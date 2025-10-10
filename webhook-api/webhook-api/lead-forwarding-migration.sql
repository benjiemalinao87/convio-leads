-- Lead Forwarding System Migration
-- Creates tables and indexes for automatic lead forwarding based on criteria

-- ============================================================================
-- TABLE: lead_forwarding_rules
-- Purpose: Define rules for automatically forwarding leads to other webhooks
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_forwarding_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Source webhook that receives the lead
  source_webhook_id TEXT NOT NULL,
  
  -- Target webhook to forward to
  target_webhook_id TEXT NOT NULL,
  target_webhook_url TEXT NOT NULL,  -- Full URL to POST to
  
  -- Matching criteria (stored as JSON arrays)
  product_types TEXT NOT NULL,  -- JSON: ["Solar", "HVAC", "Kitchen"]
  zip_codes TEXT NOT NULL,      -- JSON: ["90210", "90211", "90212"]
  
  -- Rule configuration
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  forward_enabled BOOLEAN DEFAULT 1,  -- Toggle on/off per rule
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  
  -- Constraints
  CHECK (priority >= 0),
  CHECK (is_active IN (0, 1)),
  CHECK (forward_enabled IN (0, 1)),
  
  -- Foreign keys
  FOREIGN KEY (source_webhook_id) REFERENCES webhook_configs(webhook_id)
    ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: lead_forwarding_log
-- Purpose: Track all lead forwarding attempts for monitoring and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_forwarding_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Reference data
  lead_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  rule_id INTEGER NOT NULL,
  
  -- Source and target
  source_webhook_id TEXT NOT NULL,
  target_webhook_id TEXT NOT NULL,
  target_webhook_url TEXT NOT NULL,
  
  -- Forwarding details
  forwarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  forward_status TEXT NOT NULL,  -- 'success', 'failed', 'retry'
  http_status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Matching criteria that triggered forwarding
  matched_product TEXT,
  matched_zip TEXT,
  
  -- Payload sent (limited to 10KB for storage efficiency)
  payload TEXT NOT NULL,
  
  -- Constraints
  CHECK (forward_status IN ('success', 'failed', 'retry')),
  CHECK (retry_count >= 0),
  
  -- Foreign keys
  FOREIGN KEY (lead_id) REFERENCES leads(id)
    ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES lead_forwarding_rules(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES for performance optimization
-- ============================================================================

-- Index for finding active rules for a specific webhook
CREATE INDEX IF NOT EXISTS idx_forwarding_rules_source 
ON lead_forwarding_rules(source_webhook_id, is_active, forward_enabled);

-- Index for rule priority sorting
CREATE INDEX IF NOT EXISTS idx_forwarding_rules_priority 
ON lead_forwarding_rules(source_webhook_id, priority);

-- Index for finding forwarding logs by lead
CREATE INDEX IF NOT EXISTS idx_forwarding_log_lead 
ON lead_forwarding_log(lead_id, forwarded_at DESC);

-- Index for monitoring forwarding status
CREATE INDEX IF NOT EXISTS idx_forwarding_log_status 
ON lead_forwarding_log(forward_status, forwarded_at DESC);

-- Index for source webhook analytics
CREATE INDEX IF NOT EXISTS idx_forwarding_log_source 
ON lead_forwarding_log(source_webhook_id, forwarded_at DESC);

-- Index for target webhook analytics
CREATE INDEX IF NOT EXISTS idx_forwarding_log_target 
ON lead_forwarding_log(target_webhook_id, forwarded_at DESC);

-- ============================================================================
-- ALTER webhook_configs table to add forwarding support
-- ============================================================================

-- Add forwarding enabled flag (master toggle)
ALTER TABLE webhook_configs 
ADD COLUMN forwarding_enabled BOOLEAN DEFAULT 0;

-- Add forwarding statistics counter
ALTER TABLE webhook_configs 
ADD COLUMN auto_forward_count INTEGER DEFAULT 0;

-- Add last forwarded timestamp
ALTER TABLE webhook_configs 
ADD COLUMN last_forwarded_at TIMESTAMP NULL;

-- ============================================================================
-- VIEWS for common queries
-- ============================================================================

-- View: Active forwarding rules with webhook names
CREATE VIEW IF NOT EXISTS v_active_forwarding_rules AS
SELECT 
  r.*,
  w.name as source_webhook_name,
  w.forwarding_enabled as source_forwarding_enabled
FROM lead_forwarding_rules r
JOIN webhook_configs w ON r.source_webhook_id = w.webhook_id
WHERE r.is_active = 1 
  AND r.forward_enabled = 1 
  AND w.forwarding_enabled = 1
  AND w.is_active = 1
ORDER BY r.priority ASC;

-- View: Forwarding statistics per webhook
CREATE VIEW IF NOT EXISTS v_forwarding_stats AS
SELECT 
  source_webhook_id,
  COUNT(*) as total_forwards,
  SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN forward_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  ROUND(
    (SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
    2
  ) as success_rate,
  MAX(forwarded_at) as last_forward_at
FROM lead_forwarding_log
GROUP BY source_webhook_id;

-- ============================================================================
-- TRIGGERS for automatic timestamp updates
-- ============================================================================

-- Trigger: Update updated_at on rule modification
CREATE TRIGGER IF NOT EXISTS update_forwarding_rules_timestamp 
AFTER UPDATE ON lead_forwarding_rules
BEGIN
  UPDATE lead_forwarding_rules 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Note: Sample data removed to avoid foreign key constraints
-- Add forwarding rules via API after webhooks are configured

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check if tables were created
-- SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%forwarding%';

-- Check if indexes were created
-- SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%forwarding%';

-- Check if views were created
-- SELECT name FROM sqlite_master WHERE type='view' AND name LIKE '%forwarding%';

-- Check if webhook_configs was altered
-- PRAGMA table_info(webhook_configs);

-- ============================================================================
-- MIGRATION COMPLETE
-- Version: 1.0.0
-- Date: 2025-10-10
-- Author: AI Assistant
-- ============================================================================

