-- One-time bootstrap so the in-app /admin SQL tool works.
-- After running this ONCE in the Supabase SQL editor, all future SQL can be
-- run from the app (and from your phone) — no more pasting into Supabase.

-- exec_sql runs an arbitrary statement.
--  - If it returns rows (SELECT), they come back as JSON under "rows".
--  - If it's DDL/DML (alter/create/insert/update), it just runs and reports ok.
create or replace function exec_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Try as a row-returning query first.
  begin
    execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (' || query || ') as t'
      into result;
    return jsonb_build_object('rows', result);
  exception when others then
    -- Not a SELECT (or not wrappable) — run it directly.
    execute query;
    return jsonb_build_object('ok', true, 'message', 'Statement ausgeführt.');
  end;
end;
$$;

-- Lock it down: only the service_role (used server-side by the app) may call it.
revoke all on function exec_sql(text) from public, anon, authenticated;
grant execute on function exec_sql(text) to service_role;
