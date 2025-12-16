import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'
import { LeadDatabase, LeadRecord } from '../db/leads'
import { ContactDatabase, ContactRecord } from '../db/contacts'
import { normalizePhoneNumber } from '../utils/phone'
import { generateLeadId, generateContactId } from '../utils/idGenerator'
import { BaseLeadSchema } from '../types/leads'

type Bindings = {
  LEADS_DB: D1Database
}

const formsRouter = new Hono<{ Bindings: Bindings }>()

interface FormSubmissionRequest {
  provider_id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  productid?: string
  source?: string
  notes?: string
  appointment?: {
    appointment_date: string // ISO datetime
    appointment_duration?: number
    appointment_type?: string
    appointment_notes?: string
  }
}

// POST /forms/submit - Submit form data (public endpoint, no auth required)
formsRouter.post('/submit', async (c) => {
  try {
    const db = c.env.LEADS_DB

    if (!db) {
      return c.json({
        success: false,
        error: 'Database not configured',
        message: 'D1 database is not configured for this environment'
      }, 503)
    }

    const body = await c.req.json<FormSubmissionRequest>()

    // Validate required fields
    if (!body.provider_id) {
      return c.json({
        success: false,
        error: 'Missing required field: provider_id'
      }, 400)
    }

    if (!body.firstName || !body.lastName) {
      return c.json({
        success: false,
        error: 'Missing required fields: firstName and lastName are required'
      }, 400)
    }

    // At least phone or email required
    if (!body.phone && !body.email) {
      return c.json({
        success: false,
        error: 'At least one of phone or email is required'
      }, 400)
    }

    // Validate provider exists and is active
    const providerResult = await db.prepare(`
      SELECT provider_id, provider_name, is_active
      FROM lead_source_providers
      WHERE provider_id = ? AND is_active = 1
    `).bind(body.provider_id).first()

    if (!providerResult) {
      return c.json({
        success: false,
        error: 'Invalid provider',
        message: `Provider ${body.provider_id} not found or is inactive`
      }, 404)
    }

    // Get webhook_id for this provider and verify the mapping is valid
    const webhookMapping = await db.prepare(`
      SELECT wpm.webhook_id, wc.webhook_id as verified_webhook_id
      FROM webhook_provider_mapping wpm
      INNER JOIN webhook_configs wc ON wpm.webhook_id = wc.webhook_id
      WHERE wpm.provider_id = ? AND wc.is_active = 1
      LIMIT 1
    `).bind(body.provider_id).first()

    if (!webhookMapping || !webhookMapping.webhook_id) {
      return c.json({
        success: false,
        error: 'Provider not configured',
        message: `No active webhook configured for provider ${body.provider_id}`
      }, 400)
    }

    const webhookId = webhookMapping.webhook_id as string

    // Double-check: Verify webhook is actually mapped to this provider
    const verificationCheck = await db.prepare(`
      SELECT provider_id
      FROM webhook_provider_mapping
      WHERE webhook_id = ? AND provider_id = ?
    `).bind(webhookId, body.provider_id).first()

    if (!verificationCheck) {
      return c.json({
        success: false,
        error: 'Provider mapping verification failed',
        message: `Webhook ${webhookId} is not mapped to provider ${body.provider_id}`
      }, 500)
    }

    // Normalize phone number if provided
    let normalizedPhone: string | null = null
    if (body.phone) {
      const phoneResult = normalizePhoneNumber(body.phone)
      if (!phoneResult) {
        return c.json({
          success: false,
          error: 'Invalid phone number format'
        }, 400)
      }
      normalizedPhone = phoneResult
    }

    // Initialize databases
    const leadDb = new LeadDatabase(db)
    const contactDb = new ContactDatabase(db)

    // Find or create contact
    let contactId: number
    let isNewContact = false

    if (normalizedPhone) {
      // Try to find contact by phone (within this webhook)
      const existingContact = await contactDb.findContactByPhone(webhookId, normalizedPhone)

      if (existingContact) {
        contactId = existingContact.id
        // Update contact with new information
        await contactDb.updateContact(contactId, {
          first_name: body.firstName,
          last_name: body.lastName,
          email: body.email,
          address: body.address,
          city: body.city,
          state: body.state,
          zip_code: body.zipCode
        })
      } else {
        // Create new contact
        const contactRecord: ContactRecord = {
          webhook_id: webhookId,
          phone: normalizedPhone,
          first_name: body.firstName,
          last_name: body.lastName,
          email: body.email,
          address: body.address,
          city: body.city,
          state: body.state,
          zip_code: body.zipCode
        }

        contactId = await contactDb.createContact(contactRecord)
        isNewContact = true
      }
    } else {
      // No phone - create new contact with email only (less ideal but workable)
      // We'll use email as identifier, but contacts table expects phone
      // For email-only contacts, we'll generate a placeholder phone
      const placeholderPhone = `email-${Date.now()}@form.placeholder`
      const contactRecord: ContactRecord = {
        webhook_id: webhookId,
        phone: placeholderPhone, // Placeholder since phone is required
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        address: body.address,
        city: body.city,
        state: body.state,
        zip_code: body.zipCode
      }

      contactId = await contactDb.createContact(contactRecord)
      isNewContact = true
    }

    // Create lead record with provider_id stored in subsource for traceability
    // Provider tracking strategy:
    // 1. webhook_id links to webhook_provider_mapping table for relationship
    // 2. subsource field stores provider_id directly for easy querying: SELECT * FROM leads WHERE subsource = 'provider_id'
    // 3. source field includes provider_id in format: "form-submission:provider_id"
    // 4. raw_payload contains full provider_id for audit trail
    const leadRecord: LeadRecord = {
      contact_id: contactId,
      webhook_id: webhookId,
      lead_type: 'form',
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      phone: normalizedPhone || undefined,
      address: body.address,
      city: body.city,
      state: body.state,
      zip_code: body.zipCode,
      source: body.source || `form-submission:${body.provider_id}`, // Include provider_id in source
      subsource: body.provider_id, // Store provider_id directly in subsource field for easy reference
      productid: body.productid,
      raw_payload: JSON.stringify({
        ...body,
        provider_id: body.provider_id, // Ensure provider_id is in raw_payload
        webhook_id: webhookId, // Also include webhook_id for reference
        form_submission_timestamp: new Date().toISOString()
      }),
      ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      user_agent: c.req.header('User-Agent'),
      status: body.appointment ? 'scheduled' : 'new'
    }

    const leadId = await leadDb.saveLead(leadRecord)

    let appointmentId: number | null = null

    // If appointment is provided, create appointment
    if (body.appointment) {
      if (!body.appointment.appointment_date) {
        return c.json({
          success: false,
          error: 'Appointment date is required when appointment booking is selected'
        }, 400)
      }

      // Determine service type and zip for routing
      const serviceType = body.productid || ''
      const customerZip = body.zipCode || ''

      // Find matching workspace (similar to appointments/receive endpoint)
      let matchedWorkspaceId: string | null = null
      const rules = await db.prepare(`
        SELECT workspace_id, product_types, zip_codes, priority
        FROM appointment_routing_rules
        WHERE is_active = 1
        ORDER BY priority ASC
      `).all()

      for (const rule of rules.results as any[]) {
        const productTypes: string[] = JSON.parse(rule.product_types)
        const zipCodes: string[] = JSON.parse(rule.zip_codes)

        const productMatch = serviceType && productTypes.some((product: string) =>
          product.toLowerCase() === serviceType.toLowerCase()
        )
        const zipMatch = customerZip && zipCodes.includes(customerZip)

        if (productMatch && zipMatch) {
          matchedWorkspaceId = rule.workspace_id
          break
        }
      }

      const routingMethod = matchedWorkspaceId ? 'auto' : 'unrouted'

      // Create appointment
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
        body.appointment.appointment_type || 'consultation',
        body.appointment.appointment_date,
        body.appointment.appointment_duration || 60,
        'scheduled',
        body.appointment.appointment_notes || null,
        body.appointment.appointment_notes || null,
        `${body.firstName} ${body.lastName}`,
        normalizedPhone || '',
        body.email || null,
        serviceType,
        customerZip,
        null,
        matchedWorkspaceId,
        routingMethod,
        JSON.stringify(body.appointment)
      ).run()

      appointmentId = appointmentResult.meta.last_row_id

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
          message: matchedWorkspaceId
            ? `Appointment created and routed to workspace ${matchedWorkspaceId}`
            : `Appointment created but no matching workspace found (service: ${serviceType}, zip: ${customerZip})`,
          routing_method: routingMethod,
          service_type: serviceType,
          customer_zip: customerZip,
          matched_workspace_id: matchedWorkspaceId || null,
          data_source: 'form-submission'
        }),
        'form-submission'
      ).run()

      // Forward appointment to client webhook if workspace was matched
      if (matchedWorkspaceId) {
        const workspace = await db.prepare(`
          SELECT outbound_webhook_url
          FROM workspaces
          WHERE id = ? AND is_active = 1
        `).bind(matchedWorkspaceId).first()

        if (workspace && (workspace as any).outbound_webhook_url) {
          // Forward asynchronously (don't wait for response)
          const forwardPayload = {
            appointment_id: appointmentId,
            lead_id: leadId,
            contact_id: contactId,
            customer_name: `${body.firstName} ${body.lastName}`,
            customer_phone: normalizedPhone,
            customer_email: body.email,
            service_type: serviceType,
            customer_zip: customerZip,
            appointment_date: body.appointment.appointment_date,
            appointment_duration: body.appointment.appointment_duration || 60,
            appointment_type: body.appointment.appointment_type || 'consultation'
          }

          fetch((workspace as any).outbound_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(forwardPayload)
          }).then(async (response) => {
            const responseText = await response.text()
            await db.prepare(`
              UPDATE appointments
              SET
                forwarded_at = CURRENT_TIMESTAMP,
                forward_status = ?,
                forward_response = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(
              response.ok ? 'success' : 'failed',
              responseText.substring(0, 1000),
              appointmentId
            ).run()
          }).catch((error) => {
            console.error('Error forwarding appointment:', error)
            db.prepare(`
              UPDATE appointments
              SET
                forward_status = 'failed',
                forward_response = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(
              error instanceof Error ? error.message : 'Unknown error',
              appointmentId
            ).run()
          })
        }
      }
    }

    // Log lead event with provider tracking
    try {
      await db.prepare(`
        INSERT INTO lead_events (lead_id, event_type, event_data, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        leadId,
        'created',
        JSON.stringify({
          source: 'form-submission',
          provider_id: body.provider_id,
          webhook_id: webhookId,
          has_appointment: !!appointmentId
        })
      ).run()
    } catch (error) {
      console.error('Failed to log lead event:', error)
      // Don't fail the request if logging fails
    }

    return c.json({
      success: true,
      message: 'Form submitted successfully',
      data: {
        lead_id: leadId,
        contact_id: contactId,
        appointment_id: appointmentId,
        is_new_contact: isNewContact,
        provider_id: body.provider_id, // Include provider_id in response for verification
        webhook_id: webhookId
      }
    })

  } catch (error) {
    console.error('Error processing form submission:', error)
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export { formsRouter }

