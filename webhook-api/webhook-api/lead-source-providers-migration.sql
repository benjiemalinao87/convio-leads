-- Lead Source Providers Table Migration
-- This table stores authorized third-party providers who can send data to webhook endpoints

CREATE TABLE IF NOT EXISTS lead_source_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL,     -- Unique provider identifier (e.g., "click_ventures_001")
  provider_name TEXT NOT NULL,          -- Human-readable provider name
  company_name TEXT,                    -- Company/organization name
  contact_email TEXT,                   -- Contact email for provider
  api_key TEXT,                         -- Optional API key for additional authentication
  is_active BOOLEAN DEFAULT 1,          -- Whether provider is currently active
  allowed_webhooks TEXT,                -- JSON array of webhook IDs this provider can access (optional, null = all)
  rate_limit INTEGER DEFAULT 1000,      -- Requests per hour limit
  notes TEXT,                           -- Internal notes about provider
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME                 -- Track last successful request
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_id ON lead_source_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_active ON lead_source_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_provider_last_used ON lead_source_providers(last_used_at);

-- Insert sample provider data for testing
INSERT INTO lead_source_providers (provider_id, provider_name, company_name, contact_email, is_active, notes) VALUES
  ('click_ventures_001', 'Click Ventures Primary', 'Click Ventures LLC', 'api@clickventures.com', 1, 'Primary provider for general leads'),
  ('click_ventures_002', 'Click Ventures Solar', 'Click Ventures LLC', 'solar@clickventures.com', 1, 'Specialized solar lead provider'),
  ('lead_gen_pro_001', 'LeadGen Pro', 'LeadGen Pro Inc', 'support@leadgenpro.com', 1, 'HVAC and home improvement leads'),
  ('test_provider_999', 'Test Provider', 'Internal Testing', 'test@homeprojectpartners.com', 0, 'For development and testing only');

-- Provider usage tracking table (optional - for analytics)
CREATE TABLE IF NOT EXISTS provider_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, webhook_id, date),
  FOREIGN KEY (provider_id) REFERENCES lead_source_providers(provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_date ON provider_usage_log(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_provider_usage_webhook ON provider_usage_log(webhook_id, date);
