-- Extend existing appointments table for routing system
-- Add new fields needed for appointment routing without affecting existing structure

-- Add routing-specific fields to existing appointments table
ALTER TABLE appointments ADD COLUMN customer_name TEXT;
ALTER TABLE appointments ADD COLUMN customer_phone TEXT;
ALTER TABLE appointments ADD COLUMN customer_email TEXT;
ALTER TABLE appointments ADD COLUMN service_type TEXT;
ALTER TABLE appointments ADD COLUMN customer_zip TEXT;
ALTER TABLE appointments ADD COLUMN estimated_value REAL;
ALTER TABLE appointments ADD COLUMN matched_workspace_id TEXT;
ALTER TABLE appointments ADD COLUMN routing_method TEXT;
ALTER TABLE appointments ADD COLUMN forwarded_at DATETIME;
ALTER TABLE appointments ADD COLUMN forward_status TEXT DEFAULT 'pending';
ALTER TABLE appointments ADD COLUMN forward_response TEXT;
ALTER TABLE appointments ADD COLUMN forward_attempts INTEGER DEFAULT 0;
ALTER TABLE appointments ADD COLUMN raw_payload TEXT;

-- Create routing rules table (this is completely new)
CREATE TABLE IF NOT EXISTS appointment_routing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  product_types TEXT NOT NULL,        -- JSON array: ["Kitchen", "Bath", "Solar"]
  zip_codes TEXT NOT NULL,            -- JSON array: ["90210", "90211", "90212"]
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  notes TEXT
);

-- Add outbound webhook URL columns to workspaces table
ALTER TABLE workspaces ADD COLUMN outbound_webhook_url TEXT;
ALTER TABLE workspaces ADD COLUMN webhook_active BOOLEAN DEFAULT false;

-- Create additional indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_appointments_customer_zip ON appointments(customer_zip);
CREATE INDEX IF NOT EXISTS idx_appointments_service_type ON appointments(service_type);
CREATE INDEX IF NOT EXISTS idx_appointments_matched_workspace ON appointments(matched_workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_forward_status ON appointments(forward_status);

CREATE INDEX IF NOT EXISTS idx_routing_rules_workspace ON appointment_routing_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON appointment_routing_rules(is_active);