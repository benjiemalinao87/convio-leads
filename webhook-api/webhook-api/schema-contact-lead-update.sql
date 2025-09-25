-- Contact-Lead Relationship Schema Update
-- This updates the existing schema to support contact-lead relationships

-- Step 1: Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL,
  phone TEXT NOT NULL,           -- Normalized phone (+1XXXXXXXXXX)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,                    -- Primary email for contact
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Unique phone per webhook (one contact per phone per webhook)
  UNIQUE(webhook_id, phone)
);

-- Step 2: Create indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_webhook_phone ON contacts(webhook_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

-- Step 3: Add contact_id to existing leads table
-- First, add the column as nullable
ALTER TABLE leads ADD COLUMN contact_id INTEGER REFERENCES contacts(id);

-- Step 4: Create index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);

-- Step 5: Update lead_events table to also track contact events
CREATE TABLE IF NOT EXISTS contact_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,      -- 'created', 'updated', 'merged', etc.
  event_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_contact_events_contact_id ON contact_events(contact_id);

-- Step 6: Create a view that joins contacts and leads for easier querying
CREATE VIEW IF NOT EXISTS contact_leads_view AS
SELECT
  c.id as contact_id,
  c.webhook_id,
  c.phone as contact_phone,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.email as contact_email,
  c.address as contact_address,
  c.city as contact_city,
  c.state as contact_state,
  c.zip_code as contact_zip_code,
  c.created_at as contact_created_at,
  c.updated_at as contact_updated_at,

  l.id as lead_id,
  l.lead_type,
  l.email as lead_email,
  l.source,
  l.campaign_id,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.monthly_electric_bill,
  l.property_type,
  l.roof_condition,
  l.roof_age,
  l.shade_coverage,
  l.system_type,
  l.system_age,
  l.service_type,
  l.urgency,
  l.property_size,
  l.policy_type,
  l.coverage_amount,
  l.current_premium,
  l.property_value,
  l.claims_history,
  l.raw_payload,
  l.ip_address,
  l.user_agent,
  l.created_at as lead_created_at,
  l.updated_at as lead_updated_at,
  l.processed_at,
  l.status as lead_status,
  l.notes as lead_notes,
  l.conversion_score,
  l.revenue_potential

FROM contacts c
LEFT JOIN leads l ON c.id = l.contact_id
ORDER BY c.created_at DESC, l.created_at DESC;