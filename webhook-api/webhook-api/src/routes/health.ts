import { Hono } from 'hono'

const health = new Hono()

// General health check
health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'Convio Leads Webhook API',
    timestamp: new Date().toISOString(),
    uptime: 0, // Uptime tracking not available in Cloudflare Workers
    version: '1.0.0'
  })
})

// Deep health check with more details
health.get('/detailed', (c) => {
  const healthData = {
    status: 'healthy',
    service: 'Convio Leads Webhook API',
    timestamp: new Date().toISOString(),
    uptime: 0, // Uptime tracking not available in Cloudflare Workers
    version: '1.0.0',
    checks: {
      api: 'healthy',
      webhooks: 'healthy',
      // database: 'healthy', // Uncomment when DB is connected
      // cache: 'healthy', // Uncomment when KV is connected
    },
    metrics: {
      memory_usage: null, // Memory usage not available in Cloudflare Workers
      environment: c.env ? 'production' : 'development'
    }
  }

  return c.json(healthData)
})

// Liveness probe (for Kubernetes/health monitoring)
health.get('/live', (c) => {
  return c.json({ status: 'alive' })
})

// Readiness probe (for load balancers)
health.get('/ready', (c) => {
  // Add any readiness checks here (DB connectivity, etc.)
  return c.json({ status: 'ready' })
})

export { health as healthRouter }