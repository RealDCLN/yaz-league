-- ============================================================
--  YAZ LEAGUE · Migration 006 · Public username
--
--  Τελική σειρά πεδίων:
--    • first_name = ΔΗΜΟΣΙΟ username GeoGuessr (leaderboard)
--    • nickname   = ΙΔΙΩΤΙΚΟ όνομα παίκτη
--
--  Αλλάζει:
--    • τα δημόσια grants ώστε το anon να διαβάζει first_name
--      και όχι nickname
--    • τα unique indexes ώστε μοναδικό να είναι το username
--      (first_name) και όχι το ιδιωτικό όνομα
--    • συμπληρώνει first_name = nickname όπου έλειπε, για να μην
--      εμφανίζονται κενά usernames στην κατάταξη
--
--  ΔΕΝ κάνει swap τιμών. Είναι idempotent και ασφαλές να τρέξει
--  ξανά. Τρέξε ΟΛΟΚΛΗΡΟ το αρχείο στο Supabase > SQL Editor.
-- ============================================================

do $$
declare
  con record;
begin
  -- ----------------------------------------------------------
  --  1. Fallback για παλιούς παίκτες χωρίς δημόσιο username
  -- ----------------------------------------------------------
  if to_regclass('public.players') is not null then
    update public.players
    set first_name = nickname
    where first_name is null or btrim(first_name) = '';
  end if;

  if to_regclass('public.registrations') is not null then
    update public.registrations
    set first_name = nickname
    where first_name is null or btrim(first_name) = '';
  end if;

  -- ----------------------------------------------------------
  --  2. Το unique ανήκει πλέον στο δημόσιο username
  -- ----------------------------------------------------------
  if to_regclass('public.players') is not null then
    for con in
      select conname
      from pg_constraint
      where conrelid = 'public.players'::regclass
        and contype = 'u'
    loop
      execute format('alter table public.players drop constraint %I', con.conname);
    end loop;

    drop index if exists public.players_nickname_lower_uniq;
    drop index if exists public.players_first_name_lower_uniq;

    create unique index players_first_name_lower_uniq
      on public.players (lower(btrim(first_name)))
      where first_name is not null;
  end if;

  if to_regclass('public.registrations') is not null then
    drop index if exists public.registrations_pending_nickname_uniq;
    drop index if exists public.registrations_pending_first_name_uniq;

    create unique index registrations_pending_first_name_uniq
      on public.registrations (lower(btrim(first_name)))
      where status = 'pending';
  end if;

  -- ----------------------------------------------------------
  --  3. Δημόσιο grant: first_name αντί για nickname
  -- ----------------------------------------------------------
  revoke select (id, nickname, joined_at, is_active) on public.players from anon;
  grant select (id, first_name, joined_at, is_active) on public.players to anon;

  -- Το is_patreon μπορεί να λείπει αν δεν έχει τρέξει το 005.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'is_patreon'
  ) then
    revoke select (is_patreon) on public.players from anon;
    grant select (is_patreon) on public.players to anon;
  end if;
end $$;

notify pgrst, 'reload schema';
