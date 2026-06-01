-- Permanent internal library for approved generated content.
-- Google Drive remains an export target for employees; this bucket is the source of truth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists content_assets (
  id              uuid primary key default gen_random_uuid(),
  generation_id   uuid unique references threads_generations(id) on delete set null,
  creator         text not null,
  source          text not null default 'generated'
                    check (source in ('generated', 'uploaded', 'imported')),
  status          text not null default 'saved'
                    check (status in ('saved', 'ready', 'assigned', 'used', 'archived')),
  storage_path    text not null unique,
  source_url      text,
  source_label    text,
  prompt          text,
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_content_assets_creator on content_assets(creator);
create index if not exists idx_content_assets_status on content_assets(status);
create index if not exists idx_content_assets_created_at on content_assets(created_at desc);

grant all on content_assets to service_role;
