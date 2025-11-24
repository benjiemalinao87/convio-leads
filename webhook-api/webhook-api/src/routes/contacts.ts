import { Hono } from 'hono'
import { normalizePhoneNumber } from '../utils/phone'

const contacts = new Hono()

// Get all contacts with optional filtering and includes
contacts.get('/', async (c) => {
  const webhookId = c.req.query('webhook_id')
  const limit = parseInt(c.req.query('limit') || '100')
  const includeParam = c.req.query('include') || 'basic'
  const providerId = c.req.query('provider_id')

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

    // Build query with dynamic joins and where clause
    let query = `
      SELECT
        c.id,
        c.webhook_id,
        c.phone,
        c.first_name,
        c.last_name,
        c.email,
        c.address,
        c.address2,
        c.city,
        c.state,
        c.zip_code,
        c.created_at,
        c.updated_at,
        c.lifetime_value,
        c.conversion_count,
        c.qualification_score,
        c.conversion_status,
        c.converted_timestamp,
        c.converted_by
      FROM contacts c
    `

    const params = []
    const conditions = []

    // If provider_id is provided, join with mapping table
    if (providerId) {
      query += ` INNER JOIN webhook_provider_mapping wpm ON c.webhook_id = wpm.webhook_id`
      conditions.push('wpm.provider_id = ?')
      params.push(providerId)
    }

    if (webhookId) {
      conditions.push('c.webhook_id = ?')
      params.push(webhookId)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY c.created_at DESC LIMIT ?'
    params.push(limit)

    const contactsResults = await db.prepare(query).bind(...params).all()
    const contacts = contactsResults.results || []

    // If leads are requested, fetch them for each contact
    if (includeLeads && contacts.length > 0) {
      const contactIds = contacts.map((c: any) => c.id)
      const placeholders = contactIds.map(() => '?').join(',')

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
        WHERE l.contact_id IN (${placeholders})
        ORDER BY l.created_at DESC
      `).bind(...contactIds).all()

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
    }

    return c.json({
      status: 'success',
      count: contacts.length,
      filters: {
        webhook_id: webhookId || null,
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

// Search contacts by phone number with enhanced data
contacts.get('/search/phone/:phoneNumber', async (c) => {
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
          .sort(([, a], [, b]) => b - a)[0][0]
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

// Get leads for a specific contact
contacts.get('/:contactId/leads', async (c) => {
  const contactId = parseInt(c.req.param('contactId'))
  const limit = parseInt(c.req.query('limit') || '100')

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

    const { results } = await db.prepare(`
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
      LIMIT ?
    `).bind(contactId, limit).all()

    return c.json({
      status: 'success',
      contact_id: contactId,
      count: results.length,
      leads: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching leads for contact:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch leads for contact',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Delete a contact and all associated leads
contacts.delete('/:contactId', async (c) => {
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

export { contacts as contactsRouter }