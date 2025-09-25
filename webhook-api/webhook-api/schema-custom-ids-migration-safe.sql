-- Schema Migration: Remove AUTOINCREMENT to Allow Custom IDs (Safe Version)
-- This migration removes AUTOINCREMENT constraints to enable custom ID generation
-- Contact IDs: 6-digit unique numbers (100000-999999)
-- Lead IDs: 10-digit unique numbers (1000000000-9999999999)

-- Step 1: Drop views that depend on tables
DROP VIEW IF EXISTS contact_leads_view;

-- Step 2: Create new leads table without AUTOINCREMENT
CREATE TABLE IF NOT EXISTS leads_new (
  id INTEGER PRIMARY KEY,  -- No AUTOINCREMENT - allows custom IDs
  contact_id INTEGER,
  webhook_id TEXT NOT NULL,
  lead_type TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  source TEXT NOT NULL,
  campaign_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  monthly_electric_bill REAL,
  property_type TEXT,
  roof_condition TEXT,
  roof_age INTEGER,
  shade_coverage TEXT,
  system_type TEXT,
  system_age INTEGER,
  service_type TEXT,
  urgency TEXT,
  property_size INTEGER,
  policy_type TEXT,
  coverage_amount REAL,
  current_premium REAL,
  property_value REAL,
  claims_history TEXT,
  raw_payload TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  status TEXT DEFAULT 'new',
  notes TEXT,
  conversion_score REAL,
  revenue_potential REAL,
  status_changed_at DATETIME,
  status_changed_by TEXT,
  priority INTEGER DEFAULT 1,
  assigned_to TEXT,
  follow_up_date DATETIME,
  contact_attempts INTEGER DEFAULT 0,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- Step 3: Copy existing leads data (if any) to new table
INSERT INTO leads_new SELECT * FROM leads;

-- Step 4: Drop old leads table
DROP TABLE leads;

-- Step 5: Rename new table to leads
ALTER TABLE leads_new RENAME TO leads;

-- Step 6: Recreate indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_webhook_id ON leads(webhook_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);

-- Step 7: Create new contacts table without AUTOINCREMENT
CREATE TABLE IF NOT EXISTS contacts_new (
  id INTEGER PRIMARY KEY,  -- No AUTOINCREMENT - allows custom IDs
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

-- Step 8: Copy existing contacts data (if any) to new table
INSERT INTO contacts_new SELECT * FROM contacts;

-- Step 9: Drop old contacts table
DROP TABLE contacts;

-- Step 10: Rename new table to contacts
ALTER TABLE contacts_new RENAME TO contacts;

-- Step 11: Recreate indexes for contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_webhook_phone ON contacts(webhook_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

-- Step 12: Recreate the view
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