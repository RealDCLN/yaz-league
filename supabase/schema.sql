-- ============================================================
--  YAZ LEAGUE - Supabase schema
--  Τρέξε ολόκληρο αυτό το αρχείο στο Supabase > SQL Editor > New query.
--  ΠΡΙΝ ΤΟ ΤΡΕΞΕΙΣ: άλλαξε το ADMIN_EMAIL παρακάτω στο email του διοργανωτή.
--
--  Το αρχείο είναι idempotent: μπορείς να το ξανατρέξεις πάνω σε
--  υπάρχουσα βάση για να εφαρμόσεις τις διορθώσεις ασφαλείας.
--  Αν έχεις ήδη βάση, μπορείς αντί για όλο το αρχείο να τρέξεις
--  τα supabase/migrations/003_security_hardening.sql και
--  supabase/migrations/004_username_birth_year_city.sql.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null unique,
  first_name    text,
  birth_year    int,
  city          text,
  joined_at     timestamptz not null default now(),
  is_active     boolean not null default true
);

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  week_number   int  not null check (week_number > 0),
  match_date    timestamptz not null,
  league        text not null check (league in ('map', 'quiz')),
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
  first_name    text,
  birth_year    int,
  city          text,
  created_at    timestamptz not null default now(),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected'))
);

-- Αν οι πίνακες υπήρχαν ήδη από παλαιότερη έκδοση του schema, το
-- `create table if not exists` παραπάνω ΔΕΝ πειράζει τις στήλες τους.
alter table public.registrations add column if not exists first_name text;
alter table public.registrations add column if not exists birth_year int;
alter table public.registrations add column if not exists city       text;
alter table public.players       add column if not exists first_name text;
alter table public.players       add column if not exists birth_year int;
alter table public.players       add column if not exists city       text;

-- Μόνο hash της IP για το anti-spam rate limit. Δεν αποθηκεύεται η IP.
alter table public.registrations add column if not exists client_hash text;

alter table public.registrations drop column if exists email;
alter table public.registrations drop column if exists geoguessr_url;
alter table public.registrations drop column if exists discord;
alter table public.players       drop column if exists geoguessr_url;
alter table public.players       drop column if exists discord;

-- Οι στήλες τοποθεσίας/συντεταγμένων ανήκαν στον scrapped χάρτη «Οι διαδρομές μας».
alter table public.matches drop column if exists location_name;
alter table public.matches drop column if exists lat;
alter table public.matches drop column if exists lng;

-- ------------------------------------------------------------
--  Server-side validation constraints
--  (not valid = δεν σκάει σε παλιά δεδομένα, αλλά ελέγχει κάθε νέα
--   εγγραφή). Οι έλεγχοι γίνονται στη βάση, όχι μόνο στον browser.
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
  if not exists (select 1 from pg_constraint where conname = 'players_birth_year_range') then
    alter table public.players add constraint players_birth_year_range
      check (birth_year is null or birth_year between 1900 and 2100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_city_len') then
    alter table public.players add constraint players_city_len
      check (city is null or char_length(btrim(city)) between 1 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_city_no_ctrl') then
    alter table public.players add constraint players_city_no_ctrl
      check (city is null or city !~ '[[:cntrl:]]') not valid;
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
  if not exists (select 1 from pg_constraint where conname = 'registrations_birth_year_range') then
    alter table public.registrations add constraint registrations_birth_year_range
      check (birth_year is null or birth_year between 1900 and 2100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_city_len') then
    alter table public.registrations add constraint registrations_city_len
      check (city is null or char_length(btrim(city)) between 1 and 60) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'registrations_city_no_ctrl') then
    alter table public.registrations add constraint registrations_city_no_ctrl
      check (city is null or city !~ '[[:cntrl:]]') not valid;
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
--  Κανονικοποίηση ονομάτων
--  Names/usernames are stored in ALL CAPS. The trigger also trims
--  whitespace, so manually typed names and form submissions are
--  identical without any extra work in the admin panel.
-- ------------------------------------------------------------
create or replace function public.normalize_person_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nickname   := upper(btrim(new.nickname));
  new.first_name := nullif(upper(btrim(new.first_name)), '');
  new.city       := nullif(btrim(new.city), '');
  return new;
end;
$$;

revoke all on function public.normalize_person_fields() from public;

drop trigger if exists trg_players_normalize on public.players;
create trigger trg_players_normalize
  before insert or update on public.players
  for each row execute function public.normalize_person_fields();

drop trigger if exists trg_registrations_normalize on public.registrations;
create trigger trg_registrations_normalize
  before insert or update on public.registrations
  for each row execute function public.normalize_person_fields();

-- ------------------------------------------------------------
--  Uniqueness (case-insensitive για να μην έχουμε "DCLN" και "dcln")
-- ------------------------------------------------------------
-- Αν το index αποτύχει, έχεις διπλά ονόματα. Τρέξε πρώτα:
--   select lower(btrim(nickname)), count(*) from public.players
--   group by 1 having count(*) > 1;
-- και διόρθωσε/έσβησε τα διπλά.
create unique index if not exists players_nickname_lower_uniq
  on public.players (lower(btrim(nickname)));

-- Να μην μπορεί κάποιος να στείλει 50 ίδιες εκκρεμείς αιτήσεις.
create unique index if not exists registrations_pending_nickname_uniq
  on public.registrations (lower(btrim(nickname)))
  where status = 'pending';

create index if not exists idx_results_match        on public.results (match_id);
create index if not exists idx_results_player       on public.results (player_id);
create index if not exists idx_matches_week         on public.matches (week_number);
create index if not exists idx_regs_status          on public.registrations (status, created_at);
create index if not exists idx_regs_client_hash     on public.registrations (client_hash, created_at);
create index if not exists idx_regs_created_at      on public.registrations (created_at);

-- ------------------------------------------------------------
--  RLS
-- ------------------------------------------------------------
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.results       enable row level security;
alter table public.registrations enable row level security;

-- Βοηθητική συνάρτηση: είναι ο συνδεδεμένος χρήστης ο διαχειριστής;
-- >>> ΑΛΛΑΞΕ ΤΟ EMAIL ΕΔΩ <<<
-- Το email έρχεται από το υπογεγραμμένο JWT του Supabase, οπότε δεν
-- μπορεί να πλαστογραφηθεί από τον browser.
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

-- Δημόσια ανάγνωση δεδομένων πρωταθλήματος.
-- ΣΗΜΑΝΤΙΚΟ: το players_public_read δίνεται ΜΟΝΟ στο anon. Τα
-- first_name/birth_year/city δεν πρέπει να διαβάζονται δημόσια· ο
-- admin τα βλέπει μέσω του players_admin_all.
drop policy if exists "players_public_read" on public.players;
create policy "players_public_read"
  on public.players for select to anon using (true);

drop policy if exists "matches_public_read" on public.matches;
create policy "matches_public_read"
  on public.matches for select to anon, authenticated using (true);

drop policy if exists "results_public_read" on public.results;
create policy "results_public_read"
  on public.results for select to anon, authenticated using (true);

-- Εγγραφή (δημόσια φόρμα). Το status πρέπει να είναι πάντα pending.
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

-- ------------------------------------------------------------
--  Table / column privileges (defense in depth πάνω από τα RLS)
--  Το Supabase δίνει από προεπιλογή πολλά δικαιώματα στο anon.
--  Εδώ τα περιορίζουμε στο ελάχιστο.
-- ------------------------------------------------------------
revoke all on public.players       from anon;
revoke all on public.matches       from anon;
revoke all on public.results       from anon;
revoke all on public.registrations from anon;

-- Το REVOKE ALL ON TABLE δεν πειράζει column-level grants. Καθάρισε
-- ρητά και τυχόν παλιά column grant στο first_name.
revoke all (id, nickname, first_name, birth_year, city, joined_at, is_active)
  on public.players from anon;

-- Defense in depth: τίποτα δεν πρέπει να κληρονομείται από το PUBLIC,
-- και οι client ρόλοι δεν χρειάζονται δικαίωμα δημιουργίας στο schema.
revoke all on public.players       from public;
revoke all on public.matches       from public;
revoke all on public.results       from public;
revoke all on public.registrations from public;
revoke create on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Ο δημόσιος επισκέπτης βλέπει μόνο τα μη-ευαίσθητα πεδία των παικτών.
grant select (id, nickname, joined_at, is_active) on public.players to anon;
grant select on public.matches to anon;
grant select on public.results to anon;

-- Η φόρμα μπορεί να γράψει ΜΟΝΟ nickname + first_name + birth_year + city.
-- Δεν μπορεί να ορίσει status/created_at/client_hash/id.
grant insert (nickname, first_name, birth_year, city) on public.registrations to anon;

-- Ο authenticated χρήστης είναι ο admin. Τα RLS φιλτράρουν τα rows.
-- Το πλήρες select στο players χρειάζεται για το first_name και για
-- το insert().select() του admin panel.
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
grant insert (nickname, first_name, birth_year, city) on public.registrations to authenticated;

-- ------------------------------------------------------------
--  Anti-spam για τη δημόσια φόρμα εγγραφής
--  Επιτρέπει έως 5 αιτήσεις / 15 λεπτά ανά IP. Η IP αποθηκεύεται
--  μόνο ως md5 hash. Αν τρέχεις SQL από το SQL Editor (χωρίς HTTP
--  headers), το rate limit παραλείπεται ώστε να δουλεύουν τα seeds.
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
    -- Δεν μπορούμε να ταυτοποιήσουμε IP (π.χ. SQL editor). Fail open.
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

-- Ανανέωσε το schema cache του PostgREST ώστε να δουν αμέσως οι
-- αλλαγές τα policies/grants.
notify pgrst, 'reload schema';
