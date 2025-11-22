-- Migration: Add forward count tracking to forwarding rules
-- Date: 2025-11-22
-- Purpose: Track how many times each forwarding rule has been hit/matched

-- Add forward_count column to track rule usage
ALTER TABLE lead_forwarding_rules
ADD COLUMN forward_count INTEGER DEFAULT 0;

-- Update existing rules to have 0 count
UPDATE lead_forwarding_rules
SET forward_count = 0
WHERE forward_count IS NULL;

-- Backfill counts from existing forwarding logs
UPDATE lead_forwarding_rules
SET forward_count = (
  SELECT COUNT(*)
  FROM lead_forwarding_log
  WHERE lead_forwarding_log.rule_id = lead_forwarding_rules.id
    AND lead_forwarding_log.forward_status = 'success'
)
WHERE EXISTS (
  SELECT 1
  FROM lead_forwarding_log
  WHERE lead_forwarding_log.rule_id = lead_forwarding_rules.id
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lead_forwarding_rules_forward_count
ON lead_forwarding_rules(forward_count DESC);
