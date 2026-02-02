create table if not exists public.stats_global (
  id integer primary key default 1 check (id = 1),
  sessions_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.stats_zone_mode (
  zone text not null,
  mode text not null,
  sessions_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (zone, mode)
);

insert into public.stats_global (id, sessions_count)
values (1, 0)
on conflict (id) do nothing;

alter table public.stats_global enable row level security;
alter table public.stats_zone_mode enable row level security;

create policy "Public read access" on public.stats_global
  for select
  using (true);

create policy "Public read access" on public.stats_zone_mode
  for select
  using (true);

create or replace function public.increment_session_stats()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is null then
    return new;
  end if;

  if old.ended_at is not null then
    return new;
  end if;

  update public.stats_global
  set sessions_count = sessions_count + 1,
      updated_at = now()
  where id = 1;

  insert into public.stats_zone_mode (zone, mode, sessions_count, updated_at)
  values (new.zone, new.mode, 1, now())
  on conflict (zone, mode)
  do update set
    sessions_count = stats_zone_mode.sessions_count + 1,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger game_sessions_stats_increment
after update of ended_at on public.game_sessions
for each row
execute function public.increment_session_stats();
