create table if not exists public.daily_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  target_key text not null,
  attempts_used integer not null default 0,
  solved boolean not null default false,
  solved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_attempts enable row level security;

create policy "Daily attempts read own" on public.daily_attempts
  for select
  using (auth.uid() = user_id);

create or replace view public.daily_leaderboard as
select
  daily_attempts.date,
  profiles.username,
  daily_attempts.solved,
  daily_attempts.attempts_used,
  daily_attempts.solved_at
from public.daily_attempts
left join public.profiles
  on profiles.id = daily_attempts.user_id;

alter view public.daily_leaderboard set (security_invoker = true);

grant select on public.daily_leaderboard to anon, authenticated;
