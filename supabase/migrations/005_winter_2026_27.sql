-- ============================================================
--  YAZ LEAGUE · Migration 005 · WINTER 2026-27
--  Προσθέτει:
--    • players.is_patreon  (ενεργή συνδρομή VIVRE CARD)
--    • multipliers          (Χ2: Patreon Δεκ/Ιαν + κληρώσεις εορτών)
--    • group_members        (4 όμιλοι × 4, από 4 pots)
--    • phase_matches        (όμιλοι, προημιτελικά, ημιτελικά,
--                            τελικός, μικρός τελικός)
--
--  Τρέξε ΟΛΟΚΛΗΡΟ το αρχείο στο Supabase > SQL Editor.
--  Είναι idempotent: μπορείς να το ξανατρέξεις με ασφάλεια.
--
--  ΔΕΝ αγγίζει players / matches / results / registrations.
-- ============================================================

-- ------------------------------------------------------------
--  1. Patreon flag
-- ------------------------------------------------------------
alter table public.players
  add column if not exists is_patreon boolean not null default false;

-- Ο δημόσιος επισκέπτης μπορεί να βλέπει αν κάποιος είναι Patreon
-- (χρειάζεται για να εμφανίζονται σωστά τα διαθέσιμα Χ2).
grant select (id, nickname, joined_at, is_active, is_patreon)
  on public.players to anon;

-- ------------------------------------------------------------
--  2. Πίνακας Χ2
--     source:
--       patreon_dec  → 1 Χ2 Δεκεμβρίου για ενεργό συνδρομητή
--       patreon_jan  → 1 Χ2 Ιανουαρίου για ενεργό συνδρομητή
--       holiday      → κλήρωση εορταστικής αγωνιστικής
--     used_week = η αγωνιστική στην οποία εφαρμόζεται.
--     Χωρίς used_week το entitlement είναι διαθέσιμο αλλά ανενεργό.
-- ------------------------------------------------------------
create table if not exists public.multipliers (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  source        text not null check (source in ('patreon_dec', 'patreon_jan', 'holiday')),
  awarded_week  int,
  used_week     int,
  created_at    timestamptz not null default now(),
  constraint multipliers_awarded_week_pos check (awarded_week is null or awarded_week > 0),
  constraint multipliers_used_week_pos    check (used_week    is null or used_week    > 0)
);

-- Ένας Patreon entitlement ανά πηγή ανά παίκτη.
create unique index if not exists multipliers_patreon_uniq
  on public.multipliers (player_id, source)
  where source in ('patreon_dec', 'patreon_jan');

-- Μία κλήρωση εορτών ανά παίκτη ανά εορταστική αγωνιστική.
create unique index if not exists multipliers_holiday_uniq
  on public.multipliers (player_id, awarded_week)
  where source = 'holiday';

-- Ένα μόνο Χ2 μπορεί να εφαρμοστεί σε κάθε παίκτη ανά αγωνιστική.
create unique index if not exists multipliers_one_per_week
  on public.multipliers (player_id, used_week)
  where used_week is not null;

create index if not exists idx_multipliers_week
  on public.multipliers (used_week);
create index if not exists idx_multipliers_player
  on public.multipliers (player_id);

-- ------------------------------------------------------------
--  3. Όμιλοι (ένας παίκτης = ένας όμιλος)
-- ------------------------------------------------------------
create table if not exists public.group_members (
  id           uuid primary key default gen_random_uuid(),
  group_label  text not null check (group_label in ('A', 'B', 'C', 'D')),
  player_id    uuid not null unique references public.players(id) on delete cascade,
  seed_rank    int  not null check (seed_rank > 0),
  pot          int  not null check (pot between 1 and 4),
  created_at   timestamptz not null default now()
);

create index if not exists idx_group_members_group
  on public.group_members (group_label);

-- ------------------------------------------------------------
--  4. Αγώνες φάσεων
--     phase: group | qf | sf | final | third
--     Για τους ομίλους υπάρχει group_label (A–D) και round 1–3.
--     Για το νοκ-άουτ το group_label είναι null.
-- ------------------------------------------------------------
create table if not exists public.phase_matches (
  id           uuid primary key default gen_random_uuid(),
  phase        text not null check (phase in ('group', 'qf', 'sf', 'final', 'third')),
  group_label  text check (group_label is null or group_label in ('A', 'B', 'C', 'D')),
  round        int  not null default 1 check (round > 0),
  slot         int  not null default 1 check (slot > 0),
  player_a     uuid references public.players(id) on delete cascade,
  player_b     uuid references public.players(id) on delete cascade,
  score_a      int check (score_a is null or score_a >= 0),
  score_b      int check (score_b is null or score_b >= 0),
  winner_id    uuid references public.players(id) on delete set null,
  played_at    timestamptz,
  created_at   timestamptz not null default now(),
  constraint phase_matches_distinct_players
    check (player_a is null or player_b is null or player_a <> player_b)
);

-- Ένα slot ανά φάση/όμιλο. Το coalesce χειρίζεται το null του νοκ-άουτ.
create unique index if not exists phase_matches_slot_uniq
  on public.phase_matches (phase, coalesce(group_label, '-'), slot);

create index if not exists idx_phase_matches_phase
  on public.phase_matches (phase);

-- ------------------------------------------------------------
--  5. RLS
-- ------------------------------------------------------------
alter table public.multipliers   enable row level security;
alter table public.group_members enable row level security;
alter table public.phase_matches enable row level security;

drop policy if exists "multipliers_public_read" on public.multipliers;
create policy "multipliers_public_read"
  on public.multipliers for select to anon, authenticated using (true);

drop policy if exists "multipliers_admin_all" on public.multipliers;
create policy "multipliers_admin_all"
  on public.multipliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "group_members_public_read" on public.group_members;
create policy "group_members_public_read"
  on public.group_members for select to anon, authenticated using (true);

drop policy if exists "group_members_admin_all" on public.group_members;
create policy "group_members_admin_all"
  on public.group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "phase_matches_public_read" on public.phase_matches;
create policy "phase_matches_public_read"
  on public.phase_matches for select to anon, authenticated using (true);

drop policy if exists "phase_matches_admin_all" on public.phase_matches;
create policy "phase_matches_admin_all"
  on public.phase_matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
--  6. Grants
-- ------------------------------------------------------------
revoke all on public.multipliers   from anon;
revoke all on public.group_members from anon;
revoke all on public.phase_matches from anon;
revoke all on public.multipliers   from public;
revoke all on public.group_members from public;
revoke all on public.phase_matches from public;

grant select on public.multipliers   to anon;
grant select on public.group_members to anon;
grant select on public.phase_matches to anon;

revoke all on public.multipliers   from authenticated;
revoke all on public.group_members from authenticated;
revoke all on public.phase_matches from authenticated;

grant select, insert, update, delete on public.multipliers   to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.phase_matches to authenticated;

-- ------------------------------------------------------------
--  7. Διόρθωση παλιών αποτελεσμάτων
--     Νέα κλίμακα: 1η=12, 2η=10, 3η=8, 4η=7 … 10η=1.
--     Η 2η θέση έδινε 9 πόντους σε παλιές καταχωρήσεις.
--     Το concept bonus (+3) διατηρείται. Είναι idempotent.
-- ------------------------------------------------------------
with base(placement, pts) as (
  values (1, 12), (2, 10), (3, 8), (4, 7), (5, 6),
         (6, 5),  (7, 4),  (8, 3), (9, 2), (10, 1)
)
update public.results r
set points = base.pts + case when r.concept_bonus then 3 else 0 end
from base
where r.placement = base.placement
  and r.points <> base.pts + case when r.concept_bonus then 3 else 0 end;

-- Ανανέωσε το schema cache του PostgREST.
notify pgrst, 'reload schema';
