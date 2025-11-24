-- Users Table Migration
-- This table stores all users who can login to the dashboard
-- Supports three permission types: admin, dev, and provider

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,                    -- Plain text for dev (can be hashed later)
  provider_id TEXT UNIQUE,                   -- Links to lead_source_providers.provider_id (nullable)
  permission_type TEXT NOT NULL,            -- 'admin', 'dev', or 'provider'
  is_active BOOLEAN DEFAULT 1,              -- Whether user account is active
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,                   -- Track last successful login
  
  FOREIGN KEY (provider_id) REFERENCES lead_source_providers(provider_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);
CREATE INDEX IF NOT EXISTS idx_users_permission_type ON users(permission_type);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

