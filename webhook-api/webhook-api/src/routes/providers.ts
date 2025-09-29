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
        contact_name,
        contact_phone,
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
      contact_name,
      contact_phone,
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
        contact_name,
        contact_phone,
        is_active,
        allowed_webhooks,
        rate_limit,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      providerId,
      provider_name,
      company_name || null,
      contact_email || null,
      contact_name || null,
      contact_phone || null,
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
      contact_name,
      contact_phone,
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
    if (contact_name !== undefined) {
      updateFields.push('contact_name = ?')
      updateValues.push(contact_name)
    }
    if (contact_phone !== undefined) {
      updateFields.push('contact_phone = ?')
      updateValues.push(contact_phone)
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

// Get provider conversion analytics
providers.get('/:providerId/conversions', async (c) => {
  const providerId = c.req.param('providerId')
  const fromDate = c.req.query('from') // Expected format: MM-DD-YYYY
  const toDate = c.req.query('to')     // Expected format: MM-DD-YYYY
  const status = c.req.query('status') // Optional status filter (e.g., 'scheduled')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // Verify provider exists
    const { results: providerCheck } = await db.prepare(
      'SELECT provider_id, provider_name FROM lead_source_providers WHERE provider_id = ?'
    ).bind(providerId).all()

    if (providerCheck.length === 0) {
      return c.json({
        error: 'Provider not found',
        message: `Provider ${providerId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const provider = providerCheck[0]

    // Parse and validate date parameters
    let startDate = null
    let endDate = null

    if (fromDate) {
      // Convert MM-DD-YYYY to YYYY-MM-DD for SQL
      const fromParts = fromDate.split('-')
      if (fromParts.length === 3) {
        startDate = `${fromParts[2]}-${fromParts[0].padStart(2, '0')}-${fromParts[1].padStart(2, '0')}`
      } else {
        return c.json({
          error: 'Invalid date format',
          message: 'from parameter must be in MM-DD-YYYY format',
          timestamp: new Date().toISOString()
        }, 400)
      }
    }

    if (toDate) {
      // Convert MM-DD-YYYY to YYYY-MM-DD for SQL
      const toParts = toDate.split('-')
      if (toParts.length === 3) {
        endDate = `${toParts[2]}-${toParts[0].padStart(2, '0')}-${toParts[1].padStart(2, '0')} 23:59:59`
      } else {
        return c.json({
          error: 'Invalid date format',
          message: 'to parameter must be in MM-DD-YYYY format',
          timestamp: new Date().toISOString()
        }, 400)
      }
    }

    // Build WHERE conditions and parameters properly
    let whereConditions = ['pul.provider_id = ?']
    let queryParams = [providerId]

    if (startDate) {
      whereConditions.push('(l.created_at >= ? OR (l.created_at IS NULL AND a.created_at >= ?))')
      queryParams.push(startDate)
      queryParams.push(startDate)
    }

    if (endDate) {
      whereConditions.push('(l.created_at <= ? OR (l.created_at IS NULL AND a.created_at <= ?))')
      queryParams.push(endDate)
      queryParams.push(endDate)
    }

    if (status) {
      whereConditions.push('LOWER(l.status) = LOWER(?)')
      queryParams.push(status)
    }

    // Query for leads with appointment conversion data
    // Join through provider_usage_log to link providers to leads via webhook_id
    const conversionQuery = `
      SELECT
        l.id as lead_id,
        l.first_name,
        l.last_name,
        l.email,
        l.phone,
        l.zip_code,
        l.service_type,
        l.status as lead_status,
        l.source as lead_source,
        l.created_at as lead_created_at,
        a.id as appointment_id,
        a.scheduled_at as appointment_date,
        a.appointment_type,
        a.estimated_value,
        a.forward_status,
        a.created_at as appointment_created_at,
        c.id as contact_id
      FROM leads l
      LEFT JOIN appointments a ON l.id = a.lead_id
      LEFT JOIN contacts c ON l.contact_id = c.id
      INNER JOIN provider_usage_log pul ON l.webhook_id = pul.webhook_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY l.created_at DESC
    `

    const { results: conversions } = await db.prepare(conversionQuery).bind(...queryParams).all()

    // Calculate summary statistics
    const totalLeads = conversions.length
    const scheduledLeads = conversions.filter((c: any) => c.appointment_id !== null).length
    const conversionRate = totalLeads > 0 ? ((scheduledLeads / totalLeads) * 100).toFixed(2) : '0.00'

    // Group by status for status breakdown
    const statusBreakdown = conversions.reduce((acc: any, lead: any) => {
      const status = lead.lead_status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Calculate total estimated value
    const totalEstimatedValue = conversions
      .filter((c: any) => c.estimated_value)
      .reduce((sum: number, c: any) => sum + (parseFloat(c.estimated_value) || 0), 0)

    return c.json({
      status: 'success',
      provider: {
        provider_id: providerId,
        provider_name: provider.provider_name
      },
      date_range: {
        from: fromDate || 'all_time',
        to: toDate || 'all_time',
        from_sql: startDate || 'all_time',
        to_sql: endDate || 'all_time'
      },
      summary: {
        total_leads: totalLeads,
        scheduled_appointments: scheduledLeads,
        conversion_rate: `${conversionRate}%`,
        total_estimated_value: totalEstimatedValue,
        status_breakdown: statusBreakdown
      },
      conversions: conversions.map((conv: any) => ({
        lead_id: conv.lead_id,
        contact_id: conv.contact_id,
        customer_name: `${conv.first_name || ''} ${conv.last_name || ''}`.trim(),
        email: conv.email,
        phone: conv.phone,
        zip_code: conv.zip_code,
        service_type: conv.service_type,
        lead_status: conv.lead_status,
        lead_source: conv.lead_source,
        lead_created_at: conv.lead_created_at,
        appointment: conv.appointment_id ? {
          appointment_id: conv.appointment_id,
          appointment_date: conv.appointment_date,
          appointment_type: conv.appointment_type,
          estimated_value: conv.estimated_value,
          forward_status: conv.forward_status,
          appointment_created_at: conv.appointment_created_at
        } : null
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching provider conversions:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch provider conversion data',
      details: error instanceof Error ? error.message : 'Unknown error',
      query: 'Query construction failed',
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
