// Webhook Deletion Queue System for Cloudflare Workers
// Handles 24-hour delayed deletion of webhooks

/**
 * Queue consumer function to handle webhook deletion messages
 * This is called automatically by Cloudflare Queues after the 24-hour delay
 */
export async function webhookDeletionConsumer(batch: MessageBatch<any>, env: any): Promise<void> {
  console.log(`Processing ${batch.messages.length} webhook deletion messages`)

  for (const message of batch.messages) {
    try {
      const { webhook_id, job_id, scheduled_at } = message.body
      
      console.log(`Processing deletion for webhook: ${webhook_id}, job: ${job_id}`)

      const db = env.LEADS_DB

      // Verify the webhook is still scheduled for deletion and hasn't been restored
      const { results: webhookCheck } = await db.prepare(`
        SELECT 
          w.id,
          w.webhook_id,
          w.name,
          w.deleted_at,
          sd.status as job_status
        FROM webhook_configs w
        LEFT JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id AND sd.job_id = ?
        WHERE w.webhook_id = ? AND w.deleted_at IS NOT NULL
      `).bind(job_id, webhook_id).all()

      if (webhookCheck.length === 0) {
        console.log(`Webhook ${webhook_id} not found or already processed, acking message`)
        message.ack()
        continue
      }

      const webhook = webhookCheck[0]

      // Check if the job was cancelled (webhook restored)
      if (webhook.job_status === 'cancelled') {
        console.log(`Webhook ${webhook_id} was restored, job cancelled, acking message`)
        message.ack()
        continue
      }

      // Mark job as processing
      await db.prepare(`
        UPDATE webhook_scheduled_deletions
        SET 
          status = 'processing',
          attempts = attempts + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
      `).bind(job_id).run()

      try {
        // Perform the permanent deletion in a transaction
        await db.batch([
          // Log the permanent deletion event
          db.prepare(`
            INSERT INTO webhook_deletion_events 
            (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
            VALUES (?, 'permanent_delete', CURRENT_TIMESTAMP, 'queue_system', ?, ?, ?)
          `).bind(
            webhook.id,
            'Automatic deletion after 24-hour grace period',
            JSON.stringify({
              job_id,
              scheduled_at,
              queue_processed: true,
              webhook_name: webhook.name
            }),
            job_id
          ),

          // Delete the webhook configuration permanently
          db.prepare('DELETE FROM webhook_configs WHERE webhook_id = ?').bind(webhook_id),

          // Mark the scheduled deletion as completed
          db.prepare(`
            UPDATE webhook_scheduled_deletions
            SET 
              status = 'completed',
              completed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
          `).bind(job_id)
        ])

        console.log(`Successfully deleted webhook: ${webhook_id}`)
        message.ack()

      } catch (deletionError) {
        console.error(`Failed to delete webhook ${webhook_id}:`, deletionError)
        
        // Update job status with error
        await db.prepare(`
          UPDATE webhook_scheduled_deletions
          SET 
            status = 'failed',
            error_message = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE job_id = ?
        `).bind(
          deletionError instanceof Error ? deletionError.message : 'Unknown deletion error',
          job_id
        ).run().catch(console.error)

        // Log failure event
        await db.prepare(`
          INSERT INTO webhook_deletion_events 
          (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
          VALUES (?, 'queue_failed', CURRENT_TIMESTAMP, 'queue_system', ?, ?, ?)
        `).bind(
          webhook.id,
          'Queue deletion failed',
          JSON.stringify({
            job_id,
            error: deletionError instanceof Error ? deletionError.message : 'Unknown error',
            attempts: webhook.attempts + 1
          }),
          job_id
        ).run().catch(console.error)

        // Retry the message
        message.retry()
      }

    } catch (error) {
      console.error('Queue message processing error:', error)
      message.retry()
    }
  }
}

/**
 * Queue producer function to schedule a webhook deletion
 * Called when a webhook is soft-deleted to schedule permanent deletion
 */
export async function scheduleWebhookDeletion(
  env: any,
  webhookId: string,
  jobId: string,
  scheduledAt: string
): Promise<void> {
  // Check if queue is available
  if (!env.WEBHOOK_DELETION_QUEUE) {
    console.warn('Webhook deletion queue not configured, skipping queue scheduling')
    return
  }

  const delaySeconds = Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000)

  if (delaySeconds <= 0) {
    throw new Error('Scheduled deletion time must be in the future')
  }

  try {
    // Send message to the queue with delay
    await env.WEBHOOK_DELETION_QUEUE.send({
      webhook_id: webhookId,
      job_id: jobId,
      scheduled_at: scheduledAt,
      queued_at: new Date().toISOString()
    }, {
      delaySeconds: delaySeconds
    })

    console.log(`Queued deletion for webhook ${webhookId} with ${delaySeconds}s delay (job: ${jobId})`)

  } catch (queueError) {
    console.error('Failed to queue webhook deletion:', queueError)
    throw new Error(`Queue scheduling failed: ${queueError instanceof Error ? queueError.message : 'Unknown error'}`)
  }
}

/**
 * Cron-based deletion processor (alternative to queue)
 * This can be used as a backup when queues are not available
 */
export async function processPendingDeletions(env: any): Promise<{ processed: number, failed: number }> {
  console.log('Starting cron-based deletion processing')

  const db = env.LEADS_DB
  let processed = 0
  let failed = 0

  try {
    // Find webhooks that are past their scheduled deletion time
    const { results: expiredWebhooks } = await db.prepare(`
      SELECT
        w.id,
        w.webhook_id,
        w.name,
        sd.job_id,
        sd.attempts,
        sd.max_attempts
      FROM webhook_configs w
      JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id
      WHERE w.deleted_at IS NOT NULL
        AND sd.status = 'pending'
        AND sd.execute_at <= CURRENT_TIMESTAMP
        AND sd.attempts < sd.max_attempts
    `).all()

    console.log(`Found ${expiredWebhooks.length} webhooks ready for deletion`)

    for (const webhook of expiredWebhooks) {
      try {
        await db.batch([
          // Mark as processing
          db.prepare(`
            UPDATE webhook_scheduled_deletions
            SET 
              status = 'processing',
              attempts = attempts + 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
          `).bind(webhook.job_id),

          // Log permanent deletion
          db.prepare(`
            INSERT INTO webhook_deletion_events
            (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
            VALUES (?, 'permanent_delete', CURRENT_TIMESTAMP, 'cron_system', ?, ?, ?)
          `).bind(
            webhook.id,
            'Automatic deletion via cron after 24-hour grace period',
            JSON.stringify({
              job_id: webhook.job_id,
              attempts: webhook.attempts + 1,
              cron_processed: true
            }),
            webhook.job_id
          ),

          // Delete webhook permanently
          db.prepare('DELETE FROM webhook_configs WHERE webhook_id = ?').bind(webhook.webhook_id),

          // Mark job as completed
          db.prepare(`
            UPDATE webhook_scheduled_deletions
            SET 
              status = 'completed',
              completed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
          `).bind(webhook.job_id)
        ])

        console.log(`Cron: Successfully deleted webhook ${webhook.webhook_id}`)
        processed++

      } catch (error) {
        console.error(`Cron: Failed to delete webhook ${webhook.webhook_id}:`, error)
        failed++

        // Update with error
        await db.prepare(`
          UPDATE webhook_scheduled_deletions
          SET 
            status = 'failed',
            error_message = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE job_id = ?
        `).bind(
          error instanceof Error ? error.message : 'Unknown cron error',
          webhook.job_id
        ).run().catch(console.error)
      }
    }

    console.log(`Cron deletion completed: ${processed} processed, ${failed} failed`)
    return { processed, failed }

  } catch (error) {
    console.error('Cron deletion processing error:', error)
    throw error
  }
}
