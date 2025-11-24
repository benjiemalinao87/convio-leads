# Lead Forwarding System - Deep Dive Report

**Generated:** December 2024  
**System Version:** 1.0.0

---

## Executive Summary

The **Lead Forwarding System** is an automated, priority-based routing engine that distributes incoming leads to partner webhooks based on configurable matching criteria. It acts as an intelligent lead distribution hub, enabling automatic routing based on product type, geographic location (zip codes and states), and priority rules.

---

## 🏗️ System Architecture

### Core Components

1. **Backend Engine** (`webhook-api/webhook-api/src/utils/lead-forwarder.ts`)
   - Main forwarding logic
   - Criteria matching engine
   - HTTP POST delivery system
   - Audit logging

2. **API Routes** (`webhook-api/webhook-api/src/routes/lead-forwarding.ts`)
   - RESTful endpoints for rule management
   - Master toggle control
   - Statistics and logging endpoints

3. **Frontend Components**
   - `ForwardingManagementDialog.tsx` - Main management interface
   - `ForwardingRulesList.tsx` - Rules display and management
   - `CreateForwardingRuleDialog.tsx` - Rule creation wizard
   - `ForwardingLog.tsx` - Activity monitoring

4. **Database Tables**
   - `lead_forwarding_rules` - Rule configurations
   - `lead_forwarding_log` - Complete audit trail
   - `webhook_configs` - Master toggle and statistics

---

## 🔄 How Forwarding Works - Step by Step

### 1. Lead Arrival & Storage

```
Incoming Lead → Webhook Endpoint → Store in Database
                                      ↓
                              Lead ID: 123
                              Contact ID: 456
                              Product: "Solar"
                              Zip: "90210"
                              State: "CA"
```

**Location:** Triggered automatically after lead creation in `webhook.ts`

### 2. Forwarding Check Trigger

After a lead is successfully stored, the system automatically calls:

```typescript
checkAndForwardLead(
  db,
  webhookId,        // Source webhook ID
  leadId,          // 123
  contactId,       // 456
  productId,       // "Solar"
  zipCode,         // "90210"
  state,           // "CA"
  originalPayload  // Complete JSON payload
)
```

### 3. Master Toggle Check (Level 1 Control)

**First Gate:** System checks if forwarding is globally enabled for this webhook.

```sql
SELECT forwarding_enabled, forward_mode 
FROM webhook_configs 
WHERE webhook_id = ? AND is_active = 1
```

**Decision:**
- ✅ `forwarding_enabled = 1` → Continue to rule evaluation
- ❌ `forwarding_enabled = 0` → **STOP** - No forwarding occurs

**Forward Mode:**
- `first-match` - Stop after first successful forward (prevents duplicates)
- `all-matches` - Continue evaluating all rules (multi-forward)

### 4. Rule Retrieval & Sorting

**Query:**
```sql
SELECT * FROM lead_forwarding_rules
WHERE source_webhook_id = ?
  AND is_active = 1
  AND forward_enabled = 1
ORDER BY priority ASC
```

**Key Points:**
- Only active rules (`is_active = 1`) are considered
- Only enabled rules (`forward_enabled = 1`) are considered
- Rules sorted by priority (1 = highest, 999 = lowest)
- Lower number = Higher priority = Evaluated first

### 5. Criteria Matching (AND Logic)

For each rule, the system checks **ALL THREE** criteria:

#### A. Product Type Matching
```typescript
const productTypes = JSON.parse(rule.product_types) // ["Solar", "HVAC"]
const productMatch = productTypes.includes("*") ||  // Wildcard support
  (productId && productTypes.some((p: string) =>
    p.toLowerCase() === productId.toLowerCase()  // Case-insensitive
  ))
```

**Wildcard Support:**
- `["*"]` - Matches ALL products
- `["Solar", "*"]` - Matches Solar OR any product
- Case-insensitive matching

#### B. Zip Code Matching
```typescript
const zipCodes = JSON.parse(rule.zip_codes) // ["90210", "90211"]
const zipMatch = zipCodes.includes("*") ||  // Wildcard support
  (zipCode && zipCodes.includes(zipCode))  // Exact match
```

**Wildcard Support:**
- `["*"]` - Matches ALL zip codes
- Exact string matching (case-sensitive)

#### C. State Matching
```typescript
const states = JSON.parse(rule.states) // ["CA", "NY"]
const stateMatch = states.includes("*") ||  // Wildcard support
  (state && states.some((s: string) =>
    s.toUpperCase() === state.toUpperCase()  // Case-insensitive
  ))
```

**Wildcard Support:**
- `["*"]` - Matches ALL states
- Case-insensitive matching

#### Match Decision
```typescript
if (productMatch && zipMatch && stateMatch) {
  // ALL THREE must match (AND logic)
  // Forward the lead
}
```

**Truth Table:**
| Product | Zip | State | Forward? |
|---------|-----|-------|----------|
| ✅ YES | ✅ YES | ✅ YES | ✅ **YES** |
| ✅ YES | ✅ YES | ❌ NO  | ❌ NO |
| ✅ YES | ❌ NO  | ✅ YES | ❌ NO |
| ❌ NO  | ✅ YES | ✅ YES | ❌ NO |
| ❌ NO  | ❌ NO  | ❌ NO  | ❌ NO |

### 6. HTTP POST Forwarding

When a rule matches, the system performs an HTTP POST to the target webhook:

**Request:**
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
    "matched_state": "CA",
    "forwarded_at": "2025-10-30T12:00:00.000Z"
  }
}
```

**Key Features:**
- Original payload preserved (all fields intact)
- Metadata object added for tracking
- Custom HTTP headers for identification
- Partner can ignore metadata if not needed

### 7. Response Handling & Logging

**Success (HTTP 200-299):**
```typescript
await db.prepare(`
  INSERT INTO lead_forwarding_log (
    lead_id, contact_id, rule_id,
    forward_status: 'success',
    http_status_code: 200,
    ...
  )
`).run()
```

**Failure (HTTP 400+ or Exception):**
```typescript
await db.prepare(`
  INSERT INTO lead_forwarding_log (
    forward_status: 'failed',
    http_status_code: 404,
    error_message: 'Target not found',
    ...
  )
`).run()
```

### 8. Statistics Update

After successful forward:
```sql
UPDATE webhook_configs
SET auto_forward_count = auto_forward_count + 1,
    last_forwarded_at = CURRENT_TIMESTAMP
WHERE webhook_id = ?

UPDATE lead_forwarding_rules
SET forward_count = forward_count + 1
WHERE id = ?
```

### 9. Continue or Stop?

**Forward Mode: `first-match`**
- ✅ Stop after first successful forward
- Prevents duplicate lead distribution
- Recommended for most use cases

**Forward Mode: `all-matches`**
- ✅ Continue evaluating remaining rules
- Allows multi-forward to multiple partners
- Useful for backup systems or parallel processing

---

## 🎛️ Control System (Two-Level)

### Level 1: Master Toggle (Webhook-Level)

**Location:** `webhook_configs.forwarding_enabled`

**Purpose:** Global kill switch for entire webhook

**API:**
```http
PATCH /webhook/:webhookId/forwarding-toggle
{
  "forwarding_enabled": true
}
```

**Behavior:**
- `true` - All active rules can execute
- `false` - **NO rules execute**, regardless of individual settings

**UI:** Prominent green/amber banner in `ForwardingRulesList.tsx`

### Level 2: Individual Rule Toggle (Rule-Level)

**Location:** `lead_forwarding_rules.forward_enabled`

**Purpose:** Enable/disable specific rules

**API:**
```http
PUT /webhook/:webhookId/forwarding-rules/:ruleId
{
  "forward_enabled": false
}
```

**Control Matrix:**
| Master Toggle | Rule Enabled | Result |
|--------------|--------------|--------|
| ✅ ON        | ✅ ON        | ✅ **Rule Executes** |
| ✅ ON        | ❌ OFF       | ❌ Rule Skipped |
| ❌ OFF       | ✅ ON        | ❌ Rule Skipped |
| ❌ OFF       | ❌ OFF       | ❌ Rule Skipped |

---

## 📊 Priority System

### How Priority Works

**Rule:** Lower number = Higher priority = Evaluated first

```
Priority 1  → Evaluated FIRST  (Highest Priority)
Priority 2  → Evaluated SECOND
Priority 3  → Evaluated THIRD
...
Priority 999 → Evaluated LAST  (Lowest Priority - Catch-all)
```

### Priority Assignment

**Auto-Assignment:**
- If no priority provided, system assigns: `MAX(priority) + 1`
- Ensures new rules don't conflict

**Manual Assignment:**
- User can set any priority value
- System allows gaps (e.g., 1, 5, 10, 20)

### Priority Best Practices

**Recommended Ranges:**
```
Priority 1-10:   Premium/VIP partners (specific, high-value)
Priority 11-20:  Standard partners (general coverage)
Priority 21-30:  Backup/overflow partners
Priority 999:     Catch-all fallback rules
```

**Example:**
```json
// Premium Partner - Beverly Hills only
{"priority": 1, "zip_codes": ["90210", "90211"]}

// Standard Partner - Greater LA
{"priority": 11, "zip_codes": ["90001", "90002", ...]}

// Backup Partner - All uncovered areas
{"priority": 999, "zip_codes": ["*"], "product_types": ["*"]}
```

---

## 🎯 Matching Criteria Deep Dive

### Product Type Matching

**Storage:** JSON array in database
```json
["Solar", "HVAC", "Roofing"]
```

**Matching Logic:**
- Case-insensitive comparison
- Uses `.some()` for array matching
- Wildcard `"*"` matches everything

**Examples:**
```
Rule: ["Solar", "HVAC"]
Lead: "Solar"     → ✅ MATCH
Lead: "solar"     → ✅ MATCH (case-insensitive)
Lead: "Roofing"   → ❌ NO MATCH

Rule: ["*"]
Lead: "Solar"     → ✅ MATCH (wildcard)
Lead: "Anything"  → ✅ MATCH (wildcard)
```

### Zip Code Matching

**Storage:** JSON array in database
```json
["90210", "90211", "90212"]
```

**Matching Logic:**
- Exact string match
- Case-sensitive
- Uses `.includes()` for lookup
- Wildcard `"*"` matches everything

**Examples:**
```
Rule: ["90210", "90211"]
Lead: "90210"     → ✅ MATCH
Lead: "90213"     → ❌ NO MATCH

Rule: ["*"]
Lead: "90210"     → ✅ MATCH (wildcard)
Lead: "12345"     → ✅ MATCH (wildcard)
```

### State Matching

**Storage:** JSON array in database
```json
["CA", "NY", "TX"]
```

**Matching Logic:**
- Case-insensitive comparison
- Uses `.some()` for array matching
- Wildcard `"*"` matches everything

**Examples:**
```
Rule: ["CA", "NY"]
Lead: "CA"        → ✅ MATCH
Lead: "ca"        → ✅ MATCH (case-insensitive)
Lead: "TX"        → ❌ NO MATCH

Rule: ["*"]
Lead: "CA"        → ✅ MATCH (wildcard)
Lead: "AnyState"  → ✅ MATCH (wildcard)
```

### Combined Matching (AND Logic)

**Critical:** ALL THREE criteria must match

```typescript
if (productMatch && zipMatch && stateMatch) {
  // Forward lead
}
```

**Real-World Example:**
```
Rule Configuration:
- Product Types: ["Solar"]
- Zip Codes: ["90210", "90211"]
- States: ["CA"]

Lead #1:
- Product: "Solar" ✅
- Zip: "90210" ✅
- State: "CA" ✅
→ RESULT: ✅ FORWARDED

Lead #2:
- Product: "Solar" ✅
- Zip: "90210" ✅
- State: "NY" ❌
→ RESULT: ❌ NOT FORWARDED (state mismatch)

Lead #3:
- Product: "HVAC" ❌
- Zip: "90210" ✅
- State: "CA" ✅
→ RESULT: ❌ NOT FORWARDED (product mismatch)
```

---

## 📤 Forwarded Payload Structure

### HTTP Headers

Every forwarding request includes tracking headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-Forwarded-From` | Source webhook ID | `profitise_ws_us_general_703` |
| `X-Original-Lead-Id` | Internal lead ID | `123` |
| `X-Original-Contact-Id` | Internal contact ID | `456` |
| `X-Forwarding-Rule-Id` | Rule that matched | `1` |

### JSON Body

**Structure:**
```json
{
  // Original lead payload (all fields preserved)
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "phone": "+14155551234",
  "zip": "90210",
  "productid": "Solar",
  "source": "Google Ads",
  "custom_field_1": "Some value",
  
  // Metadata object (added by system)
  "home_project_partner_metadata": {
    "lead_id": 123,
    "contact_id": 456,
    "forwarded_from": "profitise_ws_us_general_703",
    "rule_id": 1,
    "matched_product": "Solar",
    "matched_zip": "90210",
    "matched_state": "CA",
    "forwarded_at": "2025-10-30T12:00:00.000Z"
  }
}
```

**Benefits for Partners:**
1. **Deduplication** - Use `lead_id` to detect duplicates
2. **Analytics** - Track performance by source
3. **Backward Compatibility** - Ignore metadata if not needed

---

## 📝 Database Schema

### `lead_forwarding_rules` Table

```sql
CREATE TABLE lead_forwarding_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_webhook_id TEXT NOT NULL,           -- Source webhook
  target_webhook_id TEXT NOT NULL,            -- Target identifier
  target_webhook_url TEXT NOT NULL,           -- Target HTTP endpoint
  product_types TEXT NOT NULL,                -- JSON: ["Solar", "HVAC"]
  zip_codes TEXT NOT NULL,                    -- JSON: ["90210", "90211"]
  states TEXT NOT NULL,                       -- JSON: ["CA", "NY"]
  priority INTEGER NOT NULL DEFAULT 1,        -- Lower = higher priority
  is_active INTEGER NOT NULL DEFAULT 1,       -- 1 = active, 0 = inactive
  forward_enabled INTEGER NOT NULL DEFAULT 1, -- 1 = enabled, 0 = disabled
  forward_count INTEGER DEFAULT 0,           -- Statistics: times executed
  notes TEXT,                                 -- Optional description
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  created_by TEXT                             -- User who created
);
```

### `lead_forwarding_log` Table

```sql
CREATE TABLE lead_forwarding_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,                  -- FK to leads
  contact_id INTEGER NOT NULL,               -- FK to contacts
  rule_id INTEGER NOT NULL,                  -- FK to rules
  source_webhook_id TEXT NOT NULL,           -- Source webhook
  target_webhook_id TEXT NOT NULL,           -- Target identifier
  target_webhook_url TEXT NOT NULL,          -- Target URL
  forwarded_at TEXT NOT NULL,                -- ISO 8601 timestamp
  forward_status TEXT NOT NULL,               -- 'success' or 'failed'
  http_status_code INTEGER,                  -- HTTP response code
  response_body TEXT,                        -- Response (truncated)
  error_message TEXT,                        -- Error details
  matched_product TEXT,                      -- Product that matched
  matched_zip TEXT,                          -- Zip that matched
  matched_state TEXT,                        -- State that matched
  payload TEXT,                              -- Original payload (JSON)
  retry_count INTEGER DEFAULT 0              -- Future: retry attempts
);
```

### `webhook_configs` Extensions

```sql
ALTER TABLE webhook_configs ADD COLUMN forwarding_enabled INTEGER DEFAULT 0;
ALTER TABLE webhook_configs ADD COLUMN forward_mode TEXT DEFAULT 'first-match';
ALTER TABLE webhook_configs ADD COLUMN auto_forward_count INTEGER DEFAULT 0;
ALTER TABLE webhook_configs ADD COLUMN last_forwarded_at TEXT;
```

---

## 🔌 API Endpoints

### 1. Create Forwarding Rule

**Endpoint:** `POST /webhook/:webhookId/forwarding-rules`

**Request:**
```json
{
  "target_webhook_id": "partner_a_webhook",
  "target_webhook_url": "https://partner-a.com/webhook",
  "product_types": ["Solar", "HVAC"],
  "zip_codes": ["90210", "90211", "90212"],
  "states": ["CA"],
  "priority": 1,
  "forward_enabled": true,
  "notes": "Beverly Hills area - Partner A"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Forwarding rule created successfully",
  "rule": {
    "id": 1,
    "source_webhook_id": "profitise_ws_us_general_703",
    "target_webhook_id": "partner_a_webhook",
    "target_webhook_url": "https://partner-a.com/webhook",
    "product_types": ["Solar", "HVAC"],
    "zip_codes": ["90210", "90211", "90212"],
    "states": ["CA"],
    "priority": 1,
    "is_active": true,
    "forward_enabled": true,
    "zip_count": 3,
    "product_count": 2
  }
}
```

### 2. Bulk Create (CSV Zip Codes)

**Endpoint:** `POST /webhook/:webhookId/forwarding-rules/bulk`

**Request:**
```json
{
  "target_webhook_id": "partner_b_webhook",
  "target_webhook_url": "https://partner-b.com/webhook",
  "product_types": ["Kitchen", "Bath"],
  "zip_codes_csv": "10001,10002,10003,10004,10005,10006",
  "states": ["NY"],
  "priority": 2,
  "notes": "NYC area - Partner B"
}
```

### 3. List Rules

**Endpoint:** `GET /webhook/:webhookId/forwarding-rules`

**Response:**
```json
{
  "success": true,
  "webhook_id": "profitise_ws_us_general_703",
  "total_rules": 2,
  "active_rules": 2,
  "rules": [...]
}
```

### 4. Update Rule

**Endpoint:** `PUT /webhook/:webhookId/forwarding-rules/:ruleId`

**Request:**
```json
{
  "forward_enabled": false,
  "priority": 3,
  "notes": "Temporarily disabled"
}
```

### 5. Delete Rule

**Endpoint:** `DELETE /webhook/:webhookId/forwarding-rules/:ruleId`

### 6. Toggle Master Forwarding

**Endpoint:** `PATCH /webhook/:webhookId/forwarding-toggle`

**Request:**
```json
{
  "forwarding_enabled": true
}
```

### 7. Get Forwarding Log

**Endpoint:** `GET /webhook/:webhookId/forwarding-log`

**Query Parameters:**
- `status` - Filter: `success` or `failed`
- `from_date` - Start date (YYYY-MM-DD)
- `to_date` - End date (YYYY-MM-DD)
- `limit` - Max results (default: 50)

### 8. Get Forwarding Statistics

**Endpoint:** `GET /webhook/:webhookId/forwarding-stats`

**Response:**
```json
{
  "success": true,
  "webhook_id": "profitise_ws_us_general_703",
  "stats": {
    "total_forwards": 150,
    "success_count": 145,
    "failed_count": 5,
    "success_rate": 96.67,
    "last_forward_at": "2025-10-30T12:00:00.000Z"
  },
  "top_targets": [
    {
      "target_webhook_id": "partner_a_webhook",
      "forward_count": 85,
      "success_count": 82
    }
  ]
}
```

---

## 🖥️ Frontend Components

### ForwardingManagementDialog

**Location:** `src/components/leads/ForwardingManagementDialog.tsx`

**Features:**
- Tabbed interface (Rules / Activity Log)
- Fetches and displays all forwarding rules
- Integrates with `ForwardingRulesList` and `ForwardingLog`

### ForwardingRulesList

**Location:** `src/components/leads/ForwardingRulesList.tsx`

**Features:**
- Master toggle banner (green/amber visual indicator)
- Summary cards (Total Rules, Active Rules, Zip Codes, Product Types)
- Rules table grouped by target webhook
- Priority badges (#1, #2, #3)
- Active/Inactive status indicators
- Actions menu (Enable/Disable, Edit, Delete)

**Key Sections:**
- Master Toggle: Lines 254-294
- Summary Cards: Lines 296-345
- Rules Table: Lines 384-590

### CreateForwardingRuleDialog

**Location:** `src/components/leads/CreateForwardingRuleDialog.tsx`

**Features:**
- Target webhook configuration
- Product type multi-select
- Zip code entry (Single/Bulk/CSV Upload tabs)
- State selection
- Priority setting
- Enable/Disable toggle
- Optional notes field
- Catch-all template button

### ForwardingLog

**Location:** `src/components/leads/ForwardingLog.tsx`

**Features:**
- Activity log table with filters
- Statistics display
- Status filtering (success/failed/all)
- Detailed log entry modal
- JSON payload viewer

---

## 🔍 Key Behaviors & Logic

### Multi-Forward Behavior

**Forward Mode: `all-matches`**
- Single lead can match multiple rules
- Each matching rule forwards to its target
- Useful for backup systems or parallel processing

**Example:**
```
Rule #1: Product=Solar, Zip=90210 → Partner A
Rule #2: Product=Solar, Zip=90210 → Partner B

Lead: Product=Solar, Zip=90210
Result: Forwarded to BOTH Partner A and Partner B
```

### First-Match Behavior

**Forward Mode: `first-match`** (Default)
- Stops after first successful forward
- Prevents duplicate lead distribution
- Recommended for most use cases

**Example:**
```
Rule #1: Product=Solar, Zip=90210 → Partner A ✅ (Matches, forwards, STOPS)
Rule #2: Product=Solar, Zip=90210 → Partner B (Never evaluated)
```

### Wildcard Support

**Product Types:**
- `["*"]` - Matches all products
- `["Solar", "*"]` - Matches Solar OR any product

**Zip Codes:**
- `["*"]` - Matches all zip codes
- Useful for catch-all rules

**States:**
- `["*"]` - Matches all states
- Useful for nationwide rules

**Catch-All Rule Example:**
```json
{
  "product_types": ["*"],
  "zip_codes": ["*"],
  "states": ["*"],
  "priority": 999,
  "notes": "Fallback for unmatched leads"
}
```

---

## 📈 Statistics & Monitoring

### Real-Time Metrics

**Per Webhook:**
- `auto_forward_count` - Total forwards executed
- `last_forwarded_at` - Last forward timestamp

**Per Rule:**
- `forward_count` - Times rule has matched and forwarded

**Per Forwarding Attempt:**
- `forward_status` - `success` or `failed`
- `http_status_code` - HTTP response code
- `error_message` - Error details if failed
- `matched_product`, `matched_zip`, `matched_state` - What matched

### Success Rate Calculation

```sql
SELECT 
  COUNT(*) as total_forwards,
  SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) as success_count,
  ROUND(
    (SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
    2
  ) as success_rate
FROM lead_forwarding_log
WHERE source_webhook_id = ?
```

---

## 🚨 Error Handling

### HTTP Errors

**404 - Target Not Found**
- Target webhook URL is incorrect or no longer exists
- **Action:** Update rule with correct URL

**401/403 - Authentication Failed**
- Target webhook requires authentication
- **Action:** Coordinate with partner for allowlisting

**500 - Target Server Error**
- Partner's webhook is experiencing issues
- **Action:** Check with partner's technical team

**Timeout**
- Target webhook took too long to respond
- **Action:** Check partner's server capacity

### Exception Handling

All errors are logged to `lead_forwarding_log` with:
- `forward_status: 'failed'`
- `error_message: 'Error details'`
- `http_status_code: null` (if exception before HTTP)

---

## 🎯 Use Cases & Examples

### Use Case 1: Geographic Distribution

**Scenario:** Forward solar leads to different partners based on zip code.

**Rules:**
```json
// Rule #1: Beverly Hills → Premium Partner
{
  "priority": 1,
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211"],
  "target_webhook_url": "https://premium-partner.com/webhook"
}

// Rule #2: West LA → Standard Partner
{
  "priority": 2,
  "product_types": ["Solar"],
  "zip_codes": ["90025", "90064"],
  "target_webhook_url": "https://standard-partner.com/webhook"
}
```

### Use Case 2: Product-Specific Routing

**Scenario:** Route different product types to specialized partners.

**Rules:**
```json
// Solar Specialist
{
  "priority": 1,
  "product_types": ["Solar"],
  "zip_codes": ["*"],
  "target_webhook_url": "https://solar-specialist.com/webhook"
}

// HVAC Specialist
{
  "priority": 1,
  "product_types": ["HVAC"],
  "zip_codes": ["*"],
  "target_webhook_url": "https://hvac-specialist.com/webhook"
}
```

### Use Case 3: Priority-Based Fallback

**Scenario:** Premium partner gets first chance, backup partner gets overflow.

**Rules:**
```json
// Premium Partner (Priority 1)
{
  "priority": 1,
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211"],
  "target_webhook_url": "https://premium.com/webhook"
}

// Backup Partner (Priority 999)
{
  "priority": 999,
  "product_types": ["*"],
  "zip_codes": ["*"],
  "target_webhook_url": "https://backup.com/webhook"
}
```

---

## 🔧 Configuration Options

### Forward Mode

**`first-match`** (Default)
- Stops after first successful forward
- Prevents duplicates
- Recommended for most cases

**`all-matches`**
- Continues evaluating all rules
- Allows multi-forward
- Useful for backup systems

**Configuration:**
```sql
UPDATE webhook_configs
SET forward_mode = 'all-matches'
WHERE webhook_id = ?
```

### Rule Priority

**Auto-Assignment:**
- If not specified, assigns `MAX(priority) + 1`
- Ensures no conflicts

**Manual Assignment:**
- User can set any value
- System allows gaps

### Wildcards

**Supported:**
- Product types: `["*"]`
- Zip codes: `["*"]`
- States: `["*"]`

**Use Cases:**
- Catch-all rules
- Nationwide coverage
- Product-agnostic routing

---

## 📊 Performance Considerations

### Optimization Strategies

1. **Limit Active Rules**
   - Keep total rules per webhook under 20
   - Disable unused rules instead of deleting

2. **Optimize Zip Code Lists**
   - Use bulk CSV import for large lists
   - Consider zip code ranges (future feature)

3. **Database Indexes**
   - Indexes on `source_webhook_id` and `priority`
   - Ensures fast rule retrieval

4. **Reduce Forwarding Targets**
   - Consolidate similar rules
   - Use partner-side routing for sub-criteria

---

## 🐛 Troubleshooting Guide

### Issue: Rules Not Executing

**Checklist:**
1. ✅ Master toggle enabled? (`forwarding_enabled = 1`)
2. ✅ Rule active? (`is_active = 1`)
3. ✅ Rule enabled? (`forward_enabled = 1`)
4. ✅ Criteria match? (Product AND Zip AND State)
5. ✅ Check logs: `/webhook/:id/forwarding-log`

### Issue: Forwarding Failed

**Common Errors:**
- **404** - Target URL incorrect
- **401/403** - Authentication required
- **500** - Partner server error
- **Timeout** - Partner server slow

**Solution:** Check `forwarding-log` for error details

### Issue: Duplicate Forwarding

**Cause:** Multiple rules matching same lead

**Solution:**
- Review rules for overlaps
- Use `first-match` mode
- Adjust priorities

---

## 🔮 Future Enhancements

### Planned Features

1. **Retry Logic**
   - Automatic retry for failed forwards
   - Exponential backoff
   - Dead letter queue

2. **Zip Code Ranges**
   ```json
   {
     "zip_code_ranges": [
       {"from": "90210", "to": "90299"}
     ]
   }
   ```

3. **Time-Based Routing**
   ```json
   {
     "active_hours": {
       "timezone": "America/Los_Angeles",
       "schedule": [
         {"day": "monday", "start": "09:00", "end": "17:00"}
       ]
     }
   }
   ```

4. **Capacity Limits**
   ```json
   {
     "capacity": {
       "max_forwards_per_day": 100,
       "max_forwards_per_hour": 10
     }
   }
   ```

5. **Advanced Matching**
   - Regex support for product types
   - Lead value thresholds
   - Custom field matching
   - Composite conditions (OR logic)

---

## 📋 Summary

### Key Takeaways

1. **Two-Level Control**
   - Master toggle (webhook-level)
   - Individual rule toggle (rule-level)

2. **AND Logic Matching**
   - Product type AND Zip code AND State must ALL match

3. **Priority-Based Evaluation**
   - Lower number = Higher priority
   - Rules evaluated sequentially

4. **Multi-Forward Capability**
   - Single lead can match multiple rules
   - Controlled by `forward_mode` setting

5. **Complete Audit Trail**
   - Every forwarding attempt logged
   - Success/failure tracking
   - Statistics and metrics

6. **Wildcard Support**
   - `"*"` matches everything
   - Useful for catch-all rules

7. **Metadata Enrichment**
   - Original payload preserved
   - Tracking metadata added
   - Partners can deduplicate

### System Strengths

✅ **Flexibility** - Route leads to multiple partners simultaneously  
✅ **Control** - Two-level toggle system for precise management  
✅ **Intelligence** - Priority-based, criteria-matching logic  
✅ **Transparency** - Complete audit trail and statistics  
✅ **Reliability** - HTTP-based delivery with status tracking  
✅ **Scalability** - Supports unlimited rules and targets  

---

**Report Generated:** December 2024  
**System Version:** 1.0.0  
**Documentation Status:** Complete

