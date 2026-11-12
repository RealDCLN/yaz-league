-- ============================================================
--  YAZ LEAGUE - Migration 002: first_name only
--  Διορθώνει παλιές βάσεις που είχαν δημιουργηθεί με το παλιό
--  schema (χωρίς first_name, με email/geoguessr_url/discord).
--
--  Τρέξε το στο Supabase > SQL Editor. Είναι idempotent.
-- ============================================================

alter table public.registrations add column if not exists first_name text;
alter table public.players       add column if not exists first_name text;

alter table public.registrations drop column if exists email;
alter table public.registrations drop column if exists geoguessr_url;
alter table public.registrations drop column if exists discord;
alter table public.players       drop column if exists geoguessr_url;
alter table public.players       drop column if exists discord;

-- Οι στήλες τοποθεσίας/συντεταγμένων ανήκαν στον scrapped χάρτη.
alter table public.matches drop column if exists location_name;
alter table public.matches drop column if exists lat;
alter table public.matches drop column if exists lng;

notify pgrst, 'reload schema';
