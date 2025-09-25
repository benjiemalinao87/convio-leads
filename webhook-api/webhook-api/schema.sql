-- Convio Leads Database Schema

-- Main leads table
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL,
  lead_type TEXT NOT NULL,

  -- Contact Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,

  -- Lead Source
  source TEXT NOT NULL,
  campaign_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Solar Lead Fields
  monthly_electric_bill REAL,
  property_type TEXT,
  roof_condition TEXT,
  roof_age INTEGER,
  shade_coverage TEXT,

  -- HVAC Lead Fields
  system_type TEXT,
  system_age INTEGER,
  service_type TEXT,
  urgency TEXT,
  property_size INTEGER,

  -- Insurance Lead Fields
  policy_type TEXT,
  coverage_amount REAL,
  current_premium REAL,
  property_value REAL,
  claims_history TEXT,

  -- Metadata
  raw_payload TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  status TEXT DEFAULT 'new',
  notes TEXT,

  -- Analytics
  conversion_score REAL,
  revenue_potential REAL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_id ON leads(webhook_id);
CREATE INDEX IF NOT EXISTS idx_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_type ON leads(lead_type);

-- Lead events table for tracking history
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  secret_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Rate limiting
  rate_limit INTEGER DEFAULT 100,
  rate_window INTEGER DEFAULT 60,

  -- Statistics
  total_leads INTEGER DEFAULT 0,
  last_lead_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_webhook_config_id ON webhook_configs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_is_active ON webhook_configs(is_active);

-- Insert default webhook configurations
INSERT INTO webhook_configs (webhook_id, name, description, lead_type) VALUES
  ('ws_cal_solar_001', 'Solar Leads - California', 'Solar lead generation for California region', 'solar'),
  ('ws_tx_hvac_002', 'HVAC Leads - Texas', 'HVAC service leads for Texas region', 'hvac'),
  ('ws_fl_ins_003', 'Insurance - Florida', 'Insurance leads for Florida region', 'insurance');

-- Analytics aggregation table
CREATE TABLE IF NOT EXISTS lead_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Metrics
  total_leads INTEGER DEFAULT 0,
  converted_leads INTEGER DEFAULT 0,
  conversion_rate REAL DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  avg_time_to_conversion REAL DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(webhook_id, date)
);

CREATE INDEX IF NOT EXISTS idx_webhook_date ON lead_analytics(webhook_id, date);