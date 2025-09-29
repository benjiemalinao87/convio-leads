-- Webhook Soft Deletion System Migration
-- This migration adds soft deletion capabilities to the webhook system
-- Date: 2025-01-28

-- ============================================
-- STEP 1: Add soft deletion fields to webhook_configs
-- ============================================

-- Add soft deletion tracking fields
ALTER TABLE webhook_configs ADD COLUMN deleted_at DATETIME;
ALTER TABLE webhook_configs ADD COLUMN deleted_by TEXT;
ALTER TABLE webhook_configs ADD COLUMN deletion_reason TEXT;
ALTER TABLE webhook_configs ADD COLUMN scheduled_deletion_at DATETIME;
ALTER TABLE webhook_configs ADD COLUMN deletion_job_id TEXT;

-- Create indexes for soft deletion queries
CREATE INDEX IF NOT EXISTS idx_webhook_configs_deleted_at ON webhook_configs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_scheduled_deletion ON webhook_configs(scheduled_deletion_at);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_deletion_job_id ON webhook_configs(deletion_job_id);

-- ============================================
-- STEP 2: Create webhook_deletion_events table
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_deletion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'soft_delete', 'restore', 'permanent_delete', 'schedule_created', 'schedule_cancelled'
  event_data TEXT, -- JSON field with event details
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES webhook_configs(webhook_id)
);

-- Create indexes for deletion events
CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_webhook_id ON webhook_deletion_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_type ON webhook_deletion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_created_at ON webhook_deletion_events(created_at);

-- ============================================
-- STEP 3: Create scheduled_deletions table for job tracking
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_deletions (
  id TEXT PRIMARY KEY, -- UUID for job tracking
  webhook_id TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'cancelled', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES webhook_configs(webhook_id)
);

-- Create indexes for scheduled deletions
CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_webhook_id ON scheduled_deletions(webhook_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_scheduled_at ON scheduled_deletions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_status ON scheduled_deletions(status);

-- ============================================
-- STEP 4: Create views for filtered webhook queries
-- ============================================

-- View for active (non-deleted) webhooks
CREATE VIEW IF NOT EXISTS v_active_webhooks AS
SELECT *
FROM webhook_configs
WHERE deleted_at IS NULL;

-- View for soft-deleted webhooks
CREATE VIEW IF NOT EXISTS v_deleted_webhooks AS
SELECT
  *,
  CASE
    WHEN scheduled_deletion_at > datetime('now') THEN 'recoverable'
    WHEN scheduled_deletion_at <= datetime('now') THEN 'expired'
    ELSE 'unknown'
  END as deletion_status
FROM webhook_configs
WHERE deleted_at IS NOT NULL;

-- View for webhooks pending permanent deletion
CREATE VIEW IF NOT EXISTS v_webhooks_pending_deletion AS
SELECT
  w.*,
  sd.scheduled_at,
  sd.status as job_status,
  sd.attempts,
  sd.error_message
FROM webhook_configs w
JOIN scheduled_deletions sd ON w.webhook_id = sd.webhook_id
WHERE w.deleted_at IS NOT NULL
  AND sd.status = 'pending'
  AND sd.scheduled_at <= datetime('now', '+1 hour'); -- Include jobs due within next hour

-- ============================================
-- STEP 5: Create triggers for soft deletion workflow
-- ============================================

-- Trigger to update updated_at timestamp on scheduled_deletions
CREATE TRIGGER IF NOT EXISTS update_scheduled_deletions_timestamp
AFTER UPDATE ON scheduled_deletions
BEGIN
  UPDATE scheduled_deletions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to log webhook deletion events
CREATE TRIGGER IF NOT EXISTS log_webhook_soft_delete
AFTER UPDATE OF deleted_at ON webhook_configs
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN
  INSERT INTO webhook_deletion_events (webhook_id, event_type, event_data, created_by)
  VALUES (
    NEW.webhook_id,
    'soft_delete',
    json_object(
      'scheduled_deletion_at', NEW.scheduled_deletion_at,
      'deletion_reason', NEW.deletion_reason,
      'deletion_job_id', NEW.deletion_job_id
    ),
    NEW.deleted_by
  );
END;

-- Trigger to log webhook restoration
CREATE TRIGGER IF NOT EXISTS log_webhook_restore
AFTER UPDATE OF deleted_at ON webhook_configs
WHEN NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL
BEGIN
  INSERT INTO webhook_deletion_events (webhook_id, event_type, event_data, created_by)
  VALUES (
    NEW.webhook_id,
    'restore',
    json_object(
      'previous_deletion_at', OLD.deleted_at,
      'previous_scheduled_deletion', OLD.scheduled_deletion_at,
      'deletion_job_cancelled', OLD.deletion_job_id
    ),
    NEW.deleted_by
  );

  -- Cancel the scheduled deletion job
  UPDATE scheduled_deletions
  SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
  WHERE webhook_id = NEW.webhook_id AND status = 'pending';
END;

-- ============================================
-- STEP 6: Sample data for testing
-- ============================================

-- Note: This would be used for testing the soft deletion system
-- INSERT INTO webhook_configs (webhook_id, name, description, lead_type) VALUES
--   ('test_ws_cal_soft_001', 'Test Soft Delete Webhook', 'Test webhook for soft deletion', 'test');

-- ============================================
-- Migration Complete
-- ============================================