create extension if not exists pgcrypto;

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  zone text not null,
  mode text not null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  current_item_started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz,
  current_index integer not null default 0,
  total_answered integer not null default 0,
  correct_count integer not null default 0,
  errors_count integer not null default 0,
  max_errors integer,
  max_attempts integer not null,
  score numeric not null default 0,
  targets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.game_sessions enable row level security;

create index if not exists game_sessions_user_started_idx
  on public.game_sessions (user_id, started_at);

create index if not exists best_scores_zone_mode_idx
  on public.best_scores (zone, mode);
