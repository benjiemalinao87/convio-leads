-- Migration: Create webhook mapping for benjie_malinao_9378 provider
-- Purpose: Link provider to form-leads webhook for testing form submissions
-- Date: 2025-01-16

-- Check if webhook exists
-- If form-leads_ws_us_general_184 doesn't exist, you'll need to create it first or use another webhook

-- Create webhook_provider_mapping for benjie_malinao_9378
INSERT OR IGNORE INTO webhook_provider_mapping (webhook_id, provider_id, created_at)
VALUES ('form-leads_ws_us_general_184', 'benjie_malinao_9378', CURRENT_TIMESTAMP);

-- Update provider's allowed_webhooks field
UPDATE lead_source_providers
SET allowed_webhooks = json_array('form-leads_ws_us_general_184')
WHERE provider_id = 'benjie_malinao_9378';

-- Verify the mapping was created
SELECT 
  wpm.webhook_id,
  wpm.provider_id,
  wpm.created_at,
  wc.is_active as webhook_active,
  lsp.is_active as provider_active
FROM webhook_provider_mapping wpm
INNER JOIN webhook_configs wc ON wpm.webhook_id = wc.webhook_id
INNER JOIN lead_source_providers lsp ON wpm.provider_id = lsp.provider_id
WHERE wpm.provider_id = 'benjie_malinao_9378';
