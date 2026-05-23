-- ─────────────────────────────────────────────────────────────────────────────
-- Content Library — Migration 002
--
-- STORAGE NOTE:
-- The final system must download and store the actual MP4 video and thumbnail
-- into our own storage (Supabase Storage, S3, or Cloudflare R2).
-- storage_video_path and storage_thumbnail_path will hold the path/key in that
-- bucket once the download worker is implemented. For now they remain NULL.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. content_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id              uuid        REFERENCES creators(id)            ON DELETE SET NULL,
  market_id               uuid        REFERENCES markets(id)             ON DELETE SET NULL,
  instagram_account_id    uuid        REFERENCES instagram_accounts(id)  ON DELETE SET NULL,

  platform                text        NOT NULL DEFAULT 'instagram',   -- instagram | tiktok | youtube
  content_type            text        NOT NULL DEFAULT 'reel',        -- reel | post | video | story

  -- Source URLs (always stored even if file download fails)
  original_url            text        NOT NULL,
  media_url               text,         -- direct CDN/video URL from scraper (may expire)
  thumbnail_url           text,         -- thumbnail CDN URL from scraper (may expire)

  -- Permanent storage paths — populated by download worker (NOT YET IMPLEMENTED)
  -- Format: "content/{account_id}/{content_id}.mp4"
  storage_video_path      text,
  storage_thumbnail_path  text,

  caption                 text        NOT NULL DEFAULT '',
  posted_at               timestamptz,
  detected_at             timestamptz NOT NULL DEFAULT now(),
  saved_at                timestamptz,

  -- Viral classification
  viral_tier              text        NOT NULL DEFAULT 'C'        CHECK (viral_tier IN ('A','B','C')),
  -- link_only: URL saved, no file | video_saved: MP4 in storage | missing_file: expected but gone | pending: queued
  status                  text        NOT NULL DEFAULT 'link_only' CHECK (status IN ('link_only','video_saved','missing_file','pending')),

  notes                   text        NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_items_creator   ON content_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_items_market    ON content_items(market_id);
CREATE INDEX IF NOT EXISTS idx_content_items_account   ON content_items(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_content_items_tier      ON content_items(viral_tier);
CREATE INDEX IF NOT EXISTS idx_content_items_status    ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_posted_at ON content_items(posted_at DESC);


-- ── 2. content_metric_snapshots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_metric_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id  uuid        NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  checked_at       timestamptz NOT NULL DEFAULT now(),
  views            bigint      NOT NULL DEFAULT 0,
  likes            bigint      NOT NULL DEFAULT 0,
  comments         bigint      NOT NULL DEFAULT 0,
  shares           bigint      NOT NULL DEFAULT 0,
  saves            bigint      NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_snapshots_item       ON content_metric_snapshots(content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_snapshots_checked_at ON content_metric_snapshots(checked_at DESC);


-- ── 3. viral_rules ───────────────────────────────────────────────────────────
-- Rules that define when a piece of content qualifies as viral and at what tier.
-- Scope: global (creator/market/account all NULL) or scoped to a specific entity.
CREATE TABLE IF NOT EXISTS viral_rules (
  id                      uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text     NOT NULL,
  tier                    text     NOT NULL DEFAULT 'C' CHECK (tier IN ('A','B','C')),
  time_window_hours       integer  NOT NULL DEFAULT 24,   -- evaluate metrics after N hours
  min_views               bigint   NOT NULL DEFAULT 0,
  min_likes               bigint   NOT NULL DEFAULT 0,
  relative_multiplier     numeric,                        -- optional: X× account avg views
  -- optional scope — NULL means the rule applies globally
  creator_id              uuid     REFERENCES creators(id)           ON DELETE SET NULL,
  market_id               uuid     REFERENCES markets(id)            ON DELETE SET NULL,
  instagram_account_id    uuid     REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  enabled                 boolean  NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);


-- ── 4. content_tags ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_tags (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id  uuid        NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag              text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_content_tags_item ON content_tags(content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag  ON content_tags(tag);


-- ── Grant permissions ─────────────────────────────────────────────────────────
GRANT ALL ON content_items               TO service_role, anon;
GRANT ALL ON content_metric_snapshots    TO service_role, anon;
GRANT ALL ON viral_rules                 TO service_role, anon;
GRANT ALL ON content_tags                TO service_role, anon;
