import { Hono } from 'hono'
import { z } from 'zod'
import {
  LeadProviderConfig,
  LeadProviderId,
  SolarLeadSchema,
  HVACLeadSchema,
  InsuranceLeadSchema,
  BaseLeadSchema,
  WebhookPayloadType
} from '../types/leads'
import { LeadDatabase, LeadRecord } from '../db/leads'
import { ContactDatabase, ContactRecord } from '../db/contacts'
import { normalizePhoneNumber } from '../utils/phone'
import { scheduleWebhookDeletion } from '../queue/webhook-deletion'
import { checkAndForwardLead } from '../utils/lead-forwarder'

const webhook = new Hono()

// Webhook pattern matcher - matches both old and new formats:
// New: [name-prefix]_ws_[region]_[category]_[id]
// Old: ws_[region]_[category]_[id]
const WEBHOOK_PATTERN = /^(([a-z0-9-]+)_)?ws_([a-z]{2,3})_([a-z]+)_(\d{3})$/

// Helper function to get lead schema based on webhook ID
function getLeadSchema(webhookId: string) {
  const config = LeadProviderConfig[webhookId as LeadProviderId]
  if (!config) return BaseLeadSchema

  switch (config.type) {
    case 'solar':
      return SolarLeadSchema
    case 'hvac':
      return HVACLeadSchema
    case 'insurance':
      return InsuranceLeadSchema
    default:
      return BaseLeadSchema
  }
}

// Helper function to validate webhook signature
async function validateWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false

  try {
    const expectedSignature = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(secret + payload)
    )
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return `sha256=${expectedHex}` === signature
  } catch (error) {
    console.error('Signature validation error:', error)
    return false
  }
}

// Helper function to normalize lead data
function normalizeLead(leadData: any, webhookId: string) {
  const config = LeadProviderConfig[webhookId as LeadProviderId]

  // Add metadata
  return {
    ...leadData,
    source: leadData.source || config?.name || webhookId,
    webhook_id: webhookId,
    region: config?.region,
    category: config?.category,
    processed_at: new Date().toISOString(),
  }
}

// List all soft-deleted webhooks (must come before /:webhookId route)
webhook.get('/deleted', async (c) => {
  try {
    const db = ((c.env as any) as any).LEADS_DB

    // Fetch soft-deleted webhooks with their restoration status
    const { results } = await db.prepare(`
      SELECT
        w.id,
        w.webhook_id,
        w.name,
        w.description,
        w.lead_type,
        w.deleted_at,
        w.deleted_by,
        w.deletion_reason,
        w.scheduled_deletion_at,
        w.deletion_job_id,
        sd.status as job_status,
        sd.attempts,
        sd.error_message,
        sd.execute_at,
        COUNT(l.id) as total_leads,
        CASE
          WHEN sd.execute_at > CURRENT_TIMESTAMP AND sd.status = 'pending' THEN 1
          ELSE 0
        END as can_restore,
        CAST(
          (julianday(sd.execute_at) - julianday(CURRENT_TIMESTAMP)) * 24 * 60 * 60
          AS INTEGER
        ) as seconds_until_deletion
      FROM webhook_configs w
      LEFT JOIN webhook_scheduled_deletions sd ON w.id = sd.webhook_id AND w.deletion_job_id = sd.job_id
      LEFT JOIN leads l ON w.webhook_id = l.webhook_id
      WHERE w.deleted_at IS NOT NULL
      GROUP BY w.id, w.webhook_id, w.name, w.description, w.lead_type, w.deleted_at, w.deleted_by, w.deletion_reason, w.scheduled_deletion_at, w.deletion_job_id, sd.status, sd.attempts, sd.error_message, sd.execute_at
      ORDER BY w.deleted_at DESC
    `).all()

    const deletedWebhooks = results.map((webhook: any) => ({
      id: webhook.webhook_id,
      name: webhook.name,
      description: webhook.description,
      type: webhook.lead_type,
      deletion: {
        deleted_at: webhook.deleted_at,
        deleted_by: webhook.deleted_by,
        reason: webhook.deletion_reason,
        scheduled_deletion_at: webhook.scheduled_deletion_at,
        job_id: webhook.deletion_job_id
      },
      job_status: {
        status: webhook.job_status || 'unknown',
        attempts: webhook.attempts || 0,
        execute_at: webhook.execute_at,
        completed_at: null,
        error_message: webhook.error_message
      },
      restoration: {
        can_restore: webhook.can_restore === 1,
        seconds_until_deletion: Math.max(0, webhook.seconds_until_deletion || 0),
        restore_endpoint: webhook.can_restore === 1 ? `/webhook/${webhook.webhook_id}/restore` : null
      },
      stats: {
        total_leads: webhook.total_leads || 0
      }
    }))

    return c.json({
      service: 'Webhook API - Deleted Webhooks',
      total_deleted: deletedWebhooks.length,
      restorable: deletedWebhooks.filter((w: any) => w.restoration.can_restore).length,
      webhooks: deletedWebhooks,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch deleted webhooks',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Health check for specific webhook endpoint
webhook.get('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')

  // Validate webhook ID format
  if (!WEBHOOK_PATTERN.test(webhookId)) {
    return c.json({
      error: 'Invalid webhook ID format',
      message: 'Webhook ID must follow pattern: [name-prefix]_ws_[region]_[category]_[id] or ws_[region]_[category]_[id] (e.g., click-ventures_ws_cal_solar_001 or ws_cal_solar_001)',
      expected_format: '[name-prefix]_ws_[2-3 letter region]_[category]_[3 digit id]',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook exists in database
    const { results } = await db.prepare(
      'SELECT webhook_id, name, description, lead_type, is_active, total_leads, created_at, forwarding_enabled, forward_mode, auto_forward_count, last_forwarded_at FROM webhook_configs WHERE webhook_id = ? AND is_active = 1'
    ).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not configured',
        message: `Webhook ${webhookId} is not configured or is inactive`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const config = results[0]

    return c.json({
      status: 'healthy',
      webhook_id: webhookId,
      config: {
        name: config.name,
        description: config.description,
        type: config.lead_type,
        region: webhookId.split('_')[1] || 'unknown',
        category: webhookId.split('_')[2] || 'unknown',
        total_leads: config.total_leads,
        created_at: config.created_at,
        forwarding_enabled: config.forwarding_enabled || 0,
        forward_mode: config.forward_mode || 'first-match',
        auto_forward_count: config.auto_forward_count || 0,
        last_forwarded_at: config.last_forwarded_at
      },
      endpoints: {
        health: `GET /webhook/${webhookId}`,
        receive: `POST /webhook/${webhookId}`
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch webhook configuration',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Receive lead data
webhook.post('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')
  const signature = c.req.header('X-Webhook-Signature')
  const contentType = c.req.header('Content-Type')
  const authorization = c.req.header('Authorization')

  try {
    // Validate webhook ID format
    if (!WEBHOOK_PATTERN.test(webhookId)) {
      return c.json({
        error: 'Invalid webhook ID format',
        message: 'Webhook ID must follow pattern: ws_[region]_[category]_[id]',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Check if webhook is configured in database
    const db = ((c.env as any) as any).LEADS_DB
    const { results } = await db.prepare(
      'SELECT webhook_id, name, lead_type, is_active FROM webhook_configs WHERE webhook_id = ? AND is_active = 1'
    ).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not configured',
        message: `Webhook ${webhookId} is not configured or is inactive`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const config = results[0]

    // Validate lead source provider authentication
    if (!authorization) {
      return c.json({
        error: 'Missing provider authentication',
        message: 'Authorization header is required',
        timestamp: new Date().toISOString()
      }, 401)
    }

    // Check if provider exists and is active
    const { results: providerResults } = await db.prepare(
      'SELECT provider_id, provider_name, is_active, allowed_webhooks FROM lead_source_providers WHERE provider_id = ? AND is_active = 1'
    ).bind(authorization).all()

    if (providerResults.length === 0) {
      return c.json({
        error: 'Invalid provider',
        message: `Provider ${authorization} is not authorized or is inactive`,
        timestamp: new Date().toISOString()
      }, 401)
    }

    const provider = providerResults[0]

    // Check if provider has access to this specific webhook (if restrictions are set)
    if (provider.allowed_webhooks) {
      try {
        const allowedWebhooks = JSON.parse(provider.allowed_webhooks)
        if (Array.isArray(allowedWebhooks) && !allowedWebhooks.includes(webhookId)) {
          return c.json({
            error: 'Provider access denied',
            message: `Provider ${authorization} is not authorized to access webhook ${webhookId}`,
            timestamp: new Date().toISOString()
          }, 403)
        }
      } catch (parseError) {
        console.error('Error parsing allowed_webhooks for provider:', provider.provider_id, parseError)
        // Continue processing if JSON parsing fails - treat as no restrictions
      }
    }

    // Update provider's last used timestamp (fire and forget)
    db.prepare(
      'UPDATE lead_source_providers SET last_used_at = CURRENT_TIMESTAMP WHERE provider_id = ?'
    ).bind(authorization).run().catch((err: any) => {
      console.error('Failed to update provider last_used_at:', err)
    })

    console.log(`Provider authentication successful: ${provider.provider_name} (${authorization}) accessing ${webhookId}`)

    // Validate content type
    if (!contentType?.includes('application/json')) {
      return c.json({
        error: 'Invalid content type',
        message: 'Content-Type must be application/json',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Parse request body
    let requestBody: any
    try {
      requestBody = await c.req.json()
    } catch (error) {
      return c.json({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Validate webhook signature if secret is provided
    const webhookSecret = ((c.env as any) as any)?.WEBHOOK_SECRET
    if (webhookSecret && signature) {
      const rawBody = JSON.stringify(requestBody)
      const isValidSignature = await validateWebhookSignature(rawBody, signature, webhookSecret)

      if (!isValidSignature) {
        return c.json({
          error: 'Invalid signature',
          message: 'Webhook signature validation failed',
          timestamp: new Date().toISOString()
        }, 401)
      }
    }

    // Get appropriate schema for validation
    const leadSchema = getLeadSchema(webhookId)

    // Validate lead data against schema
    const validationResult = leadSchema.safeParse(requestBody)
    if (!validationResult.success) {
      return c.json({
        error: 'Validation failed',
        message: 'Lead data validation failed',
        details: validationResult.error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        })),
        timestamp: new Date().toISOString()
      }, 422)
    }

    // Normalize and enrich lead data
    const normalizedLead = normalizeLead(validationResult.data, webhookId)

    // Log successful webhook receipt
    console.log(`Webhook ${webhookId} received lead:`, {
      webhook_id: webhookId,
      lead_id: normalizedLead.email || normalizedLead.phone || 'unknown',
      timestamp: new Date().toISOString()
    })

    // Process contact and lead in database if D1 is available
    let contactId: number | null = null
    let leadId: number | null = null
    let isNewContact = false

    if (((c.env as any) as any).LEADS_DB) {
      const leadDb = new LeadDatabase(((c.env as any) as any).LEADS_DB)
      const contactDb = new ContactDatabase(((c.env as any) as any).LEADS_DB)

      // Normalize phone number - this is our unique identifier per webhook
      const normalizedPhone = normalizePhoneNumber(normalizedLead.phone)

      if (!normalizedPhone) {
        return c.json({
          error: 'Invalid phone number',
          message: 'A valid phone number is required for lead processing',
          timestamp: new Date().toISOString()
        }, 400)
      }

      try {
        // Step 1: Find or create contact based on webhook_id + phone
        const contactRecord: ContactRecord = {
          webhook_id: webhookId,
          phone: normalizedPhone,
          first_name: normalizedLead.firstName || normalizedLead.first_name || '',
          last_name: normalizedLead.lastName || normalizedLead.last_name || '',
          email: normalizedLead.email,
          address: normalizedLead.address,
          city: normalizedLead.city,
          state: normalizedLead.state,
          zip_code: normalizedLead.zipCode || normalizedLead.zip_code
        }

        const { contact, isNew } = await contactDb.findOrCreateContact(webhookId, normalizedPhone, contactRecord)
        contactId = contact.id
        isNewContact = isNew

        console.log(`${isNew ? 'Created new' : 'Found existing'} contact ID: ${contactId} for phone: ${normalizedPhone}`)

        // Step 2: Create lead linked to contact
        const leadRecord: LeadRecord = {
          contact_id: contactId, // Link to contact
          webhook_id: webhookId,
          lead_type: config.lead_type,
          // Support both naming conventions for names
          first_name: normalizedLead.firstName || normalizedLead.firstname || '',
          last_name: normalizedLead.lastName || normalizedLead.lastname || '',
          email: normalizedLead.email, // Lead-specific email (may differ from contact)
          phone: normalizedPhone,
          // Support both address naming conventions
          address: normalizedLead.address || normalizedLead.address1,
          address2: normalizedLead.address2,
          city: normalizedLead.city,
          state: normalizedLead.state,
          zip_code: normalizedLead.zipCode || normalizedLead.zip,
          source: normalizedLead.source,

          // Business-specific fields (new)
          productid: normalizedLead.productid,
          subsource: normalizedLead.subsource,
          landing_page_url: normalizedLead.landing_page_url,
          consent_description: normalizedLead.consent?.description,
          consent_value: normalizedLead.consent?.value,
          tcpa_compliance: normalizedLead.tcpa_compliance,
          campaign_id: normalizedLead.campaignId || normalizedLead.campaign_id,
          utm_source: normalizedLead.utmSource || normalizedLead.utm_source,
          utm_medium: normalizedLead.utmMedium || normalizedLead.utm_medium,
          utm_campaign: normalizedLead.utmCampaign || normalizedLead.utm_campaign,
          monthly_electric_bill: normalizedLead.monthlyElectricBill,
          property_type: normalizedLead.propertyType,
          roof_condition: normalizedLead.roofCondition,
          roof_age: normalizedLead.roofAge,
          shade_coverage: normalizedLead.shadeCoverage,
          system_type: normalizedLead.systemType,
          system_age: normalizedLead.systemAge,
          service_type: normalizedLead.serviceType,
          urgency: normalizedLead.urgency,
          property_size: normalizedLead.propertySize,
          policy_type: normalizedLead.policyType,
          coverage_amount: normalizedLead.coverageAmount,
          current_premium: normalizedLead.currentPremium,
          property_value: normalizedLead.propertyValue,
          claims_history: normalizedLead.claimsHistory,
          raw_payload: JSON.stringify(requestBody),
          ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
          user_agent: c.req.header('User-Agent'),
          status: 'new'
        }

        leadId = await leadDb.saveLead(leadRecord)
        console.log(`Lead saved to database with ID: ${leadId} for contact ID: ${contactId}`)

        // Validate that lead was actually created
        if (!leadId) {
          throw new Error('Lead creation failed - leadId is null')
        }

        // Step 3: Update webhook statistics
        try {
          await ((c.env as any) as any).LEADS_DB.prepare(`
            UPDATE webhook_configs
            SET
              total_leads = total_leads + 1,
              last_lead_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE webhook_id = ? AND is_active = 1
          `).bind(webhookId).run()

          console.log(`Updated webhook ${webhookId} statistics: total_leads incremented`)
        } catch (updateError) {
          console.error('Failed to update webhook statistics:', updateError)
          // Don't fail the webhook processing if stats update fails
        }

        // Step 4: Log provider usage for analytics
        try {
          const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

          // Use INSERT OR REPLACE to either create new record or increment existing
          await ((c.env as any) as any).LEADS_DB.prepare(`
            INSERT OR REPLACE INTO provider_usage_log (
              provider_id,
              webhook_id,
              request_count,
              date,
              created_at
            ) VALUES (
              ?,
              ?,
              COALESCE((SELECT request_count FROM provider_usage_log WHERE provider_id = ? AND webhook_id = ? AND date = ?), 0) + 1,
              ?,
              CURRENT_TIMESTAMP
            )
          `).bind(authorization, webhookId, authorization, webhookId, today, today).run()

          console.log(`Logged provider usage: ${authorization} -> ${webhookId} for ${today}`)
        } catch (usageError) {
          console.error('Failed to log provider usage:', usageError)
          // Don't fail the webhook processing if usage logging fails
        }

        // Step 5: Check and forward lead to other webhooks if criteria match
        try {
          const forwardingResult = await checkAndForwardLead(
            ((c.env as any) as any).LEADS_DB,
            webhookId,
            leadId,
            contactId,
            normalizedLead.productid,
            normalizedLead.zip || normalizedLead.zipCode || normalizedLead.zip_code,
            requestBody // Forward original payload
          )

          if (forwardingResult.forwarded_count > 0) {
            console.log(`✅ Lead ${leadId} forwarded to ${forwardingResult.forwarded_count} target webhook(s)`)
          }

          if (forwardingResult.errors.length > 0) {
            console.error(`⚠️ Some forwarding attempts failed for lead ${leadId}:`, forwardingResult.errors)
          }
        } catch (forwardError) {
          console.error('Lead forwarding error:', forwardError)
          // Don't fail the webhook processing if forwarding fails
        }

      } catch (dbError) {
        console.error('Database error during contact/lead creation:', dbError)
        
        // Return proper error response instead of silent failure
        return c.json({
          error: 'Database error',
          message: 'Failed to create contact or lead in database',
          webhook_id: webhookId,
          details: dbError instanceof Error ? dbError.message : 'Unknown database error',
          timestamp: new Date().toISOString()
        }, 500)
      }
    }

    // Create appropriate response based on contact status
    const responseData = {
      status: 'success',
      message: isNewContact
        ? 'New contact created and lead processed successfully'
        : 'Lead added to existing contact successfully',
      webhook_id: webhookId,
      contact_id: contactId || null,
      lead_id: leadId || null,
      email: normalizedLead.email,
      processed_at: normalizedLead.processed_at,
      contact_status: isNewContact ? 'new' : 'existing',
      next_steps: isNewContact
        ? [
            'Lead data validated and normalized',
            'New contact created in database',
            'Lead stored and linked to contact',
            'Lead processing pipeline triggered',
            'CRM notification sent'
          ]
        : [
            'Lead data validated and normalized',
            'Lead added to existing contact',
            'Lead stored and linked to contact',
            'Lead processing pipeline triggered',
            'CRM notification sent'
          ],
      timestamp: new Date().toISOString()
    }

    return c.json(responseData, 201)

  } catch (error) {
    console.error(`Webhook ${webhookId} processing error:`, error)

    return c.json({
      error: 'Internal server error',
      message: 'An error occurred while processing the webhook',
      webhook_id: webhookId,
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// List all configured webhooks
webhook.get('/', async (c) => {
  try {
    const db = ((c.env as any) as any).LEADS_DB
    
    // Fetch webhook configurations with statistics from D1 database (exclude soft-deleted)
    const { results } = await db.prepare(`
      SELECT
        w.webhook_id,
        w.name,
        w.description,
        w.lead_type,
        w.is_active,
        w.total_leads,
        w.created_at,
        w.last_lead_at,
        COUNT(l.id) as actual_lead_count,
        AVG(CASE WHEN l.status = 'converted' THEN 1.0 ELSE 0.0 END) * 100 as conversion_rate,
        SUM(CASE WHEN l.revenue_potential IS NOT NULL THEN l.revenue_potential ELSE 0 END) as total_revenue
      FROM webhook_configs w
      LEFT JOIN leads l ON w.webhook_id = l.webhook_id
      WHERE w.deleted_at IS NULL
      GROUP BY w.webhook_id, w.name, w.description, w.lead_type, w.is_active, w.total_leads, w.created_at, w.last_lead_at
      ORDER BY w.is_active DESC, w.created_at DESC
    `).all()

    const webhooks = results.map((config: any) => ({
      id: config.webhook_id,
      name: config.name,
      type: config.lead_type,
      region: config.webhook_id.split('_')[1] || 'unknown',
      category: config.webhook_id.split('_')[2] || 'unknown',
      enabled: config.is_active === 1,
      endpoints: {
        health: `/webhook/${config.webhook_id}`,
        receive: `/webhook/${config.webhook_id}`
      },
      // Return actual statistics
      total_leads: config.actual_lead_count || 0,
      conversion_rate: config.conversion_rate || 0,
      total_revenue: config.total_revenue || 0,
      created_at: config.created_at,
      last_lead_at: config.last_lead_at
    }))

    return c.json({
      service: 'Webhook API',
      total_webhooks: webhooks.length,
      webhooks,
      usage: {
        health_check: 'GET /webhook/{webhookId}',
        receive_lead: 'POST /webhook/{webhookId}',
        list_all: 'GET /webhook',
        create_webhook: 'POST /webhook',
        delete_webhook: 'DELETE /webhook/{webhookId}'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to fetch webhooks from database',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Create a new webhook configuration
webhook.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { name, type, region, category } = body

    // Validate required fields
    if (!name || !type || !region || !category) {
      return c.json({
        error: 'Missing required fields',
        message: 'name, type, region, and category are required',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Generate webhook ID with name prefix and random suffix to avoid collisions
    const randomSuffix = Math.floor(Math.random() * 900) + 100 // 100-999
    const namePrefix = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const webhookId = `${namePrefix}_ws_${region.toLowerCase()}_${category.toLowerCase()}_${randomSuffix}`

    // Validate webhook ID format
    if (!WEBHOOK_PATTERN.test(webhookId)) {
      return c.json({
        error: 'Invalid webhook ID generated',
        message: 'Generated webhook ID does not match required pattern',
        timestamp: new Date().toISOString()
      }, 400)
    }

    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook already exists in database
    const { results: existing } = await db.prepare(
      'SELECT webhook_id FROM webhook_configs WHERE webhook_id = ?'
    ).bind(webhookId).all()

    if (existing.length > 0) {
      return c.json({
        error: 'Webhook ID collision',
        message: `Webhook with ID ${webhookId} already exists, please try again`,
        timestamp: new Date().toISOString()
      }, 409)
    }

    // Insert new webhook configuration into database
    await db.prepare(`
      INSERT INTO webhook_configs (webhook_id, name, description, lead_type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      webhookId,
      name,
      `${name} - Auto-generated webhook`,
      type
    ).run()

    // Return the created webhook configuration
    const newWebhookConfig = {
      id: webhookId,
      name,
      type,
      region: region.toLowerCase(),
      category: category.toLowerCase(),
      endpoints: {
        health: `/webhook/${webhookId}`,
        receive: `/webhook/${webhookId}`
      }
    }
    
    return c.json({
      status: 'success',
      message: 'Webhook configuration created successfully',
      webhook: newWebhookConfig,
      timestamp: new Date().toISOString()
    }, 201)

  } catch (error) {
    console.error('Create webhook error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to create webhook configuration',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Delete a webhook configuration (with soft deletion support)
webhook.delete('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')
  const userId = c.req.header('X-User-ID') || 'unknown'
  
  // Get query parameters
  const reason = c.req.query('reason') || 'No reason provided'
  const force = c.req.query('force') === 'true'

  // Validate webhook ID format
  if (!WEBHOOK_PATTERN.test(webhookId)) {
    return c.json({
      error: 'Invalid webhook ID format',
      message: 'Webhook ID must follow pattern: [name-prefix]_ws_[region]_[category]_[id] or ws_[region]_[category]_[id] (e.g., click-ventures_ws_cal_solar_001 or ws_cal_solar_001)',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook exists in database and get current state
    const { results } = await db.prepare(`
      SELECT id, webhook_id, name, is_active, deleted_at, scheduled_deletion_at, deletion_job_id
      FROM webhook_configs 
      WHERE webhook_id = ?
    `).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not found',
        message: `Webhook ${webhookId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const webhook = results[0]

    // Check if already soft deleted
    if (webhook.deleted_at && !force) {
      return c.json({
        error: 'Webhook already deleted',
        message: `Webhook ${webhookId} is already scheduled for deletion`,
        webhook_id: webhookId,
        deleted_at: webhook.deleted_at,
        scheduled_deletion_at: webhook.scheduled_deletion_at,
        note: 'Use ?force=true to permanently delete immediately or POST /webhook/{id}/restore to restore',
        timestamp: new Date().toISOString()
      }, 409)
    }

    // Count leads before deletion for reporting
    const { results: leadCount } = await db.prepare(
      'SELECT COUNT(*) as count FROM leads WHERE webhook_id = ?'
    ).bind(webhookId).all()

    // Force delete - permanent deletion
    if (force) {
      await db.batch([
        // Log permanent deletion event
        db.prepare(`
          INSERT INTO webhook_deletion_events (webhook_id, event_type, event_timestamp, user_id, reason, metadata)
          VALUES (?, 'permanent_delete', CURRENT_TIMESTAMP, ?, ?, ?)
        `).bind(
          webhook.id,
          userId,
          reason,
          JSON.stringify({
            deletion_type: 'force',
            leads_preserved: leadCount[0]?.count || 0,
            previous_soft_delete: webhook.deleted_at
          })
        ),
        
        // Delete webhook configuration permanently
        db.prepare('DELETE FROM webhook_configs WHERE webhook_id = ?').bind(webhookId)
      ])

      return c.json({
        status: 'success',
        message: 'Webhook configuration permanently deleted immediately',
        webhook_id: webhookId,
        leads_preserved: leadCount[0]?.count || 0,
        deletion_type: 'immediate',
        note: 'All leads data has been preserved and remains accessible',
        timestamp: new Date().toISOString()
      })
    }

    // Soft delete - schedule for deletion in 24 hours
    const scheduledDeletionAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const jobId = `webhook-del-${webhookId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    await db.batch([
      // Mark webhook as soft deleted
      db.prepare(`
        UPDATE webhook_configs
        SET 
          deleted_at = CURRENT_TIMESTAMP,
          scheduled_deletion_at = ?,
          deletion_reason = ?,
          deleted_by = ?,
          deletion_job_id = ?,
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE webhook_id = ?
      `).bind(scheduledDeletionAt, reason, userId, jobId, webhookId),
      
      // Create scheduled deletion job
      db.prepare(`
        INSERT INTO webhook_scheduled_deletions 
        (webhook_id, job_id, execute_at, created_by)
        VALUES (?, ?, ?, ?)
      `).bind(webhook.id, jobId, scheduledDeletionAt, userId),
      
      // Log soft deletion event
      db.prepare(`
        INSERT INTO webhook_deletion_events (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
        VALUES (?, 'soft_delete', CURRENT_TIMESTAMP, ?, ?, ?, ?)
      `).bind(
        webhook.id,
        userId,
        reason,
        JSON.stringify({
          deletion_type: 'soft',
          scheduled_deletion_at: scheduledDeletionAt,
          leads_preserved: leadCount[0]?.count || 0
        }),
        jobId
      ),
      
      // Log queue scheduling event
      db.prepare(`
        INSERT INTO webhook_deletion_events (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
        VALUES (?, 'queue_scheduled', CURRENT_TIMESTAMP, ?, ?, ?, ?)
      `).bind(
        webhook.id,
        'system',
        'Scheduled for deletion in 24 hours',
        JSON.stringify({
          execute_at: scheduledDeletionAt,
          delay_seconds: 86400
        }),
        jobId
      )
    ])

    // Schedule the deletion in the queue (if available)
    try {
      await scheduleWebhookDeletion(((c.env as any) as any), webhookId, jobId, scheduledDeletionAt)
    } catch (queueError) {
      console.warn('Failed to schedule deletion in queue:', queueError)
      // Continue without queue - cron will pick it up as fallback
    }

    return c.json({
      status: 'success',
      message: 'Webhook scheduled for deletion in 24 hours',
      webhook_id: webhookId,
      job_id: jobId,
      leads_preserved: leadCount[0]?.count || 0,
      deletion_type: 'scheduled',
      scheduled_deletion_at: scheduledDeletionAt,
      restoration: {
        available_until: scheduledDeletionAt,
        restore_endpoint: `/webhook/${webhookId}/restore`
      },
      note: 'Webhook can be restored within 24 hours. All leads data will be preserved.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Delete webhook error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to delete webhook configuration',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Restore a soft-deleted webhook
webhook.post('/:webhookId/restore', async (c) => {
  const webhookId = c.req.param('webhookId')
  const userId = c.req.header('X-User-ID') || 'unknown'

  // Validate webhook ID format
  if (!WEBHOOK_PATTERN.test(webhookId)) {
    return c.json({
      error: 'Invalid webhook ID format',
      message: 'Webhook ID must follow pattern: [name-prefix]_ws_[region]_[category]_[id] or ws_[region]_[category]_[id]',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook exists and is soft deleted
    const { results } = await db.prepare(`
      SELECT id, webhook_id, name, deleted_at, scheduled_deletion_at, deletion_job_id
      FROM webhook_configs
      WHERE webhook_id = ? AND deleted_at IS NOT NULL
    `).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not found or not deleted',
        message: `Webhook ${webhookId} is not in a soft-deleted state`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const webhook = results[0]

    // Check if restoration window has expired
    const scheduledDeletion = new Date(webhook.scheduled_deletion_at)
    const now = new Date()

    if (scheduledDeletion <= now) {
      return c.json({
        error: 'Restoration window expired',
        message: `Webhook ${webhookId} was scheduled for deletion at ${webhook.scheduled_deletion_at} and can no longer be restored`,
        webhook_id: webhookId,
        expired_at: webhook.scheduled_deletion_at,
        timestamp: new Date().toISOString()
      }, 410)
    }

    await db.batch([
      // Restore the webhook
      db.prepare(`
        UPDATE webhook_configs
        SET
          deleted_at = NULL,
          scheduled_deletion_at = NULL,
          deletion_reason = NULL,
          deleted_by = NULL,
          deletion_job_id = NULL,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE webhook_id = ?
      `).bind(webhookId),
      
      // Cancel the scheduled deletion job
      db.prepare(`
        UPDATE webhook_scheduled_deletions
        SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
        WHERE job_id = ? AND status = 'pending'
      `).bind(webhook.deletion_job_id),
      
      // Log restoration event
      db.prepare(`
        INSERT INTO webhook_deletion_events (webhook_id, event_type, event_timestamp, user_id, reason, metadata, job_id)
        VALUES (?, 'restore', CURRENT_TIMESTAMP, ?, ?, ?, ?)
      `).bind(
        webhook.id,
        userId,
        'Webhook restored by user',
        JSON.stringify({
          restored_by: userId,
          cancelled_job_id: webhook.deletion_job_id,
          restored_at: new Date().toISOString()
        }),
        webhook.deletion_job_id
      )
    ])

    return c.json({
      status: 'success',
      message: 'Webhook restored successfully',
      webhook_id: webhookId,
      restored_by: userId,
      restored_at: new Date().toISOString(),
      note: 'Webhook is now active and can receive leads again',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Restore webhook error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to restore webhook configuration',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// Enable/disable a webhook
webhook.patch('/:webhookId/status', async (c) => {
  const webhookId = c.req.param('webhookId')

  // Validate webhook ID format
  if (!WEBHOOK_PATTERN.test(webhookId)) {
    return c.json({
      error: 'Invalid webhook ID format',
      message: 'Webhook ID must follow pattern: ws_[region]_[category]_[id]',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const requestBody = await c.req.json()
    const { enabled } = requestBody

    if (typeof enabled !== 'boolean') {
      return c.json({
        error: 'Invalid request',
        message: 'enabled field must be a boolean value',
        timestamp: new Date().toISOString()
      }, 400)
    }

    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook exists in database (including inactive ones)
    const { results } = await db.prepare(
      'SELECT webhook_id, name, is_active FROM webhook_configs WHERE webhook_id = ?'
    ).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not found',
        message: `Webhook ${webhookId} does not exist`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    const currentStatus = results[0].is_active === 1

    // Check if status is already what was requested
    if (currentStatus === enabled) {
      return c.json({
        status: 'success',
        message: `Webhook ${webhookId} is already ${enabled ? 'enabled' : 'disabled'}`,
        webhook_id: webhookId,
        enabled: enabled,
        timestamp: new Date().toISOString()
      })
    }

    // Update the status
    await db.prepare(
      'UPDATE webhook_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE webhook_id = ?'
    ).bind(enabled ? 1 : 0, webhookId).run()

    return c.json({
      status: 'success',
      message: `Webhook ${webhookId} has been ${enabled ? 'enabled' : 'disabled'} successfully`,
      webhook_id: webhookId,
      enabled: enabled,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Update webhook status error:', error)
    return c.json({
      error: 'Database error',
      message: 'Failed to update webhook status',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export { webhook as webhookRouter }