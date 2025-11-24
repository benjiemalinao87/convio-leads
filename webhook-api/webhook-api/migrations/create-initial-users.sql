-- Initial Users Migration
-- Migrates existing ENV credentials to admin user
-- Auto-creates user accounts for all existing providers

-- Step 1: Create admin user from existing ENV credentials
-- Using the values from wrangler.jsonc: LOGIN_USERNAME and LOGIN_PASSWORD
INSERT OR IGNORE INTO users (email, password, permission_type, is_active)
VALUES (
  'buyerfound_dominate_leadselling!',  -- From LOGIN_USERNAME
  'leadSelling101#12!',                -- From LOGIN_PASSWORD
  'admin',
  1
);

-- Step 2: Create dev user (for development purposes)
INSERT OR IGNORE INTO users (email, password, permission_type, is_active)
VALUES (
  'dev@homeprojectpartners.com',
  'dev',
  'dev',
  1
);

-- Step 3: Auto-create user accounts for all existing providers
-- Use contact_email if available, otherwise generate email from provider_id
INSERT OR IGNORE INTO users (email, password, provider_id, permission_type, is_active)
SELECT 
  CASE 
    WHEN contact_email IS NOT NULL AND contact_email != '' 
    THEN contact_email
    ELSE provider_id || '@provider.local'
  END as email,
  'provider_' || provider_id as password,  -- Default password: provider_{provider_id}
  provider_id,
  'provider',
  is_active  -- Inherit active status from provider
FROM lead_source_providers
WHERE provider_id IS NOT NULL;

