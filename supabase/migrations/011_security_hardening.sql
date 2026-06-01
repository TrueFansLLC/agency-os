-- Existing deployments may already have broad grants from older migrations.
-- The app reads and writes business data through authenticated server routes.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'creators', 'markets', 'instagram_accounts', 'instagram_metric_snapshots',
    'sync_logs', 'content_items', 'content_metric_snapshots', 'viral_rules',
    'content_tags', 'creator_accounts', 'account_pairs', 'employees',
    'posting_schedule', 'post_dispatch_log',
    'daily_status_screenshots', 'weekly_stats_screenshots', 'threads_accounts',
    'threads_daily_batches', 'threads_generations', 'facebook_accounts',
    'facebook_metric_snapshots', 'tasks', 'raphael_documents',
    'raphael_chunks', 'raphael_messages'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
    end if;
  end loop;
end
$$;

revoke all on all sequences in schema public from anon, authenticated;
grant all on all sequences in schema public to service_role;

do $$
begin
  if to_regclass('public.account_pairs') is not null then
    execute 'drop policy if exists "Auth users full access" on public.account_pairs';
  end if;
  if to_regclass('public.creator_accounts') is not null then
    execute 'drop policy if exists "Auth users full access" on public.creator_accounts';
  end if;
  if to_regclass('public.employees') is not null then
    execute 'drop policy if exists "Auth users full access" on public.employees';
  end if;
  if to_regclass('public.tasks') is not null then
    execute 'drop policy if exists "Service role full access" on public.tasks';
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
