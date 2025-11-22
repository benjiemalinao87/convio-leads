-- ============================================================================
-- Admin Provider Onboarding Audit Log
-- ============================================================================
-- This migration creates a table to track all provider onboarding activities
-- performed through the admin onboarding portal. It logs who created the
-- provider, when, and what materials were generated.
--
-- Usage: wrangler d1 execute convio-leads --remote --file=migrations/create-admin-onboarding-log.sql
-- ============================================================================

-- Create admin onboarding log table
CREATE TABLE IF NOT EXISTS admin_onboarding_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    webhook_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    admin_name TEXT,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    webhook_name TEXT NOT NULL,
    webhook_type TEXT NOT NULL,
    webhook_region TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    materials_viewed BOOLEAN DEFAULT 0,
    materials_downloaded BOOLEAN DEFAULT 0,
    email_copied BOOLEAN DEFAULT 0,
    notes TEXT,

    -- Foreign key relationships (soft - no enforcement in SQLite by default)
    FOREIGN KEY (provider_id) REFERENCES lead_source_providers(provider_id),
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(webhook_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_admin_onboarding_log_provider_id
ON admin_onboarding_log(provider_id);

CREATE INDEX IF NOT EXISTS idx_admin_onboarding_log_webhook_id
ON admin_onboarding_log(webhook_id);

CREATE INDEX IF NOT EXISTS idx_admin_onboarding_log_admin_email
ON admin_onboarding_log(admin_email);

CREATE INDEX IF NOT EXISTS idx_admin_onboarding_log_created_at
ON admin_onboarding_log(created_at DESC);

-- Add created_by column to lead_source_providers table (if not exists)
-- This tracks which admin created the provider
ALTER TABLE lead_source_providers
ADD COLUMN created_by TEXT;

-- Add onboarding_completed_at column to track when onboarding was finished
ALTER TABLE lead_source_providers
ADD COLUMN onboarding_completed_at TIMESTAMP;

-- Add created_by column to webhook_configs table for consistency
ALTER TABLE webhook_configs
ADD COLUMN created_by TEXT;

-- Create view for recent onboarding activity
CREATE VIEW IF NOT EXISTS v_recent_onboarding_activity AS
SELECT
    aol.id,
    aol.provider_id,
    aol.webhook_id,
    aol.admin_email,
    aol.admin_name,
    aol.company_name,
    aol.contact_name,
    aol.contact_email,
    aol.webhook_name,
    aol.webhook_type,
    aol.created_at,
    aol.materials_viewed,
    aol.materials_downloaded,
    aol.email_copied,
    lsp.is_active AS provider_is_active,
    wc.is_active AS webhook_is_active,
    (SELECT COUNT(*) FROM leads WHERE webhook_id = aol.webhook_id) AS total_leads_received
FROM admin_onboarding_log aol
LEFT JOIN lead_source_providers lsp ON aol.provider_id = lsp.provider_id
LEFT JOIN webhook_configs wc ON aol.webhook_id = wc.webhook_id
ORDER BY aol.created_at DESC;

-- Success message
SELECT 'Admin onboarding log table created successfully!' AS status;
