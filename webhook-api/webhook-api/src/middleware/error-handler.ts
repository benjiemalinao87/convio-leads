import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler = (error: Error, c: Context) => {
  const timestamp = new Date().toISOString()
  const requestId = crypto.randomUUID()

  // Log error for monitoring
  console.error('Error occurred:', {
    request_id: requestId,
    error: error.message,
    stack: error.stack,
    url: c.req.url,
    method: c.req.method,
    user_agent: c.req.header('User-Agent'),
    client_ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    timestamp
  })

  // Handle HTTP exceptions
  if (error instanceof HTTPException) {
    const status = error.status
    const message = error.message

    // Extract additional error details if available
    const errorDetails = (error as any).cause || {}

    return c.json({
      error: errorDetails.error || 'http_exception',
      message,
      status,
      request_id: requestId,
      timestamp,
      ...errorDetails
    }, status)
  }

  // Handle validation errors (Zod errors)
  if (error.name === 'ZodError') {
    const zodError = error as any
    return c.json({
      error: 'validation_error',
      message: 'Request validation failed',
      details: zodError.errors?.map((err: any) => ({
        field: err.path?.join('.') || 'unknown',
        message: err.message,
        code: err.code
      })) || [],
      request_id: requestId,
      timestamp
    }, 400)
  }

  // Handle JSON parsing errors
  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return c.json({
      error: 'invalid_json',
      message: 'Invalid JSON in request body',
      request_id: requestId,
      timestamp
    }, 400)
  }

  // Handle database errors (when D1 is integrated)
  if (error.message.includes('D1_ERROR') || error.message.includes('database')) {
    return c.json({
      error: 'database_error',
      message: 'A database error occurred',
      request_id: requestId,
      timestamp,
      details: 'Please try again later or contact support if the issue persists'
    }, 500)
  }

  // Handle rate limiting errors
  if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
    return c.json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please slow down.',
      request_id: requestId,
      timestamp,
      retry_after: 60
    }, 429)
  }

  // Handle timeout errors
  if (error.message.includes('timeout') || error.name === 'TimeoutError') {
    return c.json({
      error: 'timeout_error',
      message: 'Request timed out',
      request_id: requestId,
      timestamp,
      details: 'The request took too long to process. Please try again.'
    }, 504)
  }

  // Handle network/external service errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return c.json({
      error: 'external_service_error',
      message: 'External service error',
      request_id: requestId,
      timestamp,
      details: 'A dependency service is currently unavailable'
    }, 502)
  }

  // Generic error handler for unexpected errors
  return c.json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    request_id: requestId,
    timestamp,
    details: 'Please try again later or contact support if the issue persists'
  }, 500)
}