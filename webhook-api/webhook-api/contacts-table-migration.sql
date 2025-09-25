-- Schema Migration: Remove AUTOINCREMENT from contacts table
-- This migration removes AUTOINCREMENT constraint to enable 6-digit custom contact IDs

-- Step 1: Create new contacts table without AUTOINCREMENT
CREATE TABLE IF NOT EXISTS contacts_new (
  id INTEGER PRIMARY KEY,  -- No AUTOINCREMENT - allows custom IDs
  webhook_id TEXT NOT NULL,
  phone TEXT NOT NULL,           -- Normalized phone (+1XXXXXXXXXX)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,                    -- Primary email for contact
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Unique phone per webhook (one contact per phone per webhook)
  UNIQUE(webhook_id, phone)
);

-- Step 2: Copy existing contacts data (if any) to new table
INSERT INTO contacts_new SELECT * FROM contacts;

-- Step 3: Drop old contacts table
DROP TABLE contacts;

-- Step 4: Rename new table to contacts
ALTER TABLE contacts_new RENAME TO contacts;

-- Step 5: Recreate indexes for contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_webhook_phone ON contacts(webhook_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);