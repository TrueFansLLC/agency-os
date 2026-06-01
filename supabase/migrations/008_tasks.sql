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
drop policy if exists "Service role full access" on tasks;
create policy "Service role full access" on tasks
  for all to service_role using (true) with check (true);

alter table tasks
  add column if not exists employee_id uuid references employees(id) on delete set null,
  add column if not exists telegram_message_id integer;
