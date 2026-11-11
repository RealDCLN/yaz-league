-- ============================================================
--  YAZ LEAGUE — Supabase schema
--  Τρέξε ολόκληρο αυτό το αρχείο στο Supabase > SQL Editor > New query.
--  ΠΡΙΝ ΤΟ ΤΡΕΞΕΙΣ: άλλαξε το ADMIN_EMAIL παρακάτω στο email του διοργανωτή.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null unique,
  geoguessr_url text,
  discord       text,
  joined_at     timestamptz not null default now(),
  is_active     boolean not null default true
);

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  week_number   int  not null check (week_number > 0),
  match_date    timestamptz not null,
  league        text not null check (league in ('map', 'quiz')),
  location_name text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now(),
  unique (week_number, league)
);

create table if not exists public.results (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  placement     int  not null check (placement > 0),
  points        int  not null default 0,
  raw_score     numeric,
  concept_bonus boolean not null default false,
  unique (match_id, player_id)
);

create table if not exists public.registrations (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null,
  geoguessr_url text,
  discord       text,
  email         text,
  created_at    timestamptz not null default now(),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists idx_results_match  on public.results (match_id);
create index if not exists idx_results_player on public.results (player_id);
create index if not exists idx_matches_week   on public.matches (week_number);
create index if not exists idx_regs_status    on public.registrations (status, created_at);

alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.results       enable row level security;
alter table public.registrations enable row level security;

-- Βοηθητική συνάρτηση: είναι ο συνδεδεμένος χρήστης ο διαχειριστής;
-- >>> ΑΛΛΑΞΕ ΤΟ EMAIL ΕΔΩ <<<
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'devoyageur@yazleague.gr'
$$;

-- Δημόσια ανάγνωση δεδομένων πρωταθλήματος
drop policy if exists "players_public_read" on public.players;
create policy "players_public_read"
  on public.players for select to anon, authenticated using (true);

drop policy if exists "matches_public_read" on public.matches;
create policy "matches_public_read"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "results_public_read" on public.results;
create policy "results_public_read"
  on public.results for select to anon, authenticated using (true);

-- Εγγραφή (δημόσια φόρμα)
drop policy if exists "registrations_public_insert" on public.registrations;
create policy "registrations_public_insert"
  on public.registrations for insert to anon, authenticated
  with check (status = 'pending');

-- Διαχειριστής: πλήρης πρόσβαση
drop policy if exists "players_admin_all" on public.players;
create policy "players_admin_all"
  on public.players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "matches_admin_all" on public.matches;
create policy "matches_admin_all"
  on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "results_admin_all" on public.results;
create policy "results_admin_all"
  on public.results for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "registrations_admin_read" on public.registrations;
create policy "registrations_admin_read"
  on public.registrations for select to authenticated using (public.is_admin());

drop policy if exists "registrations_admin_update" on public.registrations;
create policy "registrations_admin_update"
  on public.registrations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "registrations_admin_delete" on public.registrations;
create policy "registrations_admin_delete"
  on public.registrations for delete to authenticated using (public.is_admin());
