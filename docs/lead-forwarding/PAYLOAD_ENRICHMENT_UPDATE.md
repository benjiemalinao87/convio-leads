# Payload Enrichment Update

**Date:** October 30, 2025
**Version:** 1.1.0
**Status:** ✅ Deployed to Production

---

## Summary

Updated the lead forwarding system to include **metadata in the JSON body** for easier partner integration and mapping. Previously, tracking information was only available in HTTP headers. Now it's available in **both** headers and the request body.

---

## What Changed

### Before (Headers Only)

```http
POST https://partner-webhook.com/leads
Content-Type: application/json
X-Forwarded-From: profitise_ws_us_general_703
X-Original-Lead-Id: 123
X-Original-Contact-Id: 456
X-Forwarding-Rule-Id: 1

{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "phone": "+14155551234",
  "zip": "90210",
  "productid": "Solar"
}
```

### After (Headers + Body Metadata)

```http
POST https://partner-webhook.com/leads
Content-Type: application/json
X-Forwarded-From: profitise_ws_us_general_703
X-Original-Lead-Id: 123
X-Original-Contact-Id: 456
X-Forwarding-Rule-Id: 1

{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "phone": "+14155551234",
  "zip": "90210",
  "productid": "Solar",
  "home_project_partner_metadata": {
    "lead_id": 123,
    "contact_id": 456,
    "forwarded_from": "profitise_ws_us_general_703",
    "rule_id": 1,
    "matched_product": "Solar",
    "matched_zip": "90210",
    "forwarded_at": "2025-10-30T12:00:00.000Z"
  }
}
```

---

## Benefits

### 1. Easier Partner Integration
Partners can access tracking data directly from the JSON body without parsing HTTP headers:

```javascript
// Simple body parsing - no header parsing needed
const { home_project_partner_metadata } = req.body
console.log(`Lead ID: ${home_project_partner_metadata.lead_id}`)
console.log(`From: ${home_project_partner_metadata.forwarded_from}`)
```

### 2. Better Deduplication
Partners can use `lead_id` to prevent processing the same lead twice:

```javascript
if (await db.exists('leads', home_project_partner_metadata.lead_id)) {
  return { success: true, duplicate: true }
}
```

### 3. Enhanced Analytics
Track which products and zip codes are performing best:

```javascript
analytics.track({
  lead_id: home_project_partner_metadata.lead_id,
  product: home_project_partner_metadata.matched_product,
  zip: home_project_partner_metadata.matched_zip,
  source: home_project_partner_metadata.forwarded_from
})
```

### 4. Backward Compatibility
Existing partner integrations continue to work without changes:
- Original payload fields remain unchanged
- `home_project_partner_metadata` is a new optional field
- Partners can ignore it if not needed

---

## Metadata Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `lead_id` | number | Internal lead ID | `123` |
| `contact_id` | number | Internal contact ID | `456` |
| `forwarded_from` | string | Source webhook ID | `profitise_ws_us_general_703` |
| `rule_id` | number | Forwarding rule that matched | `1` |
| `matched_product` | string | Product that triggered match | `Solar` |
| `matched_zip` | string | Zip code that triggered match | `90210` |
| `forwarded_at` | string | ISO 8601 timestamp | `2025-10-30T12:00:00.000Z` |

---

## Implementation Details

### Code Changes

**File Modified:** [`webhook-api/webhook-api/src/utils/lead-forwarder.ts`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts)

**Before (Lines 188-200):**
```typescript
const response = await fetch(rule.target_webhook_url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Forwarded-From': rule.source_webhook_id,
    'X-Original-Lead-Id': leadId.toString(),
    'X-Original-Contact-Id': contactId.toString(),
    'X-Forwarding-Rule-Id': rule.id.toString()
  },
  body: JSON.stringify(payload) // Original payload only
})
```

**After (Lines 190-215):**
```typescript
// Enrich payload with metadata for easy partner mapping
const enrichedPayload = {
  ...payload,
  home_project_partner_metadata: {
    lead_id: leadId,
    contact_id: contactId,
    forwarded_from: rule.source_webhook_id,
    rule_id: rule.id,
    matched_product: matchedProduct,
    matched_zip: matchedZip,
    forwarded_at: new Date().toISOString()
  }
}

const response = await fetch(rule.target_webhook_url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Forwarded-From': rule.source_webhook_id,
    'X-Original-Lead-Id': leadId.toString(),
    'X-Original-Contact-Id': contactId.toString(),
    'X-Forwarding-Rule-Id': rule.id.toString()
  },
  body: JSON.stringify(enrichedPayload) // Enriched with metadata
})
```

---

## Documentation Updates

Updated documentation files to reflect the new payload structure:

1. **[LEAD_FORWARDING_SYSTEM.md](LEAD_FORWARDING_SYSTEM.md)**
   - Added new section: "Forwarded Payload Structure"
   - Updated Table of Contents
   - Added partner integration examples
   - Updated data flow diagrams

2. **[ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)**
   - Updated HTTP POST body visualization
   - Added `home_project_partner_metadata` object to examples

---

## Deployment

| Component | Status | Details |
|-----------|--------|---------|
| **Backend** | ✅ Deployed | Worker Version: `94e9b8d3-ffa2-4af1-b5fc-e4b25700f598` |
| **Database** | ✅ No changes | No migration required |
| **Frontend** | ✅ No changes | Frontend displays logs only |
| **Documentation** | ✅ Updated | 3 files updated |

**Production URL:** `https://api.homeprojectpartners.com`

---

## Testing

### Test Forwarding with Metadata

```bash
# 1. Create a test lead
curl -X POST "https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "firstname": "Test",
    "lastname": "User",
    "email": "test@example.com",
    "phone": "5551234567",
    "zip": "90210",
    "productid": "Solar"
  }'

# 2. Check forwarding log
curl "https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703/forwarding-log?limit=1"

# 3. Verify partner received enriched payload with home_project_partner_metadata
```

### Expected Partner Response

Partners should see requests like this in their webhook logs:

```json
{
  "firstname": "Test",
  "lastname": "User",
  "email": "test@example.com",
  "phone": "+15551234567",
  "zip": "90210",
  "productid": "Solar",
  "home_project_partner_metadata": {
    "lead_id": 125,
    "contact_id": 89,
    "forwarded_from": "profitise_ws_us_general_703",
    "rule_id": 1,
    "matched_product": "Solar",
    "matched_zip": "90210",
    "forwarded_at": "2025-10-30T18:45:23.456Z"
  }
}
```

---

## Migration Guide for Partners

### No Action Required
Existing partner integrations will continue to work without any changes. The `home_project_partner_metadata` field is completely optional.

### Optional: Leverage New Metadata

Partners who want to use the new metadata can update their webhook handlers:

```javascript
// Before (still works)
app.post('/webhook', (req, res) => {
  const { firstname, lastname, email, phone } = req.body
  // Process lead...
})

// After (with metadata support)
app.post('/webhook', (req, res) => {
  const { firstname, lastname, email, phone, home_project_partner_metadata } = req.body

  // Optional: Use metadata for deduplication
  if (home_project_partner_metadata && await isDuplicate(home_project_partner_metadata.lead_id)) {
    return res.json({ success: true, duplicate: true })
  }

  // Optional: Track analytics
  if (home_project_partner_metadata) {
    analytics.track({
      lead_id: home_project_partner_metadata.lead_id,
      source: home_project_partner_metadata.forwarded_from,
      product: home_project_partner_metadata.matched_product
    })
  }

  // Process lead as before...
})
```

---

## Rollback Plan

If issues arise, rollback is simple since this is a non-breaking change:

1. **Revert Code:**
   ```bash
   cd webhook-api/webhook-api
   git revert <commit_hash>
   npm run deploy
   ```

2. **No Database Changes:** No migration to rollback

3. **Partners Unaffected:** Partners never depended on `home_project_partner_metadata`, so removal won't break integrations

---

## Related Features

This update complements existing lead forwarding features:

- ✅ **Configurable Forward Mode** - `first-match` vs `all-matches` (prevents duplicates)
- ✅ **Wildcard Catch-All Rules** - `"*"` for product types and zip codes
- ✅ **Priority-Based Routing** - Sequential rule evaluation by priority
- ✅ **Master Toggle Control** - Webhook-level enable/disable
- ✅ **Comprehensive Logging** - Full audit trail in `lead_forwarding_log`
- ✅ **Payload Enrichment** - Metadata in body + headers (this update)

---

## Support

For questions or issues:
- **Documentation:** [LEAD_FORWARDING_SYSTEM.md](LEAD_FORWARDING_SYSTEM.md)
- **Architecture:** [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)
- **Code:** [`lead-forwarder.ts`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts)

---

**Status:** ✅ Complete and Deployed
