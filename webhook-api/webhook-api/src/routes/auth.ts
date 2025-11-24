import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

interface Env {
  LEADS_DB?: D1Database
  LOGIN_USERNAME?: string  // Keep for backward compatibility during migration
  LOGIN_PASSWORD?: string  // Keep for backward compatibility during migration
}

const authRouter = new Hono<{ Bindings: Env }>()

// Login endpoint
authRouter.post('/login', async (c) => {
  try {
    const { email, password, provider_id } = await c.req.json()

    // Check if database is available
    if (!c.env.LEADS_DB) {
      // Fallback to ENV-based auth during migration (should not be used in production)
      console.warn('⚠️ LEADS_DB not available, falling back to ENV-based auth')
    const validUsername = c.env.LOGIN_USERNAME
    const validPassword = c.env.LOGIN_PASSWORD

      if (email === validUsername && password === validPassword) {
        const sessionToken = btoa(`${email}:${Date.now()}`)
      return c.json({
        success: true,
        token: sessionToken,
          user: {
            email: email,
            permission_type: 'admin',
            id: 0
          }
      })
    } else {
        return c.json({
          success: false,
          error: 'Invalid credentials'
        }, 401)
      }
    }

    // Use database-backed authentication (primary method)
    console.log('✅ Using database-backed authentication')
    const db = c.env.LEADS_DB

    // Build query based on whether provider_id is provided
    let query = 'SELECT * FROM users WHERE email = ? AND is_active = 1'
    const params: any[] = [email]

    // For providers, also check provider_id if provided
    if (provider_id) {
      query += ' AND provider_id = ?'
      params.push(provider_id)
    }

    const result = await db.prepare(query).bind(...params).first()

    if (!result) {
      return c.json({
        success: false,
        error: 'Invalid credentials'
      }, 401)
    }

    // Validate password (plain text comparison for dev)
    if (result.password !== password) {
      return c.json({
        success: false,
        error: 'Invalid credentials'
      }, 401)
    }

    // Update last_login_at
    await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(result.id).run()

    // Generate session token
    const sessionToken = btoa(`${result.email}:${Date.now()}`)

    return c.json({
      success: true,
      token: sessionToken,
      user: {
        id: result.id,
        email: result.email,
        permission_type: result.permission_type,
        provider_id: result.provider_id || undefined
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({
      success: false,
      error: 'Authentication failed'
    }, 500)
  }
})

// Verify session endpoint
authRouter.post('/verify', async (c) => {
  try {
    const { token } = await c.req.json()

    if (!token) {
      return c.json({ valid: false }, 401)
    }

    // Check if database is available
    if (!c.env.LEADS_DB) {
      // Fallback to ENV-based verification during migration (should not be used in production)
      console.warn('⚠️ LEADS_DB not available, falling back to ENV-based verification')
      try {
        const decoded = atob(token)
        const [username, timestamp] = decoded.split(':')
        const tokenAge = Date.now() - parseInt(timestamp)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (tokenAge < maxAge && username === c.env.LOGIN_USERNAME) {
          return c.json({
            valid: true,
            user: {
              email: username,
              permission_type: 'admin',
              id: 0
            }
          })
        }
      } catch (e) {
        // Invalid token format
      }
      return c.json({ valid: false }, 401)
    }

    // Use database-backed verification (primary method)
    console.log('✅ Using database-backed verification')
    const db = c.env.LEADS_DB

    // Simple token validation (in production, use proper JWT validation)
    try {
      const decoded = atob(token)
      const [email, timestamp] = decoded.split(':')

      // Check if token is less than 24 hours old
      const tokenAge = Date.now() - parseInt(timestamp)
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      if (tokenAge >= maxAge) {
        return c.json({ valid: false }, 401)
      }

      // Verify user exists and is active
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
        .bind(email).first()

      if (user) {
        return c.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            permission_type: user.permission_type,
            provider_id: user.provider_id || undefined
          }
        })
      }
    } catch (e) {
      // Invalid token format
      console.error('Token decode error:', e)
    }

    return c.json({ valid: false }, 401)
  } catch (error) {
    console.error('Verify error:', error)
    return c.json({ valid: false }, 500)
  }
})

// Logout endpoint
authRouter.post('/logout', async (c) => {
  // In a real app, you might invalidate the session here
  return c.json({ success: true })
})

export default authRouter