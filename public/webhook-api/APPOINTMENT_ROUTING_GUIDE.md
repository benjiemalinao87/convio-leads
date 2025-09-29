# Appointment Routing & Forwarding Guide

## Overview

The Convio Leads Appointment System provides intelligent routing and automatic forwarding of appointments to workspace-specific webhook endpoints. This guide covers the complete appointment routing workflow, from initial receipt through final delivery to client systems.

**Key Features:**
- Automatic routing based on service type and zip code
- Priority-based rule evaluation
- Contact deduplication and lead linking
- Automatic webhook forwarding to client systems
- Comprehensive tracking and logging
- Bulk routing rule management

---

## Routing Algorithm

### Priority Order

The appointment routing system evaluates destinations in the following priority order:

1. **Explicit Workspace Override** - If `workspace_id` is provided and valid
2. **Routing Rules Matching** - Search active rules by priority (ascending)
3. **No Match Fallback** - Return error if no matching workspace found

### Matching Logic

For routing rules to match an appointment, **both** criteria must be satisfied:

- **Service Type Match**: Case-insensitive exact match against rule's `product_types` array
- **Zip Code Match**: Exact match against rule's `zip_codes` array

### Algorithm Implementation

```typescript
async function findMatchingWorkspace(
  db: D1Database,
  serviceType: string,
  customerZip: string,
  providedWorkspaceId?: string
): Promise<string | null> {
  // Priority 1: If workspace_id provided, use it (if valid)
  if (providedWorkspaceId) {
    const workspace = await db.prepare(`
      SELECT id FROM workspaces WHERE id = ? AND is_active = 1
    `).bind(providedWorkspaceId).first()

    if (workspace) {
      return providedWorkspaceId
    }
  }

  // Priority 2: Find matching routing rules
  const rules = await db.prepare(`
    SELECT workspace_id, product_types, zip_codes, priority
    FROM appointment_routing_rules
    WHERE is_active = 1
    ORDER BY priority ASC
  `).all()

  for (const rule of rules.results) {
    const productTypes: string[] = JSON.parse(rule.product_types as string)
    const zipCodes: string[] = JSON.parse(rule.zip_codes as string)

    // Check if service type matches any product in the rule
    const productMatch = productTypes.some(product =>
      product.toLowerCase() === serviceType.toLowerCase()
    )

    // Check if zip code matches exactly
    const zipMatch = zipCodes.includes(customerZip)

    if (productMatch && zipMatch) {
      return rule.workspace_id as string
    }
  }

  return null
}
```

---

## Routing Rules Management

### Creating Routing Rules

#### Basic Rule Creation

```bash
curl -X POST https://api.homeprojectpartners.com/routing-rules \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "solar_specialists_west",
    "product_types": ["Solar", "Battery Storage"],
    "zip_codes": ["90210", "90211", "90212"],
    "priority": 1,
    "is_active": true,
    "notes": "Premium solar markets in Beverly Hills area"
  }'
```

#### Bulk Rule Creation with CSV

```bash
curl -X POST https://api.homeprojectpartners.com/routing-rules/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "solar_specialists_west",
    "product_types": ["Solar"],
    "zip_codes_csv": "90001,90002,90003,90004,90005,90006,90007,90008,90009,90010",
    "priority": 2,
    "is_active": true,
    "notes": "LA County solar coverage"
  }'
```

#### Bulk Rule Creation with Base64 CSV File

```bash
curl -X POST https://api.homeprojectpartners.com/routing-rules/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "hvac_specialists_east",
    "product_types": ["HVAC", "Air Conditioning"],
    "zip_codes_file": "OTAwMDEsOTAwMDIsOTAwMDMsOTAwMDQsOTAwMDU=",
    "priority": 3,
    "is_active": true,
    "notes": "HVAC coverage from uploaded CSV"
  }'
```

### Rule Management

#### Updating Rules

```bash
curl -X PUT https://api.homeprojectpartners.com/routing-rules/12 \
  -H "Content-Type: application/json" \
  -d '{
    "product_types": ["Solar", "Battery Storage", "HVAC"],
    "zip_codes": ["90210", "90211", "90212", "90213"],
    "priority": 1,
    "is_active": true,
    "notes": "Expanded coverage area"
  }'
```

#### Viewing Rules

```bash
# Get rules for specific workspace
curl "https://api.homeprojectpartners.com/routing-rules/solar_specialists_west"

# Get all active rules
curl "https://api.homeprojectpartners.com/routing-rules?active_only=true"
```

#### Deleting Rules

```bash
curl -X DELETE https://api.homeprojectpartners.com/routing-rules/12
```

### Rule Priority Management

Rules are evaluated in **ascending priority order** (priority 1 = highest priority, priority 2 = second highest, etc.).

**Best Practices:**
- Use priority 1-10 for high-priority, specific rules (premium markets, VIP clients)
- Use priority 11-50 for standard geographic rules
- Use priority 51+ for broad coverage or fallback rules

**Example Priority Structure:**
```
Priority 1: Premium markets (90210-90212) → Premium Workspace
Priority 2: High-value zip codes (90201-90209) → Standard Workspace
Priority 10: General LA County (90000-90999) → Volume Workspace
Priority 50: California fallback (all CA zips) → Fallback Workspace
```

---

## Contact Resolution and Lead Linking

### Contact Deduplication Strategy

The appointment system prevents duplicate contacts while preserving lead relationships:

#### With `lead_id` Parameter (Recommended)

```bash
curl -X POST https://api.homeprojectpartners.com/appointments/receive \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": 7725656196,
    "customer_name": "John Doe",
    "customer_phone": "5551234567",
    "service_type": "Solar",
    "customer_zip": "90210",
    "appointment_date": "2025-10-01T14:00:00Z"
  }'
```

**Process:**
1. Find contact that owns the specified lead
2. Link appointment to existing contact and lead
3. Update lead status to "scheduled"
4. No duplicate contact created

#### Without `lead_id` Parameter

```bash
curl -X POST https://api.homeprojectpartners.com/appointments/receive \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "customer_phone": "5551234567",
    "service_type": "Solar",
    "customer_zip": "90210",
    "appointment_date": "2025-10-01T14:00:00Z"
  }'
```

**Process:**
1. Search for existing contact by normalized phone number
2. If found: Link to existing contact, create new lead
3. If not found: Create new contact and lead
4. Lead status set to "scheduled"

### Phone Number Normalization

All phone numbers are automatically normalized to E.164 format (+1XXXXXXXXXX):

```
Input Formats          → Normalized Output
"5551234567"          → "+15551234567"
"555-123-4567"        → "+15551234567"
"(555) 123-4567"      → "+15551234567"
"+1 555 123 4567"     → "+15551234567"
```

---

## Workspace Forwarding System

### Forwarding Requirements

For automatic forwarding to succeed, the target workspace must meet these criteria:

1. **Active Workspace**: `is_active = true`
2. **Webhook URL Configured**: `outbound_webhook_url` is not null
3. **Webhook Active**: `webhook_active = true`

### Forwarding Process

When an appointment is successfully routed:

1. **Workspace Validation**: Verify forwarding requirements
2. **Data Compilation**: Gather appointment, contact, and lead data
3. **Payload Construction**: Build structured webhook payload
4. **HTTP Delivery**: POST to workspace webhook URL
5. **Response Handling**: Log success/failure and update appointment
6. **Event Logging**: Record forwarding attempt in audit trail

### Forwarded Payload Structure

```json
{
  "appointment_id": 15,
  "appointment_date": "2025-10-01T14:00:00Z",
  "appointment_time": null,
  "appointment_type": "consultation",
  "appointment_status": "scheduled",
  "appointment_notes": "Customer interested in rooftop solar installation",
  "estimated_value": 25000,
  "customer": {
    "name": "John Doe",
    "phone": "5551234567",
    "email": "john.doe@example.com",
    "zip": "90210"
  },
  "service": {
    "type": "Solar"
  },
  "contact": {
    "id": 868042,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+15551234567"
  },
  "lead": {
    "id": 7725656196,
    "source": "Google Ads"
  },
  "workspace": {
    "id": "solar_specialists_west",
    "name": "Solar Specialists West Coast"
  },
  "routing": {
    "method": "auto",
    "matched_rule_id": 12,
    "rule_priority": 1
  },
  "forwarded_at": "2025-09-29T00:29:05.637Z"
}
```

### Forwarding Headers

```http
POST /webhook/appointments HTTP/1.1
Host: client-system.com
Content-Type: application/json
X-Source: appointment-routing-system
X-Appointment-ID: 15
X-Workspace-ID: solar_specialists_west
User-Agent: Convio-Appointment-Router/1.0
```

### Manual Forwarding

Appointments can be manually forwarded to different workspaces:

```bash
curl -X POST https://api.homeprojectpartners.com/appointments/15/forward \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "alternate_workspace"
  }'
```

---

## Routing Examples

### Example 1: Priority-Based Routing

**Routing Rules:**
```json
[
  {
    "id": 1,
    "workspace_id": "premium_solar_ca",
    "product_types": ["Solar"],
    "zip_codes": ["90210", "90211", "90212"],
    "priority": 1,
    "is_active": true
  },
  {
    "id": 2,
    "workspace_id": "standard_solar_ca",
    "product_types": ["Solar"],
    "zip_codes": ["90210", "90213", "90214"],
    "priority": 2,
    "is_active": true
  }
]
```

**Appointment Request:**
```json
{
  "service_type": "Solar",
  "customer_zip": "90210"
}
```

**Routing Decision:**
- Rule 1 matches: Solar ✓, 90210 ✓, Priority 1
- Rule 2 matches: Solar ✓, 90210 ✓, Priority 2
- **Result**: Route to `premium_solar_ca` (higher priority wins)

### Example 2: Service Type Mismatch

**Routing Rules:**
```json
[
  {
    "workspace_id": "hvac_specialists",
    "product_types": ["HVAC", "Air Conditioning"],
    "zip_codes": ["90210"],
    "priority": 1
  }
]
```

**Appointment Request:**
```json
{
  "service_type": "Solar",
  "customer_zip": "90210"
}
```

**Routing Decision:**
- Rule 1: Solar ≠ HVAC/AC ❌
- **Result**: No matching workspace found (error)

### Example 3: Zip Code Mismatch

**Routing Rules:**
```json
[
  {
    "workspace_id": "solar_bay_area",
    "product_types": ["Solar"],
    "zip_codes": ["94105", "94107", "94110"],
    "priority": 1
  }
]
```

**Appointment Request:**
```json
{
  "service_type": "Solar",
  "customer_zip": "90210"
}
```

**Routing Decision:**
- Rule 1: Solar ✓, but 90210 ∉ [94105, 94107, 94110] ❌
- **Result**: No matching workspace found (error)

### Example 4: Case-Insensitive Service Matching

**Routing Rules:**
```json
[
  {
    "workspace_id": "solar_team",
    "product_types": ["SOLAR", "Battery"],
    "zip_codes": ["90210"],
    "priority": 1
  }
]
```

**Appointment Request:**
```json
{
  "service_type": "solar",
  "customer_zip": "90210"
}
```

**Routing Decision:**
- Rule 1: "solar" matches "SOLAR" (case-insensitive) ✓, 90210 ✓
- **Result**: Route to `solar_team`

---

## Error Handling and Troubleshooting

### Common Routing Errors

#### No Matching Workspace

**Error Response:**
```json
{
  "success": false,
  "error": "No matching workspace found",
  "criteria": {
    "service_type": "Solar",
    "customer_zip": "90210",
    "provided_workspace_id": null
  },
  "available_rules": [
    {
      "workspace_id": "hvac_team",
      "product_types": ["HVAC"],
      "zip_codes": ["90211", "90212"]
    }
  ]
}
```

**Troubleshooting:**
1. Check if routing rules exist for the service type
2. Verify zip code is covered by existing rules
3. Ensure rules are active (`is_active = true`)
4. Check rule priority conflicts

#### Invalid Workspace Override

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid workspace_id",
  "provided_workspace_id": "inactive_workspace",
  "reason": "Workspace not found or inactive"
}
```

**Troubleshooting:**
1. Verify workspace exists in database
2. Check workspace is active (`is_active = true`)
3. Ensure workspace ID spelling is correct

#### Invalid Lead ID

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid lead_id: Lead not found",
  "provided_lead_id": 7725656196
}
```

**Troubleshooting:**
1. Verify lead exists in database
2. Check lead hasn't been deleted
3. Ensure lead ID is correct format (number)

### Forwarding Errors

#### Webhook Configuration Missing

**Log Entry:**
```json
{
  "appointment_id": 15,
  "forward_status": "failed",
  "forward_error": "No active webhook URL configured for workspace",
  "workspace_id": "solar_team"
}
```

**Resolution:**
1. Configure `outbound_webhook_url` for workspace
2. Set `webhook_active = true`
3. Verify workspace is active

#### Webhook Delivery Failure

**Log Entry:**
```json
{
  "appointment_id": 15,
  "forward_status": "failed",
  "forward_error": "HTTP 500: Internal Server Error",
  "forward_attempts": 1,
  "webhook_url": "https://client.com/webhook"
}
```

**Resolution:**
1. Check client webhook endpoint is responding
2. Verify webhook endpoint accepts JSON POST requests
3. Check client system logs for processing errors
4. Use manual forwarding to retry delivery

---

## Monitoring and Analytics

### Forwarding Status Tracking

Each appointment tracks forwarding status:

- **`forward_status`**: "pending", "success", "failed"
- **`forward_attempts`**: Number of delivery attempts
- **`forward_response`**: Response from client webhook (truncated)
- **`forwarded_at`**: Timestamp of successful delivery

### Routing Analytics

Query routing effectiveness:

```bash
# Get appointments by routing method
curl "https://api.homeprojectpartners.com/appointments?routing_method=auto&limit=100"

# Get forwarding success rate
curl "https://api.homeprojectpartners.com/appointments/analytics/forwarding"

# Get appointments by workspace
curl "https://api.homeprojectpartners.com/appointments?workspace_id=solar_specialists_west"
```

### Event Logging

All routing and forwarding events are logged to `appointment_events`:

```sql
SELECT
  ae.appointment_id,
  ae.event_type,
  ae.event_data,
  ae.created_at,
  a.customer_name,
  a.service_type,
  a.matched_workspace_id
FROM appointment_events ae
JOIN appointments a ON ae.appointment_id = a.id
WHERE ae.event_type IN ('appointment_created', 'appointment_routed', 'appointment_forwarded')
ORDER BY ae.created_at DESC;
```

---

## Database Schema

### Core Tables

#### `appointments`
```sql
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  lead_id INTEGER,
  appointment_type TEXT DEFAULT 'consultation',
  scheduled_at DATETIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_type TEXT NOT NULL,
  customer_zip TEXT NOT NULL,
  estimated_value INTEGER,
  matched_workspace_id TEXT NOT NULL,
  routing_method TEXT DEFAULT 'auto',
  forward_status TEXT DEFAULT 'pending',
  forward_attempts INTEGER DEFAULT 0,
  forward_response TEXT,
  forwarded_at DATETIME,
  appointment_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `appointment_routing_rules`
```sql
CREATE TABLE appointment_routing_rules (
  id INTEGER PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  product_types TEXT NOT NULL, -- JSON array
  zip_codes TEXT NOT NULL,     -- JSON array
  priority INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `workspaces`
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  outbound_webhook_url TEXT,
  webhook_active BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Foreign Key Relationships

```
contacts.id → appointments.contact_id (1:M)
leads.id → appointments.lead_id (1:1)
workspaces.id → appointments.matched_workspace_id (1:M)
workspaces.id → appointment_routing_rules.workspace_id (1:M)
appointments.id → appointment_events.appointment_id (1:M)
```

---

## Best Practices

### Routing Rule Design

1. **Hierarchical Priority Structure**
   - Use low numbers (1-10) for premium/specific rules
   - Use medium numbers (11-50) for standard geographic coverage
   - Use high numbers (51+) for broad fallback rules

2. **Comprehensive Coverage**
   - Include fallback rules for broad geographic areas
   - Consider overlapping coverage with different priorities
   - Plan for service type variations and aliases

3. **Performance Optimization**
   - Keep active rules to minimum necessary
   - Use bulk operations for large zip code lists
   - Regularly audit and remove unused rules

### Workspace Configuration

1. **Webhook Reliability**
   - Implement robust webhook endpoints with proper error handling
   - Use HTTPS for webhook URLs
   - Implement idempotency for duplicate appointment handling

2. **Monitoring Setup**
   - Monitor webhook response times and success rates
   - Set up alerts for forwarding failures
   - Regularly test webhook endpoints

### Contact Management

1. **Lead Linking Strategy**
   - Always provide `lead_id` when linking to existing leads
   - Use phone number normalization for deduplication
   - Implement proper contact merge strategies for edge cases

2. **Data Quality**
   - Validate phone numbers before submission
   - Ensure consistent service type naming across systems
   - Maintain accurate zip code data

---

## API Integration Examples

### Complete Workflow Example

```bash
# 1. Create routing rule
curl -X POST https://api.homeprojectpartners.com/routing-rules \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "solar_west_coast",
    "product_types": ["Solar", "Battery Storage"],
    "zip_codes": ["90210", "90211", "90212"],
    "priority": 1,
    "is_active": true,
    "notes": "Premium solar markets"
  }'

# 2. Submit appointment (will auto-route based on rule above)
curl -X POST https://api.homeprojectpartners.com/appointments/receive \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": 7725656196,
    "customer_name": "John Doe",
    "customer_phone": "5551234567",
    "customer_email": "john@example.com",
    "service_type": "Solar",
    "customer_zip": "90210",
    "appointment_date": "2025-10-01T14:00:00Z",
    "estimated_value": 25000,
    "appointment_notes": "Interested in 10kW system"
  }'

# 3. Check routing result
curl "https://api.homeprojectpartners.com/appointments/15"

# 4. Manually forward if needed
curl -X POST https://api.homeprojectpartners.com/appointments/15/forward \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "alternate_workspace"
  }'
```

### Bulk Rule Management

```bash
# Create multiple rules for different regions
for region in "north_ca" "south_ca" "central_ca"; do
  curl -X POST https://api.homeprojectpartners.com/routing-rules/bulk \
    -H "Content-Type: application/json" \
    -d "{
      \"workspace_id\": \"solar_${region}\",
      \"product_types\": [\"Solar\"],
      \"zip_codes_csv\": \"$(cat ${region}_zips.csv)\",
      \"priority\": 10,
      \"is_active\": true,
      \"notes\": \"Auto-generated rule for ${region}\"
    }"
done
```

---

## Support and Troubleshooting

### Common Issues and Solutions

**Issue**: Appointments not routing correctly
- **Check**: Verify routing rules are active and cover the service type/zip combination
- **Solution**: Update rules or create new ones for uncovered areas

**Issue**: Forwarding failures
- **Check**: Workspace webhook configuration and endpoint availability
- **Solution**: Update webhook URL or troubleshoot client endpoint

**Issue**: Duplicate contacts being created
- **Check**: Whether `lead_id` is being provided for existing leads
- **Solution**: Always include `lead_id` when linking to existing leads

### Debugging Tools

1. **Rule Testing**: Use routing rules endpoints to verify coverage
2. **Manual Forwarding**: Test workspace webhooks independently
3. **Event Logs**: Review `appointment_events` for detailed tracking
4. **Analytics**: Monitor routing success rates and patterns

### Contact Information

For technical support with the appointment routing system:
- Review this documentation
- Check the API documentation for endpoint details
- Examine database logs for specific error details
- Test routing rules and workspace configurations systematically

---

*Last Updated: 2025-09-29*
*API Version: 1.0.0*