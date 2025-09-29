# Webhook Soft Deletion System - Implementation Plan

## Overview

This document provides a comprehensive implementation plan for adding a soft deletion system with 24-hour scheduled deletion to the Convio Leads webhook management system. The system provides multiple scheduling approaches optimized for Cloudflare Workers and D1 database.

## Architecture Summary

### Database Changes
- **Soft deletion fields** added to `webhook_configs` table
- **Event tracking** with `webhook_deletion_events` table
- **Job scheduling** with `scheduled_deletions` table
- **Automated triggers** for event logging and cleanup

### Backend API Changes
- **New soft delete routes** in `/webhook-soft-delete.ts`
- **Multiple scheduling approaches** (Cron, Queues, Durable Objects, Database-driven)
- **Restoration endpoints** with validation
- **Admin management endpoints**

### Frontend Changes
- **Enhanced delete dialog** with soft/hard delete options
- **Deleted webhooks management panel** with restoration capability
- **Real-time countdown** and progress indicators
- **Integration with existing webhook UI**

## Implementation Steps

### Step 1: Database Migration

Run the database migration to add soft deletion support:

```bash
cd webhook-api/webhook-api
wrangler d1 execute convio-leads --remote --file webhook-soft-delete-migration.sql
```

**Files created:**
- `/Users/allisonmalinao/Documents/convio-leads/webhook-api/webhook-api/webhook-soft-delete-migration.sql`

**What this adds:**
- `deleted_at`, `deleted_by`, `deletion_reason`, `scheduled_deletion_at`, `deletion_job_id` columns to `webhook_configs`
- `webhook_deletion_events` table for audit trail
- `scheduled_deletions` table for job tracking
- Database views for filtered queries
- Triggers for automatic event logging

### Step 2: Backend API Implementation

#### 2a. Add Soft Delete Routes

Add the new soft delete router to your main application:

```typescript
// In src/index.ts
import { webhookSoftDeleteRouter } from './routes/webhook-soft-delete'

// Add to your app
app.route('/webhook', webhookSoftDeleteRouter)
```

**Files created:**
- `/Users/allisonmalinao/Documents/convio-leads/webhook-api/webhook-api/src/routes/webhook-soft-delete.ts`

**New endpoints:**
- `DELETE /webhook/:webhookId` - Soft delete with options
- `POST /webhook/:webhookId/restore` - Restore deleted webhook
- `GET /webhook/deleted` - List deleted webhooks
- `GET /webhook/:webhookId/deletion-history` - View deletion events

#### 2b. Add Scheduled Deletion System

Choose one of the four scheduling approaches based on your needs:

**Files created:**
- `/Users/allisonmalinao/Documents/convio-leads/webhook-api/webhook-api/src/scheduled-deletion-system.ts`

##### Option 1: Cron Triggers (Recommended)

Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 * * * *"]  # Run every hour
```

Add to your worker:
```typescript
// In src/index.ts
import { scheduledDeletionCronHandler } from './scheduled-deletion-system'

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case "0 * * * *": // Every hour
        await scheduledDeletionCronHandler(env, ctx)
        break
    }
  }
}
```

##### Option 2: Cloudflare Queues (More Precise)

Add to `wrangler.toml`:
```toml
[[queues.consumers]]
queue = "webhook-deletion-queue"
max_batch_size = 1
max_wait_time_ms = 5000
```

##### Option 3: Durable Objects (Most Precise)

Add to `wrangler.toml`:
```toml
[durable_objects]
bindings = [
  { name = "WEBHOOK_DELETION_SCHEDULER", class_name = "WebhookDeletionScheduler" }
]

[[migrations]]
tag = "v1"
new_classes = ["WebhookDeletionScheduler"]
```

##### Option 4: Manual Database Cleanup (Fallback)

Add manual cleanup endpoint and call periodically:
```typescript
app.route('/scheduled-deletion', scheduledDeletionRouter)
```

### Step 3: Frontend Integration

#### 3a. Add Required Components

Install the new components (they've been created as separate files):

**Files created:**
- `/Users/allisonmalinao/Documents/convio-leads/src/components/webhooks/SoftDeleteDialog.tsx`
- `/Users/allisonmalinao/Documents/convio-leads/src/components/webhooks/SoftDeletedWebhooksPanel.tsx`
- `/Users/allisonmalinao/Documents/convio-leads/src/pages/WebhooksWithSoftDelete.tsx`

#### 3b. Add Missing UI Components

You may need to install additional shadcn/ui components:

```bash
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add separator
```

#### 3c. Update Main Webhooks Page

Replace your existing webhooks page or integrate the functionality from `WebhooksWithSoftDelete.tsx`:

```typescript
// Option 1: Replace entirely
mv src/pages/Webhooks.tsx src/pages/WebhooksOld.tsx
mv src/pages/WebhooksWithSoftDelete.tsx src/pages/Webhooks.tsx

// Option 2: Integrate manually by copying relevant sections
```

### Step 4: Configuration

#### 4a. Update wrangler.toml

Add your chosen scheduling approach configuration to `wrangler.toml`.

#### 4b. Environment Variables

No additional environment variables are required, but you may want to add:

```bash
# Optional: Webhook deletion job timeout
DELETION_JOB_TIMEOUT_HOURS=24

# Optional: Maximum deletion attempts
MAX_DELETION_ATTEMPTS=3
```

#### 4c. Authentication

The system uses the `Authorization` header for tracking who performs deletions. Ensure your frontend passes appropriate authentication:

```typescript
headers: {
  'Authorization': 'Bearer ' + userToken
}
```

### Step 5: Testing

#### 5a. Test Database Migration

```bash
# Verify tables were created
wrangler d1 execute convio-leads --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%deletion%';"

# Test soft deletion fields
wrangler d1 execute convio-leads --remote --command "PRAGMA table_info(webhook_configs);"
```

#### 5b. Test API Endpoints

```bash
# Test soft delete
curl -X DELETE "https://api.homeprojectpartners.com/webhook/test_webhook_id" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-user" \
  -d '{"deletion_reason": "Testing soft delete"}'

# Test list deleted webhooks
curl "https://api.homeprojectpartners.com/webhook/deleted"

# Test restore
curl -X POST "https://api.homeprojectpartners.com/webhook/test_webhook_id/restore" \
  -H "Authorization: Bearer test-user"
```

#### 5c. Test Scheduled Deletion

Depending on your chosen approach:

```bash
# Test cron trigger manually
wrangler dev --local
# Then trigger the cron in Cloudflare dashboard

# Test manual cleanup
curl -X POST "https://api.homeprojectpartners.com/scheduled-deletion/cleanup"

# Check scheduled deletion stats
curl "https://api.homeprojectpartners.com/scheduled-deletion/stats"
```

## API Reference

### Soft Delete Endpoints

#### DELETE /webhook/:webhookId
Soft delete a webhook with 24-hour restoration window.

**Request Body:**
```json
{
  "deletion_reason": "string (optional)",
  "force_delete": false
}
```

**Response (Soft Delete):**
```json
{
  "status": "success",
  "message": "Webhook soft deleted successfully",
  "webhook_id": "string",
  "deletion_type": "soft",
  "scheduled_deletion_at": "2025-01-29T12:00:00Z",
  "deletion_job_id": "uuid",
  "can_restore": true,
  "restore_endpoint": "/webhook/{id}/restore"
}
```

#### POST /webhook/:webhookId/restore
Restore a soft-deleted webhook within the 24-hour window.

**Response:**
```json
{
  "status": "success",
  "message": "Webhook restored successfully",
  "webhook_id": "string",
  "restored_at": "2025-01-28T12:30:00Z"
}
```

#### GET /webhook/deleted
List all soft-deleted webhooks with restoration status.

**Response:**
```json
{
  "total_deleted_webhooks": 2,
  "recoverable_count": 1,
  "expired_count": 1,
  "deleted_webhooks": [
    {
      "id": "string",
      "name": "string",
      "restoration_status": "recoverable",
      "can_restore": true,
      "time_remaining": "12 hours",
      "preserved_leads": 45
    }
  ]
}
```

### Scheduled Deletion Management

#### POST /scheduled-deletion/cleanup
Manually trigger deletion cleanup (admin endpoint).

#### GET /scheduled-deletion/stats
Get scheduled deletion job statistics.

## Database Schema

### New Tables

#### webhook_deletion_events
```sql
CREATE TABLE webhook_deletion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'soft_delete', 'restore', 'permanent_delete'
  event_data TEXT, -- JSON field with event details
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### scheduled_deletions
```sql
CREATE TABLE scheduled_deletions (
  id TEXT PRIMARY KEY, -- UUID for job tracking
  webhook_id TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'cancelled', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Modified Tables

#### webhook_configs (new columns)
```sql
ALTER TABLE webhook_configs ADD COLUMN deleted_at DATETIME;
ALTER TABLE webhook_configs ADD COLUMN deleted_by TEXT;
ALTER TABLE webhook_configs ADD COLUMN deletion_reason TEXT;
ALTER TABLE webhook_configs ADD COLUMN scheduled_deletion_at DATETIME;
ALTER TABLE webhook_configs ADD COLUMN deletion_job_id TEXT;
```

## Monitoring and Alerts

### Key Metrics to Track

1. **Soft deletion rate** - How many webhooks are being soft deleted
2. **Restoration rate** - How many deleted webhooks are being restored
3. **Permanent deletion success rate** - Scheduled deletion job success
4. **Failed deletion jobs** - Jobs that need manual intervention

### Recommended Alerts

1. **Failed deletion jobs** - Alert when `scheduled_deletions.status = 'failed'`
2. **High deletion rate** - Alert when deletion rate exceeds threshold
3. **Stuck deletion jobs** - Alert when jobs are pending beyond expected time

### Monitoring Queries

```sql
-- Failed deletion jobs
SELECT * FROM scheduled_deletions WHERE status = 'failed';

-- Webhooks expiring soon (last 2 hours before permanent deletion)
SELECT * FROM webhook_configs
WHERE deleted_at IS NOT NULL
  AND scheduled_deletion_at BETWEEN datetime('now') AND datetime('now', '+2 hours');

-- Deletion statistics
SELECT
  COUNT(*) as total_deletions,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM scheduled_deletions;
```

## Performance Considerations

### Database Indexing
All necessary indexes are created by the migration:
- `idx_webhook_configs_deleted_at`
- `idx_webhook_configs_scheduled_deletion`
- `idx_scheduled_deletions_scheduled_at`

### Query Optimization
- Use views (`v_active_webhooks`, `v_deleted_webhooks`) for filtered queries
- Batch operations for multiple deletions
- Cleanup completed jobs periodically

### Cloudflare Workers Limits
- **Cron triggers**: 3 per worker, consider consolidating
- **Durable Objects**: 1GB memory limit per object
- **Database queries**: Use prepared statements and batching
- **Queue messages**: 100KB message size limit

## Security Considerations

### Authorization
- All deletion operations require authentication
- Track who performs deletions with `deleted_by` field
- Admin-only access to deletion management endpoints

### Data Protection
- Soft deletion preserves all webhook and lead data
- Audit trail with complete deletion history
- Restoration window provides recovery protection

### Rate Limiting
Consider adding rate limiting for:
- Deletion operations (prevent abuse)
- Restoration attempts (prevent spam)
- Admin management endpoints

## Troubleshooting

### Common Issues

#### 1. Migration Fails
```bash
# Check current schema
wrangler d1 execute convio-leads --remote --command ".schema webhook_configs"

# Apply migration manually if needed
wrangler d1 execute convio-leads --remote --command "ALTER TABLE webhook_configs ADD COLUMN deleted_at DATETIME;"
```

#### 2. Scheduled Deletions Not Running
```bash
# Check cron trigger setup
wrangler cron list

# Manually trigger cleanup
curl -X POST "https://api.homeprojectpartners.com/scheduled-deletion/cleanup"

# Check job status
curl "https://api.homeprojectpartners.com/scheduled-deletion/stats"
```

#### 3. Frontend Components Not Loading
```bash
# Install missing dependencies
npm install @radix-ui/react-progress
npm install @radix-ui/react-checkbox

# Check component imports
```

### Rollback Plan

If you need to rollback the implementation:

1. **Database rollback** (removes soft deletion features):
```sql
-- Remove new columns (will lose soft deletion data)
ALTER TABLE webhook_configs DROP COLUMN deleted_at;
ALTER TABLE webhook_configs DROP COLUMN deleted_by;
ALTER TABLE webhook_configs DROP COLUMN deletion_reason;
ALTER TABLE webhook_configs DROP COLUMN scheduled_deletion_at;
ALTER TABLE webhook_configs DROP COLUMN deletion_job_id;

-- Drop new tables
DROP TABLE webhook_deletion_events;
DROP TABLE scheduled_deletions;
```

2. **Code rollback**:
   - Remove soft delete routes from `index.ts`
   - Restore original `Webhooks.tsx` page
   - Remove scheduled deletion system

3. **Configuration rollback**:
   - Remove cron triggers from `wrangler.toml`
   - Remove queue configurations
   - Remove Durable Object bindings

## Conclusion

This soft deletion system provides a robust, user-friendly approach to webhook management with:

- **Safety**: 24-hour restoration window prevents accidental data loss
- **Flexibility**: Multiple scheduling approaches for different needs
- **Transparency**: Complete audit trail and real-time status tracking
- **Performance**: Optimized for Cloudflare Workers and D1 database
- **Scalability**: Handles high-volume webhook operations efficiently

The implementation is production-ready and includes comprehensive error handling, monitoring capabilities, and security considerations appropriate for the Convio Leads system.