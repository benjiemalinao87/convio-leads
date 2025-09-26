-- Appointment Routing System Migration
-- Creates tables for appointment routing, rules, and management

-- 1. Routing rules per workspace
CREATE TABLE IF NOT EXISTS appointment_routing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  product_types TEXT NOT NULL,        -- JSON array: ["Kitchen", "Bath", "Solar"]
  zip_codes TEXT NOT NULL,            -- JSON array: ["90210", "90211", "90212"]
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,                    -- User who created the rule
  notes TEXT,                         -- Optional rule description

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  UNIQUE(workspace_id, priority)      -- Each workspace can have unique priorities
);

-- 2. Appointments table (linked to leads and contacts)
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,        -- Links to contacts table
  lead_id INTEGER NOT NULL,           -- Links to leads table

  -- Appointment specific fields
  appointment_date DATETIME NOT NULL,
  appointment_time TIME,              -- Separate time field for easier querying
  appointment_duration INTEGER DEFAULT 60, -- Duration in minutes
  appointment_type TEXT,              -- consultation, estimate, installation, etc.
  appointment_status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show

  -- Customer information (from 3rd party)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_type TEXT NOT NULL,         -- Product type (Kitchen, Bath, etc.)
  customer_zip TEXT NOT NULL,
  appointment_notes TEXT,
  estimated_value REAL,

  -- Routing and forwarding tracking
  matched_workspace_id TEXT,          -- Which workspace this was routed to
  routing_method TEXT,                -- auto, manual, priority
  forwarded_at DATETIME,
  forward_status TEXT DEFAULT 'pending', -- pending, success, failed
  forward_response TEXT,              -- Response from client webhook
  forward_attempts INTEGER DEFAULT 0,

  -- Metadata
  raw_payload TEXT,                   -- Original payload from 3rd party
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (matched_workspace_id) REFERENCES workspaces(id)
);

-- 3. Add outbound webhook URL to workspaces table
ALTER TABLE workspaces ADD COLUMN outbound_webhook_url TEXT;
ALTER TABLE workspaces ADD COLUMN webhook_active BOOLEAN DEFAULT false;

-- 4. Appointment activity log for tracking
CREATE TABLE IF NOT EXISTS appointment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,           -- created, routed, forwarded, status_changed, etc.
  event_description TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by TEXT,
  metadata TEXT,                      -- JSON for additional context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_workspace_id ON appointments(matched_workspace_id);
CREATE INDEX IF NOT EXISTS idx_appointments_zip ON appointments(customer_zip);
CREATE INDEX IF NOT EXISTS idx_appointments_service_type ON appointments(service_type);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(appointment_status);

CREATE INDEX IF NOT EXISTS idx_routing_rules_workspace ON appointment_routing_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON appointment_routing_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_appointment_events_appointment_id ON appointment_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_events_type ON appointment_events(event_type);

-- Migration completed successfully
-- Tables created:
-- 1. appointment_routing_rules - Routing criteria per workspace
-- 2. appointments - Appointment data linked to contacts/leads
-- 3. appointment_events - Activity tracking
-- 4. Enhanced workspaces table with outbound webhook URL