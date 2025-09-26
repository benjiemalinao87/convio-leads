# Provider Authentication Implementation

## Overview

This document describes the implementation of provider authentication for webhook endpoints. This feature adds a required header-based authentication system that validates third-party providers before processing webhook requests.

## Implementation Details

### 1. Database Schema

A new table `lead_source_providers` has been created to store authorized provider information:

```sql
CREATE TABLE lead_source_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL,     -- Unique provider identifier
  provider_name TEXT NOT NULL,          -- Human-readable provider name
  company_name TEXT,                    -- Company/organization name
  contact_email TEXT,                   -- Contact email for provider
  api_key TEXT,                         -- Optional API key for additional auth
  is_active BOOLEAN DEFAULT 1,          -- Whether provider is active
  allowed_webhooks TEXT,                -- JSON array of allowed webhook IDs
  rate_limit INTEGER DEFAULT 1000,      -- Requests per hour limit
  notes TEXT,                           -- Internal notes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME                 -- Track last successful request
);
```

### 2. Authentication Flow

1. **Header Requirement**: All POST requests to webhook endpoints must include:
   ```http
   lead_source_provider_id: <provider_id>
   ```

2. **Validation Process**:
   - Check if `lead_source_provider_id` header is present
   - Query database for provider with matching `provider_id`
   - Verify provider is active (`is_active = 1`)
   - Check webhook-specific access (if `allowed_webhooks` is set)
   - Update `last_used_at` timestamp on successful auth

3. **No Changes to Payload**: The request body format remains unchanged

### 3. Error Responses

- **401 Unauthorized**: Missing header, invalid provider, or inactive provider
- **403 Forbidden**: Provider exists but doesn't have access to specific webhook
- **200/201 Success**: Valid provider with proper access

## Pre-configured Providers

The migration includes sample providers for testing:

| Provider ID | Name | Company | Status | Notes |
|------------|------|---------|--------|-------|
| `click_ventures_001` | Click Ventures Primary | Click Ventures LLC | Active | Primary provider |
| `click_ventures_002` | Click Ventures Solar | Click Ventures LLC | Active | Solar specialist |
| `lead_gen_pro_001` | LeadGen Pro | LeadGen Pro Inc | Active | HVAC/home improvement |
| `test_provider_999` | Test Provider | Internal Testing | Inactive | Development only |

## Usage Examples

### Valid Request (Success)
```bash
curl -X POST https://api.homeprojectpartners.com/webhook/click-ventures_ws_us_general_656 \
  -H "Content-Type: application/json" \
  -H "lead_source_provider_id: click_ventures_001" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "source": "Google Ads",
    "productid": "Solar"
  }'
```

### Invalid Request (Missing Header)
```bash
curl -X POST https://api.homeprojectpartners.com/webhook/click-ventures_ws_us_general_656 \
  -H "Content-Type: application/json" \
  -d '{"firstname": "John", "lastname": "Doe"}'
```
**Response**: HTTP 401 - "Missing provider authentication"

### Invalid Request (Unknown Provider)
```bash
curl -X POST https://api.homeprojectpartners.com/webhook/click-ventures_ws_us_general_656 \
  -H "Content-Type: application/json" \
  -H "lead_source_provider_id: unknown_provider" \
  -d '{"firstname": "John", "lastname": "Doe"}'
```
**Response**: HTTP 401 - "Provider unknown_provider is not authorized or is inactive"

## Deployment Steps

### 1. Apply Database Migration
```bash
# Apply the migration to create the providers table
cat lead-source-providers-migration.sql | sqlite3 your-database.db
```

### 2. Deploy Updated Code
- The webhook route handler has been updated with authentication logic
- CORS configuration includes the new header
- No breaking changes to existing functionality

### 3. Configure Providers
Add legitimate providers to the database:
```sql
INSERT INTO lead_source_providers (provider_id, provider_name, company_name, contact_email, is_active) 
VALUES ('your_provider_id', 'Provider Name', 'Company Inc', 'contact@provider.com', 1);
```

### 4. Update Client Code
Third-party providers must update their webhook calls to include the header:
```javascript
// Before
fetch('/webhook/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(leadData)
});

// After  
fetch('/webhook/endpoint', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'lead_source_provider_id': 'your_provider_id'
  },
  body: JSON.stringify(leadData)
});
```

## Testing

Use the provided test script to verify implementation:
```bash
./test-provider-auth.sh
```

This tests:
- ❌ Request without provider header
- ❌ Request with invalid provider
- ✅ Request with valid provider  
- ❌ Request with inactive provider
- ✅ Health check (unaffected)

## Security Benefits

1. **Access Control**: Only authorized providers can submit data
2. **Audit Trail**: Track which provider submitted each lead
3. **Selective Access**: Restrict providers to specific webhooks
4. **Rate Limiting**: Per-provider rate limits (future enhancement)
5. **Easy Deactivation**: Disable problematic providers instantly

## Backward Compatibility

- **Health Check**: GET requests are unaffected
- **Payload Format**: No changes to request body structure
- **Existing Headers**: All existing headers continue to work
- **Signature Validation**: HMAC signature validation still works

## Future Enhancements

1. **API Key Support**: Additional authentication via `api_key` field
2. **Rate Limiting**: Per-provider rate limiting using `rate_limit` field
3. **Analytics**: Provider usage tracking and reporting
4. **Webhook Restrictions**: JSON-based webhook access control
5. **Provider Management API**: CRUD operations for providers

## Monitoring

Monitor these metrics post-deployment:
- Authentication failure rates by provider
- Provider usage patterns via `last_used_at`
- Webhook access patterns
- Error rates and types

## Support

For questions or issues:
1. Check provider configuration in database
2. Verify header format and spelling
3. Confirm provider is active (`is_active = 1`)
4. Review server logs for specific error details
