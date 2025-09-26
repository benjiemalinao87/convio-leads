import { Hono } from 'hono'

const providers = new Hono()

// Helper function to generate provider ID
function generateProviderId(providerName: string): string {
  // Clean the name: lowercase, replace spaces/special chars with underscores, remove multiple underscores
  const cleanName = providerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20) // Limit length

  // Generate random 4-digit suffix
  const randomSuffix = Math.floor(1000 + Math.random() * 9000) // 1000-9999
  
  return `${cleanName}_${randomSuffix}`
}

// Get all providers
providers.get('/', async (c) => {
  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB
    const { results } = await db.prepare(`
      SELECT 
        id,
        provider_id,
        provider_name,
        company_name,
        contact_email,
        is_active,
        allowed_webhooks,
        rate_limit,
        notes,
        created_at,
        updated_at,
        last_used_at
      FROM lead_source_providers
      ORDER BY created_at DESC
    `).all()

    return c.json({
      status: 'success',
      count: results.length,
      providers: results.map((provider: any) => ({
        ...provider,
        is_active: provider.is_active === 1,
        allowed_webhooks: provider.allowed_webhooks ? JSON.parse(provider.allowed_webhooks) : null
      })),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching providers:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch providers from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Create a new provider
providers.post('/', async (c) => {
  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const body = await c.req.json()
    const { 
      provider_name, 
      company_name, 
      contact_email, 
      notes,
      allowed_webhooks,
      rate_limit = 1000
    } = body

    // Validate required fields
    if (!provider_name) {
      return c.json({
        error: 'Missing required fields',
        message: 'provider_name is required',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Generate unique provider ID
    let providerId = generateProviderId(provider_name)
    
    const db = (c.env as any).LEADS_DB

    // Check for ID collision and regenerate if needed
    let attempts = 0
    while (attempts < 5) {
      const { results: existing } = await db.prepare(
        'SELECT provider_id FROM lead_source_providers WHERE provider_id = ?'
      ).bind(providerId).all()

      if (existing.length === 0) {
        break // ID is unique
      }

      // Collision detected, regenerate
      providerId = generateProviderId(provider_name)
      attempts++
    }

    if (attempts >= 5) {
      return c.json({
        error: 'ID generation failed',
        message: 'Unable to generate unique provider ID after multiple attempts',
        timestamp: new Date().toISOString()
      }, 500)
    }

    // Prepare allowed_webhooks JSON
    const allowedWebhooksJson = allowed_webhooks && Array.isArray(allowed_webhooks) && allowed_webhooks.length > 0
      ? JSON.stringify(allowed_webhooks)
      : null

    // Insert new provider
    await db.prepare(`
      INSERT INTO lead_source_providers (
        provider_id, 
        provider_name, 
        company_name, 
        contact_email, 
        is_active, 
        allowed_webhooks,
        rate_limit,
        notes,
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      providerId,
      provider_name,
      company_name || null,
      contact_email || null,
      allowedWebhooksJson,
      rate_limit,
      notes || null
    ).run()

    // Fetch the created provider
    const { results } = await db.prepare(
      'SELECT * FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    const createdProvider = results[0]

    return c.json({
      status: 'success',
      message: 'Provider created successfully',
      provider: {
        ...createdProvider,
        is_active: createdProvider.is_active === 1,
        allowed_webhooks: createdProvider.allowed_webhooks ? JSON.parse(createdProvider.allowed_webhooks) : null
      },
      timestamp: new Date().toISOString()
    }, 201)

  } catch (error) {
    console.error('Error creating provider:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to create provider',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get a single provider by ID
providers.get('/:providerId', async (c) => {
  const providerId = c.req.param('providerId')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB
    const { results } = await db.prepare(
      'SELECT * FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Provider not found',
        message: `Provider ${providerId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const provider = results[0]

    return c.json({
      status: 'success',
      provider: {
        ...provider,
        is_active: provider.is_active === 1,
        allowed_webhooks: provider.allowed_webhooks ? JSON.parse(provider.allowed_webhooks) : null
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching provider:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch provider',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Update a provider
providers.patch('/:providerId', async (c) => {
  const providerId = c.req.param('providerId')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const body = await c.req.json()
    const { 
      provider_name, 
      company_name, 
      contact_email, 
      is_active,
      allowed_webhooks,
      rate_limit,
      notes
    } = body

    const db = (c.env as any).LEADS_DB

    // Check if provider exists
    const { results: existing } = await db.prepare(
      'SELECT provider_id FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    if (existing.length === 0) {
      return c.json({
        error: 'Provider not found',
        message: `Provider ${providerId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Build dynamic update query
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (provider_name !== undefined) {
      updateFields.push('provider_name = ?')
      updateValues.push(provider_name)
    }
    if (company_name !== undefined) {
      updateFields.push('company_name = ?')
      updateValues.push(company_name)
    }
    if (contact_email !== undefined) {
      updateFields.push('contact_email = ?')
      updateValues.push(contact_email)
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?')
      updateValues.push(is_active ? 1 : 0)
    }
    if (allowed_webhooks !== undefined) {
      updateFields.push('allowed_webhooks = ?')
      updateValues.push(allowed_webhooks && Array.isArray(allowed_webhooks) && allowed_webhooks.length > 0
        ? JSON.stringify(allowed_webhooks)
        : null
      )
    }
    if (rate_limit !== undefined) {
      updateFields.push('rate_limit = ?')
      updateValues.push(rate_limit)
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?')
      updateValues.push(notes)
    }

    if (updateFields.length === 0) {
      return c.json({
        error: 'No valid fields to update',
        message: 'No updateable fields provided in request body',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    updateValues.push(providerId) // For WHERE clause

    // Execute update
    const query = `UPDATE lead_source_providers SET ${updateFields.join(', ')} WHERE provider_id = ?`
    await db.prepare(query).bind(...updateValues).run()

    // Fetch updated provider
    const { results } = await db.prepare(
      'SELECT * FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    const updatedProvider = results[0]

    return c.json({
      status: 'success',
      message: 'Provider updated successfully',
      provider: {
        ...updatedProvider,
        is_active: updatedProvider.is_active === 1,
        allowed_webhooks: updatedProvider.allowed_webhooks ? JSON.parse(updatedProvider.allowed_webhooks) : null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating provider:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to update provider',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Delete a provider
providers.delete('/:providerId', async (c) => {
  const providerId = c.req.param('providerId')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // Check if provider exists
    const { results: existing } = await db.prepare(
      'SELECT provider_id, provider_name FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    if (existing.length === 0) {
      return c.json({
        error: 'Provider not found',
        message: `Provider ${providerId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const provider = existing[0]

    // Delete the provider
    await db.prepare(
      'DELETE FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).run()

    return c.json({
      status: 'success',
      message: 'Provider deleted successfully',
      deleted_provider: {
        provider_id: providerId,
        provider_name: provider.provider_name
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting provider:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to delete provider',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Test provider ID generation
providers.post('/test-id', async (c) => {
  try {
    const body = await c.req.json()
    const { provider_name } = body

    if (!provider_name) {
      return c.json({
        error: 'Missing required fields',
        message: 'provider_name is required',
        timestamp: new Date().toISOString()
      }, 400)
    }

    const generatedId = generateProviderId(provider_name)

    return c.json({
      status: 'success',
      input_name: provider_name,
      generated_id: generatedId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return c.json({
      error: 'Invalid request',
      message: 'Failed to process request',
      timestamp: new Date().toISOString()
    }, 400)
  }
})

export { providers as providersRouter }
