-- Business Schema Migration: Add missing fields to support business-focused lead capture
-- This migration adds new optional fields without breaking existing functionality

-- Add new fields to leads table
ALTER TABLE leads ADD COLUMN address2 TEXT;
ALTER TABLE leads ADD COLUMN productid TEXT;
ALTER TABLE leads ADD COLUMN subsource TEXT;
ALTER TABLE leads ADD COLUMN landing_page_url TEXT;
ALTER TABLE leads ADD COLUMN consent_description TEXT;
ALTER TABLE leads ADD COLUMN consent_value BOOLEAN;
ALTER TABLE leads ADD COLUMN tcpa_compliance BOOLEAN;

-- Add new fields to contacts table for consistency
ALTER TABLE contacts ADD COLUMN address2 TEXT;

-- Create indexes for new commonly queried fields
CREATE INDEX IF NOT EXISTS idx_leads_productid ON leads(productid);
CREATE INDEX IF NOT EXISTS idx_leads_subsource ON leads(subsource);
CREATE INDEX IF NOT EXISTS idx_leads_tcpa_compliance ON leads(tcpa_compliance);
CREATE INDEX IF NOT EXISTS idx_leads_consent_value ON leads(consent_value);

-- Update comments for documentation
PRAGMA table_info(leads);

-- Migration completed successfully
-- New fields added:
--   - address2: Secondary address line (apt, unit, suite)
--   - productid: Expected values: Kitchen, Bath, Roofing, Basement Waterproofing, Solar
--   - subsource: Specific campaign, affiliate, or channel
--   - landing_page_url: Page URL where the lead form was submitted
--   - consent_description: Full SMS/marketing consent language provided at capture
--   - consent_value: Boolean - true = consent given, false = not given
--   - tcpa_compliance: Boolean - Was TCPA language shown & agreed to