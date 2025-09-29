import { Hono } from 'hono'

interface Env {
  LOGIN_USERNAME: string
  LOGIN_PASSWORD: string
}

const authRouter = new Hono<{ Bindings: Env }>()

// Login endpoint
authRouter.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()

    // Get credentials from environment variables
    const validUsername = c.env.LOGIN_USERNAME
    const validPassword = c.env.LOGIN_PASSWORD

    console.log('Auth attempt:', {
      username,
      hasPassword: !!password,
      hasValidUsername: !!validUsername,
      hasValidPassword: !!validPassword
    })

    // Validate credentials
    if (username === validUsername && password === validPassword) {
      // Generate a simple session token (in production, use JWT or similar)
      const sessionToken = btoa(`${username}:${Date.now()}`)

      return c.json({
        success: true,
        token: sessionToken,
        username: username
      })
    } else {
      return c.json({
        success: false,
        error: 'Invalid credentials'
      }, 401)
    }
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

    // Simple token validation (in production, use proper JWT validation)
    try {
      const decoded = atob(token)
      const [username, timestamp] = decoded.split(':')

      // Check if token is less than 24 hours old
      const tokenAge = Date.now() - parseInt(timestamp)
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      if (tokenAge < maxAge && username === c.env.LOGIN_USERNAME) {
        return c.json({
          valid: true,
          username: username
        })
      }
    } catch (e) {
      // Invalid token format
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