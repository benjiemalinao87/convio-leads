import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { D1Database } from '@cloudflare/workers-types'
import { normalizePhoneNumber } from '../utils/phone'
import { generateLeadId, generateContactId } from '../utils/idGenerator'

type Bindings = {
  LEADS_DB: D1Database
}

const appointmentsRouter = new Hono<{ Bindings: Bindings }>()

// Type definitions
interface AppointmentRequest {
  // If workspace_id provided, auto-route to that workspace
  workspace_id?: string

  // Optional: Link to existing lead instead of creating new one
  lead_id?: number

  // Customer information
  customer_name: string
  customer_phone: string
  customer_email?: string
  service_type: string      // Product: Kitchen, Bath, Solar, etc.
  customer_zip: string

  // Appointment details
  appointment_date: string  // ISO format
  appointment_time?: string
  appointment_duration?: number // minutes
  appointment_type?: string
  appointment_notes?: string
  estimated_value?: number
}

interface RoutingRule {
  id: number
  workspace_id: string
  product_types: string[]
  zip_codes: string[]
  priority: number
  is_active: boolean
}

// Helper function to find matching workspace
async function findMatchingWorkspace(
  db: D1Database,
  serviceType: string,
  customerZip: string,
  providedWorkspaceId?: string
): Promise<string | null> {
  // Priority 1: If workspace_id provided, use it (if valid)
  if (providedWorkspaceId) {
    const workspace = await db.prepare(`
      SELECT id FROM workspaces WHERE id = ? AND is_active = 1
    `).bind(providedWorkspaceId).first()

    if (workspace) {
      return providedWorkspaceId
    }
  }

  // Priority 2: Find matching routing rules
  const rules = await db.prepare(`
    SELECT workspace_id, product_types, zip_codes, priority
    FROM appointment_routing_rules
    WHERE is_active = 1
    ORDER BY priority ASC
  `).all()

  for (const rule of rules.results) {
    const productTypes: string[] = JSON.parse(rule.product_types as string)
    const zipCodes: string[] = JSON.parse(rule.zip_codes as string)

    // Check if service type matches any product in the rule
    const productMatch = productTypes.some(product =>
      product.toLowerCase() === serviceType.toLowerCase()
    )

    // Check if zip code matches exactly
    const zipMatch = zipCodes.includes(customerZip)

    if (productMatch && zipMatch) {
      return rule.workspace_id as string
    }
  }

  return null
}

// Helper function to forward appointment to client webhook
async function forwardAppointmentToClient(
  db: D1Database,
  appointmentId: number,
  workspaceId: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    // Get workspace webhook URL
    const workspace = await db.prepare(`
      SELECT outbound_webhook_url, webhook_active, name
      FROM workspaces
      WHERE id = ? AND is_active = 1
    `).bind(workspaceId).first()

    if (!workspace || !workspace.outbound_webhook_url || !workspace.webhook_active) {
      return { success: false, error: 'No active webhook URL configured for workspace' }
    }

    // Get appointment data with contact and lead info
    const appointmentData = await db.prepare(`
      SELECT
        a.*,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email,
        c.phone as contact_phone,
        l.id as lead_id,
        l.source as lead_source
      FROM appointments a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      WHERE a.id = ?
    `).bind(appointmentId).first()

    if (!appointmentData) {
      return { success: false, error: 'Appointment not found' }
    }

    // Prepare payload for client
    const payload = {
      appointment_id: appointmentData.id,
      appointment_date: appointmentData.appointment_date,
      appointment_time: appointmentData.appointment_time,
      appointment_type: appointmentData.appointment_type,
      appointment_status: appointmentData.appointment_status,
      appointment_notes: appointmentData.appointment_notes,
      estimated_value: appointmentData.estimated_value,

      customer: {
        name: appointmentData.customer_name,
        phone: appointmentData.customer_phone,
        email: appointmentData.customer_email,
        zip: appointmentData.customer_zip
      },

      service: {
        type: appointmentData.service_type
      },

      contact: {
        id: appointmentData.contact_id,
        first_name: appointmentData.contact_first_name,
        last_name: appointmentData.contact_last_name,
        email: appointmentData.contact_email,
        phone: appointmentData.contact_phone
      },

      lead: {
        id: appointmentData.lead_id,
        source: appointmentData.lead_source
      },

      workspace: {
        id: workspaceId,
        name: workspace.name
      },

      forwarded_at: new Date().toISOString()
    }

    // Make HTTP request to client webhook
    const response = await fetch(workspace.outbound_webhook_url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'appointment-routing-system',
        'X-Appointment-ID': appointmentId.toString()
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()

    // Update appointment forward status
    await db.prepare(`
      UPDATE appointments
      SET
        forwarded_at = CURRENT_TIMESTAMP,
        forward_status = ?,
        forward_response = ?,
        forward_attempts = forward_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      response.ok ? 'success' : 'failed',
      responseText.substring(0, 1000), // Truncate response
      appointmentId
    ).run()

    // Log event
    await db.prepare(`
      INSERT INTO appointment_events (
        appointment_id, event_type, event_data,
        new_value, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      appointmentId,
      'forwarded',
      `Forwarded to client webhook: ${response.status}`,
      response.ok ? 'success' : 'failed',
      JSON.stringify({
        webhook_url: workspace.outbound_webhook_url,
        response_status: response.status,
        response_headers: Object.fromEntries(response.headers.entries())
      })
    ).run()

    return {
      success: response.ok,
      response: responseText,
      error: response.ok ? undefined : `HTTP ${response.status}: ${responseText}`
    }

  } catch (error) {
    console.error('Error forwarding appointment:', error)

    // Update failure status
    await db.prepare(`
      UPDATE appointments
      SET
        forward_status = 'failed',
        forward_response = ?,
        forward_attempts = forward_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      error instanceof Error ? error.message : 'Unknown error',
      appointmentId
    ).run()

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// POST /appointments/receive - Receive appointment from 3rd party
appointmentsRouter.post('/receive', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const body = await c.req.json<AppointmentRequest>()

    // Validate required fields
    if (!body.customer_name || !body.customer_phone || !body.service_type ||
        !body.customer_zip || !body.appointment_date) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        required: ['customer_name', 'customer_phone', 'service_type', 'customer_zip', 'appointment_date'],
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(body.customer_phone)
    if (!normalizedPhone) {
      return c.json({
        success: false,
        error: 'Invalid phone number format',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Find matching workspace
    const matchedWorkspaceId = await findMatchingWorkspace(
      db,
      body.service_type,
      body.customer_zip,
      body.workspace_id
    )

    if (!matchedWorkspaceId) {
      return c.json({
        success: false,
        error: 'No matching workspace found',
        criteria: {
          service_type: body.service_type,
          customer_zip: body.customer_zip,
          provided_workspace_id: body.workspace_id
        },
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Determine contact: if lead_id provided, find contact that owns the lead; otherwise find by phone
    let contactId: number
    if (body.lead_id) {
      // Find contact that owns the specified lead
      const leadOwner = await db.prepare(`
        SELECT contact_id FROM leads WHERE id = ?
      `).bind(body.lead_id).first()

      if (!leadOwner) {
        return c.json({
          success: false,
          error: 'Invalid lead_id: Lead not found',
          provided_lead_id: body.lead_id,
          timestamp: new Date().toISOString()
        }, 400)
      }

      contactId = leadOwner.contact_id as number
    } else {
      // Find existing contact by phone number (across all webhooks) or create new one
      const existingContact = await db.prepare(`
        SELECT id, webhook_id, first_name, last_name
        FROM contacts
        WHERE phone = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(normalizedPhone).first()

      if (existingContact) {
        contactId = existingContact.id as number
      } else {
        // Create new contact
        const newContactId = await generateContactId()
        const [firstName, ...lastNameParts] = body.customer_name.split(' ')
        const lastName = lastNameParts.join(' ') || ''

        await db.prepare(`
          INSERT INTO contacts (
            id, webhook_id, phone, first_name, last_name, email,
            zip_code, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          newContactId,
          matchedWorkspaceId,
          normalizedPhone,
          firstName,
          lastName,
          body.customer_email || null,
          body.customer_zip
        ).run()

        contactId = newContactId
      }
    }

    // Use existing lead if provided, otherwise create new lead for this appointment
    let leadId: number
    if (body.lead_id) {
      leadId = body.lead_id
      // Update existing lead status to 'scheduled'
      await db.prepare(`
        UPDATE leads
        SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(leadId).run()
    } else {
      // Create new lead for this appointment
      leadId = await generateLeadId()
      const [firstName, ...lastNameParts] = body.customer_name.split(' ')
      const lastName = lastNameParts.join(' ') || ''

      await db.prepare(`
        INSERT INTO leads (
          id, contact_id, webhook_id, lead_type,
          first_name, last_name, email, phone,
          zip_code, source, productid,
          created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      `).bind(
        leadId,
        contactId,
        matchedWorkspaceId,
        'appointment',
        firstName,
        lastName,
        body.customer_email || null,
        normalizedPhone,
        body.customer_zip,
        'appointment-service',
        body.service_type,
        'scheduled'
      ).run()
    }

    // Create appointment using existing table structure
    const appointmentResult = await db.prepare(`
      INSERT INTO appointments (
        lead_id, contact_id, appointment_type, scheduled_at,
        duration_minutes, status, notes, customer_notes,
        customer_name, customer_phone, customer_email,
        service_type, customer_zip, estimated_value,
        matched_workspace_id, routing_method, raw_payload,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      leadId,
      contactId,
      body.appointment_type || 'consultation',
      body.appointment_date,
      body.appointment_duration || 60,
      'scheduled',
      body.appointment_notes || null,
      body.appointment_notes || null,
      body.customer_name,
      body.customer_phone,
      body.customer_email || null,
      body.service_type,
      body.customer_zip,
      body.estimated_value || null,
      matchedWorkspaceId,
      body.workspace_id ? 'priority' : 'auto',
      JSON.stringify(body)
    ).run()

    const appointmentId = appointmentResult.meta.last_row_id

    // Log appointment creation event
    await db.prepare(`
      INSERT INTO appointment_events (
        appointment_id, event_type, event_data,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      appointmentId,
      'created',
      JSON.stringify({
        message: `Appointment created and routed to workspace ${matchedWorkspaceId}`,
        routing_method: body.workspace_id ? 'priority' : 'auto',
        service_type: body.service_type,
        customer_zip: body.customer_zip
      }),
      'appointment-routing-system'
    ).run()

    // Forward to client webhook with proper status tracking
    try {
      const forwardResult = await forwardAppointmentToClient(db, appointmentId as number, matchedWorkspaceId)

      // Update appointment with forward status
      await db.prepare(`
        UPDATE appointments
        SET forward_status = ?, forward_attempts = forward_attempts + 1,
            forwarded_at = CURRENT_TIMESTAMP, forward_response = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        forwardResult.success ? 'success' : 'failed',
        forwardResult.response || forwardResult.error || 'No response',
        appointmentId
      ).run()

      // Log forwarding event
      await db.prepare(`
        INSERT INTO appointment_events (
          appointment_id, event_type, event_data, created_by, created_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        appointmentId,
        forwardResult.success ? 'appointment_forwarded_success' : 'appointment_forwarded_failed',
        JSON.stringify({
          workspace_id: matchedWorkspaceId,
          success: forwardResult.success,
          response: forwardResult.response || forwardResult.error
        }),
        'appointment-routing-system'
      ).run()

    } catch (error) {
      console.error('Error forwarding appointment:', error)

      // Log forwarding failure
      await db.prepare(`
        UPDATE appointments
        SET forward_status = 'failed', forward_attempts = forward_attempts + 1,
            forward_response = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        appointmentId
      ).run()

      // Log error event
      await db.prepare(`
        INSERT INTO appointment_events (
          appointment_id, event_type, event_data, created_by, created_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        appointmentId,
        'appointment_forwarding_error',
        JSON.stringify({
          workspace_id: matchedWorkspaceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        'appointment-routing-system'
      ).run()
    }

    return c.json({
      success: true,
      message: 'Appointment received and routed successfully',
      appointment_id: appointmentId,
      contact_id: contactId,
      lead_id: leadId,
      matched_workspace_id: matchedWorkspaceId,
      routing_method: body.workspace_id ? 'priority' : 'auto',
      appointment_date: body.appointment_date,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing appointment:', error)
    return c.json({
      success: false,
      error: 'Failed to process appointment',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// GET /appointments - List appointments with filtering
appointmentsRouter.get('/', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const workspaceId = c.req.query('workspace_id')
    const status = c.req.query('status')
    const fromDate = c.req.query('from_date')
    const toDate = c.req.query('to_date')
    const serviceType = c.req.query('service_type')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    let query = `
      SELECT
        a.*,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.email as contact_email,
        l.source as lead_source,
        w.name as workspace_name
      FROM appointments a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      LEFT JOIN workspaces w ON a.matched_workspace_id = w.id
      WHERE 1=1
    `

    const params: any[] = []

    if (workspaceId) {
      query += ' AND a.matched_workspace_id = ?'
      params.push(workspaceId)
    }

    if (status) {
      query += ' AND a.appointment_status = ?'
      params.push(status)
    }

    if (serviceType) {
      query += ' AND a.service_type = ?'
      params.push(serviceType)
    }

    if (fromDate) {
      query += ' AND a.appointment_date >= ?'
      params.push(fromDate)
    }

    if (toDate) {
      query += ' AND a.appointment_date <= ?'
      params.push(toDate)
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const results = await db.prepare(query).bind(...params).all()

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM appointments a WHERE 1=1`
    const countParams: any[] = []
    let paramIndex = 0

    if (workspaceId) {
      countQuery += ' AND a.matched_workspace_id = ?'
      countParams.push(workspaceId)
    }
    if (status) {
      countQuery += ' AND a.appointment_status = ?'
      countParams.push(status)
    }
    if (serviceType) {
      countQuery += ' AND a.service_type = ?'
      countParams.push(serviceType)
    }
    if (fromDate) {
      countQuery += ' AND a.appointment_date >= ?'
      countParams.push(fromDate)
    }
    if (toDate) {
      countQuery += ' AND a.appointment_date <= ?'
      countParams.push(toDate)
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first()

    return c.json({
      success: true,
      appointments: results.results,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        has_more: (countResult?.total as number || 0) > offset + limit
      },
      filters: {
        workspace_id: workspaceId,
        status,
        service_type: serviceType,
        from_date: fromDate,
        to_date: toDate
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching appointments:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch appointments',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// POST /appointments/:id/forward - Manually forward appointment
appointmentsRouter.post('/:id/forward', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const appointmentId = parseInt(c.req.param('id'))
    const { workspace_id } = await c.req.json()

    if (!appointmentId || !workspace_id) {
      return c.json({
        success: false,
        error: 'Missing appointment ID or workspace ID',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Verify appointment exists
    const appointment = await db.prepare(`
      SELECT * FROM appointments WHERE id = ?
    `).bind(appointmentId).first()

    if (!appointment) {
      return c.json({
        success: false,
        error: 'Appointment not found',
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Forward to specified workspace
    const result = await forwardAppointmentToClient(db, appointmentId, workspace_id)

    return c.json({
      success: result.success,
      message: result.success ? 'Appointment forwarded successfully' : 'Failed to forward appointment',
      appointment_id: appointmentId,
      workspace_id,
      forward_result: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error forwarding appointment:', error)
    return c.json({
      success: false,
      error: 'Failed to forward appointment',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// GET /appointments/history - Get appointment routing and forwarding history
appointmentsRouter.get('/history', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const { limit = '50', offset = '0' } = c.req.query()

    const appointments = await db.prepare(`
      SELECT
        a.id,
        a.customer_name,
        a.service_type,
        a.customer_zip,
        a.matched_workspace_id,
        a.routing_method,
        a.forwarded_at,
        a.forward_status,
        a.forward_response,
        a.forward_attempts,
        a.created_at,
        w.name as workspace_name,
        w.outbound_webhook_url
      FROM appointments a
      LEFT JOIN workspaces w ON a.matched_workspace_id = w.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(parseInt(limit), parseInt(offset)).all()

    // Parse forward_response JSON for better display
    const processedAppointments = appointments.results?.map((apt: any) => ({
      ...apt,
      forward_response_parsed: apt.forward_response ?
        (() => {
          try {
            return JSON.parse(apt.forward_response)
          } catch {
            return { message: apt.forward_response }
          }
        })() : null,
      routing_status: apt.matched_workspace_id ? 'routed' : 'unrouted',
      webhook_url_masked: apt.outbound_webhook_url ?
        apt.outbound_webhook_url.replace(/^(https?:\/\/[^\/]+).*/, '$1/...') : null
    })) || []

    return c.json({
      success: true,
      appointments: processedAppointments,
      total: processedAppointments.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

  } catch (error) {
    console.error('Error fetching appointment history:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch appointment history',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export { appointmentsRouter }