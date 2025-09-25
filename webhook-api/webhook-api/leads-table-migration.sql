-- Schema Migration: Remove AUTOINCREMENT from leads table only
-- This migration removes AUTOINCREMENT constraint to enable 10-digit custom lead IDs

-- Step 1: Create new leads table without AUTOINCREMENT
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

-- Step 2: Copy existing leads data (if any) to new table
INSERT INTO leads_new SELECT * FROM leads;

-- Step 3: Drop old leads table
DROP TABLE leads;

-- Step 4: Rename new table to leads
ALTER TABLE leads_new RENAME TO leads;

-- Step 5: Recreate indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_webhook_id ON leads(webhook_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);