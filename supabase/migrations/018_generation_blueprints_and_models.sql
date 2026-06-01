-- Keep private screenshot blueprints so failed generations can be reproduced.
-- Track provider details for quality-mode routing and clearer diagnostics.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generation-blueprints',
  'generation-blueprints',
  false,
  2621440,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table threads_generations
  add column if not exists reference_storage_path text,
  add column if not exists image_size text,
  add column if not exists generation_model text not null default 'seedream',
  add column if not exists retry_of_id uuid references threads_generations(id) on delete set null,
  add column if not exists fal_result_http_status integer;

create index if not exists idx_threads_generations_retry_of on threads_generations(retry_of_id);
