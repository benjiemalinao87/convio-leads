import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

// Rate limiting storage (in production, use KV or external service)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Request validation middleware
export const requestValidation = createMiddleware(async (c, next) => {
  const clientIP = c.req.header('CF-Connecting-IP') ||
                  c.req.header('X-Forwarded-For') ||
                  c.req.header('X-Real-IP') ||
                  'unknown'

  const userAgent = c.req.header('User-Agent') || ''
  const timestamp = new Date().toISOString()

  // Rate limiting (100 requests per minute per IP)
  const rateLimitKey = `rate_limit:${clientIP}`
  const currentTime = Date.now()
  const windowSize = 60 * 1000 // 1 minute
  const maxRequests = 100

  let rateLimitData = rateLimitStore.get(rateLimitKey)

  if (!rateLimitData || currentTime > rateLimitData.resetTime) {
    // Reset or initialize rate limit data
    rateLimitData = {
      count: 0,
      resetTime: currentTime + windowSize
    }
  }

  rateLimitData.count++
  rateLimitStore.set(rateLimitKey, rateLimitData)

  if (rateLimitData.count > maxRequests) {
    throw new HTTPException(429, {
      message: 'Rate limit exceeded. Maximum 100 requests per minute allowed.',
      cause: {
        error: 'rate_limit_exceeded',
        limit: maxRequests,
        window: '1 minute',
        retry_after: Math.ceil((rateLimitData.resetTime - currentTime) / 1000),
        timestamp
      }
    })
  }

  // Set rate limit headers
  c.res.headers.set('X-RateLimit-Limit', maxRequests.toString())
  c.res.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimitData.count).toString())
  c.res.headers.set('X-RateLimit-Reset', rateLimitData.resetTime.toString())

  // Basic security headers
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'DENY')
  c.res.headers.set('X-XSS-Protection', '1; mode=block')

  // Log request for monitoring
  console.log(`Request: ${c.req.method} ${c.req.url}`, {
    client_ip: clientIP,
    user_agent: userAgent,
    timestamp,
    rate_limit_count: rateLimitData.count,
    rate_limit_remaining: maxRequests - rateLimitData.count
  })

  // Check for required headers on POST requests
  if (c.req.method === 'POST') {
    const contentType = c.req.header('Content-Type')

    if (!contentType?.includes('application/json')) {
      throw new HTTPException(400, {
        message: 'Content-Type must be application/json for POST requests',
        cause: {
          error: 'invalid_content_type',
          required: 'application/json',
          received: contentType || 'none',
          timestamp
        }
      })
    }

    // Check content length (max 1MB)
    const contentLength = c.req.header('Content-Length')
    const maxContentLength = 1024 * 1024 // 1MB

    if (contentLength && parseInt(contentLength) > maxContentLength) {
      throw new HTTPException(413, {
        message: 'Request body too large. Maximum size is 1MB.',
        cause: {
          error: 'payload_too_large',
          max_size: maxContentLength,
          received_size: parseInt(contentLength),
          timestamp
        }
      })
    }
  }

  // Security: Block suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scanner/i,
    /curl/i,
    /wget/i
  ]

  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent))

  if (isSuspicious && !userAgent.includes('Googlebot') && !userAgent.includes('legitimate-bot')) {
    console.warn(`Suspicious user agent detected: ${userAgent}`, {
      client_ip: clientIP,
      timestamp,
      user_agent: userAgent
    })

    // Optional: uncomment to block suspicious requests
    // throw new HTTPException(403, {
    //   message: 'Access denied',
    //   cause: {
    //     error: 'suspicious_user_agent',
    //     timestamp
    //   }
    // })
  }

  await next()
})

// Webhook-specific validation middleware
export const webhookValidation = createMiddleware(async (c, next) => {
  const webhookId = c.req.param('webhookId')

  if (c.req.method === 'POST') {
    // Check for webhook signature header
    const signature = c.req.header('X-Webhook-Signature')
    const webhookSecret = (c.env as any)?.WEBHOOK_SECRET

    if (webhookSecret && !signature) {
      throw new HTTPException(400, {
        message: 'Missing webhook signature header',
        cause: {
          error: 'missing_signature',
          required_header: 'X-Webhook-Signature',
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  await next()
})