import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

type Bindings = {
  LEADS_DB: D1Database
}

const routingRulesRouter = new Hono<{ Bindings: Bindings }>()

// Type definitions
interface RoutingRuleRequest {
  workspace_id: string
  product_types: string[]     // ["Kitchen", "Bath", "Solar"]
  zip_codes: string[]         // ["90210", "90211", "90212"]
  priority?: number
  is_active?: boolean
  notes?: string
}

interface RoutingRuleBulkRequest {
  workspace_id: string
  product_types: string[]
  zip_codes_csv?: string      // CSV format: "90210,90211,90212"
  zip_codes_file?: string     // Base64 encoded CSV file
  priority?: number
  is_active?: boolean
  notes?: string
}

// POST /routing-rules - Create new routing rule
routingRulesRouter.post('/', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const body = await c.req.json<RoutingRuleRequest>()

    // Validate required fields
    if (!body.workspace_id || !body.product_types || !Array.isArray(body.product_types) ||
        !body.zip_codes || !Array.isArray(body.zip_codes)) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        required: ['workspace_id', 'product_types', 'zip_codes'],
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Verify workspace exists
    const workspace = await db.prepare(`
      SELECT id, name FROM workspaces WHERE id = ? AND is_active = 1
    `).bind(body.workspace_id).first()

    if (!workspace) {
      return c.json({
        success: false,
        error: 'Workspace not found or inactive',
        workspace_id: body.workspace_id,
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Set priority if not provided (get next available priority)
    let priority = body.priority
    if (!priority) {
      const maxPriority = await db.prepare(`
        SELECT MAX(priority) as max_priority
        FROM appointment_routing_rules
        WHERE workspace_id = ?
      `).bind(body.workspace_id).first()

      priority = (maxPriority?.max_priority as number || 0) + 1
    }

    // Create routing rule
    const result = await db.prepare(`
      INSERT INTO appointment_routing_rules (
        workspace_id, product_types, zip_codes, priority,
        is_active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      body.workspace_id,
      JSON.stringify(body.product_types),
      JSON.stringify(body.zip_codes),
      priority,
      body.is_active !== false, // Default to true
      body.notes || null
    ).run()

    const ruleId = result.meta.last_row_id

    return c.json({
      success: true,
      message: 'Routing rule created successfully',
      rule: {
        id: ruleId,
        workspace_id: body.workspace_id,
        workspace_name: workspace.name,
        product_types: body.product_types,
        zip_codes: body.zip_codes,
        priority,
        is_active: body.is_active !== false,
        notes: body.notes,
        zip_count: body.zip_codes.length,
        product_count: body.product_types.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating routing rule:', error)
    return c.json({
      success: false,
      error: 'Failed to create routing rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// POST /routing-rules/bulk - Create routing rule with CSV zip codes
routingRulesRouter.post('/bulk', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const body = await c.req.json<RoutingRuleBulkRequest>()

    // Validate required fields
    if (!body.workspace_id || !body.product_types || !Array.isArray(body.product_types)) {
      return c.json({
        success: false,
        error: 'Missing required fields',
        required: ['workspace_id', 'product_types', 'zip_codes_csv or zip_codes_file'],
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

    // Process uploaded CSV file
    if (body.zip_codes_file && !zipCodes.length) {
      try {
        const csvData = atob(body.zip_codes_file)
        const lines = csvData.split('\n')

        for (const line of lines) {
          const zips = line.split(',').map((zip: string) => zip.trim()).filter((zip: string) => zip.length > 0)
          zipCodes.push(...zips)
        }

        // Remove duplicates
        zipCodes = [...new Set(zipCodes)]
      } catch (error) {
        return c.json({
          success: false,
          error: 'Failed to parse CSV file',
          details: 'Invalid base64 or CSV format',
          timestamp: new Date().toISOString()
        }, 400)
      }
    }

    if (!zipCodes.length) {
      return c.json({
        success: false,
        error: 'No zip codes provided',
        message: 'Provide zip codes via zip_codes_csv or zip_codes_file',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Validate zip codes (basic format check)
    const invalidZips = zipCodes.filter(zip => !/^\d{5}(-\d{4})?$/.test(zip))
    if (invalidZips.length > 0) {
      return c.json({
        success: false,
        error: 'Invalid zip code format',
        invalid_zips: invalidZips.slice(0, 10), // Show first 10 invalid zips
        message: 'Zip codes should be 5 digits (12345) or 9 digits (12345-6789)',
        timestamp: new Date().toISOString()
      }, 400)
    }

    // Verify workspace exists
    const workspace = await db.prepare(`
      SELECT id, name FROM workspaces WHERE id = ? AND is_active = 1
    `).bind(body.workspace_id).first()

    if (!workspace) {
      return c.json({
        success: false,
        error: 'Workspace not found or inactive',
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Get next priority
    const maxPriority = await db.prepare(`
      SELECT MAX(priority) as max_priority
      FROM appointment_routing_rules
      WHERE workspace_id = ?
    `).bind(body.workspace_id).first()

    const priority = body.priority || (maxPriority?.max_priority as number || 0) + 1

    // Create routing rule
    const result = await db.prepare(`
      INSERT INTO appointment_routing_rules (
        workspace_id, product_types, zip_codes, priority,
        is_active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      body.workspace_id,
      JSON.stringify(body.product_types),
      JSON.stringify(zipCodes),
      priority,
      body.is_active !== false,
      body.notes || null
    ).run()

    return c.json({
      success: true,
      message: 'Bulk routing rule created successfully',
      rule: {
        id: result.meta.last_row_id,
        workspace_id: body.workspace_id,
        workspace_name: workspace.name,
        product_types: body.product_types,
        zip_count: zipCodes.length,
        product_count: body.product_types.length,
        priority,
        is_active: body.is_active !== false,
        notes: body.notes,
        sample_zips: zipCodes.slice(0, 10) // Show first 10 zips as sample
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating bulk routing rule:', error)
    return c.json({
      success: false,
      error: 'Failed to create bulk routing rule',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// GET /routing-rules/:workspace_id - Get routing rules for workspace
routingRulesRouter.get('/:workspace_id', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const workspaceId = c.req.param('workspace_id')

    const rules = await db.prepare(`
      SELECT
        r.*,
        w.name as workspace_name
      FROM appointment_routing_rules r
      LEFT JOIN workspaces w ON r.workspace_id = w.id
      WHERE r.workspace_id = ?
      ORDER BY r.priority ASC, r.created_at DESC
    `).bind(workspaceId).all()

    // Parse JSON fields and add counts
    const parsedRules = rules.results.map((rule: any) => ({
      ...rule,
      product_types: JSON.parse(rule.product_types),
      zip_codes: JSON.parse(rule.zip_codes),
      zip_count: JSON.parse(rule.zip_codes).length,
      product_count: JSON.parse(rule.product_types).length
    }))

    return c.json({
      success: true,
      workspace_id: workspaceId,
      rules: parsedRules,
      total_rules: parsedRules.length,
      active_rules: parsedRules.filter(rule => rule.is_active).length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching routing rules:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch routing rules',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// GET /routing-rules - Get all routing rules
routingRulesRouter.get('/', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const activeOnly = c.req.query('active_only') === 'true'

    let query = `
      SELECT
        r.*,
        w.name as workspace_name
      FROM appointment_routing_rules r
      LEFT JOIN workspaces w ON r.workspace_id = w.id
    `

    if (activeOnly) {
      query += ' WHERE r.is_active = 1'
    }

    query += ' ORDER BY r.workspace_id, r.priority ASC'

    const rules = await db.prepare(query).all()

    // Parse JSON fields and add counts
    const parsedRules = rules.results.map((rule: any) => ({
      ...rule,
      product_types: JSON.parse(rule.product_types),
      zip_codes: JSON.parse(rule.zip_codes),
      zip_count: JSON.parse(rule.zip_codes).length,
      product_count: JSON.parse(rule.product_types).length
    }))

    return c.json({
      success: true,
      rules: parsedRules,
      total_rules: parsedRules.length,
      active_rules: parsedRules.filter(rule => rule.is_active).length,
      filters: {
        active_only: activeOnly
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching all routing rules:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch routing rules',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// PUT /routing-rules/:id - Update routing rule
routingRulesRouter.put('/:id', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const ruleId = parseInt(c.req.param('id'))
    const body = await c.req.json<Partial<RoutingRuleRequest>>()

    // Verify rule exists
    const existingRule = await db.prepare(`
      SELECT * FROM appointment_routing_rules WHERE id = ?
    `).bind(ruleId).first()

    if (!existingRule) {
      return c.json({
        success: false,
        error: 'Routing rule not found',
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Build update query dynamically
    const updates: string[] = []
    const params: any[] = []

    if (body.product_types && Array.isArray(body.product_types)) {
      updates.push('product_types = ?')
      params.push(JSON.stringify(body.product_types))
    }

    if (body.zip_codes && Array.isArray(body.zip_codes)) {
      updates.push('zip_codes = ?')
      params.push(JSON.stringify(body.zip_codes))
    }

    if (body.priority !== undefined) {
      updates.push('priority = ?')
      params.push(body.priority)
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?')
      params.push(body.is_active)
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?')
      params.push(body.notes)
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No fields to update',
        timestamp: new Date().toISOString()
      }, 400)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(ruleId)

    await db.prepare(`
      UPDATE appointment_routing_rules
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run()

    // Get updated rule
    const updatedRule = await db.prepare(`
      SELECT
        r.*,
        w.name as workspace_name
      FROM appointment_routing_rules r
      LEFT JOIN workspaces w ON r.workspace_id = w.id
      WHERE r.id = ?
    `).bind(ruleId).first()

    return c.json({
      success: true,
      message: 'Routing rule updated successfully',
      rule: {
        ...updatedRule,
        product_types: JSON.parse(updatedRule?.product_types as string),
        zip_codes: JSON.parse(updatedRule?.zip_codes as string)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating routing rule:', error)
    return c.json({
      success: false,
      error: 'Failed to update routing rule',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

// DELETE /routing-rules/:id - Delete routing rule
routingRulesRouter.delete('/:id', async (c) => {
  try {
    const db = c.env.LEADS_DB
    const ruleId = parseInt(c.req.param('id'))

    // Verify rule exists
    const rule = await db.prepare(`
      SELECT id, workspace_id FROM appointment_routing_rules WHERE id = ?
    `).bind(ruleId).first()

    if (!rule) {
      return c.json({
        success: false,
        error: 'Routing rule not found',
        timestamp: new Date().toISOString()
      }, 404)
    }

    // Delete the rule
    await db.prepare(`
      DELETE FROM appointment_routing_rules WHERE id = ?
    `).bind(ruleId).run()

    return c.json({
      success: true,
      message: 'Routing rule deleted successfully',
      deleted_rule_id: ruleId,
      workspace_id: rule.workspace_id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting routing rule:', error)
    return c.json({
      success: false,
      error: 'Failed to delete routing rule',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

export { routingRulesRouter }