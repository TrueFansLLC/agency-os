-- Facebook Pages tracking (standalone, separate from instagram_accounts)

create table if not exists facebook_accounts (
  id                uuid primary key default gen_random_uuid(),
  page_handle       text not null,
  page_name         text not null default '',
  creator_id        uuid references creators(id),
  market_id         uuid references markets(id),
  status            text not null default 'active',
  connection_status text not null default 'not_connected',
  performance_label text not null default 'New',
  last_synced_at    timestamptz,
  notes             text not null default '',
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists facebook_metric_snapshots (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references facebook_accounts(id) on delete cascade,
  date         date not null,
  followers    bigint not null default 0,
  video_views  bigint not null default 0,
  videos_count int    not null default 0,
  posts_count  int    not null default 0,
  created_at   timestamptz not null default now(),
  unique(account_id, date)
);

create unique index if not exists idx_facebook_accounts_handle
  on facebook_accounts(page_handle);

grant all on facebook_accounts          to service_role;
grant all on facebook_metric_snapshots  to service_role;
grant all on all sequences in schema public to service_role;
