import { Hono } from 'hono'
import { LeadDatabase } from '../db/leads'
import { normalizePhoneNumber } from '../utils/phone'

const leads = new Hono()

// Get all leads with optional filtering
leads.get('/', async (c) => {
  const webhookId = c.req.query('webhook_id')
  const providerId = c.req.query('provider_id')
  const status = c.req.query('status')
  const fromDate = c.req.query('from_date')
  const toDate = c.req.query('to_date')
  const contactId = c.req.query('contact_id')
  const limit = parseInt(c.req.query('limit') || '100')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)

    // If contact_id filtering is requested, handle it separately
    if (contactId) {
      const contactIdNum = parseInt(contactId)
      if (isNaN(contactIdNum)) {
        return c.json({
          error: 'Invalid contact ID',
          message: 'Contact ID must be a valid number',
          timestamp: new Date().toISOString()
        }, 400)
      }

      const leadDb = (c.env as any).LEADS_DB
      let contactQuery = 'SELECT l.* FROM leads l'
      const contactParams: any[] = []
      
      if (providerId) {
        contactQuery += ' INNER JOIN webhook_provider_mapping wpm ON l.webhook_id = wpm.webhook_id WHERE wpm.provider_id = ? AND l.contact_id = ?'
        contactParams.push(providerId, contactIdNum)
      } else {
        contactQuery += ' WHERE l.contact_id = ?'
        contactParams.push(contactIdNum)
      }
      
      contactQuery += ' ORDER BY l.created_at DESC LIMIT ?'
      contactParams.push(limit)
      
      const { results } = await leadDb.prepare(contactQuery).bind(...contactParams).all()

      return c.json({
        status: 'success',
        count: results.length,
        filters: {
          contact_id: contactIdNum,
          limit: limit
        },
        leads: results,
        timestamp: new Date().toISOString()
      })
    }

    // If provider_id is provided, filter by provider's webhooks
    if (providerId) {
      const leadDb = (c.env as any).LEADS_DB
      
      // Get webhook IDs for this provider
      const { results: webhookMappings } = await leadDb.prepare(`
        SELECT webhook_id FROM webhook_provider_mapping WHERE provider_id = ?
      `).bind(providerId).all()
      
      const providerWebhookIds = webhookMappings.map((w: any) => w.webhook_id)
      
      if (providerWebhookIds.length === 0) {
        return c.json({
          status: 'success',
          count: 0,
          filters: { provider_id: providerId },
          leads: [],
          timestamp: new Date().toISOString()
        })
      }
      
      // Build query with provider webhook filter
      let providerQuery = 'SELECT l.* FROM leads l WHERE l.webhook_id IN (' + providerWebhookIds.map(() => '?').join(',') + ')'
      const providerParams: any[] = [...providerWebhookIds]
      
      if (status) {
        providerQuery += ' AND l.status = ?'
        providerParams.push(status)
      }
      if (webhookId && providerWebhookIds.includes(webhookId)) {
        providerQuery += ' AND l.webhook_id = ?'
        providerParams.push(webhookId)
      }
      if (fromDate) {
        providerQuery += ' AND (l.created_at >= ? OR l.created_at IS NULL)'
        providerParams.push(fromDate)
      }
      if (toDate) {
        providerQuery += ' AND (l.created_at <= ? OR l.created_at IS NULL)'
        providerParams.push(toDate)
      }
      
      providerQuery += ' ORDER BY l.created_at DESC LIMIT ?'
      providerParams.push(limit)
      
      const { results } = await leadDb.prepare(providerQuery).bind(...providerParams).all()
      
      return c.json({
        status: 'success',
        count: results.length,
        filters: {
          provider_id: providerId,
          webhook_id: webhookId || null,
          status: status || null,
          from_date: fromDate || null,
          to_date: toDate || null
        },
        leads: results,
        timestamp: new Date().toISOString()
      })
    }

    // If filtering parameters are provided, use the filtered query
    if (status || fromDate || toDate) {
      const filteredLeads = await db.getLeadsByStatusAndDateRange({
        status,
        webhookId,
        fromDate,
        toDate,
        limit
      })

      return c.json({
        status: 'success',
        count: filteredLeads.length,
        filters: {
          webhook_id: webhookId || null,
          status: status || null,
          from_date: fromDate || null,
          to_date: toDate || null
        },
        leads: filteredLeads,
        timestamp: new Date().toISOString()
      })
    }

    // Otherwise, return recent leads
    const recentLeads = await db.getRecentLeads(webhookId, limit)

    return c.json({
      status: 'success',
      count: recentLeads.length,
      webhook_id: webhookId || 'all',
      leads: recentLeads,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch leads from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get lead statistics/counts
leads.get('/statistics', async (c) => {
  const webhookId = c.req.query('webhook_id')
  const status = c.req.query('status')
  const fromDate = c.req.query('from_date')
  const toDate = c.req.query('to_date')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const statistics = await db.getLeadStatistics({
      status,
      webhookId,
      fromDate,
      toDate
    })

    // Calculate conversion rate if we have data
    const conversionRate = statistics.total_count > 0
      ? ((statistics.converted_count / statistics.total_count) * 100).toFixed(2)
      : "0"

    return c.json({
      status: 'success',
      filters: {
        webhook_id: webhookId || null,
        status: status || null,
        from_date: fromDate || null,
        to_date: toDate || null
      },
      statistics: {
        total_leads: statistics.total_count || 0,
        unique_webhooks: statistics.unique_webhooks || 0,
        days_active: statistics.days_active || 0,
        first_lead_date: statistics.first_lead_date,
        last_lead_date: statistics.last_lead_date,
        conversion_rate: parseFloat(conversionRate),
        status_breakdown: {
          new: statistics.new_count || 0,
          contacted: statistics.contacted_count || 0,
          qualified: statistics.qualified_count || 0,
          converted: statistics.converted_count || 0,
          rejected: statistics.rejected_count || 0
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching statistics:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch statistics from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get leads by specific status
leads.get('/status/:status', async (c) => {
  const status = c.req.param('status')
  const limit = parseInt(c.req.query('limit') || '100')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'rejected']
  if (!validStatuses.includes(status)) {
    return c.json({
      error: 'Invalid status',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const statusLeads = await db.getLeadsByStatus(status, limit)

    return c.json({
      status: 'success',
      lead_status: status,
      count: statusLeads.length,
      leads: statusLeads,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching leads by status:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch leads by status',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get analytics for a specific webhook
leads.get('/analytics/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')
  const days = parseInt(c.req.query('days') || '30')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const analytics = await db.getLeadAnalytics(webhookId, days)

    return c.json({
      status: 'success',
      webhook_id: webhookId,
      period_days: days,
      analytics: analytics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch analytics from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get all contacts with optional filtering and includes (MUST BE BEFORE /:leadId)
leads.get('/contacts', async (c) => {
  const webhookId = c.req.query('webhook_id')
  const providerId = c.req.query('provider_id')
  const limit = parseInt(c.req.query('limit') || '100')
  const includeParam = c.req.query('include') || 'basic'

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  // Parse include flags
  const includeFlags = includeParam.split(',').map(flag => flag.trim().toLowerCase())
  const includeAll = includeFlags.includes('all')
  const includeLeads = includeAll || includeFlags.includes('leads')

  try {
    const db = (c.env as any).LEADS_DB

    // Build WHERE clause for filtering
    let whereClause = ''
    const params = []

    // If provider_id is provided, filter by provider's webhooks
    if (providerId) {
      // Get webhook IDs for this provider
      const { results: webhookMappings } = await db.prepare(`
        SELECT webhook_id FROM webhook_provider_mapping WHERE provider_id = ?
      `).bind(providerId).all()
      
      const providerWebhookIds = webhookMappings.map((w: any) => w.webhook_id)
      
      if (providerWebhookIds.length === 0) {
        return c.json({
          status: 'success',
          contacts: [],
          count: 0,
          filters: { provider_id: providerId },
          timestamp: new Date().toISOString()
        })
      }
      
      // Filter contacts by provider's webhooks
      const placeholders = providerWebhookIds.map(() => '?').join(',')
      whereClause = `WHERE webhook_id IN (${placeholders})`
      params.push(...providerWebhookIds)
    } else if (webhookId) {
      whereClause = 'WHERE webhook_id = ?'
      params.push(webhookId)
    }

    // Fetch all contacts
    const contactsQuery = `
      SELECT
        id,
        webhook_id,
        phone,
        first_name,
        last_name,
        email,
        address,
        address2,
        city,
        state,
        zip_code,
        created_at,
        updated_at,
        lifetime_value,
        conversion_count,
        qualification_score,
        conversion_status,
        converted_timestamp,
        converted_by
      FROM contacts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `

    params.push(limit)
    const contactsResults = await db.prepare(contactsQuery).bind(...params).all()
    let contacts = contactsResults.results || []

    // If leads are requested, fetch them for each contact
    if (includeLeads && contacts.length > 0) {
      const contactIds = contacts.map((c: any) => c.id)
      const placeholders = contactIds.map(() => '?').join(',')

      // Build leads query - filter by provider if provider_id is provided
      let leadsQuery = `
        SELECT
          l.id,
          l.contact_id,
          l.webhook_id,
          l.lead_type,
          l.first_name,
          l.last_name,
          l.email,
          l.phone,
          l.source,
          l.status,
          l.revenue_potential,
          l.conversion_score,
          l.priority,
          l.assigned_to,
          l.workspace_id,
          l.created_at,
          l.updated_at,
          w.name as workspace_name
        FROM leads l
        LEFT JOIN workspaces w ON l.workspace_id = w.id
        WHERE l.contact_id IN (${placeholders})
      `
      const leadsParams: any[] = [...contactIds]

      // If provider_id is provided, also filter leads by provider's webhooks
      if (providerId) {
        const { results: webhookMappings } = await db.prepare(`
          SELECT webhook_id FROM webhook_provider_mapping WHERE provider_id = ?
        `).bind(providerId).all()
        
        const providerWebhookIds = webhookMappings.map((w: any) => w.webhook_id)
        
        if (providerWebhookIds.length > 0) {
          const webhookPlaceholders = providerWebhookIds.map(() => '?').join(',')
          leadsQuery += ` AND l.webhook_id IN (${webhookPlaceholders})`
          leadsParams.push(...providerWebhookIds)
        } else {
          // Provider has no webhooks, return empty leads
          leadsQuery += ` AND 1 = 0`
        }
      }

      leadsQuery += ' ORDER BY l.created_at DESC'

      const leadsResults = await db.prepare(leadsQuery).bind(...leadsParams).all()

      const leads = leadsResults.results || []

      // Group leads by contact_id
      const leadsByContact = new Map()
      leads.forEach((lead: any) => {
        if (!leadsByContact.has(lead.contact_id)) {
          leadsByContact.set(lead.contact_id, [])
        }
        leadsByContact.get(lead.contact_id).push(lead)
      })

      // Add leads to each contact
      contacts.forEach((contact: any) => {
        contact.leads = leadsByContact.get(contact.id) || []
      })

      // For provider filtering: remove contacts that don't have any leads after filtering
      // This ensures providers only see contacts with actual leads from their webhooks
      if (providerId) {
        contacts = contacts.filter((contact: any) => contact.leads && contact.leads.length > 0)
      }
    }

    return c.json({
      status: 'success',
      count: contacts.length,
      filters: {
        webhook_id: webhookId || null,
        provider_id: providerId || null,
        limit: limit,
        includes: includeFlags
      },
      contacts: contacts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching contacts:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch contacts',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get a single lead by ID
leads.get('/:leadId', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const result = await db.getLeadById(leadId)

    if (!result) {
      return c.json({
        error: 'Lead not found',
        message: `No lead found with ID ${leadId}`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    return c.json({
      status: 'success',
      lead: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching lead:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch lead',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Update a lead (PATCH - comprehensive update)
leads.patch('/:leadId', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const updateData = await c.req.json()
    const db = new LeadDatabase((c.env as any).LEADS_DB)

    // First check if lead exists
    const existingLead = await db.getLeadById(leadId)
    if (!existingLead) {
      return c.json({
        error: 'Lead not found',
        message: `No lead found with ID ${leadId}`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Build dynamic update query
    const updateFields: string[] = []
    const updateValues: any[] = []

    // Map frontend field names to database field names and validate
    const fieldMappings = {
      'status': 'status',
      'assigned_to': 'assigned_to',
      'revenue_potential': 'revenue_potential',
      'notes': 'notes',
      'priority': 'priority',
      'source': 'source',
      'assignedTo': 'assigned_to', // Accept both formats
    }

    // Valid statuses
    const validStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'scheduled', 'converted', 'rejected', 'lost']

    // Process each field in the update data
    for (const [frontendField, value] of Object.entries(updateData)) {
      const dbField = fieldMappings[frontendField as keyof typeof fieldMappings]

      if (dbField && value !== undefined && value !== null) {
        // Validate status field
        if (dbField === 'status' && !validStatuses.includes(value as string)) {
          return c.json({
            error: 'Invalid status',
            message: `Status must be one of: ${validStatuses.join(', ')}`,
            timestamp: new Date().toISOString()
          }, 400)
        }

        updateFields.push(`${dbField} = ?`)
        updateValues.push(value)
      }
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

    // Add leadId for WHERE clause
    updateValues.push(leadId)

    // Execute the update
    const query = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`
    await ((c.env as any).LEADS_DB as any).prepare(query).bind(...updateValues).run()

    // If status was updated, handle status change logging
    if (updateData.status && updateData.status !== existingLead.status) {
      await db.updateLeadStatus(leadId, updateData.status, {
        notes: updateData.notes,
        changedBy: updateData.changedBy || 'system',
        changedByName: updateData.changedByName || 'System User'
      })
    }

    // Fetch and return the updated lead
    const updatedLead = await db.getLeadById(leadId)

    return c.json({
      status: 'success',
      message: 'Lead updated successfully',
      lead: updatedLead,
      updated_fields: Object.keys(updateData),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating lead:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to update lead',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Update lead status (PATCH - backwards compatibility)
leads.patch('/:leadId/status', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))
  const { status, notes } = await c.req.json()

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'scheduled', 'converted', 'rejected', 'lost']
  if (!status || !validStatuses.includes(status)) {
    return c.json({
      error: 'Invalid status',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const result = await db.updateLeadStatus(leadId, status, { notes })

    return c.json({
      status: 'success',
      message: 'Lead status updated successfully',
      lead_id: leadId,
      old_status: result.oldStatus,
      new_status: status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating lead status:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to update lead status',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Update lead status (PUT - comprehensive)
leads.put('/:leadId/status', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))
  const {
    status,
    notes,
    reason,
    changedBy,
    changedByName,
    followUpDate,
    assignedTo,
    priority
  } = await c.req.json()

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'scheduled', 'converted', 'rejected', 'lost']
  if (!status || !validStatuses.includes(status)) {
    return c.json({
      error: 'Invalid status',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
      valid_statuses: validStatuses,
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const result = await db.updateLeadStatus(leadId, status, {
      notes,
      reason,
      changedBy,
      changedByName,
      followUpDate,
      assignedTo,
      priority
    })

    return c.json({
      status: 'success',
      message: 'Lead status updated successfully',
      lead_id: leadId,
      old_status: result.oldStatus,
      new_status: status,
      changed_by: changedByName || changedBy,
      reason: reason,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating lead status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update lead status'

    return c.json({
      error: 'Database error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, error instanceof Error && error.message.includes('not found') ? 404 : 500)
  }
})

// Get lead status history
leads.get('/:leadId/history', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const history = await db.getLeadStatusHistory(leadId)

    return c.json({
      status: 'success',
      lead_id: leadId,
      history_count: history.length,
      history: history,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching lead history:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch lead history',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get lead activities
leads.get('/:leadId/activities', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))
  const limit = parseInt(c.req.query('limit') || '50')

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const activities = await db.getLeadActivities(leadId, limit)

    return c.json({
      status: 'success',
      lead_id: leadId,
      activities_count: activities.length,
      activities: activities,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching lead activities:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch lead activities',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Get pipeline stages
leads.get('/pipeline/stages', async (c) => {
  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)
    const stages = await db.getPipelineStages()

    return c.json({
      status: 'success',
      stages_count: stages.length,
      stages: stages,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching pipeline stages:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch pipeline stages',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Add activity to a lead
leads.post('/:leadId/activities', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))
  const {
    activityType,
    title,
    description,
    createdBy,
    createdByName,
    activityDate
  } = await c.req.json()

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  if (!activityType || !title) {
    return c.json({
      error: 'Missing required fields',
      message: 'activityType and title are required',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = new LeadDatabase((c.env as any).LEADS_DB)

    await db.logLeadActivity(
      leadId,
      activityType,
      title,
      { description, activityDate },
      createdBy,
      createdByName
    )

    return c.json({
      status: 'success',
      message: 'Activity added successfully',
      lead_id: leadId,
      activity_type: activityType,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error adding activity:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to add activity',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Search contacts by phone number
leads.get('/search/phone/:phoneNumber', async (c) => {
  const rawPhone = c.req.param('phoneNumber')

  if (!rawPhone) {
    return c.json({
      error: 'Bad request',
      message: 'Phone number is required',
      timestamp: new Date().toISOString()
    }, 400)
  }

  // Normalize the search phone number
  const normalizedPhone = normalizePhoneNumber(rawPhone)

  if (!normalizedPhone) {
    return c.json({
      error: 'Invalid phone number',
      message: 'Please provide a valid phone number format',
      examples: ['5551234567', '555-123-4567', '(555) 123-4567', '+15551234567'],
      timestamp: new Date().toISOString()
    }, 400)
  }

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // Search for contacts with the normalized phone number
    const { results } = await db.prepare(`
      SELECT
        id,
        webhook_id,
        lead_type,
        first_name,
        last_name,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        source,
        status,
        created_at,
        updated_at,
        processed_at,
        revenue_potential,
        conversion_score,
        priority,
        assigned_to,
        follow_up_date,
        contact_attempts
      FROM leads
      WHERE phone = ?
      ORDER BY created_at DESC
    `).bind(normalizedPhone).all()

    return c.json({
      status: 'success',
      search_phone: rawPhone,
      normalized_phone: normalizedPhone,
      count: results.length,
      contacts: results,
      timestamp: new Date().toISOString(),
      deprecation_notice: {
        message: 'This endpoint is deprecated. Use /contacts/search/phone/:phoneNumber instead for better contact-lead relationship data.',
        new_endpoint: '/contacts/search/phone/:phoneNumber',
        migration_guide: 'The new endpoint returns proper contact data with associated leads, appointments, and conversions.'
      }
    })

  } catch (error) {
    console.error('Error searching contacts by phone:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to search contacts',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Search contacts by phone number with enhanced data (NEW ENDPOINT)
leads.get('/contacts/search/phone/:phoneNumber', async (c) => {
  const rawPhone = c.req.param('phoneNumber')
  const includeParam = c.req.query('include') || 'leads'

  if (!rawPhone) {
    return c.json({
      error: 'Bad request',
      message: 'Phone number is required',
      timestamp: new Date().toISOString()
    }, 400)
  }

  // Parse include flags
  const includeFlags = includeParam.split(',').map(flag => flag.trim().toLowerCase())
  const includeAll = includeFlags.includes('all')
  const includeLeads = includeAll || includeFlags.includes('leads')
  const includeAppointments = includeAll || includeFlags.includes('appointments')
  const includeConversions = includeAll || includeFlags.includes('conversions')

  // Normalize the search phone number
  const normalizedPhone = normalizePhoneNumber(rawPhone)

  if (!normalizedPhone) {
    return c.json({
      error: 'Invalid phone number',
      message: 'Please provide a valid phone number format',
      examples: ['5551234567', '555-123-4567', '(555) 123-4567', '+15551234567'],
      timestamp: new Date().toISOString()
    }, 400)
  }

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // First, find the contact by phone number
    const contactResults = await db.prepare(`
      SELECT
        id,
        webhook_id,
        phone,
        first_name,
        last_name,
        email,
        address,
        address2,
        city,
        state,
        zip_code,
        created_at,
        updated_at,
        lifetime_value,
        conversion_count,
        qualification_score,
        conversion_status,
        converted_timestamp,
        converted_by
      FROM contacts
      WHERE phone = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(normalizedPhone).all()

    if (contactResults.results.length === 0) {
      return c.json({
        status: 'success',
        search_phone: rawPhone,
        normalized_phone: normalizedPhone,
        contact: null,
        message: 'No contact found with this phone number',
        timestamp: new Date().toISOString()
      })
    }

    const contact = contactResults.results[0]
    const contactData: any = {
      ...contact,
      leads: [],
      appointments: [],
      conversions: [],
      summary: {
        total_leads: 0,
        total_appointments: 0,
        total_conversions: 0,
        lifetime_value: contact.lifetime_value || 0,
        primary_workspace: null
      }
    }

    // Fetch leads if requested
    if (includeLeads) {
      const leadsResults = await db.prepare(`
        SELECT
          l.id,
          l.contact_id,
          l.webhook_id,
          l.lead_type,
          l.first_name,
          l.last_name,
          l.email,
          l.phone,
          l.source,
          l.status,
          l.revenue_potential,
          l.conversion_score,
          l.priority,
          l.assigned_to,
          l.workspace_id,
          l.created_at,
          l.updated_at,
          w.name as workspace_name
        FROM leads l
        LEFT JOIN workspaces w ON l.workspace_id = w.id
        WHERE l.contact_id = ?
        ORDER BY l.created_at DESC
      `).bind(contact.id).all()

      contactData.leads = leadsResults.results || []
      contactData.summary.total_leads = contactData.leads.length
    }

    // Fetch appointments if requested
    if (includeAppointments) {
      const appointmentsResults = await db.prepare(`
        SELECT
          a.id,
          a.contact_id,
          a.appointment_type,
          a.scheduled_at,
          a.duration_minutes,
          a.status,
          a.customer_name,
          a.customer_phone,
          a.customer_email,
          a.service_type,
          a.customer_zip,
          a.estimated_value,
          a.matched_workspace_id,
          a.routing_method,
          a.forward_status,
          a.created_at,
          w.name as workspace_name
        FROM appointments a
        LEFT JOIN workspaces w ON a.matched_workspace_id = w.id
        WHERE a.contact_id = ?
        ORDER BY a.created_at DESC
      `).bind(contact.id).all()

      contactData.appointments = appointmentsResults.results || []
      contactData.summary.total_appointments = contactData.appointments.length
    }

    // Fetch conversions if requested
    if (includeConversions) {
      const conversionsResults = await db.prepare(`
        SELECT
          c.id,
          c.contact_id,
          c.lead_id,
          c.workspace_id,
          c.conversion_type,
          c.conversion_value,
          c.converted_by,
          c.converted_at,
          c.custom_data,
          w.name as workspace_name
        FROM conversions c
        LEFT JOIN workspaces w ON c.workspace_id = w.id
        WHERE c.contact_id = ?
        ORDER BY c.converted_at DESC
      `).bind(contact.id).all()

      contactData.conversions = conversionsResults.results || []
      contactData.summary.total_conversions = contactData.conversions.length
    }

    // Determine primary workspace
    if (contactData.leads.length > 0 || contactData.appointments.length > 0) {
      // Find most common workspace
      const workspaces = new Map()

      contactData.leads.forEach((lead: any) => {
        if (lead.workspace_id) {
          workspaces.set(lead.workspace_id, (workspaces.get(lead.workspace_id) || 0) + 1)
        }
      })

      contactData.appointments.forEach((appt: any) => {
        if (appt.matched_workspace_id) {
          workspaces.set(appt.matched_workspace_id, (workspaces.get(appt.matched_workspace_id) || 0) + 1)
        }
      })

      if (workspaces.size > 0) {
        contactData.summary.primary_workspace = Array.from(workspaces.entries())
          .sort(([,a], [,b]) => b - a)[0][0]
      }
    }

    return c.json({
      status: 'success',
      search_phone: rawPhone,
      normalized_phone: normalizedPhone,
      includes: includeFlags,
      contact: contactData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error searching contact by phone:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to search contact',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Delete a contact and all associated leads
leads.delete('/contact/:contactId', async (c) => {
  const contactId = parseInt(c.req.param('contactId'))

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  if (isNaN(contactId)) {
    return c.json({
      error: 'Invalid contact ID',
      message: 'Contact ID must be a valid number',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // First, check if the contact exists
    const { results: existingContact } = await db.prepare(`
      SELECT id, first_name, last_name, email, phone, webhook_id
      FROM contacts
      WHERE id = ?
    `).bind(contactId).all()

    if (existingContact.length === 0) {
      return c.json({
        error: 'Contact not found',
        message: `No contact found with ID ${contactId}`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const contact = existingContact[0]

    // Count associated leads
    const { results: leadCount } = await db.prepare(`
      SELECT COUNT(*) as count FROM leads WHERE contact_id = ?
    `).bind(contactId).all()

    const numLeads = leadCount[0]?.count || 0

    // Delete related records first to avoid foreign key constraints (CASCADE DELETE)
    // First delete all lead events for leads with this contact_id
    await db.prepare(`
      DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete lead status history for leads with this contact_id (CRITICAL: This was missing!)
    await db.prepare(`
      DELETE FROM lead_status_history WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete lead activities for leads with this contact_id
    await db.prepare(`
      DELETE FROM lead_activities WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete appointment events for appointments linked to leads with this contact_id
    await db.prepare(`
      DELETE FROM appointment_events WHERE appointment_id IN (
        SELECT id FROM appointments WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
      )
    `).bind(contactId).run()

    // Delete appointment events for appointments directly linked to this contact
    await db.prepare(`
      DELETE FROM appointment_events WHERE appointment_id IN (SELECT id FROM appointments WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete appointments linked to leads with this contact_id
    await db.prepare(`
      DELETE FROM appointments WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete appointments directly linked to this contact
    await db.prepare(`
      DELETE FROM appointments WHERE contact_id = ?
    `).bind(contactId).run()

    // Delete conversion events for conversions linked to leads with this contact_id
    await db.prepare(`
      DELETE FROM conversion_events WHERE conversion_id IN (
        SELECT id FROM conversions WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
      )
    `).bind(contactId).run()

    // Delete conversion events for conversions directly linked to this contact
    await db.prepare(`
      DELETE FROM conversion_events WHERE conversion_id IN (SELECT id FROM conversions WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete conversion records for all leads with this contact_id
    await db.prepare(`
      DELETE FROM conversions WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete workspace tracking records for all leads with this contact_id
    await db.prepare(`
      DELETE FROM workspace_tracking WHERE lead_id IN (SELECT id FROM leads WHERE contact_id = ?)
    `).bind(contactId).run()

    // Delete conversions directly linked to this contact
    await db.prepare(`
      DELETE FROM conversions WHERE contact_id = ?
    `).bind(contactId).run()

    // Delete workspace tracking records directly linked to this contact
    await db.prepare(`
      DELETE FROM workspace_tracking WHERE contact_id = ?
    `).bind(contactId).run()

    // Delete contact events
    await db.prepare(`
      DELETE FROM contact_events WHERE contact_id = ?
    `).bind(contactId).run()

    // Delete all leads associated with this contact
    await db.prepare(`
      DELETE FROM leads WHERE contact_id = ?
    `).bind(contactId).run()

    // Delete the contact
    await db.prepare(`
      DELETE FROM contacts WHERE id = ?
    `).bind(contactId).run()

    return c.json({
      status: 'success',
      message: 'Contact and associated leads deleted successfully',
      deleted_contact: {
        id: contactId,
        name: `${contact.first_name} ${contact.last_name}`,
        email: contact.email,
        phone: contact.phone,
        webhook_id: contact.webhook_id,
        leads_deleted: numLeads
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting contact:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to delete contact from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Delete a single lead
leads.delete('/:leadId', async (c) => {
  const leadId = parseInt(c.req.param('leadId'))

  if (!(c.env as any).LEADS_DB) {
    return c.json({
      error: 'Database not configured',
      message: 'D1 database is not configured for this environment'
    }, 503)
  }

  if (isNaN(leadId)) {
    return c.json({
      error: 'Invalid lead ID',
      message: 'Lead ID must be a valid number',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = (c.env as any).LEADS_DB

    // First, check if the lead exists
    const { results: existingLead } = await db.prepare(`
      SELECT id, first_name, last_name, email, phone, webhook_id, conversion_id
      FROM leads
      WHERE id = ?
    `).bind(leadId).all()

    if (existingLead.length === 0) {
      return c.json({
        error: 'Lead not found',
        message: `No lead found with ID ${leadId}`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const lead = existingLead[0]

    // Disable foreign key constraints temporarily for this transaction
    await db.prepare(`PRAGMA foreign_keys = OFF`).run()

    try {
      // Delete all related records without worrying about foreign key order
      const deletions = [
        `DELETE FROM lead_events WHERE lead_id = ${leadId}`,
        `DELETE FROM lead_status_history WHERE lead_id = ${leadId}`,
        `DELETE FROM lead_activities WHERE lead_id = ${leadId}`,
        `DELETE FROM appointment_events WHERE appointment_id IN (SELECT id FROM appointments WHERE lead_id = ${leadId})`,
        `DELETE FROM appointments WHERE lead_id = ${leadId}`,
        `DELETE FROM conversion_events WHERE conversion_id = '${lead.conversion_id || ''}'`,
        `DELETE FROM conversions WHERE lead_id = ${leadId}`,
        `DELETE FROM workspace_tracking WHERE lead_id = ${leadId}`,
        `DELETE FROM leads WHERE id = ${leadId}`
      ]

      for (const sql of deletions) {
        try {
          await db.prepare(sql).run()
        } catch (e) {
          console.log(`Deletion skipped: ${sql}`, e)
        }
      }

    } finally {
      // Re-enable foreign key constraints
      await db.prepare(`PRAGMA foreign_keys = ON`).run()
    }

    return c.json({
      status: 'success',
      message: 'Lead deleted successfully',
      deleted_lead: {
        id: leadId,
        name: `${lead.first_name} ${lead.last_name}`,
        email: lead.email,
        phone: lead.phone,
        webhook_id: lead.webhook_id
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting lead:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to delete lead from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export default leads