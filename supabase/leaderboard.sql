create table if not exists public.best_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  zone text not null,
  mode text not null,
  score numeric not null,
  updated_at timestamptz not null default now(),
  unique (user_id, zone, mode)
);

alter table public.best_scores enable row level security;

create policy "Public read access" on public.best_scores
  for select
  using (true);

create or replace view public.leaderboard_view as
select
  best_scores.zone,
  best_scores.mode,
  profiles.username,
  best_scores.score,
  best_scores.updated_at
from public.best_scores
left join public.profiles
  on profiles.id = best_scores.user_id;
