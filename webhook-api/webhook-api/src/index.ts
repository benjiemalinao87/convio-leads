import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { poweredBy } from 'hono/powered-by'
import { timing } from 'hono/timing'
import { webhookRouter } from './routes/webhook'
import { healthRouter } from './routes/health'
import leadsRouter from './routes/leads'
import { contactsRouter } from './routes/contacts'
import conversionsRouter from './routes/conversions'
import { appointmentsRouter } from './routes/appointments'
import { routingRulesRouter } from './routes/routing-rules'
import { providersRouter } from './routes/providers'
import { requestValidation } from './middleware/validation'
import { errorHandler } from './middleware/error-handler'
import { webhookDeletionConsumer, processPendingDeletions } from './queue/webhook-deletion'
import { D1Database, Queue, MessageBatch, ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types'

type Bindings = {
  // Define your Cloudflare bindings here
  LEADS_DB?: D1Database
  WEBHOOK_DELETION_QUEUE?: Queue
  // KV: KVNamespace
  WEBHOOK_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Global middleware
app.use('*', logger())
app.use('*', poweredBy())
app.use('*', timing())
app.use('*', cors({
  origin: [
    'https://homeprojectpartners.com',
    'https://api.homeprojectpartners.com',
    'https://dash.homeprojectpartners.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://localhost:8084',
    'http://localhost:8085',
    'http://localhost:8086',
    'http://localhost:4173',
    'http://localhost:8888',
    'http://localhost:8889',
    'http://localhost:8890'
  ],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-User-ID'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Request validation middleware
app.use('/webhook/*', requestValidation)

// Error handling
app.onError(errorHandler)

// Routes
app.route('/health', healthRouter)
app.route('/webhook', webhookRouter)
app.route('/leads', leadsRouter)
app.route('/contacts', contactsRouter)
app.route('/conversions', conversionsRouter)
app.route('/appointments', appointmentsRouter)
app.route('/routing-rules', routingRulesRouter)
app.route('/providers', providersRouter)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'Convio Leads Webhook API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString()
  }, 404)
})

// Export the queue consumer for Cloudflare Queues
export async function queue(batch: MessageBatch<any>, env: Bindings): Promise<void> {
  await webhookDeletionConsumer(batch, env)
}

// Export scheduled handler for cron triggers (fallback)
export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
  console.log('Cron trigger received:', event.cron)
  
  if (event.cron === '0 * * * *') { // Every hour
    try {
      const result = await processPendingDeletions(env)
      console.log(`Cron deletion result:`, result)
    } catch (error) {
      console.error('Cron deletion failed:', error)
    }
  }
}

// Export default app with handlers
export default {
  fetch: app.fetch,
  queue,
  scheduled
}