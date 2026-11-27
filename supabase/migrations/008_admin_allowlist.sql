-- ============================================================
--  YAZ LEAGUE · Migration 008 · Admin allowlist
--
--  Αφαιρεί το hardcoded admin email από το repo. Ο διαχειριστής
--  ορίζεται πλέον στον πίνακα public.admins και η is_admin() τον
--  διαβάζει server-side από το επαληθευμένο JWT.
--
--  Ασφαλής μετανάστευση: πριν αντικαταστήσει την is_admin(), διαβάζει
--  το admin email από την ΠΑΛΙΑ συνάρτηση και το προσθέτει στην
--  allowlist. Έτσι δεν χάνεις πρόσβαση στο /admin όταν τρέξεις αυτό
--  το αρχείο.
--
--  Τρέξε ΟΛΟΚΛΗΡΟ το αρχείο στο Supabase > SQL Editor. Είναι idempotent.
--
--  Αν στήνεις νέα βάση από το schema.sql, απλώς πρόσθεσε τον εαυτό σου:
--    insert into public.admins (email) values ('you@example.com');
-- ============================================================

create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Κράτα τον υπάρχοντα διαχειριστή πριν αλλάξει η συνάρτηση.
do $$
declare
  src text;
  previous_admin text;
begin
  select p.prosrc into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_admin'
  limit 1;

  if src is not null then
    previous_admin := (regexp_match(
      src,
      'admin_email\s+constant\s+text\s*:=\s*''([^'']+)'''
    ))[1];

    if previous_admin is not null then
      insert into public.admins (email)
      values (lower(btrim(previous_admin)))
      on conflict (email) do nothing;
    end if;
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_email text;
begin
  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if caller_email = '' then
    return false;
  end if;
  return exists (
    select 1 from public.admins a where a.email = caller_email
  );
end;
$$;

revoke all on public.admins       from public;
revoke all on public.admins       from anon;
revoke all on public.admins       from authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

notify pgrst, 'reload schema';

select 'Migration 008 applied successfully.' as result;
