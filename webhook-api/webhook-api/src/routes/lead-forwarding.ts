import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  LEADS_DB: D1Database
}

const leadForwardingRouter = new Hono<{ Bindings: Bindings }>()

// Type definitions
interface ForwardingRuleRequest {
  target_webhook_id: string
  target_webhook_url: string
  product_types: string[]     // ["Kitchen", "Bath", "Solar"]
  zip_codes: string[]         // ["90210", "90211", "90212"]
  priority?: number
  forward_enabled?: boolean
  notes?: string
}

interface ForwardingRuleBulkRequest {
  target_webhook_id: string
  target_webhook_url: string
  product_types: string[]
  zip_codes_csv?: string      // CSV format: "90210,90211,90212"
  priority?: number
  forward_enabled?: boolean
  notes?: string
}

// ============================================================================
// POST /webhook/:webhookId/forwarding-rules
// Create new forwarding rule for a webhook
// ============================================================================
leadForwardingRouter.post('/:webhookId/forwarding-rules', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const body = await c.req.json<ForwardingRuleRequest>()

    // Validate required fields
    if (!body.target_webhook_id || !body.target_webhook_url ||
        !body.product_types || !Array.isArray(body.product_types) ||
        !body.zip_codes || !Array.isArray(body.zip_codes)) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        required: ['target_webhook_id', 'target_webhook_url', 'product_types', 'zip_codes'],
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Verify source webhook exists
    const sourceWebhook = await db.prepare(`
      SELECT webhook_id, name FROM webhook_configs 
      WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(webhookId).first()

    if (!sourceWebhook) {
      return c.json({
        success: false,
        error: 'Source webhook not found or inactive',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Check for catch-all rule configuration
    const isCatchAll = body.product_types.includes("*") && body.zip_codes.includes("*")
    const isPartialCatchAll = body.product_types.includes("*") || body.zip_codes.includes("*")

    // Warn if creating catch-all rule with high priority (might override specific rules)
    if (isCatchAll && body.priority && body.priority < 100) {
      console.warn(`⚠️  Creating catch-all rule with priority ${body.priority} - this may override specific rules`)
    }

    // Check for existing catch-all rules (optional warning, not blocking)
    if (isCatchAll) {
      const existingCatchAll = await db.prepare(`
        SELECT id, priority, target_webhook_id FROM lead_forwarding_rules
        WHERE source_webhook_id = ?
          AND product_types LIKE '%"*"%'
          AND zip_codes LIKE '%"*"%'
          AND is_active = 1
      `).bind(webhookId).first()

      if (existingCatchAll) {
        console.log(`ℹ️  Another catch-all rule exists (ID: ${existingCatchAll.id}, Priority: ${existingCatchAll.priority})`)
      }
    }

    // Set priority if not provided (get next available priority)
    let priority = body.priority
    if (!priority) {
      const maxPriority = await db.prepare(`
        SELECT MAX(priority) as max_priority
        FROM lead_forwarding_rules
        WHERE source_webhook_id = ?
      `).bind(webhookId).first()

      priority = (maxPriority?.max_priority as number || 0) + 1
    }

    // Create forwarding rule
    const result = await db.prepare(`
      INSERT INTO lead_forwarding_rules (
        source_webhook_id, target_webhook_id, target_webhook_url,
        product_types, zip_codes, priority, is_active, forward_enabled,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      webhookId,
      body.target_webhook_id,
      body.target_webhook_url,
      JSON.stringify(body.product_types),
      JSON.stringify(body.zip_codes),
      priority,
      body.forward_enabled !== false, // Default to true
      body.notes || null
    ).run()

    const ruleId = result.meta.last_row_id

    return c.json({
      success: true,
      message: isCatchAll
        ? 'Catch-all forwarding rule created successfully (matches all leads)'
        : isPartialCatchAll
        ? 'Partial catch-all forwarding rule created successfully'
        : 'Forwarding rule created successfully',
      rule: {
        id: ruleId,
        source_webhook_id: webhookId,
        target_webhook_id: body.target_webhook_id,
        target_webhook_url: body.target_webhook_url,
        product_types: body.product_types,
        zip_codes: body.zip_codes,
        priority,
        is_active: true,
        forward_enabled: body.forward_enabled !== false,
        notes: body.notes,
        zip_count: body.zip_codes.length,
        product_count: body.product_types.length,
        is_catch_all: isCatchAll,
        is_partial_catch_all: isPartialCatchAll && !isCatchAll
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating forwarding rule:', error)
    return c.json({
      success: false,
      error: 'Failed to create forwarding rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// POST /webhook/:webhookId/forwarding-rules/bulk
// Create forwarding rule with CSV zip codes
// ============================================================================
leadForwardingRouter.post('/:webhookId/forwarding-rules/bulk', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const body = await c.req.json<ForwardingRuleBulkRequest>()

    // Validate required fields
    if (!body.target_webhook_id || !body.target_webhook_url ||
        !body.product_types || !Array.isArray(body.product_types)) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        required: ['target_webhook_id', 'target_webhook_url', 'product_types', 'zip_codes_csv'],
        timestamp: new Date().toISOString()
      }, 400)
    }

    let zipCodes: string[] = []

    // Process CSV zip codes
    if (body.zip_codes_csv) {
      zipCodes = body.zip_codes_csv.split(',')
        .map(zip => zip.trim())
        .filter(zip => zip.length > 0)
    }

    if (zipCodes.length === 0) {
      return c.json({
        success: false,
        error: 'No valid zip codes provided',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Verify source webhook exists
    const sourceWebhook = await db.prepare(`
      SELECT webhook_id, name FROM webhook_configs 
      WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(webhookId).first()

    if (!sourceWebhook) {
      return c.json({
        success: false,
        error: 'Source webhook not found or inactive',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Set priority
    let priority = body.priority
    if (!priority) {
      const maxPriority = await db.prepare(`
        SELECT MAX(priority) as max_priority
        FROM lead_forwarding_rules
        WHERE source_webhook_id = ?
      `).bind(webhookId).first()

      priority = (maxPriority?.max_priority as number || 0) + 1
    }

    // Create forwarding rule
    const result = await db.prepare(`
      INSERT INTO lead_forwarding_rules (
        source_webhook_id, target_webhook_id, target_webhook_url,
        product_types, zip_codes, priority, is_active, forward_enabled,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      webhookId,
      body.target_webhook_id,
      body.target_webhook_url,
      JSON.stringify(body.product_types),
      JSON.stringify(zipCodes),
      priority,
      body.forward_enabled !== false,
      body.notes || null
    ).run()

    const ruleId = result.meta.last_row_id

    return c.json({
      success: true,
      message: `Forwarding rule created successfully with ${zipCodes.length} zip codes`,
      rule: {
        id: ruleId,
        source_webhook_id: webhookId,
        target_webhook_id: body.target_webhook_id,
        target_webhook_url: body.target_webhook_url,
        product_types: body.product_types,
        zip_codes: zipCodes,
        priority,
        is_active: true,
        forward_enabled: body.forward_enabled !== false,
        notes: body.notes,
        zip_count: zipCodes.length,
        product_count: body.product_types.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating bulk forwarding rule:', error)
    return c.json({
      success: false,
      error: 'Failed to create bulk forwarding rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// GET /webhook/:webhookId/forwarding-rules
// Get all forwarding rules for a webhook
// ============================================================================
leadForwardingRouter.get('/:webhookId/forwarding-rules', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')

    // Get forwarding rules
    const { results } = await db.prepare(`
      SELECT * FROM lead_forwarding_rules
      WHERE source_webhook_id = ?
      ORDER BY priority ASC, created_at DESC
    `).bind(webhookId).all()

    const rules = results.map((rule: any) => ({
      id: rule.id,
      source_webhook_id: rule.source_webhook_id,
      target_webhook_id: rule.target_webhook_id,
      target_webhook_url: rule.target_webhook_url,
      product_types: JSON.parse(rule.product_types),
      zip_codes: JSON.parse(rule.zip_codes),
      priority: rule.priority,
      is_active: rule.is_active === 1,
      forward_enabled: rule.forward_enabled === 1,
      notes: rule.notes,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
      created_by: rule.created_by
    }))

    return c.json({
      success: true,
      webhook_id: webhookId,
      total_rules: rules.length,
      active_rules: rules.filter(r => r.is_active && r.forward_enabled).length,
      rules,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching forwarding rules:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch forwarding rules',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// GET /webhook/:webhookId/forwarding-rules/:ruleId
// Get specific forwarding rule
// ============================================================================
leadForwardingRouter.get('/:webhookId/forwarding-rules/:ruleId', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const ruleId = c.req.param('ruleId')

    const rule = await db.prepare(`
      SELECT * FROM lead_forwarding_rules
      WHERE id = ? AND source_webhook_id = ?
    `).bind(ruleId, webhookId).first()

    if (!rule) {
      return c.json({
        success: false,
        error: 'Forwarding rule not found',
        rule_id: ruleId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    return c.json({
      success: true,
      rule: {
        id: rule.id,
        source_webhook_id: rule.source_webhook_id,
        target_webhook_id: rule.target_webhook_id,
        target_webhook_url: rule.target_webhook_url,
        product_types: JSON.parse(rule.product_types as string),
        zip_codes: JSON.parse(rule.zip_codes as string),
        priority: rule.priority,
        is_active: rule.is_active === 1,
        forward_enabled: rule.forward_enabled === 1,
        notes: rule.notes,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
        created_by: rule.created_by
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching forwarding rule:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch forwarding rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// PUT /webhook/:webhookId/forwarding-rules/:ruleId
// Update forwarding rule
// ============================================================================
leadForwardingRouter.put('/:webhookId/forwarding-rules/:ruleId', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const ruleId = c.req.param('ruleId')
    const body = await c.req.json<Partial<ForwardingRuleRequest>>()

    // Check if rule exists
    const existingRule = await db.prepare(`
      SELECT id FROM lead_forwarding_rules
      WHERE id = ? AND source_webhook_id = ?
    `).bind(ruleId, webhookId).first()

    if (!existingRule) {
      return c.json({
        success: false,
        error: 'Forwarding rule not found',
        rule_id: ruleId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (body.target_webhook_id) {
      updates.push('target_webhook_id = ?')
      values.push(body.target_webhook_id)
    }
    if (body.target_webhook_url) {
      updates.push('target_webhook_url = ?')
      values.push(body.target_webhook_url)
    }
    if (body.product_types) {
      updates.push('product_types = ?')
      values.push(JSON.stringify(body.product_types))
    }
    if (body.zip_codes) {
      updates.push('zip_codes = ?')
      values.push(JSON.stringify(body.zip_codes))
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?')
      values.push(body.priority)
    }
    if (body.forward_enabled !== undefined) {
      updates.push('forward_enabled = ?')
      values.push(body.forward_enabled ? 1 : 0)
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?')
      values.push(body.notes)
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No fields to update',
        timestamp: new Date().toISOString()
      }, 400)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(ruleId, webhookId)

    await db.prepare(`
      UPDATE lead_forwarding_rules
      SET ${updates.join(', ')}
      WHERE id = ? AND source_webhook_id = ?
    `).bind(...values).run()

    // Fetch updated rule
    const updatedRule = await db.prepare(`
      SELECT * FROM lead_forwarding_rules
      WHERE id = ? AND source_webhook_id = ?
    `).bind(ruleId, webhookId).first()

    return c.json({
      success: true,
      message: 'Forwarding rule updated successfully',
      rule: {
        id: updatedRule!.id,
        source_webhook_id: updatedRule!.source_webhook_id,
        target_webhook_id: updatedRule!.target_webhook_id,
        target_webhook_url: updatedRule!.target_webhook_url,
        product_types: JSON.parse(updatedRule!.product_types as string),
        zip_codes: JSON.parse(updatedRule!.zip_codes as string),
        priority: updatedRule!.priority,
        is_active: updatedRule!.is_active === 1,
        forward_enabled: updatedRule!.forward_enabled === 1,
        notes: updatedRule!.notes,
        updated_at: updatedRule!.updated_at
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating forwarding rule:', error)
    return c.json({
      success: false,
      error: 'Failed to update forwarding rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// DELETE /webhook/:webhookId/forwarding-rules/:ruleId
// Delete forwarding rule
// ============================================================================
leadForwardingRouter.delete('/:webhookId/forwarding-rules/:ruleId', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const ruleId = c.req.param('ruleId')

    // Check if rule exists
    const existingRule = await db.prepare(`
      SELECT id, target_webhook_id FROM lead_forwarding_rules
      WHERE id = ? AND source_webhook_id = ?
    `).bind(ruleId, webhookId).first()

    if (!existingRule) {
      return c.json({
        success: false,
        error: 'Forwarding rule not found',
        rule_id: ruleId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Delete the rule
    await db.prepare(`
      DELETE FROM lead_forwarding_rules
      WHERE id = ? AND source_webhook_id = ?
    `).bind(ruleId, webhookId).run()

    return c.json({
      success: true,
      message: 'Forwarding rule deleted successfully',
      rule_id: ruleId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting forwarding rule:', error)
    return c.json({
      success: false,
      error: 'Failed to delete forwarding rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// PATCH /webhook/:webhookId/forwarding-toggle
// Toggle forwarding on/off for entire webhook (master toggle)
// ============================================================================
leadForwardingRouter.patch('/:webhookId/forwarding-toggle', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const body = await c.req.json<{ forwarding_enabled: boolean }>()

    if (typeof body.forwarding_enabled !== 'boolean') {
      return c.json({
        success: false,
        error: 'forwarding_enabled must be a boolean value',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Check if webhook exists
    const webhook = await db.prepare(`
      SELECT webhook_id, name FROM webhook_configs
      WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(webhookId).first()

    if (!webhook) {
      return c.json({
        success: false,
        error: 'Webhook not found or inactive',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Update forwarding_enabled flag
    await db.prepare(`
      UPDATE webhook_configs
      SET forwarding_enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE webhook_id = ?
    `).bind(body.forwarding_enabled ? 1 : 0, webhookId).run()

    return c.json({
      success: true,
      message: `Lead forwarding ${body.forwarding_enabled ? 'enabled' : 'disabled'} for webhook`,
      webhook_id: webhookId,
      forwarding_enabled: body.forwarding_enabled,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error toggling forwarding:', error)
    return c.json({
      success: false,
      error: 'Failed to toggle forwarding',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// PATCH /webhook/:webhookId/forward-mode
// Configure forwarding behavior for webhook
// ============================================================================
leadForwardingRouter.patch('/:webhookId/forward-mode', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    const body = await c.req.json<{ forward_mode: 'first-match' | 'all-matches' }>()

    // Validate forward_mode value
    if (!body.forward_mode || !['first-match', 'all-matches'].includes(body.forward_mode)) {
      return c.json({
        success: false,
        error: 'forward_mode must be either "first-match" or "all-matches"',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Check if webhook exists
    const webhook = await db.prepare(`
      SELECT webhook_id, name, forwarding_enabled FROM webhook_configs
      WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(webhookId).first()

    if (!webhook) {
      return c.json({
        success: false,
        error: 'Webhook not found or inactive',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Update forward_mode
    await db.prepare(`
      UPDATE webhook_configs
      SET forward_mode = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE webhook_id = ?
    `).bind(body.forward_mode, webhookId).run()

    return c.json({
      success: true,
      message: `Forward mode updated to '${body.forward_mode}' for webhook`,
      webhook_id: webhookId,
      forward_mode: body.forward_mode,
      description: body.forward_mode === 'first-match'
        ? 'Leads will forward to first matching rule only (prevents duplicates)'
        : 'Leads will forward to all matching rules (useful for analytics)',
      forwarding_enabled: webhook.forwarding_enabled === 1,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating forward mode:', error)
    return c.json({
      success: false,
      error: 'Failed to update forward mode',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// GET /webhook/:webhookId/forwarding-log
// Get forwarding activity log with filters
// ============================================================================
leadForwardingRouter.get('/:webhookId/forwarding-log', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')
    
    // Query parameters for filtering
    const status = c.req.query('status')
    const fromDate = c.req.query('from_date')
    const toDate = c.req.query('to_date')
    const limit = parseInt(c.req.query('limit') || '50')

    // Build query dynamically
    const conditions = ['source_webhook_id = ?']
    const values: any[] = [webhookId]

    if (status) {
      conditions.push('forward_status = ?')
      values.push(status)
    }
    if (fromDate) {
      conditions.push('forwarded_at >= ?')
      values.push(fromDate)
    }
    if (toDate) {
      conditions.push('forwarded_at <= ?')
      values.push(toDate)
    }

    values.push(limit)

    const { results } = await db.prepare(`
      SELECT * FROM lead_forwarding_log
      WHERE ${conditions.join(' AND ')}
      ORDER BY forwarded_at DESC
      LIMIT ?
    `).bind(...values).all()

    return c.json({
      success: true,
      webhook_id: webhookId,
      total_logs: results.length,
      filters: { status, from_date: fromDate, to_date: toDate, limit },
      logs: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching forwarding log:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch forwarding log',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// ============================================================================
// GET /webhook/:webhookId/forwarding-stats
// Get forwarding statistics
// ============================================================================
leadForwardingRouter.get('/:webhookId/forwarding-stats', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const webhookId = c.req.param('webhookId')

    // Get statistics from view
    const stats = await db.prepare(`
      SELECT * FROM v_forwarding_stats
      WHERE source_webhook_id = ?
    `).bind(webhookId).first()

    if (!stats) {
      return c.json({
        success: true,
        webhook_id: webhookId,
        stats: {
          total_forwards: 0,
          success_count: 0,
          failed_count: 0,
          success_rate: 0,
          last_forward_at: null
        },
        timestamp: new Date().toISOString()
      })
    }

    // Get top target webhooks
    const { results: topTargets } = await db.prepare(`
      SELECT 
        target_webhook_id,
        COUNT(*) as forward_count,
        SUM(CASE WHEN forward_status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM lead_forwarding_log
      WHERE source_webhook_id = ?
      GROUP BY target_webhook_id
      ORDER BY forward_count DESC
      LIMIT 5
    `).bind(webhookId).all()

    return c.json({
      success: true,
      webhook_id: webhookId,
      stats: {
        total_forwards: stats.total_forwards,
        success_count: stats.success_count,
        failed_count: stats.failed_count,
        success_rate: stats.success_rate,
        last_forward_at: stats.last_forward_at
      },
      top_targets: topTargets,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching forwarding stats:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch forwarding stats',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export { leadForwardingRouter }

