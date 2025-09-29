# Database Schema

## 🗄️ Database Schema Overview

The Webhook Soft Deletion System adds several fields and tables to the existing Convio Leads database schema. This document provides a comprehensive breakdown of all database components related to soft deletion.

## 📋 Table Relationships

```
                                Database Schema: Webhook Soft Deletion
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                         │
    │  ┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐│
    │  │   webhook_configs   │         │webhook_deletion_    │         │webhook_scheduled_   ││
    │  │                     │         │      events         │         │    deletions        ││
    │  │ ┌─────────────────┐ │  1:N    │ ┌─────────────────┐ │  1:N    │ ┌─────────────────┐ ││
    │  │ │ id (PK)         │ │◄────────┤ │ webhook_id (FK) │ │◄────────┤ │ webhook_id (FK) │ ││
    │  │ │ webhook_id      │ │         │ │ event_type      │ │         │ │ job_id (UNIQUE) │ ││
    │  │ │ name            │ │         │ │ event_timestamp │ │         │ │ scheduled_at    │ ││
    │  │ │ ...existing...  │ │         │ │ user_id         │ │         │ │ execute_at      │ ││
    │  │ │                 │ │         │ │ reason          │ │         │ │ status          │ ││
    │  │ │ NEW FIELDS:     │ │         │ │ metadata        │ │         │ │ attempts        │ ││
    │  │ │ deleted_at      │ │         │ │ job_id          │ │         │ │ max_attempts    │ ││
    │  │ │ scheduled_del...│ │         │ └─────────────────┘ │         │ │ error_message   │ ││
    │  │ │ deletion_job_id │ │         └─────────────────────┘         │ │ completed_at    │ ││
    │  │ │ deleted_by      │ │                                         │ │ created_by      │ ││
    │  │ │ deletion_reason │ │                                         │ └─────────────────┘ ││
    │  │ └─────────────────┘ │                                         └─────────────────────┘│
    │  └─────────────────────┘                                                               │
    │                                                                                         │
    │  ┌─────────────────────┐         ┌─────────────────────┐                               │
    │  │ v_active_webhooks   │         │v_soft_deleted_      │                               │
    │  │      (VIEW)         │         │   webhooks (VIEW)   │                               │
    │  │                     │         │                     │                               │
    │  │ SELECT * FROM       │         │ SELECT w.*, sd.*,   │                               │
    │  │ webhook_configs     │         │ CASE WHEN ... END   │                               │
    │  │ WHERE deleted_at    │         │ as can_restore      │                               │
    │  │ IS NULL             │         │ FROM webhook_configs│                               │
    │  └─────────────────────┘         │ WHERE deleted_at    │                               │
    │                                  │ IS NOT NULL         │                               │
    │                                  └─────────────────────┘                               │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Enhanced webhook_configs Table

### Current Schema + New Fields

```sql
CREATE TABLE webhook_configs (
    -- Existing fields (preserved)
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    lead_type TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    total_leads INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_lead_at TIMESTAMP,

    -- NEW: Soft deletion fields
    deleted_at TIMESTAMP NULL,
    scheduled_deletion_at TIMESTAMP NULL,
    deletion_reason TEXT NULL,
    deleted_by TEXT NULL,
    deletion_job_id TEXT NULL,

    -- Indexes for performance
    INDEX idx_webhook_configs_deleted_at (deleted_at),
    INDEX idx_webhook_configs_scheduled_deletion_at (scheduled_deletion_at),
    INDEX idx_webhook_configs_deletion_job_id (deletion_job_id)
);
```

### Field Descriptions

```
┌─────────────────────┬──────────────┬─────────────────────────────────────────────────┐
│      Field Name     │     Type     │                  Description                    │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ deleted_at          │ TIMESTAMP    │ When webhook was soft deleted (NULL = active)  │
│ scheduled_deletion_ │ TIMESTAMP    │ When permanent deletion is scheduled           │
│ at                  │              │                                                 │
│ deletion_reason     │ TEXT         │ User-provided reason for deletion              │
│ deleted_by          │ TEXT         │ User ID who initiated deletion                 │
│ deletion_job_id     │ TEXT         │ Cloudflare Queue job ID for tracking           │
└─────────────────────┴──────────────┴─────────────────────────────────────────────────┘
```

### State Logic

```
Webhook State Determination:
┌─────────────────────┬─────────────────────┬─────────────────────────────────┐
│   deleted_at        │ scheduled_deletion_ │            State                │
│                     │        at           │                                 │
├─────────────────────┼─────────────────────┼─────────────────────────────────┤
│ NULL                │ NULL                │ ACTIVE (normal operation)       │
│ NOT NULL            │ FUTURE TIMESTAMP    │ SOFT_DELETED (can restore)      │
│ NOT NULL            │ PAST TIMESTAMP      │ EXPIRED (cannot restore)        │
└─────────────────────┴─────────────────────┴─────────────────────────────────┘
```

## 📝 webhook_deletion_events Table

Complete audit trail for all deletion-related activities.

```sql
CREATE TABLE webhook_deletion_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'soft_delete',
            'restore',
            'permanent_delete',
            'queue_scheduled',
            'queue_processed',
            'queue_failed',
            'queue_cancelled'
        )
    ),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    reason TEXT,
    metadata TEXT, -- JSON string for additional data
    job_id TEXT,

    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE,
    INDEX idx_webhook_deletion_events_webhook_id (webhook_id),
    INDEX idx_webhook_deletion_events_timestamp (event_timestamp),
    INDEX idx_webhook_deletion_events_type (event_type),
    INDEX idx_webhook_deletion_events_job_id (job_id)
);
```

### Event Types

```
┌─────────────────────┬─────────────────────────────────────────────────────────────┐
│    Event Type       │                       Description                           │
├─────────────────────┼─────────────────────────────────────────────────────────────┤
│ soft_delete         │ Webhook marked for deletion (initial soft delete)          │
│ restore             │ Webhook restored before permanent deletion                  │
│ permanent_delete    │ Webhook permanently deleted (by queue or force)            │
│ queue_scheduled     │ Deletion job scheduled in Cloudflare Queue                 │
│ queue_processed     │ Queue job successfully processed                           │
│ queue_failed        │ Queue job failed to process                                │
│ queue_cancelled     │ Queue job cancelled (webhook was restored)                 │
└─────────────────────┴─────────────────────────────────────────────────────────────┘
```

### Sample Event Records

```sql
-- Soft delete event
INSERT INTO webhook_deletion_events VALUES (
    1,                           -- id
    123,                         -- webhook_id
    'soft_delete',               -- event_type
    '2025-09-28 10:00:00',       -- event_timestamp
    'admin-user',                -- user_id
    'No longer needed',          -- reason
    '{"deletion_type": "soft"}', -- metadata
    'job-abc123'                 -- job_id
);

-- Queue scheduled event
INSERT INTO webhook_deletion_events VALUES (
    2,                           -- id
    123,                         -- webhook_id
    'queue_scheduled',           -- event_type
    '2025-09-28 10:00:01',       -- event_timestamp
    'system',                    -- user_id
    'Scheduled for deletion in 24 hours', -- reason
    '{"execute_at": "2025-09-29 10:00:00", "delay_seconds": 86400}', -- metadata
    'job-abc123'                 -- job_id
);
```

## ⏰ webhook_scheduled_deletions Table

Tracks queue jobs and their status for deletion scheduling.

```sql
CREATE TABLE webhook_scheduled_deletions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    job_id TEXT UNIQUE NOT NULL,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execute_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    completed_at TIMESTAMP,
    created_by TEXT,

    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE,
    INDEX idx_webhook_scheduled_deletions_job_id (job_id),
    INDEX idx_webhook_scheduled_deletions_execute_at (execute_at),
    INDEX idx_webhook_scheduled_deletions_status (status),
    INDEX idx_webhook_scheduled_deletions_webhook_id (webhook_id)
);
```

### Job Status Lifecycle

```
Job Status Flow:
┌─────────────┐    queue     ┌─────────────┐    execute   ┌─────────────┐
│   pending   │─────────────▶│ processing  │─────────────▶│ completed   │
└─────────────┘              └─────────────┘              └─────────────┘
       │                            │                            ▲
       │ webhook                    │ error                      │ success
       │ restored                   ▼                            │
       │                     ┌─────────────┐    retry           │
       └────────────────────▶│   failed    │────────────────────┘
                             └─────────────┘
                                    │
                                    │ max retries exceeded
                                    ▼
                             ┌─────────────┐
                             │ cancelled   │
                             └─────────────┘
```

### Sample Job Records

```sql
-- Active pending job
INSERT INTO webhook_scheduled_deletions VALUES (
    1,                           -- id
    123,                         -- webhook_id
    'webhook-del-test-123-1696000000-abc123', -- job_id
    '2025-09-28 10:00:00',       -- scheduled_at
    '2025-09-29 10:00:00',       -- execute_at (24h later)
    'pending',                   -- status
    0,                           -- attempts
    3,                           -- max_attempts
    NULL,                        -- error_message
    NULL,                        -- completed_at
    'admin-user'                 -- created_by
);

-- Failed job with retry
INSERT INTO webhook_scheduled_deletions VALUES (
    2,                           -- id
    124,                         -- webhook_id
    'webhook-del-test-124-1696000000-def456', -- job_id
    '2025-09-28 11:00:00',       -- scheduled_at
    '2025-09-29 11:00:00',       -- execute_at
    'failed',                    -- status
    2,                           -- attempts
    3,                           -- max_attempts
    'Database connection timeout', -- error_message
    NULL,                        -- completed_at
    'admin-user'                 -- created_by
);
```

## 🔍 Database Views

### v_active_webhooks

Filters out soft-deleted webhooks for normal operations.

```sql
CREATE VIEW v_active_webhooks AS
SELECT * FROM webhook_configs
WHERE deleted_at IS NULL;
```

### v_soft_deleted_webhooks

Shows soft-deleted webhooks with restoration status.

```sql
CREATE VIEW v_soft_deleted_webhooks AS
SELECT
    w.*,
    sd.job_id,
    sd.execute_at,
    sd.status as deletion_status,
    CASE
        WHEN sd.execute_at > CURRENT_TIMESTAMP AND sd.status = 'pending' THEN 1
        ELSE 0
    END as can_restore,
    CAST(
        (julianday(sd.execute_at) - julianday(CURRENT_TIMESTAMP)) * 24 * 60 * 60
        AS INTEGER
    ) as seconds_until_deletion,
    CASE
        WHEN sd.execute_at <= CURRENT_TIMESTAMP THEN 'expired'
        WHEN sd.status = 'cancelled' THEN 'cancelled'
        WHEN sd.status = 'completed' THEN 'completed'
        WHEN sd.status = 'failed' THEN 'failed'
        ELSE 'recoverable'
    END as restoration_status
FROM webhook_configs w
LEFT JOIN webhook_scheduled_deletions sd
    ON w.id = sd.webhook_id AND sd.job_id = w.deletion_job_id
WHERE w.deleted_at IS NOT NULL;
```

## 📊 Query Examples

### Common Queries for Soft Deletion

#### 1. Get All Active Webhooks

```sql
-- Using the view (recommended)
SELECT * FROM v_active_webhooks
ORDER BY created_at DESC;

-- Direct query
SELECT * FROM webhook_configs
WHERE deleted_at IS NULL
ORDER BY created_at DESC;
```

#### 2. Get Soft-Deleted Webhooks with Restoration Status

```sql
SELECT
    webhook_id,
    name,
    deleted_at,
    deletion_reason,
    deleted_by,
    can_restore,
    seconds_until_deletion,
    restoration_status
FROM v_soft_deleted_webhooks
ORDER BY deleted_at DESC;
```

#### 3. Find Webhooks Ready for Permanent Deletion

```sql
SELECT
    w.webhook_id,
    w.name,
    sd.job_id,
    sd.execute_at,
    sd.attempts
FROM webhook_configs w
JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id
WHERE w.deleted_at IS NOT NULL
    AND sd.status = 'pending'
    AND sd.execute_at <= CURRENT_TIMESTAMP;
```

#### 4. Get Complete Deletion History for a Webhook

```sql
SELECT
    event_type,
    event_timestamp,
    user_id,
    reason,
    metadata,
    job_id
FROM webhook_deletion_events
WHERE webhook_id = (
    SELECT id FROM webhook_configs WHERE webhook_id = 'your-webhook-id'
)
ORDER BY event_timestamp ASC;
```

#### 5. Monitor Queue Job Status

```sql
SELECT
    sd.job_id,
    w.webhook_id,
    w.name,
    sd.status,
    sd.attempts,
    sd.execute_at,
    sd.error_message,
    CASE
        WHEN sd.execute_at > CURRENT_TIMESTAMP
        THEN CAST((julianday(sd.execute_at) - julianday(CURRENT_TIMESTAMP)) * 24 AS INTEGER)
        ELSE 0
    END as hours_remaining
FROM webhook_scheduled_deletions sd
JOIN webhook_configs w ON sd.webhook_id = w.id
WHERE sd.status IN ('pending', 'processing', 'failed')
ORDER BY sd.execute_at ASC;
```

## 🔧 Database Maintenance

### Cleanup Queries

#### Remove Old Deletion Events (90+ days)

```sql
DELETE FROM webhook_deletion_events
WHERE event_timestamp < datetime('now', '-90 days');
```

#### Clean Up Completed Jobs (30+ days)

```sql
DELETE FROM webhook_scheduled_deletions
WHERE status IN ('completed', 'cancelled')
    AND completed_at < datetime('now', '-30 days');
```

### Performance Monitoring

#### Index Usage Analysis

```sql
-- Check index usage on deletion-related queries
EXPLAIN QUERY PLAN
SELECT * FROM webhook_configs
WHERE deleted_at IS NOT NULL
    AND scheduled_deletion_at > CURRENT_TIMESTAMP;
```

#### Table Size Monitoring

```sql
-- Get table sizes and row counts
SELECT
    name as table_name,
    COUNT(*) as row_count
FROM (
    SELECT 'webhook_configs' as name UNION ALL
    SELECT 'webhook_deletion_events' as name UNION ALL
    SELECT 'webhook_scheduled_deletions' as name
) tables
JOIN sqlite_master ON name = tbl_name
WHERE type = 'table';
```

## 🛡️ Data Integrity

### Foreign Key Constraints

```sql
-- Ensure referential integrity
PRAGMA foreign_keys = ON;

-- Check for orphaned records
SELECT 'webhook_deletion_events' as table_name, COUNT(*) as orphaned_count
FROM webhook_deletion_events wde
LEFT JOIN webhook_configs wc ON wde.webhook_id = wc.id
WHERE wc.id IS NULL

UNION ALL

SELECT 'webhook_scheduled_deletions' as table_name, COUNT(*) as orphaned_count
FROM webhook_scheduled_deletions wsd
LEFT JOIN webhook_configs wc ON wsd.webhook_id = wc.id
WHERE wc.id IS NULL;
```

### Data Validation

#### Check for Inconsistent States

```sql
-- Webhooks marked as deleted but no deletion job
SELECT
    webhook_id,
    name,
    deleted_at,
    deletion_job_id
FROM webhook_configs
WHERE deleted_at IS NOT NULL
    AND deletion_job_id IS NULL;

-- Deletion jobs without corresponding soft-deleted webhooks
SELECT
    sd.job_id,
    sd.webhook_id,
    w.deleted_at
FROM webhook_scheduled_deletions sd
JOIN webhook_configs w ON sd.webhook_id = w.id
WHERE w.deleted_at IS NULL
    AND sd.status = 'pending';
```

## 🚀 Migration Script

The complete migration to add soft deletion support:

```sql
-- Add soft deletion fields to webhook_configs
ALTER TABLE webhook_configs ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE webhook_configs ADD COLUMN scheduled_deletion_at TIMESTAMP NULL;
ALTER TABLE webhook_configs ADD COLUMN deletion_reason TEXT NULL;
ALTER TABLE webhook_configs ADD COLUMN deleted_by TEXT NULL;
ALTER TABLE webhook_configs ADD COLUMN deletion_job_id TEXT NULL;

-- Create audit table
CREATE TABLE webhook_deletion_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('soft_delete', 'restore', 'permanent_delete', 'queue_scheduled', 'queue_processed', 'queue_failed', 'queue_cancelled')),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    reason TEXT,
    metadata TEXT,
    job_id TEXT,
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Create job tracking table
CREATE TABLE webhook_scheduled_deletions (
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
CREATE INDEX idx_webhook_configs_deleted_at ON webhook_configs(deleted_at);
CREATE INDEX idx_webhook_configs_scheduled_deletion_at ON webhook_configs(scheduled_deletion_at);
CREATE INDEX idx_webhook_deletion_events_webhook_id ON webhook_deletion_events(webhook_id);
CREATE INDEX idx_webhook_deletion_events_timestamp ON webhook_deletion_events(event_timestamp);
CREATE INDEX idx_webhook_scheduled_deletions_job_id ON webhook_scheduled_deletions(job_id);
CREATE INDEX idx_webhook_scheduled_deletions_execute_at ON webhook_scheduled_deletions(execute_at);
CREATE INDEX idx_webhook_scheduled_deletions_status ON webhook_scheduled_deletions(status);

-- Create views
CREATE VIEW v_active_webhooks AS
SELECT * FROM webhook_configs WHERE deleted_at IS NULL;

CREATE VIEW v_soft_deleted_webhooks AS
SELECT
    w.*,
    sd.job_id,
    sd.execute_at,
    sd.status as deletion_status,
    CASE
        WHEN sd.execute_at > CURRENT_TIMESTAMP AND sd.status = 'pending' THEN 1
        ELSE 0
    END as can_restore,
    CAST((julianday(sd.execute_at) - julianday(CURRENT_TIMESTAMP)) * 24 * 60 * 60 AS INTEGER) as seconds_until_deletion
FROM webhook_configs w
LEFT JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id AND sd.job_id = w.deletion_job_id
WHERE w.deleted_at IS NOT NULL;
```

---

**Next**: Learn about the [API Documentation](./04-api-documentation.md) with detailed examples.