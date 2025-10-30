/**
 * Lead Forwarding Utility
 * 
 * Handles automatic forwarding of leads to other webhooks based on criteria:
 * - Product type matching
 * - Zip code matching
 * - Priority-based rule execution
 */

import { D1Database } from '@cloudflare/workers-types'

interface ForwardingRule {
  id: number
  source_webhook_id: string
  target_webhook_id: string
  target_webhook_url: string
  product_types: string
  zip_codes: string
  priority: number
  is_active: number
  forward_enabled: number
}

interface ForwardingResult {
  success: boolean
  forwarded_count: number
  errors: string[]
}

/**
 * Check if lead forwarding is enabled for this webhook and process forwarding
 * @param db - D1 Database instance
 * @param webhookId - Source webhook ID
 * @param leadId - Lead ID that was just created
 * @param contactId - Contact ID associated with the lead
 * @param productId - Product type from lead (e.g., "Solar", "HVAC")
 * @param zipCode - Zip code from lead
 * @param originalPayload - The complete JSON payload received
 * @returns ForwardingResult with success status and count
 */
export async function checkAndForwardLead(
  db: D1Database,
  webhookId: string,
  leadId: number,
  contactId: number,
  productId: string | undefined,
  zipCode: string | undefined,
  originalPayload: any
): Promise<ForwardingResult> {
  const result: ForwardingResult = {
    success: true,
    forwarded_count: 0,
    errors: []
  }

  try {
    // Step 1: Check if forwarding is enabled for this webhook and get forward_mode
    const webhookConfig = await db.prepare(`
      SELECT forwarding_enabled, forward_mode FROM webhook_configs
      WHERE webhook_id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(webhookId).first()

    if (!webhookConfig || !webhookConfig.forwarding_enabled) {
      console.log(`Forwarding disabled for webhook ${webhookId}`)
      return result
    }

    // Get forward mode (default to 'first-match' for safety)
    const forwardMode = (webhookConfig.forward_mode as string) || 'first-match'
    console.log(`Webhook ${webhookId} forward_mode: ${forwardMode}`)

    // Step 2: Get active forwarding rules sorted by priority
    const { results: rules } = await db.prepare(`
      SELECT * FROM lead_forwarding_rules
      WHERE source_webhook_id = ?
        AND is_active = 1
        AND forward_enabled = 1
      ORDER BY priority ASC
    `).bind(webhookId).all()

    if (rules.length === 0) {
      console.log(`No active forwarding rules for webhook ${webhookId}`)
      return result
    }

    console.log(`Found ${rules.length} active forwarding rules for ${webhookId}`)

    // Step 3: Check each rule for criteria match
    for (const rule of rules as unknown as ForwardingRule[]) {
      try {
        const productTypes = JSON.parse(rule.product_types)
        const zipCodes = JSON.parse(rule.zip_codes)

        // Check criteria match with wildcard support
        // Wildcard "*" matches everything (useful for catch-all rules)
        const productMatch = productTypes.includes("*") ||
          (productId && productTypes.some((p: string) =>
            p.toLowerCase() === productId.toLowerCase()
          ))

        const zipMatch = zipCodes.includes("*") ||
          (zipCode && zipCodes.includes(zipCode))

        // Both criteria must match (AND logic)
        if (productMatch && zipMatch) {
          const matchType = productTypes.includes("*") && zipCodes.includes("*")
            ? 'catch-all'
            : productTypes.includes("*")
            ? 'product-catchall'
            : zipCodes.includes("*")
            ? 'zip-catchall'
            : 'exact'
          console.log(`Rule ${rule.id} matched (${matchType}) for lead ${leadId}: product=${productId}, zip=${zipCode}`)

          // Forward lead to target webhook
          const forwardSuccess = await forwardLeadToWebhook(
            db,
            rule,
            leadId,
            contactId,
            originalPayload,
            productId,
            zipCode
          )

          if (forwardSuccess) {
            result.forwarded_count++

            // Update webhook statistics
            await db.prepare(`
              UPDATE webhook_configs
              SET auto_forward_count = auto_forward_count + 1,
                  last_forwarded_at = CURRENT_TIMESTAMP
              WHERE webhook_id = ?
            `).bind(webhookId).run()

            // Check forward_mode to determine if we should stop after first match
            if (forwardMode === 'first-match') {
              console.log(`Forward mode is 'first-match' - stopping after successful forward`)
              break // Stop after first successful forward (prevents duplicate lead distribution)
            }
            // If forward_mode is 'all-matches', continue to next rule
            console.log(`Forward mode is 'all-matches' - continuing to evaluate remaining rules`)
          }
        } else {
          console.log(`Rule ${rule.id} did not match: product_match=${productMatch}, zip_match=${zipMatch}`)
        }
      } catch (ruleError) {
        console.error(`Error processing rule ${rule.id}:`, ruleError)
        result.errors.push(`Rule ${rule.id}: ${ruleError instanceof Error ? ruleError.message : 'Unknown error'}`)
      }
    }

    if (result.forwarded_count > 0) {
      console.log(`Successfully forwarded lead ${leadId} to ${result.forwarded_count} target(s)`)
    }

  } catch (error) {
    console.error('Error in checkAndForwardLead:', error)
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

/**
 * Forward lead to target webhook via HTTP POST
 * @param db - D1 Database instance
 * @param rule - Forwarding rule
 * @param leadId - Lead ID
 * @param contactId - Contact ID
 * @param payload - Original JSON payload
 * @param matchedProduct - Product that matched the rule
 * @param matchedZip - Zip code that matched the rule
 * @returns boolean indicating success
 */
async function forwardLeadToWebhook(
  db: D1Database,
  rule: ForwardingRule,
  leadId: number,
  contactId: number,
  payload: any,
  matchedProduct: string | undefined,
  matchedZip: string | undefined
): Promise<boolean> {
  try {
    console.log(`Forwarding lead ${leadId} to ${rule.target_webhook_url}`)

    // Enrich payload with metadata for easy partner mapping
    const enrichedPayload = {
      ...payload,
      home_project_partner_metadata: {
        lead_id: leadId,
        contact_id: contactId,
        forwarded_from: rule.source_webhook_id,
        rule_id: rule.id,
        matched_product: matchedProduct,
        matched_zip: matchedZip,
        forwarded_at: new Date().toISOString()
      }
    }

    // Make HTTP POST request to target webhook
    const response = await fetch(rule.target_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-From': rule.source_webhook_id,
        'X-Original-Lead-Id': leadId.toString(),
        'X-Original-Contact-Id': contactId.toString(),
        'X-Forwarding-Rule-Id': rule.id.toString()
      },
      body: JSON.stringify(enrichedPayload)
    })

    const responseBody = await response.text()
    const success = response.ok

    // Log forwarding attempt
    await db.prepare(`
      INSERT INTO lead_forwarding_log (
        lead_id, contact_id, rule_id,
        source_webhook_id, target_webhook_id, target_webhook_url,
        forwarded_at, forward_status, http_status_code, response_body,
        matched_product, matched_zip, payload
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      contactId,
      rule.id,
      rule.source_webhook_id,
      rule.target_webhook_id,
      rule.target_webhook_url,
      success ? 'success' : 'failed',
      response.status,
      responseBody.substring(0, 1000), // Limit response body size
      matchedProduct || null,
      matchedZip || null,
      JSON.stringify(payload).substring(0, 10000) // Limit payload size
    ).run()

    if (success) {
      console.log(`✅ Lead ${leadId} forwarded successfully to ${rule.target_webhook_id}: HTTP ${response.status}`)
    } else {
      console.error(`❌ Lead ${leadId} forwarding failed to ${rule.target_webhook_id}: HTTP ${response.status}`)
      console.error(`Response: ${responseBody.substring(0, 200)}`)
    }

    return success

  } catch (error) {
    console.error(`❌ Exception while forwarding lead ${leadId}:`, error)

    // Log failure
    try {
      await db.prepare(`
        INSERT INTO lead_forwarding_log (
          lead_id, contact_id, rule_id,
          source_webhook_id, target_webhook_id, target_webhook_url,
          forwarded_at, forward_status, error_message,
          matched_product, matched_zip, payload
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'failed', ?, ?, ?, ?)
      `).bind(
        leadId,
        contactId,
        rule.id,
        rule.source_webhook_id,
        rule.target_webhook_id,
        rule.target_webhook_url,
        error instanceof Error ? error.message : 'Unknown error',
        matchedProduct || null,
        matchedZip || null,
        JSON.stringify(payload).substring(0, 10000)
      ).run()
    } catch (logError) {
      console.error('Failed to log forwarding error:', logError)
    }

    return false
  }
}

/**
 * Retry failed forwarding attempts
 * (Optional feature for future implementation)
 */
export async function retryFailedForwarding(
  db: D1Database,
  logId: number
): Promise<boolean> {
  // TODO: Implement retry logic
  // 1. Get failed log entry
  // 2. Get rule details
  // 3. Parse payload
  // 4. Retry forwarding
  // 5. Update log with retry count
  return false
}

