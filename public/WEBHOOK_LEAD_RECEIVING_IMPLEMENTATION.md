# Webhook Lead Receiving Implementation Study

## Overview
The HPP Leads webhook system is built on Cloudflare Workers using Hono.js framework. It receives lead data from third-party providers, validates it, processes it, and stores it in a D1 (SQLite) database with intelligent contact deduplication.

### ASCII System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────┐          ┌──────────────────────────────────────────┐
│  Third-Party   │  POST    │    CLOUDFLARE WORKERS (Edge)             │
│  Lead Provider │─────────▶│    - Global Distribution                 │
│  (Google Ads,  │  HTTP    │    - Low Latency                         │
│   Facebook,    │          │    - Auto-scaling                        │
│   etc.)        │          └──────────┬───────────────────────────────┘
└────────────────┘                     │
                                       │
                    ┌──────────────────┴──────────────────┐
                    │     HONO.JS FRAMEWORK               │
                    │     - Fast, Lightweight             │
                    │     - TypeScript                    │
                    │     - Middleware Support            │
                    └──────────────────┬──────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌───────────────────┐       ┌───────────────────┐       ┌──────────────────┐
│  AUTHENTICATION   │       │   VALIDATION      │       │   MIDDLEWARE     │
│  - Provider Auth  │       │   - Zod Schemas   │       │   - Rate Limit   │
│  - Webhook Sig    │       │   - Phone E.164   │       │   - CORS         │
│  - Access Control │       │   - Type Safety   │       │   - Logging      │
└─────────┬─────────┘       └─────────┬─────────┘       └────────┬─────────┘
          │                           │                           │
          └──────────────┬────────────┴──────────────────────────┘
                         │
                         ▼
          ┌────────────────────────────────────────┐
          │    CONTACT DEDUPLICATION ENGINE        │
          │    - Phone-based unique key            │
          │    - Find or create logic              │
          │    - Auto-update contact info          │
          └──────────────┬─────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌────────────────────┐        ┌────────────────────────┐
│   CONTACTS TABLE   │  1:N   │     LEADS TABLE        │
│   (6-digit IDs)    │◀───────│   (10-digit IDs)       │
│   Primary Entity   │        │   Campaign-Specific    │
└──────────┬─────────┘        └───────────┬────────────┘
           │                               │
           │                               │
           └───────────┬───────────────────┘
                       │
                       ▼
          ┌────────────────────────────────────────┐
          │       CLOUDFLARE D1 DATABASE           │
          │       - Distributed SQLite             │
          │       - Global Replication             │
          │       - Low Latency Queries            │
          └──────────────┬─────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌────────────────────┐        ┌────────────────────────┐
│   EVENT LOGGING    │        │   ANALYTICS TRACKING   │
│   - Lead Events    │        │   - Webhook Stats      │
│   - Contact Events │        │   - Provider Usage     │
│   - Audit Trail    │        │   - Conversion Metrics │
└────────────────────┘        └────────────────────────┘

DATA FLOW:
Provider → Validation → Deduplication → Database → Events → Analytics

FEATURES:
✓ Edge computing for global low latency
✓ 7-layer validation system
✓ Phone-based deduplication
✓ Complete audit trail
✓ Real-time statistics
✓ Multi-schema support (Solar, HVAC, Insurance)
✓ Provider authentication & access control
✓ Soft deletion with 24-hour restoration
```

---

## Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers (Edge computing)
- **Framework**: Hono.js (Fast, lightweight web framework)
- **Database**: Cloudflare D1 (Distributed SQLite)
- **Validation**: Zod schemas
- **Language**: TypeScript

### Key Components
1. **Webhook Router** (`src/routes/webhook.ts`) - Main webhook endpoint handler
2. **Lead Database** (`src/db/leads.ts`) - Lead storage and management
3. **Contact Database** (`src/db/contacts.ts`) - Contact deduplication logic
4. **Type Definitions** (`src/types/leads.ts`) - Schema validation
5. **Middleware** - Authentication, validation, error handling

---

## Lead Receiving Flow

### ASCII Flow Diagram - Complete Lead Processing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THIRD-PARTY PROVIDER                                 │
│                    Sends Lead Data via HTTP POST                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: WEBHOOK ID VALIDATION                                          │
│  ✓ Check format: [prefix]_ws_[region]_[category]_[id]                  │
│  ✓ Verify webhook exists in database                                   │
│  ✓ Confirm webhook is active (is_active = 1)                           │
│  ✓ Ensure not soft-deleted (deleted_at IS NULL)                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: PROVIDER AUTHENTICATION                                        │
│  ✓ Validate Authorization header present                               │
│  ✓ Check provider exists & is active in DB                             │
│  ✓ Verify provider has webhook access                                  │
│  ✓ Update provider last_used_at timestamp                              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: REQUEST VALIDATION                                             │
│  ✓ Verify Content-Type: application/json                               │
│  ✓ Parse JSON body                                                     │
│  ✓ Validate webhook signature (optional)                               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: SCHEMA VALIDATION (Zod)                                        │
│  ✓ Select schema: Solar | HVAC | Insurance | Base                      │
│  ✓ Validate required fields (firstname, lastname, source)              │
│  ✓ Check field types and formats                                       │
│  ✓ Validate optional fields if present                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: PHONE NORMALIZATION                                            │
│  Input: "555-123-4567" or "(555) 123-4567" or "5551234567"             │
│  ✓ Remove spaces, dashes, parentheses                                  │
│  ✓ Add +1 country code if missing                                      │
│  Output: "+15551234567" (E.164 format)                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 6: CONTACT DEDUPLICATION                                          │
│  Query: SELECT * FROM contacts                                          │
│         WHERE webhook_id = ? AND phone = ?                              │
│                                                                         │
│  ┌─────────────────┐           ┌──────────────────┐                    │
│  │ Contact Found?  │──── NO ───▶│ Create Contact  │                    │
│  └────────┬────────┘            │ Generate 6-digit│                    │
│           │                     │ ID              │                    │
│          YES                    │ isNew = true    │                    │
│           │                     └────────┬─────────┘                    │
│           ▼                              │                              │
│  ┌──────────────────┐                   │                              │
│  │ Update Contact   │                   │                              │
│  │ with latest info │                   │                              │
│  │ isNew = false    │                   │                              │
│  └────────┬─────────┘                   │                              │
│           │                              │                              │
│           └──────────────┬───────────────┘                              │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 7: LEAD CREATION                                                  │
│  ✓ Generate unique 10-digit lead ID                                    │
│  ✓ Link to contact_id (from step 6)                                    │
│  ✓ Store all lead data + raw_payload                                   │
│  ✓ Set status = 'new'                                                  │
│  INSERT INTO leads (...) VALUES (...)                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 8: WEBHOOK STATISTICS UPDATE                                      │
│  UPDATE webhook_configs SET                                             │
│    total_leads = total_leads + 1,                                       │
│    last_lead_at = CURRENT_TIMESTAMP                                     │
│  WHERE webhook_id = ?                                                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 9: PROVIDER USAGE LOGGING                                         │
│  INSERT OR REPLACE INTO provider_usage_log                              │
│    (provider_id, webhook_id, request_count, date)                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 10: EVENT LOGGING                                                 │
│  ✓ Log lead creation event                                             │
│  ✓ Log contact event (created or updated)                              │
│  INSERT INTO lead_events (lead_id, event_type, event_data)             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SUCCESS RESPONSE (201 Created)                       │
│  {                                                                      │
│    "status": "success",                                                 │
│    "contact_id": 650963,                                                │
│    "lead_id": 1234567890,                                               │
│    "contact_status": "new" | "existing",                                │
│    "message": "Lead processed successfully"                             │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. **Webhook Endpoint Pattern**
```
POST /webhook/:webhookId
```

**Supported webhook ID formats:**
- New format: `[name-prefix]_ws_[region]_[category]_[id]`
  - Example: `click-ventures_ws_us_general_656`
- Legacy format: `ws_[region]_[category]_[id]`
  - Example: `ws_cal_solar_001`

**Pattern validation**: `/^(([a-z0-9-]+)_)?ws_([a-z]{2,3})_([a-z]+)_(\d{3})$/`

---

### 2. **Request Headers (Required)**

#### Provider Authentication
```http
Authorization: <provider_id>
```
- Example: `click_ventures_001`
- Validates against `lead_source_providers` table
- Checks if provider is active
- Verifies provider has access to specific webhook (if restrictions exist)

#### Optional Security Headers
```http
X-Webhook-Signature: sha256=<signature>
Content-Type: application/json
```

---

### 3. **Request Validation Pipeline**

#### ASCII Diagram - 7-Layer Validation System

```
┌──────────────────────────────────────────────────────────────────┐
│                    INCOMING HTTP REQUEST                         │
│     POST /webhook/click-ventures_ws_us_general_656               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┴────────────────────┐
         │   LAYER 1: WEBHOOK ID VALIDATION       │
         │   ✓ Regex: /^(prefix_)?ws_xx_cat_###$/ │
         │   ✓ Check DB: webhook_configs table    │
         │   ✓ Verify: is_active = 1              │
         │   ✓ Confirm: deleted_at IS NULL        │
         └────────────────┬───────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 2: PROVIDER AUTHENTICATION    │
         │   ✓ Check: Authorization header       │
         │   ✓ Query: lead_source_providers      │
         │   ✓ Verify: provider is_active = 1    │
         │   ✓ Check: allowed_webhooks access    │
         └────────────────┬──────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 3: CONTENT TYPE VALIDATION    │
         │   ✓ Header: Content-Type              │
         │   ✓ Must be: application/json         │
         └────────────────┬──────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 4: JSON PARSING               │
         │   ✓ Parse: Request body as JSON       │
         │   ✓ Validate: Valid JSON structure    │
         └────────────────┬──────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 5: SIGNATURE VERIFICATION     │
         │   (Optional if WEBHOOK_SECRET set)    │
         │   ✓ Header: X-Webhook-Signature       │
         │   ✓ Calculate: HMAC-SHA256            │
         │   ✓ Compare: Expected vs Actual       │
         └────────────────┬──────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 6: SCHEMA VALIDATION (Zod)    │
         │   ✓ Select: Lead type schema          │
         │   ✓ Required: firstname, lastname     │
         │   ✓ Required: source                  │
         │   ✓ Validate: Field types & formats   │
         │   ✓ Check: Optional field formats     │
         └────────────────┬──────────────────────┘
                          │ PASS
                          ▼
         ┌───────────────────────────────────────┐
         │   LAYER 7: PHONE NORMALIZATION        │
         │   ✓ Extract: Phone number from data   │
         │   ✓ Normalize: To E.164 format        │
         │   ✓ Validate: Valid US phone number   │
         │   Output: +1XXXXXXXXXX                │
         └────────────────┬──────────────────────┘
                          │ PASS ALL LAYERS
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│            ✅ VALIDATION COMPLETE - PROCEED TO PROCESSING         │
│         Contact Deduplication → Lead Creation → Success          │
└──────────────────────────────────────────────────────────────────┘

ERROR PATHS (Any layer can fail):
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│ Layer 1-2  │   │ Layer 3-4  │   │ Layer 5    │   │ Layer 6-7  │
│ Fail       │   │ Fail       │   │ Fail       │   │ Fail       │
├────────────┤   ├────────────┤   ├────────────┤   ├────────────┤
│ 400/404    │   │ 400        │   │ 401        │   │ 422/400    │
│ Invalid ID │   │ Bad JSON   │   │ Bad Sig    │   │ Bad Data   │
└────────────┘   └────────────┘   └────────────┘   └────────────┘
```

#### Step 1: Webhook ID Validation
- Validates format matches pattern
- Checks if webhook exists in database
- Verifies webhook is active (`is_active = 1`)
- Ensures webhook is not soft-deleted (`deleted_at IS NULL`)

#### Step 2: Provider Authentication
- Validates `Authorization` header is present
- Queries `lead_source_providers` table
- Checks provider is active
- Validates provider has access to webhook (if `allowed_webhooks` is set)
- Updates `last_used_at` timestamp for provider

#### Step 3: Content Type Validation
- Ensures `Content-Type: application/json`

#### Step 4: JSON Parsing
- Parses request body as JSON
- Returns 400 if invalid JSON

#### Step 5: Webhook Signature Verification (Optional)
- If `WEBHOOK_SECRET` is configured, validates HMAC-SHA256 signature
- Signature format: `sha256=<hash>`
- Hash calculation: `HMAC-SHA256(secret + payload)`

---

### 4. **Data Schema Validation**

The system supports multiple lead types with different schemas:

#### Base Lead Schema (Primary)
```typescript
{
  // Required (at least one naming convention)
  firstname/firstName: string (min 1 char)
  lastname/lastName: string (min 1 char)
  source: string (required)
  
  // Contact info (optional but recommended)
  phone: string (min 10 digits)
  email: string (valid email format)
  
  // Address (supports dual naming)
  address/address1: string
  address2: string
  city: string
  state: string (2-letter code)
  zip/zipCode: string
  
  // Business-specific
  productid: string (Kitchen, Bath, Roofing, Solar, etc.)
  subsource: string
  landing_page_url: string (URL)
  consent: {
    description: string
    value: boolean
  }
  tcpa_compliance: boolean
  
  // Campaign tracking
  campaign: string
  created_at: string (ISO 8601)
}
```

#### Extended Schemas
- **Solar Lead Schema**: Adds property type, electric bill, roof condition, etc.
- **HVAC Lead Schema**: Adds service type, system age, urgency, budget, etc.
- **Insurance Lead Schema**: Adds insurance type, coverage, vehicle/property info, etc.

**Schema selection logic:**
- System checks webhook ID against `LeadProviderConfig`
- Falls back to `BaseLeadSchema` if no specific schema found
- Uses Zod for runtime validation
- Returns 422 with detailed error messages if validation fails

---

### 5. **Phone Number Normalization**

All phone numbers are normalized to E.164 format before storage:

```typescript
// Input examples:
"5551234567"       → "+15551234567"
"555-123-4567"     → "+15551234567"
"(555) 123-4567"   → "+15551234567"
"+15551234567"     → "+15551234567"
```

**Implementation**: `src/utils/phone.ts` - `normalizePhoneNumber()`

---

### 6. **Contact Deduplication Logic**

**Key Strategy**: One contact per webhook per phone number

#### ASCII Diagram - Contact Deduplication Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LEAD DATA WITH PHONE NUMBER                       │
│                  e.g., John Doe, +15551234567                        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│          NORMALIZE PHONE NUMBER TO E.164 FORMAT                      │
│                                                                      │
│  Input Examples:                  Output:                           │
│  • "5551234567"          ────▶    "+15551234567"                   │
│  • "555-123-4567"        ────▶    "+15551234567"                   │
│  • "(555) 123-4567"      ────▶    "+15551234567"                   │
│  • "+15551234567"        ────▶    "+15551234567"                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│            DATABASE LOOKUP (Unique Key Check)                        │
│                                                                      │
│  SELECT * FROM contacts                                              │
│  WHERE webhook_id = 'click-ventures_ws_us_general_656'              │
│    AND phone = '+15551234567';                                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────┴────────────────┐
              │                               │
          FOUND?                           NOT FOUND?
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────────┐
│  EXISTING CONTACT       │     │  CREATE NEW CONTACT                 │
│  contact_id: 650963     │     │                                     │
│  phone: +15551234567    │     │  1. Generate 6-digit ID             │
│                         │     │     contactId = 650964              │
│  ACTION: UPDATE         │     │                                     │
│  ✓ Update first_name    │     │  2. INSERT INTO contacts            │
│  ✓ Update last_name     │     │     (id, webhook_id, phone,         │
│  ✓ Update email         │     │      first_name, last_name...)      │
│  ✓ Update address       │     │                                     │
│  ✓ Keep existing data   │     │  3. Log: event_type = 'created'     │
│    if new data is NULL  │     │                                     │
│                         │     │  Result: isNew = TRUE               │
│  Log: event_type =      │     └─────────────┬───────────────────────┘
│        'updated'        │                   │
│                         │                   │
│  Result: isNew = FALSE  │                   │
└────────┬────────────────┘                   │
         │                                    │
         └──────────────┬─────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CREATE NEW LEAD                                  │
│                                                                      │
│  1. Generate unique 10-digit lead ID                                 │
│     leadId = 1234567890                                              │
│                                                                      │
│  2. INSERT INTO leads                                                │
│     (id, contact_id, webhook_id, first_name, last_name,             │
│      email, phone, address, source, productid, raw_payload...)      │
│                                                                      │
│  3. LINK TO CONTACT:                                                 │
│     contact_id = 650963 (from step above)                            │
│                                                                      │
│  4. Set status = 'new'                                               │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  RESULT: CONTACT WITH LEAD                           │
│                                                                      │
│  Contact ID: 650963                                                  │
│  Phone: +15551234567                                                 │
│  Name: John Doe                                                      │
│  Status: NEW or EXISTING                                             │
│                                                                      │
│  Lead ID: 1234567890                                                 │
│  Linked to: contact_id 650963                                        │
│  Campaign: Solar Installation                                        │
│  Status: new                                                         │
└──────────────────────────────────────────────────────────────────────┘

BENEFITS:
✓ Same person across multiple campaigns = 1 contact, multiple leads
✓ Phone number is unique identifier per webhook
✓ Contact information always up-to-date with latest submission
✓ Complete history tracking of all lead submissions
✓ No duplicate contacts in the system
```

#### Process Flow:

```
1. Normalize phone number to E.164 format
2. Query: SELECT * FROM contacts WHERE webhook_id = ? AND phone = ?
3. If contact exists:
   - Update existing contact with new information
   - Link new lead to existing contact
   - Set isNewContact = false
4. If contact doesn't exist:
   - Generate new 6-digit contact ID
   - Create contact record
   - Link lead to new contact
   - Set isNewContact = true
```

**Implementation**: `ContactDatabase.findOrCreateContact()` in `src/db/contacts.ts`

**Benefits:**
- Prevents duplicate contacts across multiple lead submissions
- Maintains relationship history between leads and contacts
- Updates contact information with latest data
- Enables tracking of lead-to-contact ratio

---

### 7. **Lead Storage Process**

#### Database Tables

**contacts table:**
```sql
- id (INTEGER, 6-digit unique)
- webhook_id (TEXT)
- phone (TEXT, normalized +1XXXXXXXXXX)
- first_name, last_name
- email, address, city, state, zip_code
- created_at, updated_at
- UNIQUE INDEX: webhook_id + phone
```

**leads table:**
```sql
- id (INTEGER, 10-digit unique)
- contact_id (INTEGER, FK to contacts)
- webhook_id (TEXT)
- lead_type (TEXT)
- first_name, last_name, email, phone
- address, address2, city, state, zip_code
- source, productid, subsource, landing_page_url
- consent_description, consent_value, tcpa_compliance
- campaign_id, utm_source, utm_medium, utm_campaign
- monthly_electric_bill, property_type, roof_condition, etc.
- raw_payload (JSON)
- ip_address, user_agent
- status (default: 'new')
- created_at, updated_at, processed_at
- conversion_score, revenue_potential
- priority, assigned_to, follow_up_date, contact_attempts
```

#### Lead Creation Steps:

```typescript
// 1. Find or create contact
const { contact, isNew } = await contactDb.findOrCreateContact(
  webhookId, 
  normalizedPhone, 
  contactRecord
)

// 2. Generate unique 10-digit lead ID
const leadId = await generateUniqueId(db, 'leads', generateLeadId)

// 3. Insert lead record
await db.prepare(`INSERT INTO leads (...) VALUES (...)`)
  .bind(leadId, contact.id, webhookId, ...)
  .run()

// 4. Update webhook statistics
await db.prepare(`
  UPDATE webhook_configs 
  SET total_leads = total_leads + 1,
      last_lead_at = CURRENT_TIMESTAMP
  WHERE webhook_id = ?
`).run()

// 5. Log provider usage
await db.prepare(`
  INSERT OR REPLACE INTO provider_usage_log (...)
`).run()

// 6. Log lead creation event
await leadDb.logLeadEvent(leadId, 'created', { source })
```

---

### 8. **Response Format**

#### Success Response (201 Created)

**For new contact:**
```json
{
  "status": "success",
  "message": "New contact created and lead processed successfully",
  "webhook_id": "click-ventures_ws_us_general_656",
  "contact_id": 650963,
  "lead_id": 1234567890,
  "email": "john.doe@example.com",
  "processed_at": "2025-10-10T12:00:00.000Z",
  "contact_status": "new",
  "next_steps": [
    "Lead data validated and normalized",
    "New contact created in database",
    "Lead stored and linked to contact",
    "Lead processing pipeline triggered",
    "CRM notification sent"
  ],
  "timestamp": "2025-10-10T12:00:00.000Z"
}
```

**For existing contact:**
```json
{
  "status": "success",
  "message": "Lead added to existing contact successfully",
  "webhook_id": "click-ventures_ws_us_general_656",
  "contact_id": 650963,
  "lead_id": 1234567891,
  "email": "john.doe@example.com",
  "processed_at": "2025-10-10T12:00:00.000Z",
  "contact_status": "existing",
  "next_steps": [
    "Lead data validated and normalized",
    "Lead added to existing contact",
    "Lead stored and linked to contact",
    "Lead processing pipeline triggered",
    "CRM notification sent"
  ],
  "timestamp": "2025-10-10T12:00:00.000Z"
}
```

---

### 9. **Error Handling**

#### Common Error Responses:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid webhook ID format | Webhook ID doesn't match pattern |
| 400 | Invalid phone number | Phone number validation failed |
| 400 | Invalid content type | Content-Type is not application/json |
| 400 | Invalid JSON | Request body is not valid JSON |
| 401 | Missing provider authentication | Authorization header missing |
| 401 | Invalid provider | Provider not found or inactive |
| 401 | Invalid signature | Webhook signature verification failed |
| 403 | Provider access denied | Provider not authorized for webhook |
| 404 | Webhook not configured | Webhook doesn't exist or is inactive |
| 422 | Validation failed | Lead data doesn't match schema |
| 500 | Database error | Database operation failed |
| 500 | Internal server error | Unexpected error occurred |

**Error response format:**
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": "Additional context (when applicable)",
  "timestamp": "2025-10-10T12:00:00.000Z"
}
```

---

### 10. **Logging and Analytics**

#### Events Logged:

1. **Lead Events** (`lead_events` table)
   - `created` - When lead is first received
   - `status_change` - When lead status changes
   - `updated` - When lead data is modified

2. **Contact Events** (`contact_events` table)
   - `created` - When new contact is created
   - `updated` - When contact information is updated

3. **Provider Usage** (`provider_usage_log` table)
   - Tracks requests per provider per webhook per day
   - Used for analytics and billing

4. **Webhook Statistics** (`webhook_configs` table)
   - `total_leads` - Incremented on each lead
   - `last_lead_at` - Updated with each lead
   - Used for dashboard metrics

---

## Frontend Integration

The webhook management UI (`src/pages/Webhooks.tsx`) displays:

- List of all webhooks with statistics
- Real-time metrics (leads, conversion rate, revenue)
- Toggle webhook status (active/disabled)
- Copy webhook URL to clipboard
- Create new webhooks
- Delete webhooks (soft delete with 24-hour restoration window)
- View API documentation

**API endpoint used:**
```typescript
GET /webhook - List all webhooks with statistics
POST /webhook - Create new webhook
GET /webhook/:webhookId - Health check specific webhook
POST /webhook/:webhookId - Receive lead data
PATCH /webhook/:webhookId/status - Enable/disable webhook
DELETE /webhook/:webhookId - Delete webhook (soft delete)
POST /webhook/:webhookId/restore - Restore soft-deleted webhook
```

---

## Security Features

1. **Provider Authentication**: Required authorization header
2. **Webhook Signature**: Optional HMAC-SHA256 verification
3. **CORS Protection**: Whitelisted origins only
4. **Rate Limiting**: 100 requests/minute per IP (via middleware)
5. **Input Validation**: Zod schema validation
6. **SQL Injection Protection**: Prepared statements with parameter binding
7. **Security Headers**: 
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`

---

## Performance Optimizations

1. **Edge Computing**: Deployed on Cloudflare Workers (runs at edge locations)
2. **D1 Database**: Distributed SQLite with low latency
3. **Prepared Statements**: Query caching and optimization
4. **Batch Operations**: Multiple DB operations in single transaction
5. **Fire-and-forget Updates**: Provider last_used_at updated asynchronously
6. **Index Optimization**: Unique composite index on webhook_id + phone

---

## Testing

### Example cURL Request

```bash
curl -X POST https://api.homeprojectpartners.com/webhook/click-ventures_ws_us_general_656 \
  -H "Content-Type: application/json" \
  -H "Authorization: click_ventures_001" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90210",
    "source": "Google Ads",
    "productid": "Solar",
    "subsource": "Solar Installation Campaign",
    "landing_page_url": "https://solarpanel.com/ca-landing",
    "consent": {
      "description": "By providing your phone number, you consent to receive marketing messages via text.",
      "value": true
    },
    "tcpa_compliance": true
  }'
```

### Test Scripts
- `/webhook-api/test-webhook-api.sh` - Comprehensive API testing
- `/demo_conversion_data.sh` - Generate demo conversion data
- `/test_conversion_api.sh` - Test conversion tracking

---

## Database Schema Relationships

### ASCII Diagram - Complete Database Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WEBHOOK CONFIGURATION                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  webhook_configs                                                │    │
│  │  • webhook_id (PK) - Unique webhook identifier                  │    │
│  │  • name            - Human-readable name                        │    │
│  │  • is_active       - Enable/disable webhook                     │    │
│  │  • total_leads     - Running count of leads                     │
│  │  • deleted_at      - Soft deletion timestamp                    │    │
│  └──────────────────────────┬─────────────────────────────────────┘    │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ 1:N (One webhook has many contacts)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTACT ENTITY (Primary)                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  contacts                                                       │    │
│  │  • id (PK)         - 6-digit unique contact ID                  │    │
│  │  • webhook_id (FK) - Links to webhook_configs                   │    │
│  │  • phone           - Normalized phone (+1XXXXXXXXXX)            │    │
│  │  • first_name      - Contact first name                         │    │
│  │  • last_name       - Contact last name                          │    │
│  │  • email           - Contact email                              │    │
│  │  • address         - Contact address                            │    │
│  │  • city, state, zip_code                                        │    │
│  │                                                                 │    │
│  │  UNIQUE INDEX: (webhook_id, phone) ← Deduplication key         │    │
│  └──────────────────────────┬─────────────────────────────────────┘    │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ 1:N (One contact has many leads)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEAD ENTITY (Campaign-Specific)                      │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  leads                                                          │    │
│  │  • id (PK)         - 10-digit unique lead ID                    │    │
│  │  • contact_id (FK) - Links to contacts table                    │    │
│  │  • webhook_id (FK) - Links to webhook_configs                   │    │
│  │  • lead_type       - solar | hvac | insurance                   │    │
│  │  • first_name, last_name, email, phone (Lead-specific data)     │    │
│  │  • source          - Lead source (e.g., "Google Ads")           │    │
│  │  • productid       - Product type (Solar, HVAC, etc.)           │    │
│  │  • subsource       - Campaign/affiliate info                    │    │
│  │  • status          - new | contacted | qualified | converted    │    │
│  │  • raw_payload     - Complete JSON payload                      │    │
│  │  • created_at, updated_at, processed_at                         │    │
│  └────────┬──────────────────────┬──────────────────────────────┬─┘    │
└───────────┼──────────────────────┼──────────────────────────────┼──────┘
            │                      │                              │
            │ 1:N                  │ 1:N                          │ 1:N
            │                      │                              │
            ▼                      ▼                              ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  lead_events     │  │  lead_status_history │  │  lead_activities     │
│  • lead_id (FK)  │  │  • lead_id (FK)      │  │  • lead_id (FK)      │
│  • event_type    │  │  • old_status        │  │  • activity_type     │
│  • event_data    │  │  • new_status        │  │  • title             │
│  • created_at    │  │  • changed_by        │  │  • description       │
└──────────────────┘  │  • reason            │  │  • created_by        │
                      │  • created_at        │  │  • activity_date     │
                      └──────────────────────┘  └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      PROVIDER AUTHENTICATION                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  lead_source_providers                                          │    │
│  │  • provider_id (PK)  - e.g., "click_ventures_001"              │    │
│  │  • provider_name     - Human-readable name                      │    │
│  │  • is_active         - Enable/disable provider                  │    │
│  │  • allowed_webhooks  - JSON array of webhook restrictions       │    │
│  │  • last_used_at      - Last request timestamp                   │    │
│  └────────────────────────┬───────────────────────────────────────┘    │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ N:N (Providers access many webhooks)
                             │
                             ▼
          ┌────────────────────────────────────────┐
          │  provider_usage_log                    │
          │  • provider_id (FK)                    │
          │  • webhook_id (FK)                     │
          │  • request_count - Daily request count │
          │  • date          - YYYY-MM-DD          │
          │                                        │
          │  UNIQUE INDEX: (provider_id,           │
          │                 webhook_id, date)      │
          └────────────────────────────────────────┘
```

### Example: One Contact, Multiple Leads

```
John Doe (Contact ID: 650963)
Phone: +15551234567
├── Lead #1234567890 (Solar Campaign)
│   ├── Source: Google Ads
│   ├── Product: Solar Installation
│   ├── Status: new
│   ├── Created: 2025-09-01
│   └── Events:
│       └── created, status_change, contacted
│
├── Lead #9876543210 (HVAC Campaign)
│   ├── Source: Facebook Ads
│   ├── Product: HVAC Repair
│   ├── Status: qualified
│   ├── Created: 2025-09-15
│   └── Events:
│       └── created, status_change, qualified
│
└── Lead #5555555555 (Insurance Campaign)
    ├── Source: Email Marketing
    ├── Product: Home Insurance
    ├── Status: converted
    ├── Created: 2025-10-01
    └── Events:
        └── created, contacted, converted

Result: 1 Contact → 3 Leads across different campaigns
```

### Relationships Summary

```
WEBHOOKS (1:N) ────▶ CONTACTS (1:N) ────▶ LEADS (1:N) ────▶ EVENTS
     │                    │                   │
     │                    │                   └────▶ STATUS HISTORY
     │                    │                   │
     │                    │                   └────▶ ACTIVITIES
     │                    │
     │                    └────▶ CONTACT EVENTS
     │
     └──────────────────────────────────────────────▶ PROVIDER USAGE

PROVIDERS (N:N) ◀──────────────────────▶ WEBHOOKS
```

---

## Key Files Reference

### Core Implementation
- `/webhook-api/webhook-api/src/index.ts` - Main application entry point
- `/webhook-api/webhook-api/src/routes/webhook.ts` - Webhook endpoint handlers
- `/webhook-api/webhook-api/src/db/leads.ts` - Lead database operations
- `/webhook-api/webhook-api/src/db/contacts.ts` - Contact deduplication logic
- `/webhook-api/webhook-api/src/types/leads.ts` - Type definitions and schemas
- `/webhook-api/webhook-api/src/utils/phone.ts` - Phone normalization utility
- `/webhook-api/webhook-api/src/middleware/validation.ts` - Request validation
- `/webhook-api/webhook-api/src/middleware/error-handler.ts` - Error handling

### Frontend
- `/src/pages/Webhooks.tsx` - Webhook management UI
- `/src/components/ApiDocumentation.tsx` - API documentation modal
- `/src/components/webhooks/SoftDeleteDialog.tsx` - Soft delete confirmation
- `/src/components/webhooks/SoftDeletedWebhooksPanel.tsx` - Deleted webhooks view

### Documentation
- `/webhook-api/API_DOCUMENTATION.md` - Complete API reference
- `/docs/webhook-soft-deletion/` - Soft deletion system documentation
- `/WEBHOOK_SOFT_DELETE_DEPLOYMENT.md` - Deployment guide

---

## Best Practices Implemented

1. ✅ **Idempotency**: Phone-based deduplication prevents duplicate contacts
2. ✅ **Validation**: Multi-layer validation (webhook, provider, schema)
3. ✅ **Normalization**: Phone numbers normalized to consistent format
4. ✅ **Logging**: Comprehensive event logging for audit trail
5. ✅ **Error Handling**: Graceful error handling with detailed messages
6. ✅ **Security**: Provider authentication and optional signature verification
7. ✅ **Performance**: Edge computing with optimized database queries
8. ✅ **Monitoring**: Statistics tracking and analytics
9. ✅ **Documentation**: Well-documented API with examples
10. ✅ **Type Safety**: Full TypeScript implementation with Zod validation

---

## Conclusion

The webhook lead receiving implementation is a robust, production-ready system that:

- Handles multiple lead types with flexible schema validation
- Prevents duplicate contacts through intelligent deduplication
- Provides comprehensive security and authentication
- Offers detailed logging and analytics
- Scales efficiently with edge computing
- Maintains backward compatibility with multiple schema formats
- Includes soft deletion with restoration capability

The system is well-architected for reliability, maintainability, and extensibility.

