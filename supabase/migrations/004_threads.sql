-- ============================================================
-- Migration 004 — Threads System
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. threads_accounts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              TEXT NOT NULL,             -- "cathyycamping" (same as IG, without @)
  creator               TEXT NOT NULL,             -- "Cathy" | "Neyla" | "Romina"
  branding              TEXT,                      -- "Camping" | "Farm" | etc.
  mitarbeiter           TEXT,                      -- Employee name (must match employees.name)
  warmup_started_at     DATE,                      -- Day 1: phone reset + IG account created
  ramp_up_started_at    DATE,                      -- Day first Threads post was made
  status                TEXT NOT NULL DEFAULT 'warmup'
                          CHECK (status IN ('warmup', 'active', 'paused', 'banned')),
  notes                 TEXT NOT NULL DEFAULT '',
  archived              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_accounts_creator     ON threads_accounts(creator);
CREATE INDEX IF NOT EXISTS idx_threads_accounts_status      ON threads_accounts(status);
CREATE INDEX IF NOT EXISTS idx_threads_accounts_mitarbeiter ON threads_accounts(mitarbeiter);
CREATE INDEX IF NOT EXISTS idx_threads_accounts_archived    ON threads_accounts(archived);


-- ── 2. threads_daily_batches ─────────────────────────────────
-- One batch = one Google Drive folder with images for one account for one day.
-- Employee downloads folder, posts all, then confirms deletion.
CREATE TABLE IF NOT EXISTS threads_daily_batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL REFERENCES threads_accounts(id) ON DELETE CASCADE,
  date                    DATE NOT NULL,
  drive_folder_url        TEXT NOT NULL,            -- Google Drive folder link
  posts_count             INTEGER NOT NULL,         -- How many posts today (1–5)
  images_count            INTEGER NOT NULL,         -- posts_count × 2
  status                  TEXT NOT NULL DEFAULT 'ready'
                            CHECK (status IN ('ready', 'sent', 'posted', 'deleted')),
  telegram_message_id     INTEGER,
  chat_id                 TEXT,
  dispatched_at           TIMESTAMPTZ,
  posted_confirmed_at     TIMESTAMPTZ,
  deletion_confirmed_at   TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, date)  -- one batch per account per day
);

CREATE INDEX IF NOT EXISTS idx_threads_batches_account ON threads_daily_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_threads_batches_date    ON threads_daily_batches(date DESC);
CREATE INDEX IF NOT EXISTS idx_threads_batches_status  ON threads_daily_batches(status);

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL ON threads_accounts      TO service_role, anon;
GRANT ALL ON threads_daily_batches TO service_role, anon;
