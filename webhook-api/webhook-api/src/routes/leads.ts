import { Hono } from 'hono'
import { LeadDatabase } from '../db/leads'
import { normalizePhoneNumber } from '../utils/phone'

const leads = new Hono()

// Get all leads with optional filtering
leads.get('/', async (c) => {
  const webhookId = c.req.query('webhook_id')
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
      const { results } = await leadDb.prepare(`
        SELECT * FROM leads
        WHERE contact_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(contactIdNum, limit).all()

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
      timestamp: new Date().toISOString()
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
      SELECT id, first_name, last_name, email, phone, webhook_id
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

    // Delete the lead from the database
    await db.prepare(`
      DELETE FROM leads WHERE id = ?
    `).bind(leadId).run()

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