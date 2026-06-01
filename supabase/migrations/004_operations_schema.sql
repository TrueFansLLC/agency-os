-- Core operations tables used by Tracker, Posting Planner and Telegram.
-- Kept before migration 004 because account status extends these tables.

create table if not exists account_pairs (
  id                uuid primary key default gen_random_uuid(),
  creator           text not null,
  branding          text,
  content_creator   text,
  ig_mitarbeiter    text,
  fb_mitarbeiter    text,
  ig_username       text,
  ig_status         text not null default 'Fehlt',
  ig_posting        boolean not null default false,
  ig_link           text,
  fb_username       text,
  fb_status         text not null default 'Fehlt',
  fb_posting        boolean not null default false,
  fb_link           text,
  notes             text,
  archived          boolean not null default false,
  archive_reason    text,
  archived_at       timestamptz,
  archived_by       text,
  status            text not null default 'active'
                      check (status in ('active', 'restricted', 'banned')),
  status_since      timestamptz,
  status_note       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists employees (
  id                              uuid primary key default gen_random_uuid(),
  name                            text not null,
  devices                         integer not null default 0,
  notes                           text,
  platform                        text not null default 'ig_fb',
  role                            text not null default 'employee',
  telegram_chat_id                text unique,
  telegram_posting_thread_id      integer,
  telegram_fb_thread_id           integer,
  telegram_ig_status_thread_id    integer,
  telegram_fb_status_thread_id    integer,
  telegram_ig_weekly_thread_id    integer,
  telegram_fb_weekly_thread_id    integer,
  telegram_salary_thread_id       integer,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create table if not exists posting_schedule (
  id                    uuid primary key default gen_random_uuid(),
  creator               text not null,
  account               text not null,
  platform              text not null default 'Instagram',
  reel_number           integer not null default 1,
  send_date             date not null,
  send_time             time not null default '23:00',
  post_text             text not null default '',
  caption               text not null default '',
  video_link            text not null default '',
  status                text not null default 'geplant'
                          check (status in ('geplant', 'bereit', 'gesendet', 'gepostet', 'wartet')),
  telegram_message_id   integer,
  chat_id               text,
  thread_id             integer,
  employee_name         text,
  dispatched_at         timestamptz,
  confirmed_at          timestamptz,
  followup_sent_at      timestamptz,
  owner_notified_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists daily_status_screenshots (
  id                uuid primary key default gen_random_uuid(),
  employee_name     text not null,
  date              date not null,
  platform          text not null,
  expected_count    integer not null default 0,
  received_count    integer not null default 0,
  check_sent_at     timestamptz,
  followup_sent_at  timestamptz,
  chat_id           text not null,
  thread_id         integer not null,
  created_at        timestamptz not null default now(),
  unique(employee_name, date, platform)
);

create table if not exists weekly_stats_screenshots (
  id                uuid primary key default gen_random_uuid(),
  employee_name     text not null,
  week_start        date not null,
  platform          text not null,
  expected_count    integer not null default 0,
  received_count    integer not null default 0,
  check_sent_at     timestamptz,
  chat_id           text not null,
  thread_id         integer not null,
  created_at        timestamptz not null default now(),
  unique(employee_name, week_start, platform)
);

create table if not exists threads_generations (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null,
  creator           text not null,
  source_label      text,
  prompt            text not null,
  status            text not null default 'generating',
  fal_status_url    text,
  fal_response_url  text,
  image_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Facebook sync failures use the same log table as Instagram. The original
-- Instagram-only foreign key would reject a Facebook account id.
alter table sync_logs
  drop constraint if exists sync_logs_account_id_fkey;

alter table sync_logs
  add column if not exists platform text not null default 'instagram';

create index if not exists idx_account_pairs_archived on account_pairs(archived);
create index if not exists idx_posting_schedule_date on posting_schedule(send_date);
create index if not exists idx_posting_schedule_status on posting_schedule(status);
create index if not exists idx_threads_generations_batch on threads_generations(batch_id);

grant all on account_pairs, employees, posting_schedule,
  daily_status_screenshots, weekly_stats_screenshots, threads_generations
  to service_role;
