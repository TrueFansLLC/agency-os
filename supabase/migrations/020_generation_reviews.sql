-- Human calibration feedback for generated screenshot recreations.
-- Automated QA remains advisory until enough manual reviews exist.

create table if not exists generation_reviews (
  id             uuid primary key default gen_random_uuid(),
  generation_id  uuid not null unique references threads_generations(id) on delete cascade,
  verdict        text not null check (verdict in ('approved', 'usable', 'rejected')),
  reasons        text[] not null default '{}',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_generation_reviews_verdict on generation_reviews(verdict);
create index if not exists idx_generation_reviews_updated_at on generation_reviews(updated_at desc);

alter table public.generation_reviews enable row level security;
revoke all on table public.generation_reviews from anon, authenticated;
grant all on table public.generation_reviews to service_role;
