-- Migration: Create admin_onboarding_events table
-- Purpose: Track all provider onboarding events for audit trail
-- Date: 2025-11-22

CREATE TABLE IF NOT EXISTS admin_onboarding_events (
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
    webhook_region TEXT DEFAULT 'us',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for performance
    FOREIGN KEY (provider_id) REFERENCES lead_source_providers(provider_id),
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(webhook_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_onboarding_provider ON admin_onboarding_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_admin_onboarding_webhook ON admin_onboarding_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_admin_onboarding_created ON admin_onboarding_events(created_at);
