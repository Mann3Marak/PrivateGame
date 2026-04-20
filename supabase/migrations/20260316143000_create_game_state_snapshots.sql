create table if not exists public.game_state_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_state_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'game_state_snapshots'
      and policyname = 'Deny direct access to game snapshots'
  ) then
    create policy "Deny direct access to game snapshots"
      on public.game_state_snapshots
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;
end $$;
