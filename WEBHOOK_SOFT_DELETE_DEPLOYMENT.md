# Webhook Soft Deletion with Cloudflare Queues - Deployment Guide

This guide provides step-by-step instructions to deploy the webhook soft deletion system using Cloudflare Queues with a 24-hour grace period.

## Overview

The implementation includes:
- **Soft Deletion**: Webhooks are marked for deletion but can be restored within 24 hours
- **Cloudflare Queues**: Handles scheduled deletion with precise timing and retry logic
- **Database Migration**: Adds necessary fields and tables for tracking deletions
- **Frontend UI**: Enhanced delete confirmation and deleted webhook management

## Prerequisites

- Cloudflare Workers account with Queues enabled
- Cloudflare API token with appropriate permissions
- Access to the Convio Leads codebase

## Deployment Steps

### Step 1: Database Migration

Run the database migration to add soft deletion support:

```bash
cd webhook-api/webhook-api

# Execute the migration
wrangler d1 execute convio-leads --remote --file migrations/add-webhook-soft-deletion.sql
```

Verify the migration:
```bash
# Check new tables exist
wrangler d1 execute convio-leads --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%webhook%';"

# Check new columns exist
wrangler d1 execute convio-leads --remote --command "PRAGMA table_info(webhook_configs);"
```

### Step 2: Create Cloudflare Queues

Create the required queues in your Cloudflare account:

```bash
# Create main deletion queue
wrangler queues create webhook-deletion

# Create dead letter queue for failed jobs
wrangler queues create webhook-deletion-dlq
```

Verify queues are created:
```bash
wrangler queues list
```

### Step 3: Deploy Backend Changes

The backend changes include:
- Updated webhook DELETE endpoint with soft deletion logic
- New webhook restore endpoint
- New deleted webhooks listing endpoint
- Queue consumer for processing deletions

Deploy the updated API:
```bash
cd webhook-api/webhook-api

# Build and deploy
npm run build
npm run deploy

# Verify deployment
curl https://api.homeprojectpartners.com/health
```

### Step 4: Test Queue Consumer

Test the queue consumer is working:

```bash
# Check logs for queue consumer registration
wrangler logs --env production

# Send a test deletion (with a test webhook)
curl -X DELETE "https://api.homeprojectpartners.com/webhook/test-webhook?reason=Testing" \
  -H "X-User-ID: admin-test"
```

### Step 5: Deploy Frontend Changes

The frontend changes include:
- Enhanced delete confirmation dialog with soft/force delete options
- Deleted webhooks management panel with restoration functionality
- Updated main webhooks page integration

Deploy the frontend:
```bash
# From project root
npm run build
npm run deploy  # or your deployment command
```

### Step 6: Verification

1. **Test Soft Deletion**:
   - Create a test webhook
   - Delete it using soft delete option
   - Verify it appears in deleted webhooks list
   - Verify it can be restored

2. **Test Queue Processing**:
   - Check queue metrics in Cloudflare dashboard
   - Verify jobs are scheduled for 24 hours later

3. **Test Restoration**:
   - Restore a soft-deleted webhook
   - Verify it appears in main webhooks list again

4. **Test Force Deletion**:
   - Delete a webhook with force option
   - Verify it's immediately permanently deleted

## Configuration Options

### Queue Settings

The queue configuration in `wrangler.jsonc`:

```json
{
  "queues": {
    "producers": [
      {
        "binding": "WEBHOOK_DELETION_QUEUE",
        "queue": "webhook-deletion"
      }
    ],
    "consumers": [
      {
        "queue": "webhook-deletion",
        "max_batch_size": 5,
        "max_batch_timeout": 10,
        "max_retries": 3,
        "dead_letter_queue": "webhook-deletion-dlq"
      }
    ]
  }
}
```

### Environment Variables

Set these in Cloudflare Workers environment:

```bash
# Optional webhook signature validation
wrangler secret put WEBHOOK_SECRET

# Any additional environment variables
wrangler secret put ENVIRONMENT  # development/production
```

## API Endpoints

### New Endpoints

1. **Soft Delete Webhook**:
   ```
   DELETE /webhook/{webhookId}?reason={reason}&force={true|false}
   Headers: X-User-ID: {user_id}
   ```

2. **Restore Webhook**:
   ```
   POST /webhook/{webhookId}/restore
   Headers: X-User-ID: {user_id}
   ```

3. **List Deleted Webhooks**:
   ```
   GET /webhook/deleted
   ```

### Updated Endpoints

- `GET /webhook` - Now excludes soft-deleted webhooks
- `DELETE /webhook/{webhookId}` - Enhanced with soft deletion support

## Monitoring and Troubleshooting

### Queue Monitoring

Monitor queue health in Cloudflare Dashboard:
- Queue depth and processing rate
- Dead letter queue for failed jobs
- Consumer error rates

### Database Monitoring

Check deletion job status:
```sql
SELECT
  ws.webhook_id,
  ws.job_id,
  ws.status,
  ws.execute_at,
  ws.attempts,
  ws.error_message
FROM webhook_scheduled_deletions ws
WHERE ws.status = 'pending'
ORDER BY ws.execute_at;
```

### Common Issues

1. **Queue Consumer Not Processing**:
   - Check consumer is properly exported in `index.ts`
   - Verify queue configuration in `wrangler.jsonc`
   - Check worker logs for errors

2. **Database Errors**:
   - Verify migration ran successfully
   - Check foreign key constraints
   - Validate table permissions

3. **Frontend Issues**:
   - Check API endpoint responses
   - Verify component imports
   - Check browser console for errors

## Rollback Plan

If issues occur, you can rollback in this order:

1. **Frontend Rollback**:
   ```bash
   # Revert to previous frontend deployment
   git checkout previous-commit
   npm run build && npm run deploy
   ```

2. **Backend Rollback**:
   ```bash
   # Revert API changes
   git checkout previous-commit
   cd webhook-api/webhook-api
   npm run deploy
   ```

3. **Database Rollback** (if necessary):
   ```sql
   -- Remove new columns (will lose soft deletion data)
   ALTER TABLE webhook_configs DROP COLUMN deleted_at;
   ALTER TABLE webhook_configs DROP COLUMN scheduled_deletion_at;
   -- etc.

   -- Drop new tables
   DROP TABLE webhook_deletion_events;
   DROP TABLE webhook_scheduled_deletions;
   ```

## Performance Considerations

### Queue Scaling

- Default batch size: 5 webhooks per batch
- Default timeout: 10 seconds per batch
- Max retries: 3 attempts before dead letter queue

### Database Performance

- Indexes added for query optimization
- Views created for filtered queries
- Batch operations for better D1 performance

### Cost Optimization

- Queue operations are billed per message
- Database operations optimized for D1 pricing
- Cleanup jobs to remove old deletion events

## Security Considerations

### Authentication

- All deletion operations require user identification
- Restore operations include audit trail
- Admin-level permissions recommended for force delete

### Data Protection

- Lead data is always preserved during deletion
- Complete audit trail in `webhook_deletion_events`
- Soft deletion prevents accidental data loss

### Rate Limiting

- Consider implementing rate limits for deletion operations
- Monitor for abuse of restoration functionality
- Implement proper authentication for API endpoints

## Support and Maintenance

### Regular Maintenance

1. **Weekly**: Review queue metrics and performance
2. **Monthly**: Clean up old deletion events (>90 days)
3. **Quarterly**: Review and optimize queue configuration

### Monitoring Alerts

Set up alerts for:
- High queue depth (>100 pending jobs)
- Consumer error rate >5%
- Dead letter queue accumulation
- Database query timeouts

### Documentation Updates

Keep this deployment guide updated with:
- Configuration changes
- New endpoints or features
- Troubleshooting solutions
- Performance optimizations

---

For additional support, refer to:
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Project README](/README.md)