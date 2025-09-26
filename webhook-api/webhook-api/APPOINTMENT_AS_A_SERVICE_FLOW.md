# Appointment-as-a-Service: End-to-End Flow Documentation

## Business Model Overview

**homeprojectpartners ** operates as an **Appointment-as-a-Service** platform that:
1. Receives raw leads from 3rd party lead providers
2. Converts those leads into qualified appointments
3. Routes appointments to client businesses based on matching criteria
4. Forwards appointment data to client systems via webhooks

This creates a scalable lead-to-appointment pipeline where clients pay for qualified, scheduled appointments rather than raw leads.

## End-to-End System Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           APPOINTMENT-AS-A-SERVICE PIPELINE                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: LEAD INGESTION
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   3rd Party     │    │   3rd Party     │    │   3rd Party     │
│   Provider A    │    │   Provider B    │    │   Provider C    │
│                 │    │                 │    │                 │
│ ├ Solar Leads   │    │ ├ HVAC Leads    │    │ ├ Kitchen Leads │
│ ├ Zip: 90210    │    │ ├ Zip: 10001    │    │ ├ Zip: 60601    │
│ └ $50-100/lead  │    │ └ $75-125/lead  │    │ └ $30-80/lead   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    WEBHOOK ENDPOINTS                        │
    │  POST /webhook/provider-a   POST /webhook/provider-b        │
    │  POST /webhook/provider-c   POST /leads/receive             │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼

PHASE 2: DATA PROCESSING & STORAGE
    ┌─────────────────────────────────────────────────────────────┐
    │      homeprojectpartners API PROCESSING                     │
    │                                                             │
    │  ┌─ Phone Number Normalization (+1XXXXXXXXXX)              │
    │  ├─ Contact Deduplication (phone + provider_id)            │
    │  ├─ Lead Classification & Validation                       │
    │  └─ Appointment Scheduling Logic                           │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE D1 DATABASE STORAGE                         │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │    CONTACTS     │  │      LEADS      │  │  APPOINTMENTS   │                │
│  │                 │  │                 │  │                 │                │
│  │ ├ id (PK)       │  │ ├ id (PK)       │  │ ├ id (PK)       │                │
│  │ ├ phone_normal  │  │ ├ contact_id    │  │ ├ lead_id       │                │
│  │ ├ provider_id   │  │ ├ source        │  │ ├ contact_id    │                │
│  │ ├ first_name    │  │ ├ product_type  │  │ ├ service_type  │                │
│  │ ├ last_name     │  │ ├ estimated_val │  │ ├ customer_zip  │                │
│  │ ├ email         │  │ ├ zip_code      │  │ ├ scheduled_at  │                │
│  │ └ created_at    │  │ └ created_at    │  │ ├ routing_match │                │
│  └─────────────────┘  └─────────────────┘  │ ├ workspace_id  │                │
│           │                     │           │ ├ forward_status│                │
│           └─────────────────────┼───────────┤ └ created_at    │                │
│                                 │           └─────────────────┘                │
│                                 │                     │                        │
│                                 └─────────────────────┘                        │
│                                                                                 │
│  Relationships:                                                                 │
│  • contacts.id → leads.contact_id (1:M)                                        │
│  • leads.id → appointments.lead_id (1:1)                                       │
│  • contacts.id → appointments.contact_id (1:M)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼

PHASE 3: APPOINTMENT ROUTING ENGINE
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ROUTING LOGIC ENGINE                                 │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      ROUTING CRITERIA MATCHING                         │   │
│  │                                                                         │   │
│  │  Input: service_type="Solar", customer_zip="90210"                     │   │
│  │                                                                         │   │
│  │  Query: SELECT * FROM appointment_routing_rules WHERE                  │   │
│  │         JSON_EXTRACT(product_types, '$') LIKE '%Solar%' AND            │   │
│  │         JSON_EXTRACT(zip_codes, '$') LIKE '%90210%' AND                │   │
│  │         is_active = 1 ORDER BY priority ASC LIMIT 1;                  │   │
│  │                                                                         │   │
│  │  Result: workspace_id = "solar_west_coast"                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      ROUTING RULES DATABASE                                    │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                    APPOINTMENT_ROUTING_RULES                             │  │
│  │                                                                          │  │
│  │  ├ id: 1                                                                 │  │
│  │  ├ workspace_id: "solar_west_coast"                                     │  │
│  │  ├ product_types: ["Solar", "Battery"]                                  │  │
│  │  ├ zip_codes: ["90210", "90211", "90212", ...]                         │  │
│  │  ├ priority: 1                                                          │  │
│  │  └ is_active: true                                                      │  │
│  │                                                                          │  │
│  │  ├ id: 2                                                                 │  │
│  │  ├ workspace_id: "hvac_northeast"                                       │  │
│  │  ├ product_types: ["HVAC", "Heat Pump"]                                 │  │
│  │  ├ zip_codes: ["10001", "10002", "10003", ...]                         │  │
│  │  ├ priority: 2                                                          │  │
│  │  └ is_active: true                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼

PHASE 4: CLIENT WORKSPACE ASSIGNMENT
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACES DATABASE                                  │
│                                                                                 │
│  ┌─ solar_west_coast ─────────────────────────────────────────────────────┐   │
│  │ ├ name: "Solar West Coast Team"                                        │   │
│  │ ├ outbound_webhook_url: "https://solar-client.com/webhooks/appts"     │   │
│  │ ├ webhook_active: true                                                 │   │
│  │ ├ business_type: "Solar Installation"                                  │   │
│  │ └ payment_rate: "$150/appointment"                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─ hvac_northeast ───────────────────────────────────────────────────────┐   │
│  │ ├ name: "HVAC Northeast Division"                                      │   │
│  │ ├ outbound_webhook_url: "https://hvac-pros.com/api/appointments"      │   │
│  │ ├ webhook_active: true                                                 │   │
│  │ ├ business_type: "HVAC Services"                                       │   │
│  │ └ payment_rate: "$125/appointment"                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼

PHASE 5: APPOINTMENT FORWARDING (WEBHOOK DELIVERY)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WEBHOOK FORWARDING ENGINE                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PAYLOAD CONSTRUCTION                           │   │
│  │                                                                         │   │
│  │  {                                                                      │   │
│  │    "appointment_id": 12345,                                            │   │
│  │    "customer_name": "John Solar Customer",                             │   │
│  │    "customer_phone": "555-123-4567",                                   │   │
│  │    "customer_email": "john@example.com",                               │   │
│  │    "service_type": "Solar",                                            │   │
│  │    "customer_zip": "90210",                                            │   │
│  │    "appointment_date": "2024-12-01T14:00:00Z",                         │   │
│  │    "estimated_value": 25000,                                           │   │
│  │    "notes": "Interested in 10kW solar system",                         │   │
│  │    "routing_method": "auto",                                           │   │
│  │    "matched_at": "2024-01-15T10:30:00Z",                               │   │
│  │    "workspace_id": "solar_west_coast"                                  │   │
│  │  }                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT DELIVERY                                   │
│                                                                                 │
│  POST https://solar-client.com/webhooks/appts                                  │
│  Headers:                                                                       │
│  ├ Content-Type: application/json                                              │
│  ├ User-Agent: Convio-Appointment-Router/1.0                                   │
│  └ X-Webhook-Source: appointment-routing                                       │
│                                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐                         │
│  │  Solar Client   │◀─────────────│   HVAC Client   │                         │
│  │   Business      │   Webhook    │    Business     │                         │
│  │                 │   Delivery   │                 │                         │
│  │ ├ CRM System    │              │ ├ Scheduling    │                         │
│  │ ├ Lead Routing  │              │ ├ Sales Team    │                         │
│  │ ├ Sales Team    │              │ ├ Technicians   │                         │
│  │ └ $150/appt     │              │ └ $125/appt     │                         │
│  └─────────────────┘              └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼

PHASE 6: DELIVERY TRACKING & BILLING
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        APPOINTMENT DELIVERY TRACKING                           │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │              UPDATE APPOINTMENT RECORD                                  │   │
│  │                                                                         │   │
│  │  UPDATE appointments SET                                                │   │
│  │    forward_status = 'success',                                         │   │
│  │    forwarded_at = CURRENT_TIMESTAMP,                                   │   │
│  │    forward_response = '{"status": "received"}',                        │   │
│  │    forward_attempts = 1                                                │   │
│  │  WHERE id = 12345;                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    BILLING RECORD CREATION                             │   │
│  │                                                                         │   │
│  │  INSERT INTO billing_events (                                          │   │
│  │    appointment_id, workspace_id, billable_amount,                      │   │
│  │    delivery_status, delivery_timestamp                                 │   │
│  │  ) VALUES (                                                            │   │
│  │    12345, 'solar_west_coast', 150.00,                                  │   │
│  │    'delivered', '2024-01-15 10:30:00'                                  │   │
│  │  );                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Database Schema & Relationships

### Core Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE RELATIONSHIP MAP                            │
└─────────────────────────────────────────────────────────────────────────────────┘

LEAD PROVIDER    →    CONTACTS    →    LEADS    →    APPOINTMENTS
     │                    │             │              │
     │                    │             │              ▼
     │                    │             │         ┌─────────────────┐
     │                    │             │         │  ROUTING RULES  │
     │                    │             │         │                 │
     │                    │             │         │ ├ workspace_id  │
     │                    │             │         │ ├ product_types │
     │                    │             │         │ ├ zip_codes     │
     │                    │             │         │ └ priority      │
     │                    │             │         └─────────────────┘
     │                    │             │              │
     │                    │             │              ▼
     │                    │             │         ┌─────────────────┐
     │                    │             │         │   WORKSPACES    │
     │                    │             │         │                 │
     │                    │             │         │ ├ id            │
     │                    │             │         │ ├ name          │
     │                    │             │         │ ├ webhook_url   │
     │                    │             │         │ └ webhook_active│
     │                    │             │         └─────────────────┘
     │                    │             │              │
     │                    │             │              ▼
     ▼                    ▼             ▼         ┌─────────────────┐
┌──────────┐    ┌──────────────┐  ┌──────────┐  │ APPOINTMENT     │
│PROVIDERS │    │   CONTACTS   │  │  LEADS   │  │    EVENTS       │
│          │    │              │  │          │  │                 │
│├ id      │    │├ id (PK)     │  │├ id (PK) │  │├ appointment_id │
│├ name    │    │├ phone_norm  │  │├ contact │  │├ event_type     │
│├ webhook │    │├ provider_id │  │├ source  │  │├ event_data     │
│└ active  │    │├ first_name  │  │├ product │  │├ metadata       │
└──────────┘    │├ last_name   │  │├ est_val │  │└ created_at     │
     │          │├ email       │  │├ zip     │  └─────────────────┘
     │          │└ created_at  │  │└ created │           ▲
     └──────────┤              │  └──────────┘           │
                └──────────────┘       │                  │
                     │                 │                  │
                     └─────────────────┼──────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  APPOINTMENTS   │
                              │                 │
                              │├ id (PK)        │
                              │├ lead_id (FK)   │
                              │├ contact_id(FK) │
                              │├ service_type   │
                              │├ customer_zip   │
                              │├ scheduled_at   │
                              │├ workspace_id   │
                              │├ routing_method │
                              │├ forward_status │
                              │├ forwarded_at   │
                              │├ forward_resp   │
                              │└ created_at     │
                              └─────────────────┘
```

### Database Tables Detail

#### 1. **contacts** (Customer Identity Management)
```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  phone_normalized TEXT NOT NULL,        -- +1XXXXXXXXXX format
  lead_source_provider_id TEXT,          -- Links to provider
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(phone_normalized, lead_source_provider_id)
);
```

#### 2. **leads** (Business Opportunities)
```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,           -- Links to contact
  source TEXT,                           -- Lead source/provider
  product_type TEXT,                     -- Solar, HVAC, Kitchen, etc.
  estimated_value REAL,                  -- Potential deal value
  zip_code TEXT,                         -- Geographic location
  interest_level TEXT,                   -- Hot, warm, cold
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
```

#### 3. **appointments** (Scheduled Meetings)
```sql
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL,              -- Links to lead
  contact_id INTEGER NOT NULL,           -- Links to contact
  customer_name TEXT,                    -- Convenience field
  customer_phone TEXT,                   -- Convenience field
  customer_email TEXT,                   -- Convenience field
  service_type TEXT,                     -- Service requested
  customer_zip TEXT,                     -- Location
  appointment_date DATETIME,             -- Scheduled time
  estimated_value REAL,                  -- Deal value
  matched_workspace_id TEXT,             -- Routed workspace
  routing_method TEXT,                   -- auto/manual
  forwarded_at DATETIME,                 -- Webhook sent time
  forward_status TEXT DEFAULT 'pending', -- pending/success/failed
  forward_response TEXT,                 -- Webhook response
  forward_attempts INTEGER DEFAULT 0,    -- Retry count
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
```

#### 4. **appointment_routing_rules** (Matching Criteria)
```sql
CREATE TABLE appointment_routing_rules (
  id INTEGER PRIMARY KEY,
  workspace_id TEXT NOT NULL,            -- Target workspace
  product_types TEXT NOT NULL,           -- JSON array ["Solar","Battery"]
  zip_codes TEXT NOT NULL,               -- JSON array ["90210","90211"]
  priority INTEGER DEFAULT 1,            -- Matching order
  is_active BOOLEAN DEFAULT 1,           -- Rule enabled/disabled
  notes TEXT,                            -- Description
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. **workspaces** (Client Businesses)
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,                   -- solar_west_coast
  name TEXT NOT NULL,                    -- "Solar West Coast Team"
  outbound_webhook_url TEXT,             -- Client webhook endpoint
  webhook_active BOOLEAN DEFAULT 0,      -- Webhook enabled
  business_type TEXT,                    -- Solar, HVAC, Kitchen
  payment_rate REAL,                     -- Revenue per appointment
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Revenue Model & Business Logic

### Appointment-as-a-Service Economics

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REVENUE FLOW                                      │
│                                                                                 │
│  LEAD COSTS          PROCESSING COSTS        CLIENT REVENUE                     │
│                                                                                 │
│  Provider A: $75  →  ┌─────────────────┐  →  Solar Team: $150/appt             │
│  Provider B: $50  →  │  HPP MARKUP  │  →  HVAC Team: $125/appt              │
│  Provider C: $60  →  │                 │  →  Kitchen Team: $100/appt            │
│                      │  ├ Qualification │                                       │
│                      │  ├ Scheduling    │  GROSS MARGIN                         │
│                      │  ├ Routing       │  = $150 - $75 = $75/appt             │
│                      │  └ Delivery      │  = 100% markup                        │
│                      └─────────────────┘                                       │
│                                                                                 │
│  CONVERSION METRICS:                                                            │
│  ├ Lead-to-Appointment Rate: 60-80%                                            │
│  ├ Appointment Delivery Rate: 95%+                                             │
│  ├ Client Acceptance Rate: 90%+                                                │
│  └ Revenue Recognition: Upon webhook delivery                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## System Performance & Scale

### Throughput Specifications

```
SYSTEM CAPACITY:
├ Lead Ingestion: 10,000+ leads/day
├ Appointment Creation: 6,000+ appointments/day
├ Routing Processing: < 100ms per appointment
├ Webhook Delivery: < 2 seconds per appointment
└ Database Operations: 50,000+ queries/day

RELIABILITY METRICS:
├ Webhook Success Rate: 99.5%
├ Routing Accuracy: 99.8%
├ System Uptime: 99.9%
└ Data Consistency: 100%

GEOGRAPHIC COVERAGE:
├ United States: All 50 states
├ Zip Code Coverage: 41,000+ zip codes
├ Service Types: 15+ categories
└ Client Workspaces: 100+ active
```

## Integration Points & APIs

### Inbound APIs (Lead Reception)
- `POST /webhook/provider-{id}` - Provider-specific webhooks
- `POST /leads/receive` - Generic lead ingestion
- `POST /appointments/receive` - Direct appointment creation

### Outbound APIs (Client Delivery)
- Webhook forwarding to client endpoints
- Real-time appointment data transmission
- Delivery confirmation tracking

### Management APIs
- Routing rule configuration
- Workspace management
- Performance analytics
- Billing reconciliation

This end-to-end flow creates a scalable, profitable appointment delivery service that converts raw leads into qualified business opportunities for clients while maintaining data integrity and delivery reliability.