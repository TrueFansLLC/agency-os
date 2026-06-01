-- Curated reusable content packs for new accounts and daily posting batches.

alter table public.content_assets enable row level security;
revoke all on table public.content_assets from anon, authenticated;
grant all on table public.content_assets to service_role;

create table if not exists content_packs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  creator           text,
  pack_type         text not null default 'starter'
                      check (pack_type in ('starter', 'daily', 'reusable')),
  status            text not null default 'draft'
                      check (status in ('draft', 'ready', 'exported', 'used', 'archived')),
  drive_folder_url  text,
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists content_pack_assets (
  pack_id       uuid not null references content_packs(id) on delete cascade,
  asset_id      uuid not null references content_assets(id) on delete cascade,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  primary key (pack_id, asset_id),
  unique (pack_id, position)
);

create index if not exists idx_content_packs_creator on content_packs(creator);
create index if not exists idx_content_packs_status on content_packs(status);
create index if not exists idx_content_packs_created_at on content_packs(created_at desc);
create index if not exists idx_content_pack_assets_asset on content_pack_assets(asset_id);

alter table public.content_packs enable row level security;
alter table public.content_pack_assets enable row level security;
revoke all on table public.content_packs, public.content_pack_assets from anon, authenticated;
grant all on table public.content_packs, public.content_pack_assets to service_role;
