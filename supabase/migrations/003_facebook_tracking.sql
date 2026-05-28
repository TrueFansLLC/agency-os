-- ============================================================
-- Migration 003 — Facebook tracking columns
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Add Facebook page username to instagram_accounts
ALTER TABLE instagram_accounts
  ADD COLUMN IF NOT EXISTS fb_username TEXT;

-- Add Facebook follower count to daily snapshots
ALTER TABLE instagram_metric_snapshots
  ADD COLUMN IF NOT EXISTS fb_followers INTEGER NOT NULL DEFAULT 0;
