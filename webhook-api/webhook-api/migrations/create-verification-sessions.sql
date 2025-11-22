-- Migration: Create verification sessions table for admin onboarding
-- Purpose: Store temporary verification codes for two-factor provider creation
-- Date: 2025-11-21

-- ============================================================================
-- Verification Sessions Table
-- ============================================================================
-- Stores temporary verification sessions with 15-minute expiration
-- Used for Slack-based two-factor verification before provider creation

CREATE TABLE IF NOT EXISTS admin_verification_sessions (
    session_id TEXT PRIMARY KEY,
    verification_code TEXT NOT NULL,
    form_data TEXT NOT NULL, -- JSON stringified form data from onboarding request
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT 0,
    verified_at TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,

    -- Indexes for performance
    UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_verification_expires ON admin_verification_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_verified ON admin_verification_sessions(verified);
CREATE INDEX IF NOT EXISTS idx_verification_code ON admin_verification_sessions(verification_code);

-- ============================================================================
-- Cleanup Policy
-- ============================================================================
-- Sessions expire after 15 minutes
-- Verified sessions can be cleaned up after 24 hours (for audit trail)
-- Failed sessions (>3 attempts) should be investigated

-- Example cleanup query (to be run via cron or manually):
-- DELETE FROM admin_verification_sessions
-- WHERE expires_at < datetime('now', '-1 day')
--    OR (verified = 1 AND verified_at < datetime('now', '-7 days'));
