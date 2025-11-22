-- Migration: Add state-based matching to lead forwarding rules
-- Date: 2025-11-21
-- Purpose: Enable forwarding rules to match on state field (e.g., CA, NY, TX)
--          Supports wildcard "*" for all states

-- Add states column to lead_forwarding_rules table
-- Default to ["*"] for existing rules to maintain current behavior
ALTER TABLE lead_forwarding_rules
ADD COLUMN states TEXT DEFAULT '["*"]';

-- Update existing rules to use wildcard for states (all states match)
UPDATE lead_forwarding_rules
SET states = '["*"]'
WHERE states IS NULL;

-- Add matched_state column to lead_forwarding_log table for tracking
ALTER TABLE lead_forwarding_log
ADD COLUMN matched_state TEXT;

-- Create index for performance on state-based queries
CREATE INDEX IF NOT EXISTS idx_lead_forwarding_rules_states
ON lead_forwarding_rules(states);

-- Verification query (commented out for migration)
-- SELECT id, source_webhook_id, product_types, zip_codes, states, priority
-- FROM lead_forwarding_rules
-- ORDER BY priority ASC;
