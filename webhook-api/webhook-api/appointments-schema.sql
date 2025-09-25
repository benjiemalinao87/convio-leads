-- Appointments table for tracking appointments per lead
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,

  -- Appointment details
  appointment_type TEXT NOT NULL,     -- 'consultation', 'estimate', 'installation', 'follow_up', etc.
  scheduled_at DATETIME NOT NULL,     -- When the appointment is scheduled
  duration_minutes INTEGER DEFAULT 60, -- Expected duration

  -- Status tracking
  status TEXT DEFAULT 'scheduled',    -- 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'

  -- Contact information
  location_type TEXT DEFAULT 'home',  -- 'home', 'office', 'phone', 'video'
  location_address TEXT,              -- Physical address for in-person appointments

  -- Notes and details
  notes TEXT,                         -- Internal notes
  customer_notes TEXT,                -- Notes from customer
  assigned_to TEXT,                   -- Sales rep or tech assigned

  -- Outcome tracking
  outcome TEXT,                       -- 'qualified', 'not_interested', 'needs_follow_up', 'proposal_sent', etc.
  next_action TEXT,                   -- What needs to happen next
  next_action_date DATETIME,          -- When next action should happen

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,                    -- Who created the appointment

  -- Foreign key constraints
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- Create indexes for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments(assigned_to);

-- Appointment events/history table
CREATE TABLE IF NOT EXISTS appointment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,           -- 'created', 'confirmed', 'rescheduled', 'cancelled', 'completed', etc.
  old_value TEXT,                     -- Previous value (for changes)
  new_value TEXT,                     -- New value (for changes)
  event_data TEXT,                    -- JSON data for complex events
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,                    -- Who made the change

  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_events_appointment_id ON appointment_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_events_created_at ON appointment_events(created_at);

-- View for appointment summary with contact and lead info
CREATE VIEW IF NOT EXISTS appointment_summary_view AS
SELECT
  a.id as appointment_id,
  a.appointment_type,
  a.scheduled_at,
  a.duration_minutes,
  a.status,
  a.location_type,
  a.location_address,
  a.notes,
  a.customer_notes,
  a.assigned_to,
  a.outcome,
  a.next_action,
  a.next_action_date,
  a.created_at as appointment_created_at,
  a.updated_at as appointment_updated_at,

  -- Lead information
  l.id as lead_id,
  l.lead_type,
  l.source,
  l.campaign_id,
  l.status as lead_status,
  l.created_at as lead_created_at,

  -- Contact information
  c.id as contact_id,
  c.phone as contact_phone,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.email as contact_email,
  c.address as contact_address,
  c.city as contact_city,
  c.state as contact_state,
  c.zip_code as contact_zip_code,

  -- Webhook information
  wc.name as webhook_name,
  wc.lead_type as webhook_type

FROM appointments a
JOIN leads l ON a.lead_id = l.id
JOIN contacts c ON a.contact_id = c.id
JOIN webhook_configs wc ON l.webhook_id = wc.webhook_id
ORDER BY a.scheduled_at DESC;