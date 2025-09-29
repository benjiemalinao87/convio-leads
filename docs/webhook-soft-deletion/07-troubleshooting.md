# Troubleshooting Guide

## 🔧 Common Issues and Solutions

This guide covers common problems you might encounter with the Webhook Soft Deletion System and provides step-by-step solutions.

## 🚨 Issue Categories

### 🔄 Queue Processing Issues
### 💾 Database Problems
### 🌐 API Errors
### 🎨 Frontend Issues
### ⚡ Performance Problems

---

## 🔄 Queue Processing Issues

### Issue: Deletion Jobs Not Processing

**Symptoms:**
- Webhooks remain soft-deleted past 24 hours
- Queue shows pending jobs but no processing
- Consumer logs show no activity

**Diagnosis Steps:**

```bash
# 1. Check queue consumer is running
wrangler logs --env production | grep -i queue

# 2. Check queue depth
wrangler queues list

# 3. Check pending jobs in database
wrangler d1 execute convio-leads --remote --command "
SELECT
  job_id,
  webhook_id,
  status,
  execute_at,
  attempts
FROM webhook_scheduled_deletions
WHERE status = 'pending'
AND execute_at <= CURRENT_TIMESTAMP
ORDER BY execute_at;"
```

**Solutions:**

1. **Consumer Not Exported**
   ```typescript
   // Ensure queue consumer is exported in index.ts
   export async function queue(batch: any, env: any): Promise<void> {
     await webhookDeletionConsumer(batch, env);
   }
   ```

2. **Queue Configuration Missing**
   ```json
   // Check wrangler.jsonc has correct queue config
   {
     "queues": {
       "consumers": [{
         "queue": "webhook-deletion",
         "max_batch_size": 5,
         "max_batch_timeout": 10
       }]
     }
   }
   ```

3. **Redeploy Worker**
   ```bash
   cd webhook-api/webhook-api
   npm run deploy
   ```

### Issue: Jobs Failing Repeatedly

**Symptoms:**
- Jobs status shows "failed"
- High attempt counts
- Error messages in database

**Diagnosis:**

```sql
-- Check failed jobs
SELECT
  job_id,
  webhook_id,
  status,
  attempts,
  max_attempts,
  error_message,
  execute_at
FROM webhook_scheduled_deletions
WHERE status = 'failed'
ORDER BY execute_at DESC;
```

**Common Error Messages & Solutions:**

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Database connection timeout" | D1 database overload | Add retry logic, check query performance |
| "Webhook not found" | Webhook manually deleted | Update job status to cancelled |
| "Transaction failed" | Database lock conflict | Implement transaction retry |
| "Queue ACK timeout" | Long-running operations | Optimize deletion queries |

**Solutions:**

1. **Database Timeout Issues**
   ```typescript
   // Add timeout and retry to database operations
   async function executeWithRetry(query: any, maxRetries: number = 3): Promise<any> {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await query;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
       }
     }
   }
   ```

2. **Reset Failed Jobs**
   ```sql
   -- Reset failed jobs to pending (for retry)
   UPDATE webhook_scheduled_deletions
   SET status = 'pending', attempts = 0, error_message = NULL
   WHERE status = 'failed' AND attempts < max_attempts;
   ```

### Issue: Dead Letter Queue Accumulation

**Symptoms:**
- Jobs moving to dead letter queue
- No automatic retry happening
- Consumer stops processing

**Diagnosis:**
```bash
# Check dead letter queue
wrangler queues list | grep dlq

# Manual inspection of failed jobs
wrangler d1 execute convio-leads --remote --command "
SELECT COUNT(*) as failed_jobs
FROM webhook_scheduled_deletions
WHERE status = 'failed' AND attempts >= max_attempts;"
```

**Solutions:**

1. **Manual Reprocessing**
   ```sql
   -- Identify recoverable jobs
   SELECT job_id, error_message
   FROM webhook_scheduled_deletions
   WHERE status = 'failed'
   AND error_message NOT LIKE '%not found%';

   -- Reset for retry
   UPDATE webhook_scheduled_deletions
   SET status = 'pending', attempts = 0
   WHERE job_id IN ('specific-job-ids');
   ```

2. **Increase Retry Limits**
   ```json
   // In wrangler.jsonc
   {
     "queues": {
       "consumers": [{
         "max_retries": 5,  // Increase from 3
         "max_batch_timeout": 30  // Increase timeout
       }]
     }
   }
   ```

---

## 💾 Database Problems

### Issue: Soft Deletion Fields Missing

**Symptoms:**
- API returns "column not found" errors
- Migration appears incomplete
- Deletion operations fail

**Diagnosis:**
```sql
-- Check if soft deletion columns exist
PRAGMA table_info(webhook_configs);

-- Look for deletion-related columns:
-- deleted_at, scheduled_deletion_at, deletion_reason, deleted_by, deletion_job_id
```

**Solution:**
```bash
# Re-run the migration
cd webhook-api/webhook-api
wrangler d1 execute convio-leads --remote --file migrations/add-webhook-soft-deletion.sql

# Verify columns exist
wrangler d1 execute convio-leads --remote --command "PRAGMA table_info(webhook_configs);"
```

### Issue: Foreign Key Constraint Errors

**Symptoms:**
- "FOREIGN KEY constraint failed" errors
- Orphaned deletion events or jobs
- Inconsistent deletion states

**Diagnosis:**
```sql
-- Check for orphaned deletion events
SELECT COUNT(*) as orphaned_events
FROM webhook_deletion_events wde
LEFT JOIN webhook_configs wc ON wde.webhook_id = wc.id
WHERE wc.id IS NULL;

-- Check for orphaned deletion jobs
SELECT COUNT(*) as orphaned_jobs
FROM webhook_scheduled_deletions wsd
LEFT JOIN webhook_configs wc ON wsd.webhook_id = wc.id
WHERE wc.id IS NULL;
```

**Solutions:**

1. **Clean Orphaned Records**
   ```sql
   -- Remove orphaned deletion events
   DELETE FROM webhook_deletion_events
   WHERE webhook_id NOT IN (SELECT id FROM webhook_configs);

   -- Remove orphaned deletion jobs
   DELETE FROM webhook_scheduled_deletions
   WHERE webhook_id NOT IN (SELECT id FROM webhook_configs);
   ```

2. **Fix Broken References**
   ```sql
   -- Find webhooks with broken job references
   SELECT webhook_id, deletion_job_id
   FROM webhook_configs
   WHERE deletion_job_id IS NOT NULL
   AND deletion_job_id NOT IN (SELECT job_id FROM webhook_scheduled_deletions);

   -- Clear broken references
   UPDATE webhook_configs
   SET deletion_job_id = NULL
   WHERE deletion_job_id NOT IN (SELECT job_id FROM webhook_scheduled_deletions);
   ```

### Issue: Inconsistent Webhook States

**Symptoms:**
- Webhooks marked as deleted but no deletion job
- Active webhooks with deletion timestamps
- Restoration fails due to state mismatch

**Diagnosis:**
```sql
-- Find inconsistent states
SELECT
  webhook_id,
  deleted_at,
  deletion_job_id,
  CASE
    WHEN deleted_at IS NULL AND deletion_job_id IS NOT NULL THEN 'Active with job'
    WHEN deleted_at IS NOT NULL AND deletion_job_id IS NULL THEN 'Deleted without job'
    ELSE 'Consistent'
  END as state_issue
FROM webhook_configs
WHERE (deleted_at IS NULL AND deletion_job_id IS NOT NULL)
   OR (deleted_at IS NOT NULL AND deletion_job_id IS NULL);
```

**Solutions:**

1. **Fix Active Webhooks with Jobs**
   ```sql
   -- Clear deletion fields from active webhooks
   UPDATE webhook_configs
   SET deletion_job_id = NULL,
       scheduled_deletion_at = NULL,
       deletion_reason = NULL,
       deleted_by = NULL
   WHERE deleted_at IS NULL AND deletion_job_id IS NOT NULL;
   ```

2. **Fix Deleted Webhooks without Jobs**
   ```sql
   -- Either restore webhook or create missing job
   -- Option 1: Restore to active
   UPDATE webhook_configs
   SET deleted_at = NULL,
       scheduled_deletion_at = NULL,
       deletion_reason = NULL,
       deleted_by = NULL
   WHERE deleted_at IS NOT NULL AND deletion_job_id IS NULL;

   -- Option 2: Force permanent deletion
   DELETE FROM webhook_configs
   WHERE deleted_at IS NOT NULL AND deletion_job_id IS NULL;
   ```

---

## 🌐 API Errors

### Issue: Authentication Failures

**Symptoms:**
- 401 Unauthorized responses
- Missing user attribution in logs
- Operations not logged properly

**Common Causes:**
- Missing `X-User-ID` header
- Invalid user ID format
- CORS issues in browser

**Solutions:**

1. **Frontend Integration**
   ```typescript
   // Ensure X-User-ID header is always included
   const headers = {
     'Content-Type': 'application/json',
     'X-User-ID': getCurrentUser().id  // Get from auth context
   };

   // For deletion requests
   fetch(`/webhook/${webhookId}`, {
     method: 'DELETE',
     headers
   });
   ```

2. **Test Authentication**
   ```bash
   # Test with curl
   curl -X DELETE "https://api.homeprojectpartners.com/webhook/test-123" \
     -H "X-User-ID: admin-user" \
     -v

   # Should return 200, not 401
   ```

### Issue: Validation Errors

**Symptoms:**
- 422 Unprocessable Entity responses
- Invalid webhook ID format errors
- Parameter validation failures

**Solutions:**

1. **Webhook ID Format**
   ```javascript
   // Webhook ID must match pattern: [name-prefix]_ws_[region]_[category]_[id]
   const validWebhookId = "solar-leads_ws_us_solar_001";
   const invalidWebhookId = "invalid-format";

   // Validate before API call
   const WEBHOOK_PATTERN = /^(([a-z0-9-]+)_)?ws_([a-z]{2,3})_([a-z]+)_(\d{3})$/;
   if (!WEBHOOK_PATTERN.test(webhookId)) {
     throw new Error('Invalid webhook ID format');
   }
   ```

2. **Parameter Encoding**
   ```javascript
   // Properly encode deletion reason
   const reason = "No longer needed - migrating to new system";
   const encodedReason = encodeURIComponent(reason);
   const url = `/webhook/${webhookId}?reason=${encodedReason}`;
   ```

### Issue: Timeout Errors

**Symptoms:**
- 504 Gateway Timeout responses
- Long response times
- Database operation timeouts

**Solutions:**

1. **Optimize Database Queries**
   ```sql
   -- Use indexes for better performance
   CREATE INDEX IF NOT EXISTS idx_webhook_configs_deleted_at
   ON webhook_configs(deleted_at);

   -- Use views for complex queries
   SELECT * FROM v_soft_deleted_webhooks
   WHERE restoration.can_restore = 1;
   ```

2. **Client-Side Timeout Handling**
   ```typescript
   async function deleteWebhookWithTimeout(webhookId: string, timeoutMs: number = 30000) {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

     try {
       const response = await fetch(`/webhook/${webhookId}`, {
         method: 'DELETE',
         signal: controller.signal,
         headers: { 'X-User-ID': 'admin-user' }
       });

       clearTimeout(timeoutId);
       return response;
     } catch (error) {
       if (error.name === 'AbortError') {
         throw new Error('Request timed out');
       }
       throw error;
     }
   }
   ```

---

## 🎨 Frontend Issues

### Issue: Components Not Loading

**Symptoms:**
- Delete dialog doesn't appear
- Deleted webhooks panel shows blank
- Import/export errors

**Solutions:**

1. **Check Component Imports**
   ```typescript
   // Verify correct imports in Webhooks.tsx
   import SoftDeleteDialog from '@/components/webhooks/SoftDeleteDialog';
   import SoftDeletedWebhooksPanel from '@/components/webhooks/SoftDeletedWebhooksPanel';

   // Check file paths exist
   // src/components/webhooks/SoftDeleteDialog.tsx
   // src/components/webhooks/SoftDeletedWebhooksPanel.tsx
   ```

2. **TypeScript Errors**
   ```bash
   # Check for TypeScript compilation errors
   npm run build

   # Fix common import issues
   npm install  # Ensure all dependencies installed
   ```

### Issue: State Management Problems

**Symptoms:**
- UI not updating after deletion/restoration
- Stale data in components
- Inconsistent loading states

**Solutions:**

1. **Proper State Updates**
   ```typescript
   const handleDeleteConfirm = async (webhookId: string, reason: string, forceDelete: boolean) => {
     try {
       setIsLoading(true);  // Set loading state

       const result = await deleteWebhook(webhookId, { force: forceDelete, reason });

       // Update local state
       setIsDeleteDialogOpen(false);
       setSelectedWebhookForDeletion(null);

       // Refresh webhook list
       await fetchWebhooks();

       toast({ title: "Success", description: result.message });
     } catch (error) {
       toast({ title: "Error", description: error.message, variant: "destructive" });
     } finally {
       setIsLoading(false);  // Clear loading state
     }
   };
   ```

2. **Real-time Updates**
   ```typescript
   // Auto-refresh deleted webhooks panel
   useEffect(() => {
     if (isDeletedWebhooksPanelOpen) {
       const interval = setInterval(fetchDeletedWebhooks, 30000);  // 30 seconds
       return () => clearInterval(interval);
     }
   }, [isDeletedWebhooksPanelOpen]);
   ```

### Issue: Countdown Timers Not Working

**Symptoms:**
- Time remaining shows static values
- Countdown doesn't update
- Incorrect time calculations

**Solutions:**

1. **Fix Time Calculation**
   ```typescript
   const formatTimeRemaining = (secondsRemaining: number): string => {
     if (secondsRemaining <= 0) return 'Expired';

     const hours = Math.floor(secondsRemaining / 3600);
     const minutes = Math.floor((secondsRemaining % 3600) / 60);

     if (hours < 1) {
       if (minutes < 1) return 'Less than 1 minute';
       return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
     }
     return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
   };
   ```

2. **Add Live Updates**
   ```typescript
   // Update countdown every minute
   useEffect(() => {
     const interval = setInterval(() => {
       setDeletedWebhooks(prevWebhooks =>
         prevWebhooks.map(webhook => ({
           ...webhook,
           restoration: {
             ...webhook.restoration,
             seconds_until_deletion: Math.max(0, webhook.restoration.seconds_until_deletion - 60)
           }
         }))
       );
     }, 60000);

     return () => clearInterval(interval);
   }, []);
   ```

---

## ⚡ Performance Problems

### Issue: Slow API Responses

**Symptoms:**
- Long loading times for webhook operations
- Database query timeouts
- High memory usage

**Diagnosis:**

```bash
# Check API response times
curl -w "@curl-format.txt" -X GET "https://api.homeprojectpartners.com/webhook/deleted"

# Where curl-format.txt contains:
#     time_namelookup:  %{time_namelookup}\n
#     time_connect:     %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#     time_pretransfer: %{time_pretransfer}\n
#     time_redirect:    %{time_redirect}\n
#     time_starttransfer: %{time_starttransfer}\n
#     ----------\n
#     time_total:       %{time_total}\n
```

**Solutions:**

1. **Database Query Optimization**
   ```sql
   -- Add missing indexes
   CREATE INDEX IF NOT EXISTS idx_webhook_deletion_events_type_timestamp
   ON webhook_deletion_events(event_type, event_timestamp);

   -- Use LIMIT for large result sets
   SELECT * FROM webhook_deletion_events
   WHERE webhook_id = ?
   ORDER BY event_timestamp DESC
   LIMIT 50;
   ```

2. **API Response Caching**
   ```typescript
   // Add caching for deleted webhooks list
   const CACHE_TTL = 60000; // 1 minute
   let cachedDeletedWebhooks: any = null;
   let cacheTimestamp = 0;

   async function getDeletedWebhooksWithCache() {
     const now = Date.now();
     if (cachedDeletedWebhooks && (now - cacheTimestamp) < CACHE_TTL) {
       return cachedDeletedWebhooks;
     }

     cachedDeletedWebhooks = await fetchDeletedWebhooksFromDB();
     cacheTimestamp = now;
     return cachedDeletedWebhooks;
   }
   ```

### Issue: High Database Load

**Symptoms:**
- D1 rate limiting errors
- Connection pool exhaustion
- Slow query performance

**Solutions:**

1. **Batch Operations**
   ```typescript
   // Batch database operations instead of individual calls
   async function batchDeleteEvents(events: any[]) {
     const statements = events.map(event =>
       db.prepare(`
         INSERT INTO webhook_deletion_events
         (webhook_id, event_type, user_id, reason)
         VALUES (?, ?, ?, ?)
       `).bind(event.webhook_id, event.event_type, event.user_id, event.reason)
     );

     await db.batch(statements);
   }
   ```

2. **Connection Pooling**
   ```typescript
   // Reuse database connections
   class DatabaseManager {
     private static instance: DatabaseManager;
     private db: D1Database;

     static getInstance(env: any): DatabaseManager {
       if (!DatabaseManager.instance) {
         DatabaseManager.instance = new DatabaseManager(env.LEADS_DB);
       }
       return DatabaseManager.instance;
     }

     // ... database operations
   }
   ```

---

## 🔍 Monitoring and Alerting

### Essential Monitoring Queries

```sql
-- Monitor queue health
SELECT
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM webhook_scheduled_deletions
GROUP BY status;

-- Check for stuck jobs
SELECT COUNT(*) as stuck_jobs
FROM webhook_scheduled_deletions
WHERE status = 'pending'
AND execute_at < datetime('now', '-1 hour');

-- Monitor deletion patterns
SELECT
  DATE(event_timestamp) as date,
  event_type,
  COUNT(*) as count
FROM webhook_deletion_events
WHERE event_timestamp > datetime('now', '-7 days')
GROUP BY DATE(event_timestamp), event_type
ORDER BY date DESC;
```

### Health Check Endpoint

```typescript
// Add health check for deletion system
app.get('/health/deletion-system', async (c) => {
  const db = c.env.LEADS_DB;

  try {
    // Check queue processing
    const { results: queueStats } = await db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM webhook_scheduled_deletions
      WHERE scheduled_at > datetime('now', '-24 hours')
      GROUP BY status
    `).all();

    // Check for stuck jobs
    const { results: stuckJobs } = await db.prepare(`
      SELECT COUNT(*) as count
      FROM webhook_scheduled_deletions
      WHERE status = 'pending'
      AND execute_at < datetime('now', '-1 hour')
    `).all();

    const isHealthy = stuckJobs[0]?.count === 0;

    return c.json({
      status: isHealthy ? 'healthy' : 'degraded',
      queue_stats: queueStats,
      stuck_jobs: stuckJobs[0]?.count || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});
```

### Log Analysis

```bash
# Monitor for common error patterns
wrangler logs --env production | grep -E "(ERROR|Failed|timeout)"

# Count deletion operations
wrangler logs --env production | grep "webhook deletion" | wc -l

# Monitor queue processing
wrangler logs --env production | grep "Processing webhook deletion batch"
```

---

## 📞 Getting Help

### Before Contacting Support

1. **Check System Status**
   - Visit health check endpoint: `/health/deletion-system`
   - Check Cloudflare Dashboard for service status
   - Review recent deployments

2. **Gather Information**
   ```bash
   # Get system info
   wrangler --version
   node --version

   # Get error details
   wrangler logs --tail --env production

   # Database state
   wrangler d1 execute convio-leads --remote --command "
   SELECT
     COUNT(*) as total_webhooks,
     COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted,
     COUNT(CASE WHEN deletion_job_id IS NOT NULL THEN 1 END) as with_jobs
   FROM webhook_configs;"
   ```

3. **Document the Issue**
   - Exact error messages
   - Steps to reproduce
   - Expected vs actual behavior
   - Timestamp of issue occurrence

### Escalation Path

1. **Level 1**: Check this troubleshooting guide
2. **Level 2**: Review logs and database state
3. **Level 3**: Contact team lead with gathered information
4. **Level 4**: Escalate to infrastructure team if needed

---

**Next**: Learn about [Developer Onboarding](./08-developer-onboarding.md) for new team members.