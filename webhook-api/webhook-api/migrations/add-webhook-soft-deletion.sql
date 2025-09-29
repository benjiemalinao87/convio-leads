-- Migration: Add soft deletion support to webhook_configs
-- Date: 2025-09-28
-- Purpose: Enable 24-hour delayed deletion with Cloudflare Queues

-- Add soft deletion fields to webhook_configs table
ALTER TABLE webhook_configs
ADD COLUMN deleted_at TIMESTAMP NULL;

ALTER TABLE webhook_configs
ADD COLUMN scheduled_deletion_at TIMESTAMP NULL;

ALTER TABLE webhook_configs
ADD COLUMN deletion_reason TEXT NULL;

ALTER TABLE webhook_configs
ADD COLUMN deleted_by TEXT NULL;

ALTER TABLE webhook_configs
ADD COLUMN deletion_job_id TEXT NULL;

-- Create webhook deletion events table for audit trail
CREATE TABLE IF NOT EXISTS webhook_deletion_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('soft_delete', 'restore', 'permanent_delete', 'queue_scheduled', 'queue_processed', 'queue_failed')),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    reason TEXT,
    metadata TEXT, -- JSON string for additional data
    job_id TEXT,
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Create scheduled deletion jobs table for tracking queue jobs
CREATE TABLE IF NOT EXISTS webhook_scheduled_deletions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    job_id TEXT UNIQUE NOT NULL,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execute_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    completed_at TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_configs_deleted_at ON webhook_configs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_scheduled_deletion_at ON webhook_configs(scheduled_deletion_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_webhook_id ON webhook_deletion_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_timestamp ON webhook_deletion_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_webhook_scheduled_deletions_job_id ON webhook_scheduled_deletions(job_id);
CREATE INDEX IF NOT EXISTS idx_webhook_scheduled_deletions_execute_at ON webhook_scheduled_deletions(execute_at);
CREATE INDEX IF NOT EXISTS idx_webhook_scheduled_deletions_status ON webhook_scheduled_deletions(status);

-- Create view for active (non-deleted) webhooks
CREATE VIEW IF NOT EXISTS v_active_webhooks AS
SELECT * FROM webhook_configs
WHERE deleted_at IS NULL;

-- Create view for soft-deleted webhooks (within restoration window)
CREATE VIEW IF NOT EXISTS v_soft_deleted_webhooks AS
SELECT
    w.*,
    sd.job_id,
    sd.execute_at,
    sd.status as deletion_status,
    CASE
        WHEN sd.execute_at > CURRENT_TIMESTAMP THEN 1
        ELSE 0
    END as can_restore,
    CAST((julianday(sd.execute_at) - julianday(CURRENT_TIMESTAMP)) * 24 * 60 * 60 AS INTEGER) as seconds_until_deletion
FROM webhook_configs w
LEFT JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id AND sd.status = 'pending'
WHERE w.deleted_at IS NOT NULL;

-- Insert initial audit event for existing webhooks (mark as active)
INSERT INTO webhook_deletion_events (webhook_id, event_type, event_timestamp, reason, metadata)
SELECT
    id as webhook_id,
    'active' as event_type,
    CURRENT_TIMESTAMP as event_timestamp,
    'Migration: marking existing webhooks as active' as reason,
    '{"migration": true, "version": "1.0.0"}' as metadata
FROM webhook_configs
WHERE id NOT IN (SELECT DISTINCT webhook_id FROM webhook_deletion_events);