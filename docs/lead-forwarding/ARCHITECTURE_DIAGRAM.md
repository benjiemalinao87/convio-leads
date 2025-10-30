# Lead Forwarding System - Architecture Diagrams

This document contains visual diagrams and flowcharts to help understand the Lead Forwarding System architecture.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   HOME PROJECT PARTNERS LEAD FORWARDING SYSTEM               │
│                                                                              │
│  ┌────────────────┐         ┌──────────────────┐         ┌────────────────┐│
│  │  Lead Sources  │────────▶│  Webhook API     │────────▶│   Partners     ││
│  │  (Profitise,   │         │  (Cloudflare     │         │  (Target       ││
│  │   Click        │         │   Workers)       │         │   Webhooks)    ││
│  │   Ventures)    │         │                  │         │                ││
│  └────────────────┘         └──────────────────┘         └────────────────┘│
│                                      │                                       │
│                                      │                                       │
│                                      ▼                                       │
│                          ┌──────────────────────┐                          │
│                          │   Cloudflare D1      │                          │
│                          │   Database           │                          │
│                          │  ┌────────────────┐  │                          │
│                          │  │ contacts       │  │                          │
│                          │  │ leads          │  │                          │
│                          │  │ forwarding_rules│ │                          │
│                          │  │ forwarding_log │  │                          │
│                          │  └────────────────┘  │                          │
│                          └──────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow - Lead Reception to Forwarding

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEAD JOURNEY THROUGH SYSTEM                         │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: LEAD ARRIVES
═══════════════════════════════════════════════════════════════════
    📥 HTTP POST Request
    ↓
    POST https://api.homeprojectpartners.com/webhook/profitise_ws_us_general_703
    Headers:
      Content-Type: application/json
      lead_source_provider_id: click_ventures_001
    Body:
      {
        "firstname": "John",
        "lastname": "Doe",
        "email": "john@example.com",
        "phone": "5551234567",
        "productid": "Solar",
        "zip": "90210",
        "source": "Google Ads"
      }


STEP 2: AUTHENTICATION & VALIDATION
═══════════════════════════════════════════════════════════════════
    ┌──────────────────────────┐
    │ Provider Authentication  │
    │ ✅ Valid API Key?        │
    └────────────┬─────────────┘
                 │ YES
                 ▼
    ┌──────────────────────────┐
    │ Webhook Validation       │
    │ ✅ Valid Webhook ID?     │
    └────────────┬─────────────┘
                 │ YES
                 ▼
    ┌──────────────────────────┐
    │ Data Validation          │
    │ ✅ Required Fields?      │
    └────────────┬─────────────┘
                 │ YES
                 ▼


STEP 3: CONTACT & LEAD STORAGE
═══════════════════════════════════════════════════════════════════
    ┌──────────────────────────────────────┐
    │ Phone Number Normalization           │
    │ "5551234567" → "+15551234567"        │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Check Existing Contact               │
    │ Query: phone + webhook_id            │
    └────────────┬─────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    FOUND│            NOT FOUND
         │                │
         ▼                ▼
    ┌─────────┐      ┌─────────────┐
    │ USE     │      │ CREATE NEW  │
    │ EXISTING│      │ CONTACT     │
    │ CONTACT │      │ contact_id  │
    └────┬────┘      └──────┬──────┘
         │                  │
         └────────┬─────────┘
                  │
                  ▼
    ┌──────────────────────────────────────┐
    │ CREATE NEW LEAD                      │
    │ INSERT INTO leads (                  │
    │   contact_id: [from above],          │
    │   webhook_id: "profitise...",        │
    │   first_name: "John",                │
    │   last_name: "Doe",                  │
    │   email: "john@example.com",         │
    │   phone: "+15551234567",             │
    │   zip_code: "90210",                 │
    │   product_id: "Solar",               │
    │   ...                                │
    │ )                                    │
    │                                      │
    │ 📊 Result:                           │
    │   lead_id: 123                       │
    │   contact_id: 456                    │
    └────────────┬─────────────────────────┘
                 │
                 ▼


STEP 4: FORWARDING ELIGIBILITY CHECK
═══════════════════════════════════════════════════════════════════
    ┌──────────────────────────────────────┐
    │ checkAndForwardLead() Function       │
    │ Triggered Automatically              │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Query: webhook_configs               │
    │ WHERE webhook_id = 'profitise...'    │
    │   AND is_active = 1                  │
    │   AND deleted_at IS NULL             │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Check: forwarding_enabled = 1?       │
    │                                      │
    │ 🔘 Master Toggle Status              │
    └────────┬───────────────────┬─────────┘
             │                   │
         NO  │               YES │
             │                   │
             ▼                   ▼
    ┌────────────────┐   ┌──────────────────┐
    │ STOP           │   │ CONTINUE TO      │
    │ No Forwarding  │   │ RULES EVALUATION │
    │ Exit Function  │   │                  │
    └────────────────┘   └────────┬─────────┘
                                  │
                                  ▼


STEP 5: RULES RETRIEVAL
═══════════════════════════════════════════════════════════════════
    ┌──────────────────────────────────────┐
    │ Query: lead_forwarding_rules         │
    │ WHERE source_webhook_id = ?          │
    │   AND is_active = 1                  │
    │   AND forward_enabled = 1            │
    │ ORDER BY priority ASC                │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Results:                             │
    │                                      │
    │ Rule #1 (priority: 1)                │
    │   target: partner_a_webhook          │
    │   products: ["Solar"]                │
    │   zips: ["90210", "90211"]           │
    │                                      │
    │ Rule #2 (priority: 2)                │
    │   target: partner_b_webhook          │
    │   products: ["Solar", "HVAC"]        │
    │   zips: ["90210", "90212", "90213"]  │
    │                                      │
    │ Rule #3 (priority: 3)                │
    │   target: partner_c_webhook          │
    │   products: ["Kitchen"]              │
    │   zips: ["90210"]                    │
    └────────────┬─────────────────────────┘
                 │
                 ▼


STEP 6: SEQUENTIAL RULE EVALUATION
═══════════════════════════════════════════════════════════════════

    FOR EACH RULE IN ORDER:
    ═══════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────┐
    │ RULE #1 EVALUATION                                      │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ Lead Data:                                              │
    │   productid: "Solar"                                    │
    │   zip: "90210"                                          │
    │                                                         │
    │ Rule Criteria:                                          │
    │   product_types: ["Solar"]                              │
    │   zip_codes: ["90210", "90211"]                         │
    │                                                         │
    │ ┌─────────────────────────────────────┐                │
    │ │ Product Type Match Check:           │                │
    │ │                                     │                │
    │ │ productTypes.some(p =>              │                │
    │ │   p.toLowerCase() ===               │                │
    │ │   "Solar".toLowerCase()             │                │
    │ │ )                                   │                │
    │ │                                     │                │
    │ │ "Solar" in ["Solar"]?               │                │
    │ │ Result: ✅ YES                      │                │
    │ └─────────────────────────────────────┘                │
    │                                                         │
    │ ┌─────────────────────────────────────┐                │
    │ │ Zip Code Match Check:               │                │
    │ │                                     │                │
    │ │ zipCodes.includes("90210")          │                │
    │ │                                     │                │
    │ │ "90210" in ["90210", "90211"]?      │                │
    │ │ Result: ✅ YES                      │                │
    │ └─────────────────────────────────────┘                │
    │                                                         │
    │ ┌─────────────────────────────────────┐                │
    │ │ Combined Check (AND Logic):         │                │
    │ │                                     │                │
    │ │ productMatch && zipMatch            │                │
    │ │ true && true                        │                │
    │ │ Result: ✅ MATCH                    │                │
    │ │                                     │                │
    │ │ → FORWARD LEAD                      │                │
    │ └─────────────────────────────────────┘                │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │ forwardLeadToWebhook()                                  │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ 📤 HTTP POST                                            │
    │ URL: https://partner-a.com/webhook                      │
    │                                                         │
    │ Headers:                                                │
    │   Content-Type: application/json                        │
    │   X-Forwarded-From: profitise_ws_us_general_703         │
    │   X-Original-Lead-Id: 123                               │
    │   X-Original-Contact-Id: 456                            │
    │   X-Forwarding-Rule-Id: 1                               │
    │                                                         │
    │ Body:                                                   │
    │   {                                                     │
    │     ...complete original lead payload...,               │
    │     "home_project_partner_metadata": {                               │
    │       "lead_id": 123,                                   │
    │       "contact_id": 456,                                │
    │       "forwarded_from": "profitise_ws_us_general_703",  │
    │       "rule_id": 1,                                     │
    │       "matched_product": "Solar",                       │
    │       "matched_zip": "90210",                           │
    │       "forwarded_at": "2025-10-30T12:00:00Z"            │
    │     }                                                   │
    │   }                                                     │
    │                                                         │
    │ ⏱️  Await Response...                                   │
    │                                                         │
    │ 📨 Response Received:                                   │
    │   HTTP Status: 200 OK                                   │
    │   Body: {"success": true, "id": "abc123"}               │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │ LOG FORWARDING ATTEMPT                                  │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ INSERT INTO lead_forwarding_log (                       │
    │   lead_id: 123,                                         │
    │   contact_id: 456,                                      │
    │   rule_id: 1,                                           │
    │   source_webhook_id: "profitise_ws_us_general_703",     │
    │   target_webhook_id: "partner_a_webhook",               │
    │   target_webhook_url: "https://partner-a.com/webhook",  │
    │   forwarded_at: "2025-10-30T12:00:00Z",                 │
    │   forward_status: "success",                            │
    │   http_status_code: 200,                                │
    │   response_body: '{"success": true, "id": "abc123"}',   │
    │   matched_product: "Solar",                             │
    │   matched_zip: "90210",                                 │
    │   payload: '{ ... original payload ... }'               │
    │ )                                                       │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │ UPDATE WEBHOOK STATISTICS                               │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ UPDATE webhook_configs                                  │
    │ SET auto_forward_count = auto_forward_count + 1,        │
    │     last_forwarded_at = CURRENT_TIMESTAMP               │
    │ WHERE webhook_id = 'profitise_ws_us_general_703'        │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │ ⚠️  CONTINUE TO NEXT RULE (No break statement!)         │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼

    ┌─────────────────────────────────────────────────────────┐
    │ RULE #2 EVALUATION                                      │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ Rule Criteria:                                          │
    │   product_types: ["Solar", "HVAC"]                      │
    │   zip_codes: ["90210", "90212", "90213"]                │
    │                                                         │
    │ Product Match: "Solar" in ["Solar", "HVAC"]? ✅ YES     │
    │ Zip Match: "90210" in ["90210", "90212", ...]? ✅ YES   │
    │                                                         │
    │ Combined: ✅ MATCH → FORWARD AGAIN                      │
    │                                                         │
    │ 📤 HTTP POST to https://partner-b.com/webhook           │
    │ 📊 Log entry created                                    │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼

    ┌─────────────────────────────────────────────────────────┐
    │ RULE #3 EVALUATION                                      │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ Rule Criteria:                                          │
    │   product_types: ["Kitchen"]                            │
    │   zip_codes: ["90210"]                                  │
    │                                                         │
    │ Product Match: "Solar" in ["Kitchen"]? ❌ NO            │
    │ Zip Match: "90210" in ["90210"]? ✅ YES                 │
    │                                                         │
    │ Combined: ❌ NO MATCH → SKIP                            │
    └────────────┬────────────────────────────────────────────┘
                 │
                 ▼


STEP 7: FINAL RESULT
═══════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────┐
    │ FORWARDING COMPLETE                                     │
    ├─────────────────────────────────────────────────────────┤
    │                                                         │
    │ 📊 Summary:                                             │
    │   - Total Rules Evaluated: 3                            │
    │   - Rules Matched: 2                                    │
    │   - Successful Forwards: 2                              │
    │   - Failed Forwards: 0                                  │
    │                                                         │
    │ ✅ Partner A received lead                              │
    │ ✅ Partner B received lead                              │
    │ ⏭️  Rule #3 skipped (no match)                          │
    │                                                         │
    │ 🎯 Result: MULTI-FORWARD SUCCESS                        │
    └─────────────────────────────────────────────────────────┘


STEP 8: API RESPONSE TO ORIGINAL WEBHOOK REQUEST
═══════════════════════════════════════════════════════════════════

    📨 HTTP Response to Provider
    ↓
    Status: 201 Created
    Body:
      {
        "status": "success",
        "message": "Lead received and processed successfully",
        "webhook_id": "profitise_ws_us_general_703",
        "contact_id": 456,
        "lead_id": 123,
        "email": "john@example.com",
        "forwarding": {
          "enabled": true,
          "forwarded_count": 2,
          "forwarded_to": [
            "partner_a_webhook",
            "partner_b_webhook"
          ]
        },
        "processed_at": "2025-10-30T12:00:00.000Z",
        "timestamp": "2025-10-30T12:00:01.000Z"
      }
```

---

## Control Flow - Master Toggle & Rule Toggle

```
┌─────────────────────────────────────────────────────────────────┐
│              TWO-LEVEL CONTROL SYSTEM LOGIC                     │
└─────────────────────────────────────────────────────────────────┘

                    Lead Arrives for Forwarding
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │ LEVEL 1: MASTER TOGGLE CHECK                │
        │ (Webhook-Level Control)                     │
        │                                             │
        │ Query: webhook_configs.forwarding_enabled   │
        └─────────┬──────────────────────┬────────────┘
                  │                      │
              = 0 │                  = 1 │
         (DISABLED)                (ENABLED)
                  │                      │
                  ▼                      ▼
        ┌──────────────────┐   ┌──────────────────────┐
        │ 🛑 STOP          │   │ ✅ CONTINUE          │
        │                  │   │                      │
        │ No rules execute │   │ Proceed to evaluate  │
        │ Return early     │   │ individual rules     │
        │                  │   │                      │
        │ Forwarded: 0     │   └──────────┬───────────┘
        └──────────────────┘              │
                                          ▼
                        ┌──────────────────────────────────┐
                        │ Get Active Rules:                │
                        │                                  │
                        │ WHERE source_webhook_id = ?      │
                        │   AND is_active = 1              │
                        │   AND forward_enabled = 1        │
                        │ ORDER BY priority ASC            │
                        └──────────┬───────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────────────┐
                        │ FOR EACH RULE:                   │
                        └──────────┬───────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────────────┐
                        │ LEVEL 2: RULE TOGGLE CHECK       │
                        │ (Individual Rule Control)        │
                        │                                  │
                        │ Check: rule.forward_enabled      │
                        └──┬─────────────────────┬─────────┘
                           │                     │
                       = 0 │                 = 1 │
                  (DISABLED)              (ENABLED)
                           │                     │
                           ▼                     ▼
                ┌────────────────────┐  ┌────────────────────┐
                │ ⏭️  SKIP THIS RULE │  │ ✅ EVALUATE RULE   │
                │                    │  │                    │
                │ Move to next rule  │  │ Check criteria:    │
                │                    │  │ - Product match    │
                └────────────────────┘  │ - Zip match        │
                                        │                    │
                                        │ If both match:     │
                                        │ → Forward lead     │
                                        └────────────────────┘


TRUTH TABLE:
═══════════════════════════════════════════════════════════════
│ Master Toggle │ Rule Enabled │ Rule Active │ Result        │
├───────────────┼──────────────┼─────────────┼───────────────┤
│ ❌ OFF        │ ✅ ON        │ ✅ YES      │ ⏭️  SKIP      │
│ ❌ OFF        │ ✅ ON        │ ❌ NO       │ ⏭️  SKIP      │
│ ❌ OFF        │ ❌ OFF       │ ✅ YES      │ ⏭️  SKIP      │
│ ❌ OFF        │ ❌ OFF       │ ❌ NO       │ ⏭️  SKIP      │
│ ✅ ON         │ ❌ OFF       │ ✅ YES      │ ⏭️  SKIP      │
│ ✅ ON         │ ❌ OFF       │ ❌ NO       │ ⏭️  SKIP      │
│ ✅ ON         │ ✅ ON        │ ❌ NO       │ ⏭️  SKIP      │
│ ✅ ON         │ ✅ ON        │ ✅ YES      │ ✅ EXECUTE    │
═══════════════════════════════════════════════════════════════

Summary: ALL THREE must be ON/YES for rule to execute:
  1️⃣  Master Toggle = ON
  2️⃣  Rule forward_enabled = 1
  3️⃣  Rule is_active = 1
```

---

## Priority Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              PRIORITY-BASED SEQUENTIAL EVALUATION                │
└─────────────────────────────────────────────────────────────────┘

Database Query:
═══════════════════════════════════════════════════════════════════
SELECT * FROM lead_forwarding_rules
WHERE source_webhook_id = 'profitise_ws_us_general_703'
  AND is_active = 1
  AND forward_enabled = 1
ORDER BY priority ASC    ◀── Lowest number first!
═══════════════════════════════════════════════════════════════════

Results (in order):
═══════════════════════════════════════════════════════════════════

    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ 1️⃣  RULE #1 (Priority: 1) - EVALUATED FIRST       ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              │
              ▼ Check Criteria
              │
        ┌─────┴──────┐
        │            │
     MATCH        NO MATCH
        │            │
        ▼            ▼
    Forward       Skip
    Lead
        │            │
        └─────┬──────┘
              │
              ▼
    ⚠️  CONTINUE (No break!)
              │
              ▼
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ 2️⃣  RULE #2 (Priority: 2) - EVALUATED SECOND      ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              │
              ▼ Check Criteria
              │
        ┌─────┴──────┐
        │            │
     MATCH        NO MATCH
        │            │
        ▼            ▼
    Forward       Skip
    Lead
        │            │
        └─────┬──────┘
              │
              ▼
    ⚠️  CONTINUE (No break!)
              │
              ▼
    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃ 3️⃣  RULE #3 (Priority: 3) - EVALUATED THIRD       ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              │
              ▼ Check Criteria
              │
        ┌─────┴──────┐
        │            │
     MATCH        NO MATCH
        │            │
        ▼            ▼
    Forward       Skip
    Lead
        │            │
        └─────┬──────┘
              │
              ▼
         END OF RULES
              │
              ▼
    ┌──────────────────────────────────┐
    │ Return Forwarding Result         │
    │                                  │
    │ {                                │
    │   success: true,                 │
    │   forwarded_count: 2,            │
    │   errors: []                     │
    │ }                                │
    └──────────────────────────────────┘


KEY CHARACTERISTIC: 🔁 MULTI-FORWARD BEHAVIOR
═══════════════════════════════════════════════════════════════════

The loop does NOT break after first match!

❌ DOES NOT DO THIS:
   for (const rule of rules) {
     if (matches) {
       forward()
       break ◀── NOPE! No break statement
     }
   }

✅ ACTUALLY DOES THIS:
   for (const rule of rules) {
     if (matches) {
       forward()
       // Continue to next rule ◀── Continues looping
     }
   }

RESULT: A single lead can forward to MULTIPLE partners
```

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE TABLE RELATIONSHIPS                  │
└─────────────────────────────────────────────────────────────────┘

    ┌────────────────────────┐
    │   webhook_configs      │
    │ ─────────────────────  │
    │ webhook_id (PK)        │◀──────────┐
    │ name                   │           │
    │ is_active              │           │
    │ forwarding_enabled ◀───┼─── Master Toggle
    │ auto_forward_count     │           │
    │ last_forwarded_at      │           │
    └────────────────────────┘           │
                                         │
                 ┌───────────────────────┘
                 │
                 │ source_webhook_id (FK)
                 │
    ┌────────────▼───────────────────┐
    │  lead_forwarding_rules         │
    │ ──────────────────────────────│
    │ id (PK)                        │
    │ source_webhook_id (FK) ────────┼──┐
    │ target_webhook_id              │  │
    │ target_webhook_url             │  │
    │ product_types (JSON)           │  │
    │ zip_codes (JSON)               │  │
    │ priority ◀────── Evaluation Order
    │ is_active                      │  │
    │ forward_enabled ◀─── Rule Toggle │
    │ notes                          │  │
    │ created_at                     │  │
    │ updated_at                     │  │
    └────┬───────────────────────────┘  │
         │                               │
         │ rule_id (FK)                  │
         │                               │
    ┌────▼───────────────────────────┐  │
    │  lead_forwarding_log           │  │
    │ ──────────────────────────────│  │
    │ id (PK)                        │  │
    │ lead_id (FK) ──────────────────┼──┼──┐
    │ contact_id (FK) ───────────────┼──┼──┼──┐
    │ rule_id (FK) ──────────────────┼──┘  │  │
    │ source_webhook_id (FK) ────────┼─────┘  │
    │ target_webhook_id              │        │
    │ target_webhook_url             │        │
    │ forwarded_at                   │        │
    │ forward_status ◀─── 'success'/'failed'  │
    │ http_status_code               │        │
    │ response_body                  │        │
    │ error_message                  │        │
    │ matched_product                │        │
    │ matched_zip                    │        │
    │ payload (JSON)                 │        │
    └────────────────────────────────┘        │
                                              │
         ┌────────────────────────────────────┘
         │
         │ lead_id (FK)
         │
    ┌────▼───────────────────────────┐
    │         leads                  │
    │ ──────────────────────────────│
    │ id (PK)                        │
    │ contact_id (FK) ───────────────┼──┐
    │ webhook_id                     │  │
    │ first_name                     │  │
    │ last_name                      │  │
    │ email                          │  │
    │ phone                          │  │
    │ zip_code ◀───── Used for matching
    │ product_id ◀──── Used for matching
    │ status                         │  │
    │ created_at                     │  │
    └────────────────────────────────┘  │
                                        │
         ┌──────────────────────────────┘
         │
         │ contact_id (FK)
         │
    ┌────▼───────────────────────────┐
    │        contacts                │
    │ ──────────────────────────────│
    │ id (PK)                        │
    │ webhook_id                     │
    │ phone (normalized)             │
    │ first_name                     │
    │ last_name                      │
    │ email                          │
    │ created_at                     │
    └────────────────────────────────┘
```

---

## HTTP Headers in Forwarding Request

```
┌─────────────────────────────────────────────────────────────────┐
│           HEADERS SENT TO TARGET WEBHOOK                        │
└─────────────────────────────────────────────────────────────────┘

When forwarding a lead to partner webhook, the system includes
custom headers to provide context about the forwarded lead:

╔═══════════════════════════════════════════════════════════════╗
║  HTTP POST https://partner-a.com/webhook                      ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  📋 HEADERS:                                                  ║
║  ──────────────────────────────────────────────────────────   ║
║                                                               ║
║  Content-Type: application/json                               ║
║    └─ Standard JSON content type                              ║
║                                                               ║
║  X-Forwarded-From: profitise_ws_us_general_703                ║
║    └─ Source webhook that received the original lead          ║
║       Partner can track which source webhooks send them leads ║
║                                                               ║
║  X-Original-Lead-Id: 123                                      ║
║    └─ Primary key of lead in our database                     ║
║       Partner can reference for support/inquiries             ║
║                                                               ║
║  X-Original-Contact-Id: 456                                   ║
║    └─ Primary key of contact in our database                  ║
║       Allows tracking if same contact submits multiple leads  ║
║                                                               ║
║  X-Forwarding-Rule-Id: 1                                      ║
║    └─ Which forwarding rule triggered this forward            ║
║       Useful for partners with multiple rules/criteria        ║
║                                                               ║
║  📦 BODY:                                                     ║
║  ──────────────────────────────────────────────────────────   ║
║  {                                                            ║
║    "firstname": "John",                                       ║
║    "lastname": "Doe",                                         ║
║    "email": "john@example.com",                               ║
║    "phone": "5551234567",                                     ║
║    "productid": "Solar",                                      ║
║    "zip": "90210",                                            ║
║    "source": "Google Ads",                                    ║
║    ... [complete original payload] ...                        ║
║  }                                                            ║
╚═══════════════════════════════════════════════════════════════╝

Partner webhook receives the EXACT same payload that was
originally submitted, plus the custom headers for context.
```

---

## Success Metrics Dashboard View

```
┌─────────────────────────────────────────────────────────────────┐
│              FORWARDING STATISTICS DASHBOARD                    │
└─────────────────────────────────────────────────────────────────┘

GET /webhook/profitise_ws_us_general_703/forwarding-stats

Response:
═══════════════════════════════════════════════════════════════════

    ┌───────────────────────────────────────────────────────┐
    │  📊 OVERALL STATISTICS                                │
    ├───────────────────────────────────────────────────────┤
    │                                                       │
    │  Total Forwards:     ████████████████░░  150         │
    │  Success Count:      ███████████████░░░  145         │
    │  Failed Count:       █░░░░░░░░░░░░░░░░    5          │
    │  Success Rate:       96.67%                           │
    │  Last Forward:       2025-10-30 12:00:00 UTC          │
    │                                                       │
    └───────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────┐
    │  🎯 TOP FORWARDING TARGETS                            │
    ├───────────────────────────────────────────────────────┤
    │                                                       │
    │  #1 partner_a_webhook                                 │
    │      ████████████████████░  85 forwards               │
    │      Success: 82 (96.5%)   Failed: 3                  │
    │                                                       │
    │  #2 partner_b_webhook                                 │
    │      ███████████████░░░░░░  65 forwards               │
    │      Success: 63 (96.9%)   Failed: 2                  │
    │                                                       │
    └───────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0.0
**Last Updated:** October 30, 2025
