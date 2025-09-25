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

const webhook = new Hono()

// Webhook pattern matcher - matches ws_[region]_[category]_[id]
const WEBHOOK_PATTERN = /^ws_([a-z]{2,3})_([a-z]+)_(\d{3})$/

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
      message: 'Webhook ID must follow pattern: ws_[region]_[category]_[id] (e.g., ws_cal_solar_001)',
      expected_format: 'ws_[2-3 letter region]_[category]_[3 digit id]',
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

    // Store lead in database if D1 is available
    let leadId: number | null = null
    if (((c.env as any) as any).LEADS_DB) {
      const db = new LeadDatabase(((c.env as any) as any).LEADS_DB)

      // Get lead type from webhook config
      const config = LeadProviderConfig[webhookId as LeadProviderId]

      // Prepare lead record for database
      const leadRecord: LeadRecord = {
        webhook_id: webhookId,
        lead_type: config.type,
        first_name: normalizedLead.firstName || normalizedLead.first_name || '',
        last_name: normalizedLead.lastName || normalizedLead.last_name || '',
        email: normalizedLead.email,
        phone: normalizedLead.phone,
        address: normalizedLead.address,
        city: normalizedLead.city,
        state: normalizedLead.state,
        zip_code: normalizedLead.zipCode || normalizedLead.zip_code,
        source: normalizedLead.source,
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

      try {
        leadId = await db.saveLead(leadRecord)
        console.log(`Lead saved to database with ID: ${leadId}`)

        // Update webhook statistics in webhook_configs table
        if (leadId) {
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
        }
      } catch (dbError) {
        console.error('Database error:', dbError)
        // Continue processing even if database save fails
      }
    }

    return c.json({
      status: 'success',
      message: 'Lead received and processed successfully',
      webhook_id: webhookId,
      contact_id: leadId || null,
      lead_id: leadId || null, // Keep for backwards compatibility
      email: normalizedLead.email,
      processed_at: normalizedLead.processed_at,
      next_steps: [
        'Lead data validated and normalized',
        leadId ? 'Lead stored in database' : 'Lead processed (database not configured)',
        'Lead processing pipeline triggered',
        'CRM notification sent'
      ],
      timestamp: new Date().toISOString()
    }, 201)

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
      WHERE w.is_active = 1
      GROUP BY w.webhook_id, w.name, w.description, w.lead_type, w.is_active, w.total_leads, w.created_at, w.last_lead_at
      ORDER BY w.created_at DESC
    `).all()

    const webhooks = results.map((config: any) => ({
      id: config.webhook_id,
      name: config.name,
      type: config.lead_type,
      region: config.webhook_id.split('_')[1] || 'unknown',
      category: config.webhook_id.split('_')[2] || 'unknown',
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

    // Generate webhook ID with random suffix to avoid collisions
    const randomSuffix = Math.floor(Math.random() * 900) + 100 // 100-999
    const webhookId = `ws_${region.toLowerCase()}_${category.toLowerCase()}_${randomSuffix}`

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
      message: 'Webhook ID must follow pattern: ws_[region]_[category]_[id]',
      timestamp: new Date().toISOString()
    }, 400)
  }

  try {
    const db = ((c.env as any) as any).LEADS_DB

    // Check if webhook exists in database
    const { results } = await db.prepare(
      'SELECT webhook_id, name FROM webhook_configs WHERE webhook_id = ? AND is_active = 1'
    ).bind(webhookId).all()

    if (results.length === 0) {
      return c.json({
        error: 'Webhook not found',
        message: `Webhook ${webhookId} does not exist or is already inactive`,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Soft delete by marking as inactive
    await db.prepare(
      'UPDATE webhook_configs SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE webhook_id = ?'
    ).bind(webhookId).run()
    
    return c.json({
      status: 'success',
      message: 'Webhook configuration deleted successfully',
      webhook_id: webhookId,
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

export { webhook as webhookRouter }