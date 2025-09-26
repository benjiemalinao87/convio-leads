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
      'SELECT webhook_id, name, description, lead_type, is_active, total_leads, created_at FROM webhook_configs WHERE webhook_id = ? AND is_active = 1'
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
        created_at: config.created_at
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
    
    // Fetch webhook configurations with statistics from D1 database
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

// Delete a webhook configuration
webhook.delete('/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId')

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

    // Count leads before deletion for reporting
    const { results: leadCount } = await db.prepare(
      'SELECT COUNT(*) as count FROM leads WHERE webhook_id = ?'
    ).bind(webhookId).all()

    // Only delete the webhook configuration - keep all leads data
    // The leads will become "orphaned" but remain accessible in the system
    await db.prepare(
      'DELETE FROM webhook_configs WHERE webhook_id = ?'
    ).bind(webhookId).run()
    
    return c.json({
      status: 'success',
      message: 'Webhook configuration deleted successfully',
      webhook_id: webhookId,
      leads_preserved: leadCount[0]?.count || 0,
      note: 'All leads data has been preserved and remains accessible',
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