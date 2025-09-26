import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { D1Database } from '@cloudflare/workers-types'

// Simple function to generate API key
function generateApiKey(): string {
  return 'ws_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

type Bindings = {
  LEADS_DB: D1Database
}

const conversionsRouter = new Hono<{ Bindings: Bindings }>()

// Type definitions
interface ConversionLogRequest {
  contact_id: number
  lead_id?: number
  workspace_id: string
  converted_by: string
  conversion_type: 'sale' | 'appointment' | 'qualified' | 'proposal' | 'contract'
  conversion_value?: number
  currency?: string
  custom_data?: Record<string, any>
}

interface ContactConversionUpdate {
  sent_from_workspace?: string
  converted_from_workspace?: string
  conversion_status?: 'pending' | 'qualified' | 'converted' | 'rejected'
  converted_by?: string
  custom_metadata?: Record<string, any>
  qualification_score?: number
}

interface WorkspaceActivityLog {
  contact_id: number
  lead_id?: number
  workspace_id: string
  action: 'sent' | 'received' | 'converted' | 'updated' | 'qualified' | 'rejected'
  action_details?: string
  performed_by?: string
  metadata?: Record<string, any>
}

// Helper function to validate workspace API key
async function validateWorkspace(db: D1Database, workspaceId: string, apiKey: string): Promise<boolean> {
  const workspace = await db.prepare(`
    SELECT id, is_active FROM workspaces WHERE id = ? AND api_key = ?
  `).bind(workspaceId, apiKey).first()

  return workspace !== null && workspace.is_active === 1
}

// POST /conversions/log - Log a new conversion
conversionsRouter.post('/log', async (c) => {
  try {
    const body = await c.req.json<ConversionLogRequest>()
    const db = c.env.LEADS_DB

    // Validate workspace from headers
    const workspaceId = c.req.header('X-Workspace-ID') || body.workspace_id
    const apiKey = c.req.header('X-API-Key')

    if (!workspaceId || !apiKey) {
      return c.json({
        success: false,
        error: 'Missing workspace credentials'
      }, 401)
    }

    const isValid = await validateWorkspace(db, workspaceId, apiKey)
    if (!isValid) {
      return c.json({
        success: false,
        error: 'Invalid workspace credentials'
      }, 401)
    }

    // Validate required fields
    if (!body.contact_id || !body.converted_by || !body.conversion_type) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400)
    }

    // Generate conversion ID
    const conversionId = uuidv4()
    const now = new Date().toISOString()

    // Start transaction
    const statements = []

    // Insert conversion record
    statements.push(db.prepare(`
      INSERT INTO conversions (
        id, contact_id, lead_id, workspace_id, converted_by,
        converted_at, conversion_type, conversion_value, currency,
        custom_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      conversionId,
      body.contact_id,
      body.lead_id || null,
      workspaceId,
      body.converted_by,
      now,
      body.conversion_type,
      body.conversion_value || null,
      body.currency || 'USD',
      body.custom_data ? JSON.stringify(body.custom_data) : null,
      now
    ))

    // Update contact with conversion info
    statements.push(db.prepare(`
      UPDATE contacts SET
        conversion_status = 'converted',
        converted_from_workspace = ?,
        converted_timestamp = ?,
        converted_by = ?,
        conversion_count = conversion_count + 1,
        lifetime_value = lifetime_value + COALESCE(?, 0),
        last_conversion_id = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      workspaceId,
      now,
      body.converted_by,
      body.conversion_value || 0,
      conversionId,
      now,
      body.contact_id
    ))

    // Update lead if provided
    if (body.lead_id) {
      statements.push(db.prepare(`
        UPDATE leads SET
          status = 'converted',
          conversion_id = ?,
          workspace_status = 'converted',
          updated_at = ?
        WHERE id = ?
      `).bind(conversionId, now, body.lead_id))
    }

    // Log workspace activity
    statements.push(db.prepare(`
      INSERT INTO workspace_tracking (
        contact_id, lead_id, workspace_id, action,
        action_details, performed_by, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.contact_id,
      body.lead_id || null,
      workspaceId,
      'converted',
      `${body.conversion_type} conversion logged`,
      body.converted_by,
      JSON.stringify({
        conversion_id: conversionId,
        conversion_value: body.conversion_value,
        conversion_type: body.conversion_type
      })
    ))

    // Execute transaction
    const results = await db.batch(statements)

    return c.json({
      success: true,
      conversion: {
        id: conversionId,
        contact_id: body.contact_id,
        lead_id: body.lead_id,
        workspace_id: workspaceId,
        conversion_type: body.conversion_type,
        conversion_value: body.conversion_value,
        converted_at: now
      }
    })

  } catch (error) {
    console.error('Error logging conversion:', error)
    return c.json({
      success: false,
      error: 'Failed to log conversion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// PATCH /conversions/contacts/:id - Update contact conversion status
conversionsRouter.patch('/contacts/:id', async (c) => {
  try {
    const contactId = c.req.param('id')
    const body = await c.req.json<ContactConversionUpdate>()
    const db = c.env.LEADS_DB

    // Validate workspace
    const workspaceId = c.req.header('X-Workspace-ID')
    const apiKey = c.req.header('X-API-Key')

    if (!workspaceId || !apiKey) {
      return c.json({
        success: false,
        error: 'Missing workspace credentials'
      }, 401)
    }

    const isValid = await validateWorkspace(db, workspaceId, apiKey)
    if (!isValid) {
      return c.json({
        success: false,
        error: 'Invalid workspace credentials'
      }, 401)
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (body.sent_from_workspace !== undefined) {
      updates.push('sent_from_workspace = ?')
      values.push(body.sent_from_workspace)
    }

    if (body.converted_from_workspace !== undefined) {
      updates.push('converted_from_workspace = ?')
      values.push(body.converted_from_workspace)
    }

    if (body.conversion_status !== undefined) {
      updates.push('conversion_status = ?')
      values.push(body.conversion_status)
    }

    if (body.converted_by !== undefined) {
      updates.push('converted_by = ?')
      values.push(body.converted_by)

      // Also set converted timestamp
      updates.push('converted_timestamp = ?')
      values.push(new Date().toISOString())
    }

    if (body.custom_metadata !== undefined) {
      updates.push('custom_metadata = ?')
      values.push(JSON.stringify(body.custom_metadata))
    }

    if (body.qualification_score !== undefined) {
      updates.push('qualification_score = ?')
      values.push(body.qualification_score)
    }

    // Add updated_at
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())

    // Add contact ID to values
    values.push(contactId)

    // Execute update
    const result = await db.prepare(`
      UPDATE contacts SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()

    // Log workspace activity
    await db.prepare(`
      INSERT INTO workspace_tracking (
        contact_id, workspace_id, action, action_details, performed_by, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      contactId,
      workspaceId,
      'updated',
      'Contact conversion status updated',
      body.converted_by || 'system',
      JSON.stringify(body)
    ).run()

    return c.json({
      success: true,
      contact_id: contactId,
      updates_applied: result.meta.changes > 0
    })

  } catch (error) {
    console.error('Error updating contact:', error)
    return c.json({
      success: false,
      error: 'Failed to update contact',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /conversions - Query conversions with filters
conversionsRouter.get('/', async (c) => {
  try {
    const db = c.env.LEADS_DB

    // Get query parameters
    const workspaceId = c.req.query('workspace_id')
    const contactId = c.req.query('contact_id')
    const leadId = c.req.query('lead_id')
    const conversionType = c.req.query('conversion_type')
    const fromDate = c.req.query('from_date')
    const toDate = c.req.query('to_date')
    const minValue = c.req.query('min_value')
    const maxValue = c.req.query('max_value')
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')

    // Build query
    let query = `
      SELECT
        c.*,
        ct.first_name,
        ct.last_name,
        ct.email,
        ct.phone,
        w.name as workspace_name
      FROM conversions c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN workspaces w ON c.workspace_id = w.id
      WHERE 1=1
    `

    const params: any[] = []

    if (workspaceId) {
      query += ' AND c.workspace_id = ?'
      params.push(workspaceId)
    }

    if (contactId) {
      query += ' AND c.contact_id = ?'
      params.push(contactId)
    }

    if (leadId) {
      query += ' AND c.lead_id = ?'
      params.push(leadId)
    }

    if (conversionType) {
      query += ' AND c.conversion_type = ?'
      params.push(conversionType)
    }

    if (fromDate) {
      query += ' AND c.converted_at >= ?'
      params.push(fromDate)
    }

    if (toDate) {
      query += ' AND c.converted_at <= ?'
      params.push(toDate)
    }

    if (minValue) {
      query += ' AND c.conversion_value >= ?'
      params.push(parseFloat(minValue))
    }

    if (maxValue) {
      query += ' AND c.conversion_value <= ?'
      params.push(parseFloat(maxValue))
    }

    query += ' ORDER BY c.converted_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    // Execute query
    const conversions = await db.prepare(query).bind(...params).all()

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM conversions c WHERE 1=1
    `
    const countParams = params.slice(0, -2) // Remove limit and offset

    if (workspaceId) countQuery += ' AND c.workspace_id = ?'
    if (contactId) countQuery += ' AND c.contact_id = ?'
    if (leadId) countQuery += ' AND c.lead_id = ?'
    if (conversionType) countQuery += ' AND c.conversion_type = ?'
    if (fromDate) countQuery += ' AND c.converted_at >= ?'
    if (toDate) countQuery += ' AND c.converted_at <= ?'
    if (minValue) countQuery += ' AND c.conversion_value >= ?'
    if (maxValue) countQuery += ' AND c.conversion_value <= ?'

    const totalResult = await db.prepare(countQuery).bind(...countParams).first()

    return c.json({
      success: true,
      conversions: conversions.results.map(conv => ({
        ...conv,
        custom_data: conv.custom_data ? JSON.parse(conv.custom_data as string) : null
      })),
      pagination: {
        total: totalResult?.total || 0,
        limit,
        offset,
        has_more: offset + limit < ((totalResult?.total as number) || 0)
      }
    })

  } catch (error) {
    console.error('Error querying conversions:', error)
    return c.json({
      success: false,
      error: 'Failed to query conversions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /conversions/analytics - Get conversion analytics
conversionsRouter.get('/analytics', async (c) => {
  try {
    const db = c.env.LEADS_DB

    // Get query parameters
    const workspaceId = c.req.query('workspace_id')
    const fromDate = c.req.query('from_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const toDate = c.req.query('to_date') || new Date().toISOString()
    const groupBy = c.req.query('group_by') || 'day' // day, week, month

    // Get summary statistics
    let summaryQuery = `
      SELECT
        COUNT(*) as total_conversions,
        SUM(conversion_value) as total_value,
        AVG(conversion_value) as average_value,
        COUNT(DISTINCT contact_id) as unique_contacts,
        COUNT(DISTINCT workspace_id) as active_workspaces
      FROM conversions
      WHERE converted_at BETWEEN ? AND ?
    `
    const summaryParams = [fromDate, toDate]

    if (workspaceId) {
      summaryQuery += ' AND workspace_id = ?'
      summaryParams.push(workspaceId)
    }

    const summary = await db.prepare(summaryQuery).bind(...summaryParams).first()

    // Get conversions by type
    let byTypeQuery = `
      SELECT
        conversion_type,
        COUNT(*) as count,
        SUM(conversion_value) as total_value,
        AVG(conversion_value) as avg_value
      FROM conversions
      WHERE converted_at BETWEEN ? AND ?
    `
    const byTypeParams = [fromDate, toDate]

    if (workspaceId) {
      byTypeQuery += ' AND workspace_id = ?'
      byTypeParams.push(workspaceId)
    }

    byTypeQuery += ' GROUP BY conversion_type'

    const byType = await db.prepare(byTypeQuery).bind(...byTypeParams).all()

    // Get conversions by workspace
    const byWorkspace = await db.prepare(`
      SELECT
        w.id as workspace_id,
        w.name as workspace_name,
        COUNT(c.id) as conversions,
        SUM(c.conversion_value) as total_value,
        AVG(c.conversion_value) as avg_value,
        COUNT(DISTINCT c.contact_id) as unique_contacts
      FROM workspaces w
      LEFT JOIN conversions c ON w.id = c.workspace_id
        AND c.converted_at BETWEEN ? AND ?
      GROUP BY w.id, w.name
      HAVING conversions > 0
      ORDER BY total_value DESC
    `).bind(fromDate, toDate).all()

    // Get trend data based on groupBy parameter
    let trendQuery = ''
    if (groupBy === 'day') {
      trendQuery = `
        SELECT
          DATE(converted_at) as period,
          COUNT(*) as conversions,
          SUM(conversion_value) as total_value
        FROM conversions
        WHERE converted_at BETWEEN ? AND ?
      `
    } else if (groupBy === 'week') {
      trendQuery = `
        SELECT
          strftime('%Y-W%W', converted_at) as period,
          COUNT(*) as conversions,
          SUM(conversion_value) as total_value
        FROM conversions
        WHERE converted_at BETWEEN ? AND ?
      `
    } else { // month
      trendQuery = `
        SELECT
          strftime('%Y-%m', converted_at) as period,
          COUNT(*) as conversions,
          SUM(conversion_value) as total_value
        FROM conversions
        WHERE converted_at BETWEEN ? AND ?
      `
    }

    const trendParams = [fromDate, toDate]
    if (workspaceId) {
      trendQuery += ' AND workspace_id = ?'
      trendParams.push(workspaceId)
    }
    trendQuery += ' GROUP BY period ORDER BY period'

    const trends = await db.prepare(trendQuery).bind(...trendParams).all()

    // Calculate conversion rate
    const totalLeadsQuery = await db.prepare(`
      SELECT COUNT(*) as total FROM leads
      WHERE created_at BETWEEN ? AND ?
    `).bind(fromDate, toDate).first()

    const conversionRate = totalLeadsQuery?.total
      ? (((summary?.total_conversions as number) || 0) / (totalLeadsQuery.total as number)) * 100
      : 0

    return c.json({
      success: true,
      analytics: {
        summary: {
          total_conversions: summary?.total_conversions || 0,
          total_value: summary?.total_value || 0,
          average_value: summary?.average_value || 0,
          unique_contacts: summary?.unique_contacts || 0,
          active_workspaces: summary?.active_workspaces || 0,
          conversion_rate: conversionRate.toFixed(2)
        },
        by_type: byType.results,
        by_workspace: byWorkspace.results,
        trends: trends.results,
        filters: {
          workspace_id: workspaceId || null,
          from_date: fromDate,
          to_date: toDate,
          group_by: groupBy
        }
      }
    })

  } catch (error) {
    console.error('Error getting analytics:', error)
    return c.json({
      success: false,
      error: 'Failed to get analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /conversions/funnel - Get conversion funnel data
conversionsRouter.get('/funnel', async (c) => {
  try {
    const db = c.env.LEADS_DB

    const workspaceId = c.req.query('workspace_id')
    const fromDate = c.req.query('from_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const toDate = c.req.query('to_date') || new Date().toISOString()

    // Build funnel query
    let funnelQuery = `
      SELECT
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT CASE WHEN l.status = 'contacted' THEN l.id END) as contacted,
        COUNT(DISTINCT CASE WHEN l.status = 'qualified' THEN l.id END) as qualified,
        COUNT(DISTINCT CASE WHEN l.status = 'converted' THEN l.id END) as converted,
        COUNT(DISTINCT c.lead_id) as has_conversion_record
      FROM leads l
      LEFT JOIN conversions c ON l.id = c.lead_id
      WHERE l.created_at BETWEEN ? AND ?
    `

    const params = [fromDate, toDate]
    if (workspaceId) {
      funnelQuery += ' AND l.workspace_id = ?'
      params.push(workspaceId)
    }

    const funnel = await db.prepare(funnelQuery).bind(...params).first()

    return c.json({
      success: true,
      funnel: {
        stages: [
          {
            name: 'Leads Received',
            count: funnel?.total_leads || 0,
            percentage: 100
          },
          {
            name: 'Contacted',
            count: funnel?.contacted || 0,
            percentage: funnel?.total_leads ? (((funnel?.contacted as number) || 0) / (funnel.total_leads as number)) * 100 : 0
          },
          {
            name: 'Qualified',
            count: funnel?.qualified || 0,
            percentage: funnel?.total_leads ? (((funnel?.qualified as number) || 0) / (funnel.total_leads as number)) * 100 : 0
          },
          {
            name: 'Converted',
            count: funnel?.converted || 0,
            percentage: funnel?.total_leads ? (((funnel?.converted as number) || 0) / (funnel.total_leads as number)) * 100 : 0
          }
        ],
        conversion_rate: funnel?.total_leads ? (((funnel?.converted as number) || 0) / (funnel.total_leads as number)) * 100 : 0,
        filters: {
          workspace_id: workspaceId || null,
          from_date: fromDate,
          to_date: toDate
        }
      }
    })

  } catch (error) {
    console.error('Error getting funnel data:', error)
    return c.json({
      success: false,
      error: 'Failed to get funnel data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// POST /conversions/workspace/register - Register a new workspace (for testing)
conversionsRouter.post('/workspace/register', async (c) => {
  try {
    const body = await c.req.json<{
      workspace_id: string
      name: string
      permissions?: string[]
    }>()
    const db = c.env.LEADS_DB

    if (!body.workspace_id || !body.name) {
      return c.json({
        success: false,
        error: 'Missing workspace_id or name'
      }, 400)
    }

    const apiKey = generateApiKey()

    const result = await db.prepare(`
      INSERT INTO workspaces (id, name, api_key, permissions, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      body.workspace_id,
      body.name,
      apiKey,
      JSON.stringify(body.permissions || ['read', 'write', 'convert']),
      1,
      new Date().toISOString()
    ).run()

    return c.json({
      success: true,
      workspace: {
        id: body.workspace_id,
        name: body.name,
        api_key: apiKey,
        permissions: body.permissions || ['read', 'write', 'convert']
      }
    })

  } catch (error) {
    console.error('Error registering workspace:', error)
    return c.json({
      success: false,
      error: 'Failed to register workspace',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// DELETE /conversions/workspace/:workspaceId - Delete a workspace
conversionsRouter.delete('/workspace/:workspaceId', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId')
    const db = c.env.LEADS_DB

    // Check if workspace exists
    const workspace = await db.prepare(`
      SELECT id, name FROM workspaces WHERE id = ?
    `).bind(workspaceId).first()

    if (!workspace) {
      return c.json({
        success: false,
        error: 'Workspace not found',
        workspace_id: workspaceId
      }, 404)
    }

    // Check if workspace has any routing rules
    const routingRules = await db.prepare(`
      SELECT COUNT(*) as count FROM appointment_routing_rules WHERE workspace_id = ?
    `).bind(workspaceId).first()

    if (routingRules && (routingRules.count as number) > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete workspace with active routing rules',
        message: 'Please delete all routing rules for this workspace first',
        routing_rules_count: routingRules.count
      }, 400)
    }

    // Check if workspace has any appointments
    const appointments = await db.prepare(`
      SELECT COUNT(*) as count FROM appointments WHERE matched_workspace_id = ?
    `).bind(workspaceId).first()

    if (appointments && (appointments.count as number) > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete workspace with appointments',
        message: 'This workspace has appointments assigned to it. Consider deactivating instead of deleting.',
        appointments_count: appointments.count
      }, 400)
    }

    // Delete workspace tracking records first (foreign key cleanup)
    try {
      await db.prepare(`
        DELETE FROM workspace_tracking WHERE workspace_id = ?
      `).bind(workspaceId).run()
    } catch (error) {
      // Ignore if table doesn't exist
      console.log('workspace_tracking table may not exist:', error)
    }

    // Delete conversion logs
    try {
      await db.prepare(`
        DELETE FROM conversion_logs WHERE workspace_id = ?
      `).bind(workspaceId).run()
    } catch (error) {
      // Ignore if table doesn't exist
      console.log('conversion_logs table may not exist:', error)
    }

    // Delete the workspace
    const deleteResult = await db.prepare(`
      DELETE FROM workspaces WHERE id = ?
    `).bind(workspaceId).run()

    if (deleteResult.meta.changes === 0) {
      return c.json({
        success: false,
        error: 'Failed to delete workspace',
        message: 'No changes made to database'
      }, 500)
    }

    return c.json({
      success: true,
      message: 'Workspace deleted successfully',
      deleted_workspace: {
        id: workspace.id,
        name: workspace.name
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error deleting workspace:', error)
    return c.json({
      success: false,
      error: 'Failed to delete workspace',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /conversions/workspaces - List all workspaces
conversionsRouter.get('/workspaces', async (c) => {
  try {
    const db = c.env.LEADS_DB

    const workspaces = await db.prepare(`
      SELECT
        id,
        name,
        is_active,
        outbound_webhook_url,
        webhook_active,
        created_at,
        updated_at
      FROM workspaces
      ORDER BY name ASC
    `).all()

    return c.json({
      success: true,
      workspaces: workspaces.results || [],
      total_workspaces: workspaces.results?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching workspaces:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch workspaces',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// PUT /conversions/workspace/:workspaceId/webhook - Update workspace webhook settings
conversionsRouter.put('/workspace/:workspaceId/webhook', async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId')
    const db = c.env.LEADS_DB
    const body = await c.req.json<{
      outbound_webhook_url: string
      webhook_active: boolean
    }>()

    // Check if workspace exists
    const workspace = await db.prepare(`
      SELECT id, name FROM workspaces WHERE id = ?
    `).bind(workspaceId).first()

    if (!workspace) {
      return c.json({
        success: false,
        error: 'Workspace not found',
        workspace_id: workspaceId
      }, 404)
    }

    // Validate webhook URL if provided
    if (body.outbound_webhook_url && body.outbound_webhook_url.trim()) {
      try {
        new URL(body.outbound_webhook_url)
      } catch (error) {
        return c.json({
          success: false,
          error: 'Invalid webhook URL',
          message: 'Please provide a valid HTTP/HTTPS URL'
        }, 400)
      }
    }

    // Update workspace webhook settings
    const updateResult = await db.prepare(`
      UPDATE workspaces
      SET
        outbound_webhook_url = ?,
        webhook_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.outbound_webhook_url || null,
      body.webhook_active ? 1 : 0,
      workspaceId
    ).run()

    if (updateResult.meta.changes === 0) {
      return c.json({
        success: false,
        error: 'Failed to update workspace',
        message: 'No changes made to database'
      }, 500)
    }

    // Get updated workspace
    const updatedWorkspace = await db.prepare(`
      SELECT
        id,
        name,
        is_active,
        outbound_webhook_url,
        webhook_active,
        updated_at
      FROM workspaces
      WHERE id = ?
    `).bind(workspaceId).first()

    return c.json({
      success: true,
      message: 'Workspace webhook settings updated successfully',
      workspace: {
        ...updatedWorkspace,
        webhook_active: updatedWorkspace?.webhook_active === 1
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error updating workspace webhook settings:', error)
    return c.json({
      success: false,
      error: 'Failed to update workspace webhook settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default conversionsRouter