import { D1Database } from '@cloudflare/workers-types';
import { generateLeadId, generateUniqueId } from '../utils/idGenerator';

export interface LeadRecord {
  contact_id?: number; // Link to contacts table
  webhook_id: string;
  lead_type: string;
  first_name: string;
  last_name: string;
  email?: string; // Make email optional to match schema validation
  phone?: string;
  address?: string;
  address2?: string; // New field - apt, unit, suite
  city?: string;
  state?: string;
  zip_code?: string;
  source: string;

  // Business-specific fields (new)
  productid?: string; // Expected: Kitchen, Bath, Roofing, Basement Waterproofing, Solar
  subsource?: string; // Specific campaign, affiliate, or channel
  landing_page_url?: string; // Page URL where form was submitted
  consent_description?: string; // Full SMS/marketing consent language
  consent_value?: boolean; // true = consent given, false = not given
  tcpa_compliance?: boolean; // Was TCPA language shown & agreed to
  campaign_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  monthly_electric_bill?: number;
  property_type?: string;
  roof_condition?: string;
  roof_age?: number;
  shade_coverage?: string;
  system_type?: string;
  system_age?: number;
  service_type?: string;
  urgency?: string;
  property_size?: number;
  policy_type?: string;
  coverage_amount?: number;
  current_premium?: number;
  property_value?: number;
  claims_history?: string;
  raw_payload: string;
  ip_address?: string;
  user_agent?: string;
  status?: string;
  conversion_score?: number;
  revenue_potential?: number;
}

export class LeadDatabase {
  constructor(private db: D1Database) {}

  async saveLead(lead: LeadRecord): Promise<number> {
    // Generate unique 10-digit lead ID
    const leadId = await generateUniqueId(this.db, 'leads', generateLeadId)

    const stmt = await this.db.prepare(`
      INSERT INTO leads (
        id, contact_id, webhook_id, lead_type, first_name, last_name, email, phone,
        address, address2, city, state, zip_code, source, campaign_id,
        productid, subsource, landing_page_url, consent_description, consent_value, tcpa_compliance,
        utm_source, utm_medium, utm_campaign,
        monthly_electric_bill, property_type, roof_condition, roof_age, shade_coverage,
        system_type, system_age, service_type, urgency, property_size,
        policy_type, coverage_amount, current_premium, property_value, claims_history,
        raw_payload, ip_address, user_agent,
        created_at, updated_at, processed_at, status, notes,
        conversion_score, revenue_potential, status_changed_at, status_changed_by,
        priority, assigned_to, follow_up_date, contact_attempts
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `    ).bind(
      leadId, lead.contact_id || null, lead.webhook_id, lead.lead_type, lead.first_name, lead.last_name, lead.email || null, lead.phone || null,
      lead.address || null, lead.address2 || null, lead.city || null, lead.state || null, lead.zip_code || null,
      lead.source, lead.campaign_id || null,
      lead.productid || null, lead.subsource || null, lead.landing_page_url || null,
      lead.consent_description || null, lead.consent_value || null, lead.tcpa_compliance || null,
      lead.utm_source || null, lead.utm_medium || null, lead.utm_campaign || null,
      lead.monthly_electric_bill || null, lead.property_type || null, lead.roof_condition || null,
      lead.roof_age || null, lead.shade_coverage || null,
      lead.system_type || null, lead.system_age || null, lead.service_type || null,
      lead.urgency || null, lead.property_size || null,
      lead.policy_type || null, lead.coverage_amount || null, lead.current_premium || null,
      lead.property_value || null, lead.claims_history || null,
      lead.raw_payload, lead.ip_address || null, lead.user_agent || null,
      // Timestamp fields - let DB use defaults
      null, null, null, // created_at, updated_at, processed_at
      lead.status || 'new', null, // status, notes
      lead.conversion_score || null, lead.revenue_potential || null,
      null, null, // status_changed_at, status_changed_by
      1, null, null, 0 // priority (default 1), assigned_to, follow_up_date, contact_attempts (default 0)
    );

    const result = await stmt.run();

    // Update webhook statistics
    await this.updateWebhookStats(lead.webhook_id);

    // Log the event
    await this.logLeadEvent(leadId, 'created', { source: lead.source });

    return leadId;
  }

  async updateWebhookStats(webhookId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE webhook_configs
      SET total_leads = total_leads + 1,
          last_lead_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE webhook_id = ?
    `).bind(webhookId).run();
  }

  async logLeadEvent(leadId: number, eventType: string, eventData: any): Promise<void> {
    await this.db.prepare(`
      INSERT INTO lead_events (lead_id, event_type, event_data)
      VALUES (?, ?, ?)
    `).bind(leadId, eventType, JSON.stringify(eventData)).run();
  }

  async getWebhookConfig(webhookId: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT * FROM webhook_configs WHERE webhook_id = ? AND is_active = 1
    `).bind(webhookId).first();

    return result;
  }

  async getRecentLeads(webhookId?: string, limit: number = 100): Promise<any[]> {
    let query = `
      SELECT * FROM leads
      ${webhookId ? 'WHERE webhook_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const stmt = webhookId
      ? this.db.prepare(query).bind(webhookId, limit)
      : this.db.prepare(query).bind(limit);

    const result = await stmt.all();
    return result.results;
  }

  async getLeadsByStatusAndDateRange(params: {
    status?: string;
    webhookId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<any[]> {
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (params.status) {
      conditions.push('status = ?');
      bindings.push(params.status);
    }

    if (params.webhookId) {
      conditions.push('webhook_id = ?');
      bindings.push(params.webhookId);
    }

    if (params.fromDate) {
      conditions.push('created_at >= ?');
      bindings.push(params.fromDate);
    }

    if (params.toDate) {
      conditions.push('created_at <= ?');
      bindings.push(params.toDate + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 1000;

    const query = `
      SELECT * FROM leads
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    bindings.push(limit);

    const stmt = this.db.prepare(query).bind(...bindings);
    const result = await stmt.all();
    return result.results;
  }

  async getLeadStatistics(params: {
    status?: string;
    webhookId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<any> {
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (params.status) {
      conditions.push('status = ?');
      bindings.push(params.status);
    }

    if (params.webhookId) {
      conditions.push('webhook_id = ?');
      bindings.push(params.webhookId);
    }

    if (params.fromDate) {
      conditions.push('created_at >= ?');
      bindings.push(params.fromDate);
    }

    if (params.toDate) {
      conditions.push('created_at <= ?');
      bindings.push(params.toDate + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        COUNT(*) as total_count,
        COUNT(DISTINCT webhook_id) as unique_webhooks,
        COUNT(DISTINCT DATE(created_at)) as days_active,
        MIN(created_at) as first_lead_date,
        MAX(created_at) as last_lead_date,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified_count,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM leads
      ${whereClause}
    `;

    const stmt = this.db.prepare(query).bind(...bindings);
    const result = await stmt.first();
    return result;
  }

  async getLeadsByStatus(status: string, limit: number = 100): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM leads
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(status, limit).all();

    return result.results;
  }

  async updateLeadStatus(
    leadId: number,
    newStatus: string,
    options: {
      notes?: string;
      reason?: string;
      changedBy?: string;
      changedByName?: string;
      followUpDate?: string;
      assignedTo?: string;
      priority?: number;
    } = {}
  ): Promise<{ success: boolean; oldStatus?: string }> {

    // First, get the current status
    const currentLead = await this.db.prepare(`
      SELECT status, assigned_to FROM leads WHERE id = ?
    `).bind(leadId).first();

    if (!currentLead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    const oldStatus = (currentLead as any).status as string;

    // Update the lead with new status and metadata
    await this.db.prepare(`
      UPDATE leads
      SET status = ?,
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP,
          status_changed_at = CURRENT_TIMESTAMP,
          status_changed_by = ?,
          assigned_to = COALESCE(?, assigned_to),
          follow_up_date = COALESCE(?, follow_up_date),
          priority = COALESCE(?, priority),
          contact_attempts = CASE
            WHEN ? = 'contacted' AND status != 'contacted' THEN contact_attempts + 1
            ELSE contact_attempts
          END,
          processed_at = CASE
            WHEN ? IN ('converted', 'scheduled') THEN CURRENT_TIMESTAMP
            ELSE processed_at
          END
      WHERE id = ?
    `).bind(
      newStatus,
      options.notes || null,
      options.changedBy || null,
      options.assignedTo || null,
      options.followUpDate || null,
      options.priority || null,
      newStatus,
      newStatus,
      leadId
    ).run();

    // Record status change in history
    await this.recordStatusChange(leadId, oldStatus, newStatus, {
      changedBy: options.changedBy,
      changedByName: options.changedByName,
      reason: options.reason,
      notes: options.notes
    });

    // Log activity
    await this.logLeadActivity(leadId, 'status_change', `Status changed from ${oldStatus} to ${newStatus}`, {
      oldStatus,
      newStatus,
      reason: options.reason,
      changedBy: options.changedBy,
      changedByName: options.changedByName
    });

    return { success: true, oldStatus: oldStatus as string };
  }

  async recordStatusChange(
    leadId: number,
    oldStatus: string,
    newStatus: string,
    options: {
      changedBy?: string;
      changedByName?: string;
      reason?: string;
      notes?: string;
    } = {}
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, changed_by_name, reason, notes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      oldStatus || null,
      newStatus,
      options.changedBy || null,
      options.changedByName || null,
      options.reason || null,
      options.notes || null,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...options
      })
    ).run();
  }

  async logLeadActivity(
    leadId: number,
    activityType: string,
    title: string,
    details: any = {},
    createdBy?: string,
    createdByName?: string
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, created_by, created_by_name, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      activityType,
      title,
      details.description || null,
      createdBy || null,
      createdByName || null,
      JSON.stringify(details)
    ).run();
  }

  async getLeadStatusHistory(leadId: number): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM lead_status_history
      WHERE lead_id = ?
      ORDER BY created_at DESC
    `).bind(leadId).all();

    return result.results;
  }

  async getLeadActivities(leadId: number, limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM lead_activities
      WHERE lead_id = ?
      ORDER BY activity_date DESC, created_at DESC
      LIMIT ?
    `).bind(leadId, limit).all();

    return result.results;
  }

  async getPipelineStages(): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM lead_pipeline_stages
      WHERE is_active = 1
      ORDER BY order_index
    `).all();

    return result.results;
  }

  async updateLeadAssignment(leadId: number, assignedTo: string, assignedBy?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE leads
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(assignedTo, leadId).run();

    await this.logLeadActivity(
      leadId,
      'assignment',
      `Lead assigned to ${assignedTo}`,
      { assignedTo, assignedBy }
    );
  }

  async getLeadAnalytics(webhookId: string, days: number = 30): Promise<any> {
    const result = await this.db.prepare(`
      SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_leads,
        AVG(conversion_score) as avg_conversion_score,
        SUM(revenue_potential) as total_revenue_potential,
        MIN(created_at) as first_lead_date,
        MAX(created_at) as last_lead_date
      FROM leads
      WHERE webhook_id = ?
        AND created_at > datetime('now', '-' || ? || ' days')
    `).bind(webhookId, days).first();

    return result;
  }

  async updateDailyAnalytics(webhookId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const stats = await this.db.prepare(`
      SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_leads,
        SUM(revenue_potential) as total_revenue
      FROM leads
      WHERE webhook_id = ?
        AND DATE(created_at) = ?
    `).bind(webhookId, today).first();

    const conversionRate = stats && (stats as any).total_leads > 0
      ? ((stats as any).converted_leads / (stats as any).total_leads) * 100
      : 0;

    await this.db.prepare(`
      INSERT INTO lead_analytics (webhook_id, date, total_leads, converted_leads, conversion_rate, total_revenue)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(webhook_id, date) DO UPDATE SET
        total_leads = excluded.total_leads,
        converted_leads = excluded.converted_leads,
        conversion_rate = excluded.conversion_rate,
        total_revenue = excluded.total_revenue,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      webhookId,
      today,
      stats?.total_leads || 0,
      stats?.converted_leads || 0,
      conversionRate,
      stats?.total_revenue || 0
    ).run();
  }

  async getLeadById(leadId: number): Promise<any | null> {
    const result = await this.db.prepare(`
      SELECT * FROM leads WHERE id = ?
    `).bind(leadId).first();

    return result || null;
  }
}