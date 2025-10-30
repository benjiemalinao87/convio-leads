-- Migration: Add forward_mode to webhook_configs
-- Date: 2025-10-30
-- Description: Adds configurable forwarding behavior to webhooks
--              'first-match' = stop after first successful forward (default, safe for lead selling)
--              'all-matches' = continue forwarding to all matching rules (for analytics/internal systems)

-- Add forward_mode column with default value
ALTER TABLE webhook_configs
ADD COLUMN forward_mode TEXT DEFAULT 'first-match';

-- Add check constraint to ensure only valid values
-- Note: SQLite doesn't support CHECK constraints in ALTER TABLE, so we'll validate in application code

-- Update existing webhooks to have explicit forward_mode
UPDATE webhook_configs
SET forward_mode = 'first-match'
WHERE forward_mode IS NULL;

-- Create index for performance (if querying by forward_mode becomes common)
CREATE INDEX IF NOT EXISTS idx_webhook_configs_forward_mode
ON webhook_configs(forward_mode);

-- Verification query (comment out after running)
-- SELECT webhook_id, name, forwarding_enabled, forward_mode
-- FROM webhook_configs
-- LIMIT 10;
