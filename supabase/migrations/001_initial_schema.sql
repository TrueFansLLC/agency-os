-- ============================================================
-- Agency OS — Initial Schema
-- Run this in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Creators (e.g. Romina, Gina)
CREATE TABLE creators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Markets (e.g. Germany, USA)
CREATE TABLE markets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Instagram accounts being tracked
CREATE TABLE instagram_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              TEXT NOT NULL UNIQUE,
  creator_id            UUID REFERENCES creators(id) ON DELETE SET NULL,
  market_id             UUID REFERENCES markets(id)  ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  connection_status     TEXT NOT NULL DEFAULT 'not_connected',
  data_source           TEXT NOT NULL DEFAULT 'instagram_api',
  external_instagram_id TEXT,
  performance_label     TEXT NOT NULL DEFAULT 'New',
  notes                 TEXT NOT NULL DEFAULT '',
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- One row per account per day — written by the sync function
CREATE TABLE instagram_metric_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  followers   INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  posts       INTEGER NOT NULL DEFAULT 0,
  likes       INTEGER NOT NULL DEFAULT 0,
  comments    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, date)  -- one snapshot per account per day
);

-- Sync history — every sync attempt is logged here
CREATE TABLE sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  status            TEXT NOT NULL,        -- 'success' | 'error' | 'partial'
  triggered_by      TEXT DEFAULT 'manual',
  snapshots_written INTEGER DEFAULT 0,
  error_message     TEXT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Indexes for fast dashboard queries
CREATE INDEX idx_snapshots_account_date ON instagram_metric_snapshots (account_id, date DESC);
CREATE INDEX idx_accounts_creator       ON instagram_accounts (creator_id);
CREATE INDEX idx_accounts_market        ON instagram_accounts (market_id);
CREATE INDEX idx_accounts_archived      ON instagram_accounts (archived);
CREATE INDEX idx_sync_logs_account      ON sync_logs (account_id, started_at DESC);

-- Seed default markets
INSERT INTO markets (name) VALUES ('Germany'), ('USA');
