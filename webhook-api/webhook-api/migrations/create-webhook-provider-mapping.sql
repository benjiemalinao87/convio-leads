-- Migration: Create webhook_provider_mapping table
-- Purpose: Link webhooks to their owning providers for authorization
-- Date: 2025-11-22

CREATE TABLE IF NOT EXISTS webhook_provider_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes and constraints
    UNIQUE(webhook_id, provider_id),
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(webhook_id),
    FOREIGN KEY (provider_id) REFERENCES lead_source_providers(provider_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_provider_webhook ON webhook_provider_mapping(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_provider_provider ON webhook_provider_mapping(provider_id);
