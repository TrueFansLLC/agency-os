-- Threads account-status checks before posting.
-- Restricted or banned accounts stop immediately and keep an auditable blocked batch.

alter table public.employees
  add column if not exists telegram_threads_status_thread_id integer;

alter table public.threads_accounts
  drop constraint if exists threads_accounts_status_check;

alter table public.threads_accounts
  add constraint threads_accounts_status_check
  check (status in ('warmup', 'active', 'restricted', 'paused', 'banned'));

alter table public.threads_daily_batches
  drop constraint if exists threads_daily_batches_status_check;

alter table public.threads_daily_batches
  add constraint threads_daily_batches_status_check
  check (status in ('ready', 'sent', 'posted', 'deleted', 'blocked'));

alter table public.threads_daily_batches
  add column if not exists status_checked_at timestamptz,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;
