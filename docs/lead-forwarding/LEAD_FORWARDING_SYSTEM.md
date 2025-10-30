# Lead Forwarding System Documentation

**Home Project Partners - Leads Management System**
**Version:** 1.0.0
**Last Updated:** October 30, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Priority & Routing Logic](#priority--routing-logic)
4. [Control System](#control-system)
5. [Matching Criteria](#matching-criteria)
6. [Data Flow](#data-flow)
7. [Forwarded Payload Structure](#forwarded-payload-structure)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [Frontend Components](#frontend-components)
11. [Examples](#examples)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The **Lead Forwarding System** is a sophisticated, priority-based routing mechanism that automatically distributes incoming leads to partner webhooks based on configurable criteria. This enables the Home Project Partners platform to act as a lead distribution hub, intelligently routing leads to the right partners based on product type and geographic location.

### Key Features

- ✅ **Priority-Based Sequential Evaluation** - Rules processed in order (lowest number = highest priority)
- ✅ **Multi-Forward Capability** - Single lead can match and forward to multiple destinations
- ✅ **Two-Level Control** - Master toggle (webhook-level) + individual rule toggle (rule-level)
- ✅ **Criteria Matching** - Product type AND zip code must both match
- ✅ **Complete Audit Trail** - Every forwarding attempt logged with status and metadata
- ✅ **Real-Time Statistics** - Success rates, forwarding counts, and performance metrics
- ✅ **HTTP POST Forwarding** - Industry-standard webhook delivery with custom headers

### Business Use Case

**Scenario:** You receive solar leads from a provider like "Profitise" and want to automatically forward qualified leads to multiple partner companies based on their service areas and product specializations.

**Solution:** Configure forwarding rules that evaluate each incoming lead and automatically POST the lead data to matching partner webhook endpoints.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEAD FORWARDING SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│   Lead Arrives   │────────▶│  Store in D1     │
│   via Webhook    │         │  Database        │
└──────────────────┘         └────────┬─────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │  Check Master Toggle     │
                        │  forwarding_enabled = 1? │
                        └─────────┬────────────────┘
                                  │ YES
                                  ▼
                        ┌──────────────────────────┐
                        │  Fetch Active Rules      │
                        │  ORDER BY priority ASC   │
                        └─────────┬────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────────┐
                        │  For Each Rule:          │
                        │  ┌──────────────────┐    │
                        │  │ Product Match?   │    │
                        │  └────────┬─────────┘    │
                        │           │ YES          │
                        │           ▼              │
                        │  ┌──────────────────┐    │
                        │  │ Zip Code Match?  │    │
                        │  └────────┬─────────┘    │
                        │           │ YES          │
                        │           ▼              │
                        │  ┌──────────────────┐    │
                        │  │ FORWARD LEAD     │    │
                        │  └──────────────────┘    │
                        └─────────┬────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────────┐
                        │  HTTP POST to Target     │
                        │  target_webhook_url      │
                        └─────────┬────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────────┐
                        │  Log Result in           │
                        │  lead_forwarding_log     │
                        └─────────┬────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────────┐
                        │  Continue to Next Rule   │
                        │  (Multi-Forward)         │
                        └──────────────────────────┘
```

### File Locations

**Backend (API):**
- **Core Forwarding Logic**: [`webhook-api/webhook-api/src/utils/lead-forwarder.ts`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts)
- **API Routes**: [`webhook-api/webhook-api/src/routes/lead-forwarding.ts`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts)
- **Integration Point**: Called from lead creation in webhook route

**Frontend (React):**
- **Rules List Component**: [`src/components/leads/ForwardingRulesList.tsx`](../../src/components/leads/ForwardingRulesList.tsx)
- **Create Rule Dialog**: [`src/components/leads/CreateForwardingRuleDialog.tsx`](../../src/components/leads/CreateForwardingRuleDialog.tsx)
- **Webhook Detail Page**: Shows forwarding management interface

---

## Priority & Routing Logic

### How Priority Works

Priority is a **numeric value** that determines the order in which rules are evaluated:

```
Priority 1 → Evaluated FIRST  (Highest Priority)
Priority 2 → Evaluated SECOND
Priority 3 → Evaluated THIRD
...
Priority N → Evaluated LAST   (Lowest Priority)
```

**Key Characteristics:**
- **Lower Number = Higher Priority** (Rule #1 is checked before Rule #2)
- **Sequential Evaluation** - Rules are processed one by one in priority order
- **Does NOT Stop After First Match** - All matching rules execute (multi-forward behavior)
- **Auto-Assignment** - If no priority specified, system assigns next available number

### Priority Assignment Algorithm

From [`lead-forwarding.ts:71-78`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L71-L78):

```typescript
// If no priority provided, auto-assigns next available
const maxPriority = await db.prepare(`
  SELECT MAX(priority) as max_priority
  FROM lead_forwarding_rules
  WHERE source_webhook_id = ?
`).bind(webhookId).first()

priority = (maxPriority?.max_priority as number || 0) + 1
```

### Routing Evaluation Flow

From [`lead-forwarder.ts:85-134`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L85-L134):

```typescript
// Step 1: Get active forwarding rules sorted by priority
const { results: rules } = await db.prepare(`
  SELECT * FROM lead_forwarding_rules
  WHERE source_webhook_id = ?
    AND is_active = 1
    AND forward_enabled = 1
  ORDER BY priority ASC
`).bind(webhookId).all()

// Step 2: Check each rule for criteria match
for (const rule of rules as unknown as ForwardingRule[]) {
  const productTypes = JSON.parse(rule.product_types)
  const zipCodes = JSON.parse(rule.zip_codes)

  // Both criteria must match (AND logic)
  const productMatch = productId && productTypes.some((p: string) =>
    p.toLowerCase() === productId.toLowerCase()
  )
  const zipMatch = zipCode && zipCodes.includes(zipCode)

  if (productMatch && zipMatch) {
    // FORWARD THE LEAD
    await forwardLeadToWebhook(...)

    // NOTE: No 'break' statement - continues to next rule!
  }
}
```

**Critical Behavior:** The system does **NOT** stop after the first match. All matching rules are executed, allowing leads to be forwarded to multiple partners simultaneously.

---

## Control System

The system uses a **two-level control mechanism** for fine-grained forwarding management:

### Level 1: Master Toggle (Webhook-Level)

**Location:** `webhook_configs.forwarding_enabled`

This is the **master kill switch** that controls ALL forwarding for a specific webhook.

```
┌─────────────────────────────────────────────────────────┐
│  Master Toggle: ENABLED                                 │
│  ✅ All active rules will execute when leads arrive     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Master Toggle: DISABLED                                │
│  ❌ NO rules execute, regardless of individual settings │
└─────────────────────────────────────────────────────────┘
```

**API Endpoint:**
```http
PATCH /webhook/:webhookId/forwarding-toggle
Content-Type: application/json

{
  "forwarding_enabled": true
}
```

**Code Reference:** [`lead-forwarding.ts:519-573`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L519-L573)

**Check Logic:** [`lead-forwarder.ts:58-66`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L58-L66)

```typescript
// Check if forwarding is enabled for this webhook
const webhookConfig = await db.prepare(`
  SELECT forwarding_enabled FROM webhook_configs
  WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
`).bind(webhookId).first()

if (!webhookConfig || !webhookConfig.forwarding_enabled) {
  console.log(`Forwarding disabled for webhook ${webhookId}`)
  return result
}
```

### Level 2: Individual Rule Toggle (Rule-Level)

**Location:** `lead_forwarding_rules.forward_enabled`

Controls whether a **specific rule** executes, even when master toggle is ON.

```
Master Toggle: ✅ ENABLED
├── Rule #1 (Priority 1): ✅ ENABLED  → Will Execute
├── Rule #2 (Priority 2): ❌ DISABLED → Will Skip
└── Rule #3 (Priority 3): ✅ ENABLED  → Will Execute
```

**API Endpoint:**
```http
PUT /webhook/:webhookId/forwarding-rules/:ruleId
Content-Type: application/json

{
  "forward_enabled": true
}
```

**Code Reference:** [`lead-forwarding.ts:358-463`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L358-L463)

### Control Matrix

| Master Toggle | Rule Enabled | Result |
|--------------|--------------|--------|
| ✅ ON        | ✅ ON        | ✅ **Rule Executes** |
| ✅ ON        | ❌ OFF       | ❌ Rule Skipped |
| ❌ OFF       | ✅ ON        | ❌ Rule Skipped |
| ❌ OFF       | ❌ OFF       | ❌ Rule Skipped |

**UI Display:** [`ForwardingRulesList.tsx:251-290`](../../src/components/leads/ForwardingRulesList.tsx#L251-L290)

The frontend shows a prominent green/amber banner indicating master toggle status, with individual rule status badges in the table.

---

## Matching Criteria

For a lead to be forwarded via a rule, **BOTH** criteria must match:

```
Product Type Match  AND  Zip Code Match  =  FORWARD
```

### Product Type Matching

**Storage Format:** JSON array in database

```json
["Solar", "HVAC", "Roofing"]
```

**Matching Logic:**
- **Case-Insensitive** - "Solar" matches "solar", "SOLAR", "SoLaR"
- **Any Match** - If lead's product matches ANY product in the rule, criteria is satisfied
- **Uses `.some()`** - Array method for efficient matching

**Code:** [`lead-forwarder.ts:91-93`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L91-L93)

```typescript
const productMatch = productId && productTypes.some((p: string) =>
  p.toLowerCase() === productId.toLowerCase()
)
```

**Example:**

```
Rule Product Types: ["Solar", "HVAC"]
Lead Product: "Solar"
Result: ✅ MATCH
```

```
Rule Product Types: ["Kitchen", "Bath"]
Lead Product: "Solar"
Result: ❌ NO MATCH
```

### Zip Code Matching

**Storage Format:** JSON array in database

```json
["90210", "90211", "90212"]
```

**Matching Logic:**
- **Exact String Match** - "90210" only matches "90210"
- **Case-Sensitive** - Standard zip code comparison
- **Uses `.includes()`** - Array method for efficient lookup

**Code:** [`lead-forwarder.ts:94`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L94)

```typescript
const zipMatch = zipCode && zipCodes.includes(zipCode)
```

**Example:**

```
Rule Zip Codes: ["90210", "90211", "90212"]
Lead Zip Code: "90210"
Result: ✅ MATCH
```

```
Rule Zip Codes: ["90210", "90211", "90212"]
Lead Zip Code: "90213"
Result: ❌ NO MATCH
```

### Combined Criteria (AND Logic)

**Code:** [`lead-forwarder.ts:96-98`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L96-L98)

```typescript
// Both criteria must match (AND logic)
if (productMatch && zipMatch) {
  console.log(`Rule ${rule.id} matched for lead ${leadId}`)
  // FORWARD THE LEAD
}
```

**Truth Table:**

| Product Match | Zip Match | Forward? |
|--------------|-----------|----------|
| ✅ YES       | ✅ YES    | ✅ **YES** |
| ✅ YES       | ❌ NO     | ❌ NO |
| ❌ NO        | ✅ YES    | ❌ NO |
| ❌ NO        | ❌ NO     | ❌ NO |

---

## Data Flow

### Complete Lead Forwarding Flow

```
1️⃣  LEAD ARRIVES
    ↓
    POST /webhook/profitise_ws_us_general_703
    {
      "firstname": "John",
      "lastname": "Doe",
      "productid": "Solar",
      "zip": "90210"
    }

2️⃣  LEAD STORED
    ↓
    INSERT INTO contacts ...
    INSERT INTO leads ...
    ↓
    lead_id: 123
    contact_id: 456

3️⃣  FORWARDING CHECK
    ↓
    checkAndForwardLead() triggered
    ↓
    ┌─────────────────────────────────┐
    │ Is forwarding_enabled = 1?      │
    │ (Master Toggle Check)           │
    └─────────┬───────────────────────┘
              │ YES
              ▼
    ┌─────────────────────────────────┐
    │ Get active rules for webhook    │
    │ ORDER BY priority ASC           │
    └─────────┬───────────────────────┘
              │
              │ Rule #1 (Priority 1)
              ▼
    ┌─────────────────────────────────┐
    │ Product: ["Solar"]              │
    │ Zip: ["90210", "90211"]         │
    │                                 │
    │ Lead Product: "Solar" ✅        │
    │ Lead Zip: "90210" ✅            │
    │                                 │
    │ BOTH MATCH → FORWARD            │
    └─────────┬───────────────────────┘
              │
              ▼
4️⃣  HTTP POST TO TARGET
    ↓
    POST https://partner-a.com/webhook
    Headers:
      Content-Type: application/json
      X-Forwarded-From: profitise_ws_us_general_703
      X-Original-Lead-Id: 123
      X-Original-Contact-Id: 456
      X-Forwarding-Rule-Id: 1
    Body:
      {
        ...original lead payload...,
        "home_project_partner_metadata": {
          "lead_id": 123,
          "contact_id": 456,
          "forwarded_from": "profitise_ws_us_general_703",
          "rule_id": 1,
          "matched_product": "Solar",
          "matched_zip": "90210",
          "forwarded_at": "2025-10-30T12:00:00Z"
        }
      }
    ↓
    Response: HTTP 200 OK

5️⃣  LOG RESULT
    ↓
    INSERT INTO lead_forwarding_log (
      lead_id: 123,
      contact_id: 456,
      rule_id: 1,
      forward_status: 'success',
      http_status_code: 200,
      ...
    )

6️⃣  UPDATE STATISTICS
    ↓
    UPDATE webhook_configs
    SET auto_forward_count = auto_forward_count + 1,
        last_forwarded_at = CURRENT_TIMESTAMP

7️⃣  CONTINUE TO NEXT RULE
    ↓
    Rule #2 (Priority 2)
    ↓
    (If matches, forward again to different target)
```

### Integration Point

The forwarding system is triggered automatically when a lead is created via webhook:

**Location:** [`webhook-api/webhook-api/src/routes/webhook.ts`](../../webhook-api/webhook-api/src/routes/webhook.ts)

```typescript
import { checkAndForwardLead } from '../utils/lead-forwarder'

// After lead creation...
const forwardingResult = await checkAndForwardLead(
  c.env.LEADS_DB,
  webhookId,
  leadId,
  contactId,
  leadData.productid,
  leadData.zip,
  originalPayload
)
```

---

## Forwarded Payload Structure

### What Partners Receive

When a lead is forwarded to a partner webhook, they receive the **original lead payload** enriched with **metadata** for tracking and deduplication.

#### HTTP Headers (Metadata)

All forwarding requests include tracking information in HTTP headers:

```http
Content-Type: application/json
X-Forwarded-From: profitise_ws_us_general_703
X-Original-Lead-Id: 123
X-Original-Contact-Id: 456
X-Forwarding-Rule-Id: 1
```

| Header | Description | Example |
|--------|-------------|---------|
| `X-Forwarded-From` | Source webhook ID | `profitise_ws_us_general_703` |
| `X-Original-Lead-Id` | Your internal lead ID | `123` |
| `X-Original-Contact-Id` | Your internal contact ID | `456` |
| `X-Forwarding-Rule-Id` | Which rule triggered the forward | `1` |

#### JSON Body (Original Payload + Metadata)

The request body contains the **complete original lead data** plus a `home_project_partner_metadata` object:

```json
{
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "phone": "+14155551234",
  "zip": "90210",
  "productid": "Solar",
  "source": "Google Ads",
  "custom_field_1": "Some value",
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

### Metadata Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `lead_id` | number | Your internal lead ID for reference |
| `contact_id` | number | Your internal contact ID for tracking |
| `forwarded_from` | string | Source webhook identifier |
| `rule_id` | number | Forwarding rule that matched |
| `matched_product` | string | Product type that triggered the match |
| `matched_zip` | string | Zip code that triggered the match |
| `forwarded_at` | string | ISO 8601 timestamp of forwarding |

### Partner Integration Benefits

#### Deduplication
Partners can use `lead_id` to detect and handle duplicate deliveries:

```javascript
// Example partner webhook handler
app.post('/webhook', (req, res) => {
  const { home_project_partner_metadata } = req.body

  // Check if we've already received this lead
  if (await isLeadProcessed(home_project_partner_metadata.lead_id)) {
    console.log(`Duplicate lead ${home_project_partner_metadata.lead_id} - skipping`)
    return res.json({ success: true, duplicate: true })
  }

  // Process new lead...
})
```

#### Analytics & Reporting
Track performance by source webhook:

```javascript
// Track conversion by source
analytics.track({
  source: req.body.home_project_partner_metadata.forwarded_from,
  product: req.body.home_project_partner_metadata.matched_product,
  lead_id: req.body.home_project_partner_metadata.lead_id
})
```

#### Backward Compatibility
Partners who don't need the metadata can simply ignore the `home_project_partner_metadata` field:

```javascript
// Existing partner code continues to work
const { firstname, lastname, email, phone } = req.body
// home_project_partner_metadata is safely ignored
```

### Complete Example Request

```bash
curl -X POST https://partner-webhook.com/leads \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-From: profitise_ws_us_general_703" \
  -H "X-Original-Lead-Id: 123" \
  -H "X-Original-Contact-Id: 456" \
  -H "X-Forwarding-Rule-Id: 1" \
  -d '{
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
  }'
```

**Code Implementation:** [`lead-forwarder.ts:190-202`](../../webhook-api/webhook-api/src/utils/lead-forwarder.ts#L190-L202)

---

## API Reference

### Core Endpoints

#### 1. Create Forwarding Rule

**Endpoint:** `POST /webhook/:webhookId/forwarding-rules`

**Request:**
```json
{
  "target_webhook_id": "partner_a_webhook",
  "target_webhook_url": "https://partner-a.com/webhook",
  "product_types": ["Solar", "HVAC"],
  "zip_codes": ["90210", "90211", "90212"],
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
    "priority": 1,
    "is_active": true,
    "forward_enabled": true,
    "zip_count": 3,
    "product_count": 2
  }
}
```

**Code:** [`lead-forwarding.ts:35-129`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L35-L129)

---

#### 2. Create Bulk Forwarding Rule (CSV Zip Codes)

**Endpoint:** `POST /webhook/:webhookId/forwarding-rules/bulk`

**Request:**
```json
{
  "target_webhook_id": "partner_b_webhook",
  "target_webhook_url": "https://partner-b.com/webhook",
  "product_types": ["Kitchen", "Bath"],
  "zip_codes_csv": "10001,10002,10003,10004,10005,10006",
  "priority": 2,
  "notes": "NYC area - Partner B"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Forwarding rule created successfully with 6 zip codes",
  "rule": {
    "id": 2,
    "zip_count": 6,
    "product_count": 2
  }
}
```

**Code:** [`lead-forwarding.ts:135-244`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L135-L244)

---

#### 3. Get Forwarding Rules

**Endpoint:** `GET /webhook/:webhookId/forwarding-rules`

**Response:**
```json
{
  "success": true,
  "webhook_id": "profitise_ws_us_general_703",
  "total_rules": 2,
  "active_rules": 2,
  "rules": [
    {
      "id": 1,
      "priority": 1,
      "product_types": ["Solar", "HVAC"],
      "zip_codes": ["90210", "90211", "90212"],
      "is_active": true,
      "forward_enabled": true
    }
  ]
}
```

**Code:** [`lead-forwarding.ts:251-296`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L251-L296)

---

#### 4. Update Forwarding Rule

**Endpoint:** `PUT /webhook/:webhookId/forwarding-rules/:ruleId`

**Request:**
```json
{
  "forward_enabled": false,
  "priority": 3,
  "notes": "Temporarily disabled for maintenance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Forwarding rule updated successfully",
  "rule": {
    "id": 1,
    "forward_enabled": false,
    "priority": 3,
    "updated_at": "2025-10-30T12:00:00.000Z"
  }
}
```

**Code:** [`lead-forwarding.ts:358-463`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L358-L463)

---

#### 5. Delete Forwarding Rule

**Endpoint:** `DELETE /webhook/:webhookId/forwarding-rules/:ruleId`

**Response:**
```json
{
  "success": true,
  "message": "Forwarding rule deleted successfully",
  "rule_id": 1
}
```

**Code:** [`lead-forwarding.ts:470-512`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L470-L512)

---

#### 6. Toggle Master Forwarding

**Endpoint:** `PATCH /webhook/:webhookId/forwarding-toggle`

**Request:**
```json
{
  "forwarding_enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead forwarding enabled for webhook",
  "webhook_id": "profitise_ws_us_general_703",
  "forwarding_enabled": true
}
```

**Code:** [`lead-forwarding.ts:519-573`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L519-L573)

---

#### 7. Get Forwarding Activity Log

**Endpoint:** `GET /webhook/:webhookId/forwarding-log`

**Query Parameters:**
- `status` - Filter by `success` or `failed`
- `from_date` - Start date (YYYY-MM-DD)
- `to_date` - End date (YYYY-MM-DD)
- `limit` - Max results (default: 50)

**Response:**
```json
{
  "success": true,
  "webhook_id": "profitise_ws_us_general_703",
  "total_logs": 25,
  "logs": [
    {
      "id": 1,
      "lead_id": 123,
      "contact_id": 456,
      "rule_id": 1,
      "target_webhook_id": "partner_a_webhook",
      "forward_status": "success",
      "http_status_code": 200,
      "forwarded_at": "2025-10-30T10:15:00.000Z",
      "matched_product": "Solar",
      "matched_zip": "90210"
    }
  ]
}
```

**Code:** [`lead-forwarding.ts:579-633`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L579-L633)

---

#### 8. Get Forwarding Statistics

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
    },
    {
      "target_webhook_id": "partner_b_webhook",
      "forward_count": 65,
      "success_count": 63
    }
  ]
}
```

**Code:** [`lead-forwarding.ts:640-701`](../../webhook-api/webhook-api/src/routes/lead-forwarding.ts#L640-L701)

---

## Database Schema

### `lead_forwarding_rules` Table

Stores forwarding rule configurations.

```sql
CREATE TABLE lead_forwarding_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_webhook_id TEXT NOT NULL,           -- Webhook receiving leads
  target_webhook_id TEXT NOT NULL,           -- Target webhook identifier
  target_webhook_url TEXT NOT NULL,          -- Target HTTP endpoint
  product_types TEXT NOT NULL,               -- JSON array: ["Solar", "HVAC"]
  zip_codes TEXT NOT NULL,                   -- JSON array: ["90210", "90211"]
  priority INTEGER NOT NULL DEFAULT 1,       -- Lower = higher priority
  is_active INTEGER NOT NULL DEFAULT 1,      -- 1 = active, 0 = inactive
  forward_enabled INTEGER NOT NULL DEFAULT 1,-- 1 = enabled, 0 = disabled
  notes TEXT,                                -- Optional description
  created_at TEXT NOT NULL,                  -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                  -- ISO 8601 timestamp
  created_by TEXT                            -- User who created rule
);

-- Indexes for performance
CREATE INDEX idx_forwarding_rules_source ON lead_forwarding_rules(source_webhook_id);
CREATE INDEX idx_forwarding_rules_priority ON lead_forwarding_rules(priority);
CREATE INDEX idx_forwarding_rules_active ON lead_forwarding_rules(is_active, forward_enabled);
```

---

### `lead_forwarding_log` Table

Complete audit trail of all forwarding attempts.

```sql
CREATE TABLE lead_forwarding_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,                  -- FK to leads table
  contact_id INTEGER NOT NULL,               -- FK to contacts table
  rule_id INTEGER NOT NULL,                  -- FK to lead_forwarding_rules
  source_webhook_id TEXT NOT NULL,           -- Source webhook
  target_webhook_id TEXT NOT NULL,           -- Target webhook ID
  target_webhook_url TEXT NOT NULL,          -- Target URL
  forwarded_at TEXT NOT NULL,                -- ISO 8601 timestamp
  forward_status TEXT NOT NULL,              -- 'success' or 'failed'
  http_status_code INTEGER,                  -- HTTP response code (200, 404, etc.)
  response_body TEXT,                        -- Response from target (truncated)
  error_message TEXT,                        -- Error details if failed
  matched_product TEXT,                      -- Product that matched rule
  matched_zip TEXT,                          -- Zip that matched rule
  payload TEXT,                              -- Original lead payload (JSON)
  retry_count INTEGER DEFAULT 0,             -- Future: retry attempts

  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (rule_id) REFERENCES lead_forwarding_rules(id)
);

-- Indexes for querying
CREATE INDEX idx_forwarding_log_lead ON lead_forwarding_log(lead_id);
CREATE INDEX idx_forwarding_log_contact ON lead_forwarding_log(contact_id);
CREATE INDEX idx_forwarding_log_rule ON lead_forwarding_log(rule_id);
CREATE INDEX idx_forwarding_log_status ON lead_forwarding_log(forward_status);
CREATE INDEX idx_forwarding_log_date ON lead_forwarding_log(forwarded_at);
```

---

### `webhook_configs` Table Extension

The `webhook_configs` table includes forwarding-related fields:

```sql
ALTER TABLE webhook_configs ADD COLUMN forwarding_enabled INTEGER DEFAULT 0;
ALTER TABLE webhook_configs ADD COLUMN auto_forward_count INTEGER DEFAULT 0;
ALTER TABLE webhook_configs ADD COLUMN last_forwarded_at TEXT;
```

---

### Database View: `v_forwarding_stats`

Pre-computed statistics for performance:

```sql
CREATE VIEW v_forwarding_stats AS
SELECT
  source_webhook_id,
  COUNT(*) as total_forwards,
  SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN forward_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  ROUND(
    (SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
    2
  ) as success_rate,
  MAX(forwarded_at) as last_forward_at
FROM lead_forwarding_log
GROUP BY source_webhook_id;
```

---

## Frontend Components

### 1. `ForwardingRulesList.tsx`

Main component for managing forwarding rules.

**Location:** [`src/components/leads/ForwardingRulesList.tsx`](../../src/components/leads/ForwardingRulesList.tsx)

**Features:**
- Master toggle banner (green/amber visual indicator)
- Summary cards (Total Rules, Active Rules, Zip Codes, Product Types)
- Rules table grouped by target webhook
- Priority badges (#1, #2, #3)
- Active/Inactive status indicators
- Actions menu (Enable/Disable, Edit, Delete)

**Key Code Sections:**
- Master Toggle: Lines 88-146
- Summary Cards: Lines 293-341
- Rules Table: Lines 380-551

---

### 2. `CreateForwardingRuleDialog.tsx`

Dialog for creating new forwarding rules.

**Location:** [`src/components/leads/CreateForwardingRuleDialog.tsx`](../../src/components/leads/CreateForwardingRuleDialog.tsx)

**Features:**
- Target webhook configuration
- Product type multi-select
- Zip code entry (Single/Bulk/CSV Upload tabs)
- Priority setting
- Enable/Disable toggle
- Optional notes field

---

### UI Flow

```
┌──────────────────────────────────────────────────┐
│  Webhook Detail Page                             │
│  ┌────────────────────────────────────────────┐  │
│  │  Profitise                                 │  │
│  │  Created 29/10/2025                        │  │
│  │  ┌──────────────┐                          │  │
│  │  │ Active       │  🔘 Toggle               │  │
│  │  └──────────────┘                          │  │
│  │                                            │  │
│  │  📊 Leads: 9    💰 Revenue: $0            │  │
│  │  📈 Conversion: 0%   ⏱️  Avg Time: 2.4 days│  │
│  │                                            │  │
│  │  [Manage Lead Forwarding] ────────────────▶│  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│  Lead Forwarding - Profitise                     │
│  ┌────────────────────────────────────────────┐  │
│  │  🟢 Lead forwarding is ENABLED             │  │
│  │  Leads matching rules will be forwarded    │  │
│  │                                      [🔘]  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │Total │ │Active│ │ Zip  │ │Prodct│           │
│  │  1   │ │  1   │ │  1   │ │  1   │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
│  Lead Forwarding Rules       [🔄 Refresh] [➕]  │
│  ┌────────────────────────────────────────────┐ │
│  │  🔗 profitise_ws_us_general_703           │ │
│  │  https://app.channelautomation.com/...    │ │
│  │                                            │ │
│  │  Priority | Product Types | Zip Codes |...│ │
│  │  ──────────────────────────────────────── │ │
│  │    #1    │     Solar     │  1 zip    |✅  │ │
│  │          │  1 product    │  code     |⋮   │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Examples

### Example 1: Single Partner, Single Product

**Scenario:** Forward all Solar leads in Beverly Hills area to Partner A.

**Configuration:**
```json
{
  "target_webhook_id": "partner_a_solar",
  "target_webhook_url": "https://partner-a.com/webhook",
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211", "90212"],
  "priority": 1
}
```

**Lead Arrives:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "productid": "Solar",
  "zip": "90210"
}
```

**Result:**
```
✅ MATCHES Rule #1
   Product: Solar ✅
   Zip: 90210 ✅

   → Forward to Partner A
   → HTTP POST https://partner-a.com/webhook
   → Status: 200 OK
   → Log: lead_forwarding_log entry created
```

---

### Example 2: Multi-Partner, Priority-Based

**Scenario:** Forward Solar leads to multiple partners based on priority and coverage area.

**Rules:**

**Rule #1** (Priority 1):
```json
{
  "target_webhook_id": "premium_partner",
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211"],  // High-value zips only
  "priority": 1
}
```

**Rule #2** (Priority 2):
```json
{
  "target_webhook_id": "general_partner",
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211", "90212", "90213", "90214"],  // Wider area
  "priority": 2
}
```

**Lead Arrives:**
```json
{
  "productid": "Solar",
  "zip": "90210"
}
```

**Result:**
```
✅ MATCHES Rule #1 (Priority 1)
   → Forward to Premium Partner

✅ MATCHES Rule #2 (Priority 2)
   → Forward to General Partner

📊 Result: Lead forwarded to BOTH partners (multi-forward)
```

---

### Example 3: Product-Specific Routing

**Scenario:** Route different product types to specialized partners.

**Rules:**

**Rule #1** (Solar Specialist):
```json
{
  "target_webhook_id": "solar_specialist",
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211", "90212"],
  "priority": 1
}
```

**Rule #2** (HVAC Specialist):
```json
{
  "target_webhook_id": "hvac_specialist",
  "product_types": ["HVAC"],
  "zip_codes": ["90210", "90211", "90212"],
  "priority": 1
}
```

**Rule #3** (Kitchen/Bath Specialist):
```json
{
  "target_webhook_id": "home_remodel_specialist",
  "product_types": ["Kitchen", "Bath"],
  "zip_codes": ["90210", "90211", "90212"],
  "priority": 1
}
```

**Leads:**

```json
// Lead A
{"productid": "Solar", "zip": "90210"}
→ Forwards to: solar_specialist ✅

// Lead B
{"productid": "HVAC", "zip": "90210"}
→ Forwards to: hvac_specialist ✅

// Lead C
{"productid": "Kitchen", "zip": "90210"}
→ Forwards to: home_remodel_specialist ✅

// Lead D
{"productid": "Roofing", "zip": "90210"}
→ No match, no forwarding ❌
```

---

### Example 4: Geographic Coverage Gaps

**Scenario:** Different partners cover different geographic areas.

**Rules:**

```json
// Partner A: Beverly Hills area
{
  "target_webhook_id": "partner_a",
  "product_types": ["Solar"],
  "zip_codes": ["90210", "90211", "90212"],
  "priority": 1
}

// Partner B: West LA area
{
  "target_webhook_id": "partner_b",
  "product_types": ["Solar"],
  "zip_codes": ["90025", "90064", "90024"],
  "priority": 1
}
```

**Leads:**

```json
// Lead from Beverly Hills
{"productid": "Solar", "zip": "90210"}
→ Forwards to: partner_a ✅

// Lead from West LA
{"productid": "Solar", "zip": "90025"}
→ Forwards to: partner_b ✅

// Lead from Downtown LA
{"productid": "Solar", "zip": "90012"}
→ No match, no forwarding ❌
```

---

## Troubleshooting

### Issue: Rules Not Executing

**Symptoms:** Leads arrive, but no forwarding occurs.

**Checklist:**

1. **Check Master Toggle**
   ```bash
   curl https://api.homeprojectpartners.com/webhook/your-webhook-id
   ```
   Verify `forwarding_enabled: 1` in response.

2. **Check Rule Status**
   ```bash
   curl https://api.homeprojectpartners.com/webhook/your-webhook-id/forwarding-rules
   ```
   Verify rules have:
   - `is_active: true`
   - `forward_enabled: true`

3. **Check Criteria Matching**
   - Verify lead's `productid` matches rule's `product_types` (case-insensitive)
   - Verify lead's `zip` exactly matches one of rule's `zip_codes`

4. **Check Logs**
   ```bash
   curl "https://api.homeprojectpartners.com/webhook/your-webhook-id/forwarding-log?limit=20"
   ```

---

### Issue: Forwarding Failed (HTTP Errors)

**Symptoms:** Logs show `forward_status: 'failed'` with HTTP error codes.

**Common Errors:**

**HTTP 404 - Target Not Found**
```
Error: Target webhook URL is incorrect or no longer exists
Solution: Update rule with correct target_webhook_url
```

**HTTP 401/403 - Authentication Failed**
```
Error: Target webhook requires authentication
Solution: Coordinate with partner to allowlist your forwarding source
```

**HTTP 500 - Target Server Error**
```
Error: Partner's webhook is experiencing issues
Solution: Check with partner's technical team, retry later
```

**Timeout**
```
Error: Target webhook took too long to respond
Solution: Check partner's server capacity and response time
```

---

### Issue: Duplicate Forwarding

**Symptoms:** Same lead forwarded multiple times to same partner.

**Cause:** Multiple rules matching the same lead.

**Example:**
```
Rule #1: Product=[Solar], Zip=[90210] → partner_a
Rule #2: Product=[Solar, HVAC], Zip=[90210, 90211] → partner_a

Lead: Product=Solar, Zip=90210
Result: Forwarded TWICE to partner_a ⚠️
```

**Solution:**
- Review rules and adjust criteria to avoid overlaps
- Use priority to control which rule executes first
- Disable lower-priority duplicate rules

---

### Issue: No Logs Generated

**Symptoms:** Forwarding seems to work, but no entries in `lead_forwarding_log`.

**Potential Causes:**

1. **Database Write Failure**
   - Check Cloudflare D1 database status
   - Verify write permissions

2. **Exception in Logging Code**
   - Check Cloudflare Workers logs: `wrangler tail --remote`

3. **Transaction Rollback**
   - Lead forwarding might be failing before log creation

**Debug Steps:**
```bash
# Check recent Cloudflare Workers logs
cd webhook-api/webhook-api
npm run logs

# Check database directly
wrangler d1 execute convio-leads --remote --command "SELECT COUNT(*) FROM lead_forwarding_log;"
```

---

### Issue: Performance Degradation

**Symptoms:** Webhook response times increasing as forwarding rules grow.

**Optimization Strategies:**

1. **Limit Active Rules**
   - Keep total rules per webhook under 20
   - Disable unused rules instead of deleting (historical data)

2. **Optimize Zip Code Lists**
   - Use bulk CSV import for large zip lists
   - Consider zip code ranges instead of individual codes (future feature)

3. **Reduce Forwarding Targets**
   - Consolidate similar rules
   - Use partner-side routing for sub-criteria

4. **Database Indexes**
   - Ensure indexes exist on `source_webhook_id` and `priority`
   - Run: `wrangler d1 execute convio-leads --remote --file=create-indexes.sql`

---

### Debugging Tools

#### 1. Check Forwarding Status

```bash
# Get webhook config
curl https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703

# Response includes:
# "forwarding_enabled": 1 or 0
```

#### 2. View Active Rules

```bash
# Get all rules for webhook
curl https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703/forwarding-rules

# Filter active only in response
```

#### 3. Check Recent Forwarding Activity

```bash
# Get last 50 forwarding attempts
curl "https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703/forwarding-log?limit=50"

# Filter failed attempts
curl "https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703/forwarding-log?status=failed&limit=20"
```

#### 4. Get Statistics

```bash
# Overall forwarding stats
curl https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703/forwarding-stats

# Response includes:
# - total_forwards
# - success_count
# - failed_count
# - success_rate
# - top_targets
```

#### 5. Database Queries

```bash
# Check specific lead forwarding
wrangler d1 execute convio-leads --remote --command \
  "SELECT * FROM lead_forwarding_log WHERE lead_id = 123;"

# Check rule configuration
wrangler d1 execute convio-leads --remote --command \
  "SELECT * FROM lead_forwarding_rules WHERE source_webhook_id = 'profitise_ws_us_general_703';"

# Count forwards by status
wrangler d1 execute convio-leads --remote --command \
  "SELECT forward_status, COUNT(*) as count FROM lead_forwarding_log GROUP BY forward_status;"
```

---

## Best Practices

### 1. Rule Design

✅ **DO:**
- Start with specific, high-priority rules
- Use clear, descriptive notes for each rule
- Test rules with sample data before enabling
- Keep product type lists focused (2-5 products max)
- Group zip codes by logical geographic areas

❌ **DON'T:**
- Create overlapping rules unintentionally
- Use catch-all rules with hundreds of zip codes
- Mix unrelated products in single rule
- Forget to set priorities

---

### 2. Priority Management

**Recommended Approach:**

```
Priority 1-10:   Premium/VIP partners
Priority 11-20:  Standard partners
Priority 21-30:  Backup/overflow partners
```

**Example:**
```json
// Premium Partner - Beverly Hills only
{"priority": 1, "zip_codes": ["90210", "90211"]}

// Standard Partner - Greater LA
{"priority": 11, "zip_codes": ["90001", "90002", "90003", ...]}

// Backup Partner - All uncovered areas
{"priority": 21, "zip_codes": ["90xxx", ...]}
```

---

### 3. Testing Strategy

**Before Going Live:**

1. **Create Test Rule** (disabled)
   ```json
   {
     "forward_enabled": false,
     "product_types": ["Solar"],
     "zip_codes": ["90210"],
     "target_webhook_url": "https://webhook.site/your-test-url"
   }
   ```

2. **Send Test Lead**
   ```bash
   curl -X POST https://api.homeprojectpartners.com/webhook/your-webhook-id \
     -H "Content-Type: application/json" \
     -H "lead_source_provider_id: test_provider" \
     -d '{"firstname": "Test", "lastname": "User", "productid": "Solar", "zip": "90210"}'
   ```

3. **Enable Rule & Verify**
   - Check webhook.site for received payload
   - Verify headers include `X-Forwarded-From`, `X-Original-Lead-Id`
   - Confirm payload matches original lead data

4. **Monitor Logs**
   ```bash
   curl "https://api.homeprojectpartners.com/webhook/your-webhook-id/forwarding-log?limit=5"
   ```

---

### 4. Monitoring & Maintenance

**Weekly:**
- Review forwarding statistics
- Check failure rates
- Identify problematic rules

**Monthly:**
- Audit active rules for relevance
- Update zip code lists
- Review partner feedback on lead quality

**Quarterly:**
- Optimize rule priorities based on performance
- Consolidate overlapping rules
- Archive or delete obsolete rules

---

### 5. Partner Communication

**When Adding New Partner:**

1. **Provide Forwarding Details**
   ```
   Your webhook will receive:
   - Headers: X-Forwarded-From, X-Original-Lead-Id, X-Original-Contact-Id
   - Payload: Complete lead data (JSON)
   - Expected response: HTTP 200 OK
   ```

2. **Testing Coordination**
   - Send sample payloads before going live
   - Verify partner can process the data structure
   - Confirm authentication/allowlisting if needed

3. **Ongoing Monitoring**
   - Share forwarding success rates
   - Alert partners of repeated failures
   - Coordinate troubleshooting

---

## Future Enhancements

### Planned Features

1. **Retry Logic**
   - Automatic retry for failed forwards (exponential backoff)
   - Configurable retry count and delays
   - Dead letter queue for permanent failures

2. **Zip Code Ranges**
   ```json
   {
     "zip_code_ranges": [
       {"from": "90210", "to": "90299"},
       {"from": "91000", "to": "91999"}
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

6. **Webhooks for Forwarding Events**
   - Notify when forwarding fails
   - Alert on capacity reached
   - Daily summary reports

---

## Summary

The **Lead Forwarding System** provides:

✅ **Flexibility** - Route leads to multiple partners simultaneously
✅ **Control** - Two-level toggle system for precise management
✅ **Intelligence** - Priority-based, criteria-matching logic
✅ **Transparency** - Complete audit trail and statistics
✅ **Reliability** - HTTP-based delivery with status tracking
✅ **Scalability** - Supports unlimited rules and targets

**Key Takeaway:** The system uses **AND logic** (product AND zip must match) with **multi-forward behavior** (all matching rules execute), controlled by a **master toggle** and individual **rule toggles**.

---

**Documentation Version:** 1.0.0
**Last Updated:** October 30, 2025
**Maintained By:** Home Project Partners Development Team

For questions or issues, refer to:
- Main API Docs: [`webhook-api/API_DOCUMENTATION.md`](../../webhook-api/API_DOCUMENTATION.md)
- Project README: [`CLAUDE.md`](../../CLAUDE.md)
- Code Repository: [GitHub](https://github.com/homeprojectpartners/convio-leads)
