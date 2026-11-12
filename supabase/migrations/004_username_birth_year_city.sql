-- ============================================================
--  YAZ LEAGUE - Migration 004
--  Προσθέτει: έτος γέννησης + πόλη/περιφερειακή ενότητα,
--  και κάνει όλα τα ονόματα/usernames ΚΕΦΑΛΑΙΑ (και για τα
--  υπάρχοντα δεδομένα).
--
--  Τρέξε το ΟΛΟΚΛΗΡΟ στο Supabase > SQL Editor. Είναι idempotent.
-- ============================================================

-- ------------------------------------------------------------
--  1. Νέες στήλες
-- ------------------------------------------------------------
alter table public.players       add column if not exists birth_year int;
alter table public.players       add column if not exists city       text;
alter table public.registrations add column if not exists birth_year int;
alter table public.registrations add column if not exists city       text;

-- ------------------------------------------------------------
--  2. Υπάρχοντα δεδομένα -> ΚΕΦΑΛΑΙΑ
--     (τα unique indexes είναι πάνω σε lower(btrim(...)), οπότε
--      δεν δημιουργούνται διπλότυπα από το upper())
-- ------------------------------------------------------------
update public.players
   set nickname   = upper(btrim(nickname)),
       first_name = nullif(upper(btrim(first_name)), '')
 where nickname <> upper(btrim(nickname))
    or (first_name is not null and first_name <> upper(btrim(first_name)));

update public.registrations
   set nickname   = upper(btrim(nickname)),
       first_name = nullif(upper(btrim(first_name)), '')
 where nickname <> upper(btrim(nickname))
    or (first_name is not null and first_name <> upper(btrim(first_name)));

-- ------------------------------------------------------------
--  3. Server-side validation constraints
-- ------------------------------------------------------------
do $$
begin
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
end $$;

-- ------------------------------------------------------------
--  4. Αυτόματο ΚΕΦΑΛΑΙΑ για κάθε insert/update
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
--  5. Grants για τη δημόσια φόρμα
-- ------------------------------------------------------------
-- Τα νέα πεδία είναι προσωπικά: ο anon δεν πρέπει να μπορεί να τα
-- διαβάσει από το players (ακόμα κι αν κάποιο παλιό column grant έμεινε).
revoke all (birth_year, city) on public.players from anon;

grant insert (nickname, first_name, birth_year, city)
  on public.registrations to anon;
grant insert (nickname, first_name, birth_year, city)
  on public.registrations to authenticated;

-- Ανανέωσε το schema cache του PostgREST.
notify pgrst, 'reload schema';
