-- ============================================================
--  YAZ LEAGUE · Migration 007 · Registration rate limit
--
--  Το X-Forwarded-For μπορεί να το γράψει ο client. Το πρώτο
--  στοιχείο της λίστας δεν είναι αξιόπιστο· ο proxy προσθέτει τη
--  σωστή IP στο ΤΕΛΟΣ της κεφαλίδας. Έτσι το όριο των 5 αιτήσεων /
--  15 λεπτά δεν παρακάμπτεται με ένα ψεύτικο header.
--
--  Τρέξε ΟΛΟΚΛΗΡΟ το αρχείο στο Supabase > SQL Editor.
--  Είναι idempotent.
-- ============================================================

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

  -- Το πρώτο στοιχείο του X-Forwarded-For το ελέγχει ο client. Το
  -- τελευταίο το προσθέτει ο proxy, οπότε είναι το αξιόπιστο.
  ip := nullif(btrim(coalesce(
    (regexp_match(coalesce(hdrs ->> 'x-forwarded-for', ''), '([^,]+)\s*$'))[1],
    ''
  )), '');
  if ip is null then
    ip := nullif(btrim(hdrs ->> 'cf-connecting-ip'), '');
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

notify pgrst, 'reload schema';
