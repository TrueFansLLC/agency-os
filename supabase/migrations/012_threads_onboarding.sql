-- Threads onboarding and Telegram topic routing.
-- Existing text assignments stay intact; employee_id is the reliable link going forward.

alter table public.employees
  add column if not exists telegram_threads_thread_id integer;

alter table public.threads_accounts
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

alter table public.threads_daily_batches
  add column if not exists thread_id integer;

create index if not exists idx_threads_accounts_employee
  on public.threads_accounts(employee_id);

update public.threads_accounts as account
set employee_id = employee.id
from public.employees as employee
where account.employee_id is null
  and account.mitarbeiter is not null
  and lower(trim(account.mitarbeiter)) = lower(trim(employee.name));
