-- Conversion Tracking System Migration
-- This migration adds conversion tracking capabilities to the Convio Leads system
-- Date: 2025-01-25

-- ============================================
-- STEP 1: Create conversions table
-- ============================================
CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,  -- UUID format for unique identification
  contact_id INTEGER NOT NULL,
  lead_id INTEGER,
  workspace_id TEXT NOT NULL,
  converted_by TEXT NOT NULL,
  converted_at DATETIME NOT NULL,
  conversion_type TEXT NOT NULL,  -- 'sale', 'appointment', 'qualified', 'proposal', 'contract'
  conversion_value REAL,
  currency TEXT DEFAULT 'USD',
  custom_data TEXT,  -- JSON field for dynamic structured data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Create indexes for conversions table
CREATE INDEX IF NOT EXISTS idx_conversions_contact_id ON conversions(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversions_lead_id ON conversions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversions_workspace_id ON conversions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversions_type ON conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON conversions(converted_at);
CREATE INDEX IF NOT EXISTS idx_conversions_value ON conversions(conversion_value);

-- ============================================
-- STEP 2: Create workspace_tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  lead_id INTEGER,
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'sent', 'received', 'converted', 'updated', 'qualified', 'rejected'
  action_details TEXT,  -- Additional context about the action
  performed_by TEXT,  -- User who performed the action
  metadata TEXT,  -- JSON field for additional data
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Create indexes for workspace_tracking table
CREATE INDEX IF NOT EXISTS idx_workspace_tracking_contact_id ON workspace_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tracking_lead_id ON workspace_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tracking_workspace_id ON workspace_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tracking_action ON workspace_tracking(action);
CREATE INDEX IF NOT EXISTS idx_workspace_tracking_timestamp ON workspace_tracking(timestamp);

-- ============================================
-- STEP 3: Create workspaces table
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,  -- workspace_id
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  permissions TEXT,  -- JSON array of permissions
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME,
  total_conversions INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  metadata TEXT  -- JSON field for workspace configuration
);

-- Create indexes for workspaces table
CREATE INDEX IF NOT EXISTS idx_workspaces_api_key ON workspaces(api_key);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_active ON workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_activity ON workspaces(last_activity_at);

-- ============================================
-- STEP 4: Update contacts table with conversion fields
-- ============================================
ALTER TABLE contacts ADD COLUMN sent_from_workspace TEXT;
ALTER TABLE contacts ADD COLUMN converted_from_workspace TEXT;
ALTER TABLE contacts ADD COLUMN conversion_status TEXT DEFAULT 'pending';
ALTER TABLE contacts ADD COLUMN converted_timestamp DATETIME;
ALTER TABLE contacts ADD COLUMN converted_by TEXT;
ALTER TABLE contacts ADD COLUMN custom_metadata TEXT;  -- JSON field for custom data
ALTER TABLE contacts ADD COLUMN lifetime_value REAL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN conversion_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN last_conversion_id TEXT;
ALTER TABLE contacts ADD COLUMN qualification_score REAL;

-- Create indexes for new contact fields
CREATE INDEX IF NOT EXISTS idx_contacts_conversion_status ON contacts(conversion_status);
CREATE INDEX IF NOT EXISTS idx_contacts_sent_from_workspace ON contacts(sent_from_workspace);
CREATE INDEX IF NOT EXISTS idx_contacts_converted_from_workspace ON contacts(converted_from_workspace);
CREATE INDEX IF NOT EXISTS idx_contacts_converted_timestamp ON contacts(converted_timestamp);
CREATE INDEX IF NOT EXISTS idx_contacts_lifetime_value ON contacts(lifetime_value);

-- ============================================
-- STEP 5: Update leads table with workspace fields
-- ============================================
ALTER TABLE leads ADD COLUMN workspace_id TEXT;
ALTER TABLE leads ADD COLUMN conversion_id TEXT;
ALTER TABLE leads ADD COLUMN conversion_metadata TEXT;  -- JSON field for conversion-specific data
ALTER TABLE leads ADD COLUMN workspace_assigned_at DATETIME;
ALTER TABLE leads ADD COLUMN workspace_status TEXT;

-- Create indexes for new lead fields
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_conversion_id ON leads(conversion_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON leads(workspace_status);

-- ============================================
-- STEP 6: Create conversion_events table for detailed tracking
-- ============================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversion_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'status_change', 'value_update', 'note_added', etc.
  event_data TEXT,  -- JSON field with event details
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversion_id) REFERENCES conversions(id)
);

-- Create indexes for conversion_events table
CREATE INDEX IF NOT EXISTS idx_conversion_events_conversion_id ON conversion_events(conversion_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created_at ON conversion_events(created_at);

-- ============================================
-- STEP 7: Create conversion_analytics_cache table
-- ============================================
CREATE TABLE IF NOT EXISTS conversion_analytics_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,
  cache_data TEXT NOT NULL,  -- JSON field with cached analytics
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cache expiration
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON conversion_analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON conversion_analytics_cache(cache_key);

-- ============================================
-- STEP 8: Create views for analytics
-- ============================================

-- View for conversion summary by workspace
CREATE VIEW IF NOT EXISTS v_workspace_conversion_summary AS
SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  COUNT(DISTINCT c.id) as total_conversions,
  SUM(c.conversion_value) as total_revenue,
  AVG(c.conversion_value) as avg_conversion_value,
  COUNT(DISTINCT c.contact_id) as unique_contacts_converted,
  MAX(c.converted_at) as last_conversion_date
FROM workspaces w
LEFT JOIN conversions c ON w.id = c.workspace_id
GROUP BY w.id, w.name;

-- View for conversion funnel
CREATE VIEW IF NOT EXISTS v_conversion_funnel AS
SELECT
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT CASE WHEN l.status = 'contacted' THEN l.id END) as contacted_leads,
  COUNT(DISTINCT CASE WHEN l.status = 'qualified' THEN l.id END) as qualified_leads,
  COUNT(DISTINCT c.lead_id) as converted_leads,
  ROUND(COUNT(DISTINCT c.lead_id) * 100.0 / NULLIF(COUNT(DISTINCT l.id), 0), 2) as conversion_rate
FROM leads l
LEFT JOIN conversions c ON l.id = c.lead_id;

-- View for daily conversion metrics
CREATE VIEW IF NOT EXISTS v_daily_conversion_metrics AS
SELECT
  DATE(converted_at) as conversion_date,
  COUNT(*) as conversion_count,
  SUM(conversion_value) as daily_revenue,
  AVG(conversion_value) as avg_value,
  COUNT(DISTINCT workspace_id) as active_workspaces,
  COUNT(DISTINCT converted_by) as active_agents
FROM conversions
GROUP BY DATE(converted_at);

-- ============================================
-- STEP 9: Insert default workspace for existing data
-- ============================================
INSERT OR IGNORE INTO workspaces (id, name, api_key, permissions)
VALUES (
  'default_workspace',
  'Default Workspace',
  'default_' || hex(randomblob(16)),
  '["read", "write", "convert"]'
);

-- ============================================
-- STEP 10: Create triggers for updated_at timestamps
-- ============================================

-- Trigger for conversions table
CREATE TRIGGER IF NOT EXISTS update_conversions_timestamp
AFTER UPDATE ON conversions
BEGIN
  UPDATE conversions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for workspaces table
CREATE TRIGGER IF NOT EXISTS update_workspaces_timestamp
AFTER UPDATE ON workspaces
BEGIN
  UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update workspace stats on new conversion
CREATE TRIGGER IF NOT EXISTS update_workspace_stats_on_conversion
AFTER INSERT ON conversions
BEGIN
  UPDATE workspaces
  SET
    total_conversions = total_conversions + 1,
    total_revenue = total_revenue + COALESCE(NEW.conversion_value, 0),
    last_activity_at = CURRENT_TIMESTAMP
  WHERE id = NEW.workspace_id;

  UPDATE contacts
  SET
    conversion_count = conversion_count + 1,
    lifetime_value = lifetime_value + COALESCE(NEW.conversion_value, 0),
    last_conversion_id = NEW.id
  WHERE id = NEW.contact_id;
END;

-- ============================================
-- Migration Complete
-- ============================================