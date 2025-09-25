-- Lead Status History Tracking Schema Update

-- Add status transitions table for detailed tracking
CREATE TABLE IF NOT EXISTS lead_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT, -- user ID or system identifier
  changed_by_name TEXT, -- display name of who made the change
  reason TEXT, -- reason for status change
  notes TEXT, -- additional notes about the change
  metadata TEXT, -- JSON metadata about the change
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON lead_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_status_history_new_status ON lead_status_history(new_status);

-- Add additional fields to leads table for better tracking
ALTER TABLE leads ADD COLUMN status_changed_at DATETIME;
ALTER TABLE leads ADD COLUMN status_changed_by TEXT;
ALTER TABLE leads ADD COLUMN priority INTEGER DEFAULT 1; -- 1=low, 2=medium, 3=high
ALTER TABLE leads ADD COLUMN assigned_to TEXT; -- who is handling this lead
ALTER TABLE leads ADD COLUMN follow_up_date DATETIME; -- when to follow up
ALTER TABLE leads ADD COLUMN contact_attempts INTEGER DEFAULT 0; -- number of contact attempts

-- Add lead pipeline stages (more detailed than just status)
CREATE TABLE IF NOT EXISTS lead_pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default pipeline stages
INSERT OR IGNORE INTO lead_pipeline_stages (name, description, order_index) VALUES
  ('New Lead', 'Freshly received lead, not yet contacted', 1),
  ('Contacted', 'Initial contact has been made', 2),
  ('Qualified', 'Lead has been qualified and shows interest', 3),
  ('Proposal Sent', 'Proposal or quote has been sent to lead', 4),
  ('Negotiating', 'In negotiation phase with lead', 5),
  ('Scheduled', 'Appointment or service has been scheduled', 6),
  ('Converted', 'Lead has become a customer', 7),
  ('Rejected', 'Lead was not interested or not qualified', 8),
  ('Lost', 'Lost to competitor or other reasons', 9);

-- Lead activities table for comprehensive tracking
CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'note', 'status_change'
  title TEXT NOT NULL,
  description TEXT,
  activity_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  created_by_name TEXT,
  metadata TEXT, -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_date ON lead_activities(activity_date);