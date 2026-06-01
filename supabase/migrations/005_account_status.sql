-- Account status columns on account_pairs
ALTER TABLE account_pairs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'banned')),
  ADD COLUMN IF NOT EXISTS status_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_note TEXT;

-- Account Status thread IDs on employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS telegram_ig_status_thread_id INTEGER,
  ADD COLUMN IF NOT EXISTS telegram_fb_status_thread_id INTEGER;
