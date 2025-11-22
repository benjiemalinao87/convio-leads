import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  LEADS_DB: D1Database
}

const adminOnboardingRouter = new Hono<{ Bindings: Bindings }>()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate provider ID from provider name
 * Format: {sanitized_name}_{random_4_digit_suffix}
 * Example: click_ventures_1234
 */
function generateProviderId(providerName: string): string {
  const sanitized = providerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50)

  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${sanitized}_${suffix}`
}

/**
 * Generate webhook ID from webhook name and details
 * Format: {name_prefix}_ws_{region}_{category}_{random_3_digit}
 * Example: click-ventures_ws_cal_solar_123
 */
function generateWebhookId(webhookName: string, region: string, category: string): string {
  const sanitized = webhookName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30)

  const suffix = Math.floor(100 + Math.random() * 900)
  return `${sanitized}_ws_${region.toLowerCase()}_${category.toLowerCase()}_${suffix}`
}

// ============================================================================
// POST /admin/onboard-provider
// One-step provider + webhook creation with onboarding materials
// ============================================================================
adminOnboardingRouter.post('/onboard-provider', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const body = await c.req.json()

    // Validate required fields
    const requiredFields = [
      'company_name',
      'contact_name',
      'contact_phone',
      'contact_email',
      'webhook_name',
      'admin_email'
    ]

    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        missing: missingFields,
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Validate webhook_types array
    if (!body.webhook_types || !Array.isArray(body.webhook_types) || body.webhook_types.length === 0) {
      return c.json({
        success: false,
        error: 'webhook_types must be a non-empty array',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Extract and validate webhook region (optional, defaults to 'us')
    const webhookRegion = body.webhook_region || 'us'

    // ========================================================================
    // STEP 1: Generate Provider ID
    // ========================================================================
    let providerId = generateProviderId(body.company_name)
    let collisionAttempts = 0
    const maxAttempts = 5

    // Check for collisions and regenerate if needed
    while (collisionAttempts < maxAttempts) {
      const existing = await db.prepare(`
        SELECT provider_id FROM lead_source_providers WHERE provider_id = ?
      `).bind(providerId).first()

      if (!existing) break

      providerId = generateProviderId(body.company_name)
      collisionAttempts++
    }

    if (collisionAttempts >= maxAttempts) {
      return c.json({
        success: false,
        error: 'Failed to generate unique provider ID after multiple attempts',
        timestamp: new Date().toISOString()
      }, 500)
    }

    // ========================================================================
    // STEP 2: Create Provider Record
    // ========================================================================
    const providerResult = await db.prepare(`
      INSERT INTO lead_source_providers (
        provider_id, provider_name, company_name,
        contact_name, contact_email, contact_phone,
        is_active, rate_limit, created_by,
        onboarding_completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      providerId,
      body.company_name, // provider_name same as company_name
      body.company_name,
      body.contact_name,
      body.contact_email,
      body.contact_phone,
      1, // is_active
      body.rate_limit || 5000, // Default 5000 requests/hour
      body.admin_email,
      new Date().toISOString()
    ).run()

    if (!providerResult.success) {
      return c.json({
        success: false,
        error: 'Failed to create provider record',
        timestamp: new Date().toISOString()
      }, 500)
    }

    // ========================================================================
    // STEP 3: Generate Webhook ID
    // ========================================================================
    // Use first webhook type as primary type for webhook ID generation
    const primaryWebhookType = body.webhook_types[0]
    let webhookId = generateWebhookId(body.webhook_name, webhookRegion, primaryWebhookType)
    collisionAttempts = 0

    // Check for webhook ID collisions
    while (collisionAttempts < maxAttempts) {
      const existing = await db.prepare(`
        SELECT webhook_id FROM webhook_configs WHERE webhook_id = ?
      `).bind(webhookId).first()

      if (!existing) break

      webhookId = generateWebhookId(body.webhook_name, webhookRegion, primaryWebhookType)
      collisionAttempts++
    }

    if (collisionAttempts >= maxAttempts) {
      // Rollback provider creation
      await db.prepare(`
        DELETE FROM lead_source_providers WHERE provider_id = ?
      `).bind(providerId).run()

      return c.json({
        success: false,
        error: 'Failed to generate unique webhook ID after multiple attempts',
        timestamp: new Date().toISOString()
      }, 500)
    }

    // ========================================================================
    // STEP 4: Create Webhook Record
    // ========================================================================
    const webhookResult = await db.prepare(`
      INSERT INTO webhook_configs (
        webhook_id, name, description, lead_type,
        is_active, forwarding_enabled, forward_mode,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      webhookId,
      body.webhook_name,
      `Webhook for ${body.company_name} - ${body.webhook_types.join(', ')} leads`,
      primaryWebhookType, // Store primary type in lead_type field
      1, // is_active
      0, // forwarding_enabled
      'first-match', // forward_mode
      body.admin_email
    ).run()

    if (!webhookResult.success) {
      // Rollback provider creation
      await db.prepare(`
        DELETE FROM lead_source_providers WHERE provider_id = ?
      `).bind(providerId).run()

      return c.json({
        success: false,
        error: 'Failed to create webhook record',
        timestamp: new Date().toISOString()
      }, 500)
    }

    // ========================================================================
    // STEP 5: Link Provider to Webhook
    // ========================================================================
    await db.prepare(`
      UPDATE lead_source_providers
      SET allowed_webhooks = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = ?
    `).bind(JSON.stringify([webhookId]), providerId).run()

    // ========================================================================
    // STEP 6: Create Onboarding Audit Log
    // ========================================================================
    await db.prepare(`
      INSERT INTO admin_onboarding_log (
        provider_id, webhook_id, admin_email, admin_name,
        company_name, contact_name, contact_email, contact_phone,
        webhook_name, webhook_type, webhook_region,
        created_at, materials_viewed, materials_downloaded, email_copied
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0, 0, 0)
    `).bind(
      providerId,
      webhookId,
      body.admin_email,
      body.admin_name || null,
      body.company_name,
      body.contact_name,
      body.contact_email,
      body.contact_phone,
      body.webhook_name,
      body.webhook_types.join(', '), // Store all types as comma-separated string
      webhookRegion
    ).run()

    // ========================================================================
    // STEP 7: Generate Webhook URL
    // ========================================================================
    const webhookUrl = `https://api.homeprojectpartners.com/webhook/${webhookId}`

    // ========================================================================
    // STEP 8: Return Success with Onboarding Data
    // ========================================================================
    return c.json({
      success: true,
      message: 'Provider and webhook created successfully',
      data: {
        provider: {
          provider_id: providerId,
          company_name: body.company_name,
          contact_name: body.contact_name,
          contact_email: body.contact_email,
          contact_phone: body.contact_phone,
          is_active: true,
          rate_limit: body.rate_limit || 5000
        },
        webhook: {
          webhook_id: webhookId,
          webhook_url: webhookUrl,
          webhook_name: body.webhook_name,
          webhook_types: body.webhook_types, // Return all types
          webhook_type: primaryWebhookType, // Primary type used for ID
          webhook_region: webhookRegion,
          is_active: true
        },
        onboarding: {
          created_by: body.admin_email,
          created_at: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in admin onboarding:', error)
    return c.json({
      success: false,
      error: 'Failed to complete provider onboarding',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// GET /admin/onboarding-materials/:providerId
// Generate HTML onboarding materials for a provider
// ============================================================================
adminOnboardingRouter.get('/onboarding-materials/:providerId', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const providerId = c.req.param('providerId')

    // Fetch provider details
    const provider = await db.prepare(`
      SELECT * FROM lead_source_providers WHERE provider_id = ?
    `).bind(providerId).first()

    if (!provider) {
      return c.json({
        success: false,
        error: 'Provider not found',
        provider_id: providerId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Fetch webhook details (get first webhook from allowed_webhooks)
    let webhookId: string | null = null
    let webhook: any = null

    if (provider.allowed_webhooks) {
      const allowedWebhooks = JSON.parse(provider.allowed_webhooks as string)
      if (allowedWebhooks.length > 0) {
        webhookId = allowedWebhooks[0]
        webhook = await db.prepare(`
          SELECT * FROM webhook_configs WHERE webhook_id = ?
        `).bind(webhookId).first()
      }
    }

    const webhookUrl = webhookId
      ? `https://api.homeprojectpartners.com/webhook/${webhookId}`
      : 'N/A'

    // Generate email template
    const emailTemplate = generateEmailTemplate({
      contact_name: provider.contact_name as string,
      provider_id: providerId,
      webhook_url: webhookUrl,
      webhook_id: webhookId || 'N/A',
      webhook_type: webhook?.lead_type || 'unknown'
    })

    // Generate HTML setup guide
    const setupGuideHtml = generateSetupGuideHtml({
      company_name: provider.company_name as string,
      contact_name: provider.contact_name as string,
      contact_email: provider.contact_email as string,
      provider_id: providerId,
      webhook_url: webhookUrl,
      webhook_id: webhookId || 'N/A',
      webhook_name: webhook?.name || 'N/A',
      webhook_type: webhook?.lead_type || 'unknown',
      rate_limit: provider.rate_limit as number || 5000
    })

    // Update audit log to track materials view
    await db.prepare(`
      UPDATE admin_onboarding_log
      SET materials_viewed = 1
      WHERE provider_id = ?
    `).bind(providerId).run()

    return c.json({
      success: true,
      provider_id: providerId,
      email_template: emailTemplate,
      setup_guide_html: setupGuideHtml,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error generating onboarding materials:', error)
    return c.json({
      success: false,
      error: 'Failed to generate onboarding materials',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// Template Generation Functions
// ============================================================================

function generateEmailTemplate(data: {
  contact_name: string
  provider_id: string
  webhook_url: string
  webhook_id: string
  webhook_type: string
}): string {
  return `Subject: Welcome to BuyerFound - Lead API Setup

Hi ${data.contact_name},

Welcome to BuyerFound! Your lead integration is ready to go.

CREDENTIALS
-----------
Provider ID: ${data.provider_id}
Webhook URL: ${data.webhook_url}
Webhook Type: ${data.webhook_type}

QUICK START
-----------
Send leads via HTTP POST to the webhook URL above.
Include your Provider ID in the Authorization header:

Authorization: ${data.provider_id}

EXAMPLE REQUEST
---------------
curl -X POST ${data.webhook_url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: ${data.provider_id}" \\
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90210",
    "source": "Google Ads",
    "productid": "${data.webhook_type}",
    "subsource": "Solar Installation Campaign",
    "landing_page_url": "https://solarpanel.com/ca-landing",
    "consent": {
      "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
      "value": true
    }
  }'

TESTING
-------
Test your webhook health:
GET ${data.webhook_url}

Expected response:
{"status": "ok", "webhook_id": "${data.webhook_id}"}

PAYLOAD FIELDS
--------------
Required:
- firstname (string) - Lead's first name
- lastname (string) - Lead's last name
- email (string) - Valid email address
- phone (string) - Format: 5551234567 or +15551234567

Recommended:
- state (string) - 2-letter state code (e.g., CA, NY)
- zip (string) - 5-digit zip code
- productid (string) - Product type (Solar, HVAC, Roofing, etc.)
- source (string) - Lead source identifier (e.g., "Google Ads")

Optional:
- address1 (string) - Street address
- address2 (string) - Apartment, suite, etc.
- city (string) - City name
- subsource (string) - Campaign or sub-source detail
- landing_page_url (string) - URL where lead originated
- consent (object) - Consent information with description and value
- Any custom fields your system uses

SUPPORT
-------
Questions? Contact us at:
Email: brian@buyerfound.ai
Documentation: https://api.homeprojectpartners.com/docs

Best regards,
BuyerFound Team`
}

function generateSetupGuideHtml(data: {
  company_name: string
  contact_name: string
  contact_email: string
  provider_id: string
  webhook_url: string
  webhook_id: string
  webhook_name: string
  webhook_type: string
  rate_limit: number
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Integration Guide - ${data.company_name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
        .header h1 { color: #1e40af; font-size: 28px; margin-bottom: 10px; }
        .header p { color: #6b7280; font-size: 16px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1e40af; font-size: 20px; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
        .section h3 { color: #374151; font-size: 16px; margin: 20px 0 10px; }
        .credential-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 15px 0; border-radius: 4px; }
        .credential-box .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .credential-box .value { color: #1e40af; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 600; word-break: break-all; }
        .code-block { background: #1e293b; color: #e2e8f0; padding: 20px; border-radius: 6px; overflow-x: auto; margin: 15px 0; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5; }
        .code-block .comment { color: #94a3b8; }
        .code-block .string { color: #86efac; }
        .code-block .key { color: #7dd3fc; }
        .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .info-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        .info-table td:first-child { font-weight: 600; color: #374151; width: 40%; }
        .info-table td:last-child { color: #6b7280; }
        .badge { display: inline-block; padding: 4px 12px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 12px; font-weight: 600; margin-right: 8px; }
        .badge.success { background: #dcfce7; color: #166534; }
        .badge.warning { background: #fef3c7; color: #92400e; }
        .alert { padding: 15px; border-radius: 6px; margin: 15px 0; }
        .alert-info { background: #dbeafe; border-left: 4px solid #2563eb; color: #1e40af; }
        .alert-success { background: #dcfce7; border-left: 4px solid #16a34a; color: #166534; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .code-block { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API Integration Guide</h1>
            <p>Welcome to BuyerFound, ${data.contact_name}!</p>
        </div>

        <!-- Account Information -->
        <div class="section">
            <h2>📋 Account Information</h2>
            <table class="info-table">
                <tr>
                    <td>Company Name</td>
                    <td>${data.company_name}</td>
                </tr>
                <tr>
                    <td>Contact Person</td>
                    <td>${data.contact_name}</td>
                </tr>
                <tr>
                    <td>Contact Email</td>
                    <td>${data.contact_email}</td>
                </tr>
                <tr>
                    <td>Rate Limit</td>
                    <td>${data.rate_limit} requests/hour</td>
                </tr>
                <tr>
                    <td>Webhook Type</td>
                    <td><span class="badge">${data.webhook_type}</span></td>
                </tr>
                <tr>
                    <td>Account Status</td>
                    <td><span class="badge success">Active</span></td>
                </tr>
            </table>
        </div>

        <!-- API Credentials -->
        <div class="section">
            <h2>🔑 API Credentials</h2>
            <p>Use these credentials for all API requests. Keep them secure and do not share publicly.</p>

            <div class="credential-box">
                <div class="label">Provider ID</div>
                <div class="value">${data.provider_id}</div>
            </div>

            <div class="credential-box">
                <div class="label">Webhook URL</div>
                <div class="value">${data.webhook_url}</div>
            </div>

            <div class="credential-box">
                <div class="label">Webhook ID</div>
                <div class="value">${data.webhook_id}</div>
            </div>
        </div>

        <!-- Quick Start -->
        <div class="section">
            <h2>⚡ Quick Start</h2>
            <p>Send leads to our API with a simple HTTP POST request:</p>

            <h3>Step 1: Test Webhook Health</h3>
            <p>Verify your webhook is active:</p>
            <div class="code-block">curl https://api.homeprojectpartners.com/webhook/${data.webhook_id}</div>
            <p><strong>Expected Response:</strong></p>
            <div class="code-block">{"status": "ok", "webhook_id": "${data.webhook_id}"}</div>

            <h3>Step 2: Send Your First Lead</h3>
            <div class="code-block">curl -X POST ${data.webhook_url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: ${data.provider_id}" \\
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90210",
    "source": "Google Ads",
    "productid": "${data.webhook_type}",
    "subsource": "Solar Installation Campaign",
    "landing_page_url": "https://solarpanel.com/ca-landing",
    "consent": {
      "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
      "value": true
    }
  }'</div>

            <h3>Step 3: Handle Response</h3>
            <p><strong>Success Response (201 Created):</strong></p>
            <div class="code-block">{
  "success": true,
  "message": "Lead received successfully",
  "contact_id": 12345,
  "lead_id": 67890,
  "contact_status": "new",
  "timestamp": "2025-11-22T04:30:00.000Z"
}</div>

            <p><strong>Error Response (400/401/500):</strong></p>
            <div class="code-block">{
  "success": false,
  "error": "Error message here",
  "timestamp": "2025-11-22T04:30:00.000Z"
}</div>
        </div>

        <!-- Payload Specification -->
        <div class="section">
            <h2>📄 Payload Specification</h2>

            <h3>Required Fields</h3>
            <table class="info-table">
                <tr>
                    <td>firstname</td>
                    <td>string - Lead's first name</td>
                </tr>
                <tr>
                    <td>lastname</td>
                    <td>string - Lead's last name</td>
                </tr>
                <tr>
                    <td>email</td>
                    <td>string - Valid email address</td>
                </tr>
                <tr>
                    <td>phone</td>
                    <td>string - Format: 5551234567 or +15551234567</td>
                </tr>
            </table>

            <h3>Optional Fields</h3>
            <table class="info-table">
                <tr>
                    <td>address1</td>
                    <td>string - Street address</td>
                </tr>
                <tr>
                    <td>address2</td>
                    <td>string - Apartment, suite, etc.</td>
                </tr>
                <tr>
                    <td>city</td>
                    <td>string - City name</td>
                </tr>
                <tr>
                    <td>state</td>
                    <td>string - 2-letter state code (CA, NY, TX, etc.)</td>
                </tr>
                <tr>
                    <td>zip</td>
                    <td>string - 5-digit zip code</td>
                </tr>
                <tr>
                    <td>source</td>
                    <td>string - Lead source identifier</td>
                </tr>
                <tr>
                    <td>productid</td>
                    <td>string - Product type (Solar, HVAC, Roofing, Bath, etc.)</td>
                </tr>
                <tr>
                    <td>subsource</td>
                    <td>string - Campaign or sub-source detail</td>
                </tr>
                <tr>
                    <td>landing_page_url</td>
                    <td>string - URL where lead originated</td>
                </tr>
                <tr>
                    <td>consent</td>
                    <td>object - Consent information with description and value</td>
                </tr>
            </table>
        </div>

        <!-- Authentication -->
        <div class="section">
            <h2>🔐 Authentication</h2>
            <p>All requests must include your Provider ID in the Authorization header:</p>
            <div class="code-block">Authorization: ${data.provider_id}</div>
            <div class="alert alert-info">
                <strong>Important:</strong> Do not use "Bearer" prefix. Send the provider ID directly as shown above.
            </div>
        </div>

        <!-- Rate Limiting -->
        <div class="section">
            <h2>⏱️ Rate Limiting</h2>
            <p>Your account has a rate limit of <strong>${data.rate_limit} requests per hour</strong>.</p>
            <p>If you exceed this limit, you'll receive a 429 Too Many Requests response. Contact support to increase your limit if needed.</p>
        </div>

        <!-- Troubleshooting -->
        <div class="section">
            <h2>🔧 Troubleshooting</h2>

            <h3>Common Error Codes</h3>
            <table class="info-table">
                <tr>
                    <td>400 Bad Request</td>
                    <td>Missing required fields or invalid data format</td>
                </tr>
                <tr>
                    <td>401 Unauthorized</td>
                    <td>Invalid or missing Provider ID in Authorization header</td>
                </tr>
                <tr>
                    <td>403 Forbidden</td>
                    <td>Provider not authorized for this webhook</td>
                </tr>
                <tr>
                    <td>429 Too Many Requests</td>
                    <td>Rate limit exceeded</td>
                </tr>
                <tr>
                    <td>500 Server Error</td>
                    <td>Internal server error - contact support</td>
                </tr>
            </table>

            <h3>Testing Checklist</h3>
            <div class="alert alert-success">
                ✅ Verify webhook health endpoint returns OK status<br>
                ✅ Test with valid lead data and confirm 201 response<br>
                ✅ Test with missing required fields (should get 400 error)<br>
                ✅ Test with wrong Provider ID (should get 401 error)<br>
                ✅ Verify phone numbers are normalized to +1XXXXXXXXXX format
            </div>
        </div>

        <!-- Support -->
        <div class="section">
            <h2>💬 Support & Resources</h2>
            <p><strong>Email:</strong> brian@buyerfound.ai</p>
            <p><strong>Documentation:</strong> https://api.homeprojectpartners.com/docs</p>
            <p><strong>API Status:</strong> https://api.homeprojectpartners.com/health</p>
        </div>

        <div class="footer">
            <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            <p>© ${new Date().getFullYear()} BuyerFound. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
}

export { adminOnboardingRouter }
