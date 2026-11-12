-- ============================================================
--  YAZ LEAGUE — Migration 003: security hardening
--  Τρέξε ΟΛΟ αυτό το αρχείο στο Supabase > SQL Editor > New query.
--  Είναι idempotent (μπορείς να το ξανατρέξεις με ασφάλεια).
--
--  Τι διορθώνει:
--   1. Κρύβει το players.first_name από τον δημόσιο API.
--   2. Περιορίζει τα δικαιώματα του anon σε SELECT-only (και σε
--      στενό INSERT μόνο για τη φόρμα εγγραφής).
--   3. Βάζει server-side validation constraints.
--   4. Εμποδίζει διπλές/μαζικές εγγραφές (case-insensitive + rate limit).
--   5. Καθαρίζει τα policies ώστε να είναι γνωστά και ελεγχόμενα.
--
--  ΠΡΙΝ ΤΟ ΤΡΕΞΕΙΣ, έλεγξε για διπλά ονόματα (αν υπάρχουν, το
--  unique index θα αποτύχει):
--    select lower(btrim(nickname)), count(*)
--    from public.players group by 1 having count(*) > 1;
--    select lower(btrim(nickname)), count(*)
--    from public.registrations where status = 'pending'
--    group by 1 having count(*) > 1;
-- ============================================================
--  ΣΗΜΑΝΤΙΚΟ: πριν πατήσεις Run, πάτησε Ctrl+A μέσα στον editor
--  ώστε να είναι επιλεγμένο ΟΛΟ το script (όχι μόνο μία γραμμή).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  Στήλες / παλιό schema
-- ------------------------------------------------------------
alter table public.registrations add column if not exists first_name text;
alter table public.players       add column if not exists first_name text;
alter table public.registrations add column if not exists client_hash text;

alter table public.registrations drop column if exists email;
alter table public.registrations drop column if exists geoguessr_url;
alter table public.registrations drop column if exists discord;
alter table public.players       drop column if exists geoguessr_url;
alter table public.players       drop column if exists discord;

alter table public.matches drop column if exists location_name;
alter table public.matches drop column if exists lat;
alter table public.matches drop column if exists lng;

-- ------------------------------------------------------------
--  Validation constraints (not valid = δεν σκάει σε παλιά rows)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_nickname_len') then
    alter table public.players add constraint players_nickname_len
      check (char_length(btrim(nickname)) between 2 and 40) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_nickname_trim') then
    alter table public.players add constraint players_nickname_trim
      check (nickname = btrim(nickname)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_nickname_no_ctrl') then
    alter table public.players add constraint players_nickname_no_ctrl
      check (nickname !~ '[[:cntrl:]]') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_first_name_len') then
    alter table public.players add constraint players_first_name_len
      check (first_name is null or char_length(btrim(first_name)) between 1 and 40) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'registrations_nickname_len') then
    alter table public.registrations add constraint registrations_nickname_len
      check (char_length(btrim(nickname)) between 2 and 40) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_nickname_trim') then
    alter table public.registrations add constraint registrations_nickname_trim
      check (nickname = btrim(nickname)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_nickname_no_ctrl') then
    alter table public.registrations add constraint registrations_nickname_no_ctrl
      check (nickname !~ '[[:cntrl:]]') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_first_name_len') then
    alter table public.registrations add constraint registrations_first_name_len
      check (first_name is null or char_length(btrim(first_name)) between 1 and 40) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_first_name_no_ctrl') then
    alter table public.registrations add constraint registrations_first_name_no_ctrl
      check (first_name is null or first_name !~ '[[:cntrl:]]') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_points_range') then
    alter table public.results add constraint results_points_range
      check (points between 0 and 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'results_raw_score_nonneg') then
    alter table public.results add constraint results_raw_score_nonneg
      check (raw_score is null or raw_score >= 0) not valid;
  end if;
end $$;

-- ------------------------------------------------------------
--  Uniqueness
-- ------------------------------------------------------------
create unique index if not exists players_nickname_lower_uniq
  on public.players (lower(btrim(nickname)));

create unique index if not exists registrations_pending_nickname_uniq
  on public.registrations (lower(btrim(nickname)))
  where status = 'pending';

create index if not exists idx_results_match    on public.results (match_id);
create index if not exists idx_results_player   on public.results (player_id);
create index if not exists idx_matches_week     on public.matches (week_number);
create index if not exists idx_regs_status      on public.registrations (status, created_at);
create index if not exists idx_regs_client_hash on public.registrations (client_hash, created_at);
create index if not exists idx_regs_created_at  on public.registrations (created_at);

-- ------------------------------------------------------------
--  RLS
-- ------------------------------------------------------------
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.results       enable row level security;
alter table public.registrations enable row level security;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  admin_email constant text := 'admin@example.com';
begin
  return lower(coalesce(auth.jwt() ->> 'email', '')) = lower(admin_email);
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ΠΡΟΣΟΧΗ: μόνο anon. Το first_name δεν πρέπει να είναι δημόσιο.
drop policy if exists "players_public_read" on public.players;
create policy "players_public_read"
  on public.players for select to anon using (true);

drop policy if exists "matches_public_read" on public.matches;
create policy "matches_public_read"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "results_public_read" on public.results;
create policy "results_public_read"
  on public.results for select to anon, authenticated using (true);

drop policy if exists "registrations_public_insert" on public.registrations;
create policy "registrations_public_insert"
  on public.registrations for insert to anon, authenticated
  with check (status = 'pending');

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

-- ------------------------------------------------------------
--  Privileges
-- ------------------------------------------------------------
revoke all on public.players       from anon;
revoke all on public.matches       from anon;
revoke all on public.results       from anon;
revoke all on public.registrations from anon;

-- Defense in depth: τίποτα δεν πρέπει να κληρονομείται από το PUBLIC,
-- και οι client ρόλοι δεν χρειάζονται δικαίωμα δημιουργίας στο schema.
revoke all on public.players       from public;
revoke all on public.matches       from public;
revoke all on public.results       from public;
revoke all on public.registrations from public;
revoke create on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select (id, nickname, joined_at, is_active) on public.players to anon;
grant select on public.matches to anon;
grant select on public.results to anon;
grant insert (nickname, first_name) on public.registrations to anon;

revoke all on public.players       from authenticated;
revoke all on public.matches       from authenticated;
revoke all on public.results       from authenticated;
revoke all on public.registrations from authenticated;

grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update, delete on public.results to authenticated;

grant select on public.registrations to authenticated;
grant update (status) on public.registrations to authenticated;
grant delete on public.registrations to authenticated;
grant insert (nickname, first_name) on public.registrations to authenticated;

-- ------------------------------------------------------------
--  Anti-spam trigger
-- ------------------------------------------------------------
create or replace function public.enforce_registration_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hdrs   json;
  ip     text;
  h      text;
  recent int;
begin
  new.nickname   := btrim(new.nickname);
  new.first_name := nullif(btrim(new.first_name), '');
  new.status     := 'pending';

  hdrs := nullif(current_setting('request.headers', true), '')::json;
  if hdrs is null then
    return new;
  end if;

  ip := nullif(split_part(coalesce(hdrs ->> 'x-forwarded-for', ''), ',', 1), '');
  if ip is null then
    ip := nullif(hdrs ->> 'cf-connecting-ip', '');
  end if;
  if ip is null then
    return new;
  end if;

  h := md5(ip);
  new.client_hash := h;

  select count(*) into recent
  from public.registrations
  where client_hash = h
    and created_at > now() - interval '15 minutes';

  if recent >= 5 then
    raise exception 'Πολλές αιτήσεις σε σύντομο διάστημα. Δοκίμασε ξανά σε λίγα λεπτά.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_registration_rules() from public;

drop trigger if exists trg_registration_rules on public.registrations;
create trigger trg_registration_rules
  before insert on public.registrations
  for each row execute function public.enforce_registration_rules();

notify pgrst, 'reload schema';

select 'Migration 003 applied successfully.' as result;
