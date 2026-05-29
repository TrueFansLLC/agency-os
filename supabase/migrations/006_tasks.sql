create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  assignee    text not null default 'Elijah',
  status      text not null default 'offen' check (status in ('offen', 'in_arbeit', 'erledigt')),
  priority    text not null default 'mittel' check (priority in ('hoch', 'mittel', 'niedrig')),
  due_date    date,
  created_at  timestamptz not null default now(),
  created_by  text default 'Rafael'
);

alter table tasks enable row level security;
create policy "Service role full access" on tasks using (true) with check (true);
