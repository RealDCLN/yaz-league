-- ============================================================
--  YAZ LEAGUE · WINTER 2026-27 · Seed data
--  24 παίκτες, 12 αγωνιστικές × 2 δοκιμασίες, Χ2.
--  Τρέξε το ΜΕΤΑ το schema.sql (ή μετά το migration 005).
--
--  ⚠️  DEVELOPMENT / DEMO ONLY.
--  Το TRUNCATE είναι σχολιασμένο για να μην σβήσει ζωντανή βάση.
--  Σε καθαρό project, ενεργοποίησέ το για reset:
--
--  truncate public.phase_matches, public.group_members,
--           public.multipliers, public.results, public.matches,
--           public.players cascade;
--
--  Οι όμιλοι και το Final-8 ΔΕΝ σπέρνονται εδώ: γίνονται από το
--  admin panel («Φάσεις → Κλήρωση ομίλων») μετά τα προκριματικά.
-- ============================================================

select setseed(0.20261120);

-- Ασφάλεια: το seed προσθέτει 24 παίκτες και δεν είναι idempotent.
-- Σε βάση που έχει ήδη δεδομένα θα δημιουργούσε διπλότυπα.
do $$
begin
  if exists (select 1 from public.players) then
    raise exception 'Το seed.sql τρέχει μόνο σε άδεια βάση (υπάρχουν ήδη παίκτες). Ενεργοποίησε το TRUNCATE παραπάνω αν θέλεις reset.';
  end if;
end $$;

insert into public.players (nickname, is_patreon) values
  ('MR. LAG', false),
  ('VISIT KASTORIA', true),
  ('KARIPIDIS', false),
  ('DCLN', false),
  ('AEGEAN_FOX', true),
  ('MAPMAKER_GR', false),
  ('THESSALONIKI_DRIFT', false),
  ('PINDUS_WALKER', false),
  ('KYRA_VASILIKI', true),
  ('GEOMANIS', false),
  ('SARONIC_SAILOR', false),
  ('CRETAN_ARROW', false),
  ('NORTH_WIND', false),
  ('ATHENS_NOCTURNE', true),
  ('OLIVE_BRANCH', false),
  ('CYCLADES_7', false),
  ('EPIRUS_ECHO', false),
  ('SPORADES_SALT', false),
  ('KASTORIA_BLUE', false),
  ('PELOPONNESE_KID', false),
  ('GRAMMOS_GHOST', false),
  ('LEMNOS_LIGHT', false),
  ('ZAGORI_ZOI', false),
  ('MERCHANT_OF_MAPS', false);

-- Στο demo κάθε nickname είναι και δημόσιο username.
update public.players
set first_name = nickname
where first_name is null;

insert into public.matches (week_number, match_date, league) values
  (1,  '2026-11-20T19:30:00+02:00', 'map'), (1,  '2026-11-20T19:30:00+02:00', 'quiz'),
  (2,  '2026-11-27T19:30:00+02:00', 'map'), (2,  '2026-11-27T19:30:00+02:00', 'quiz'),
  (3,  '2026-12-03T19:30:00+02:00', 'map'), (3,  '2026-12-03T19:30:00+02:00', 'quiz'),
  (4,  '2026-12-11T19:30:00+02:00', 'map'), (4,  '2026-12-11T19:30:00+02:00', 'quiz'),
  (5,  '2026-12-18T19:30:00+02:00', 'map'), (5,  '2026-12-18T19:30:00+02:00', 'quiz'),
  (6,  '2026-12-25T19:30:00+02:00', 'map'), (6,  '2026-12-25T19:30:00+02:00', 'quiz'),
  (7,  '2027-01-01T19:30:00+02:00', 'map'), (7,  '2027-01-01T19:30:00+02:00', 'quiz'),
  (8,  '2027-01-08T19:30:00+02:00', 'map'), (8,  '2027-01-08T19:30:00+02:00', 'quiz'),
  (9,  '2027-01-15T19:30:00+02:00', 'map'), (9,  '2027-01-15T19:30:00+02:00', 'quiz'),
  (10, '2027-01-22T19:30:00+02:00', 'map'), (10, '2027-01-22T19:30:00+02:00', 'quiz'),
  (11, '2027-01-29T19:30:00+02:00', 'map'), (11, '2027-01-29T19:30:00+02:00', 'quiz'),
  (12, '2027-02-05T19:30:00+02:00', 'map'), (12, '2027-02-05T19:30:00+02:00', 'quiz');

-- Σταθερό skill ανά παίκτη, ίδιο με το front-end demo.
drop table if exists _skill;
create temp table _skill (nickname text primary key, skill numeric);

insert into _skill (nickname, skill) values
  ('MR. LAG', 100), ('VISIT KASTORIA', 98.85), ('KARIPIDIS', 97.7), ('DCLN', 96.55),
  ('AEGEAN_FOX', 95.4), ('MAPMAKER_GR', 94.25), ('THESSALONIKI_DRIFT', 93.1),
  ('PINDUS_WALKER', 91.95), ('KYRA_VASILIKI', 90.8), ('GEOMANIS', 89.65),
  ('SARONIC_SAILOR', 88.5), ('CRETAN_ARROW', 87.35), ('NORTH_WIND', 86.2),
  ('ATHENS_NOCTURNE', 85.05), ('OLIVE_BRANCH', 83.9), ('CYCLADES_7', 82.75),
  ('EPIRUS_ECHO', 81.6), ('SPORADES_SALT', 80.45), ('KASTORIA_BLUE', 79.3),
  ('PELOPONNESE_KID', 78.15), ('GRAMMOS_GHOST', 77), ('LEMNOS_LIGHT', 75.85),
  ('ZAGORI_ZOI', 74.7), ('MERCHANT_OF_MAPS', 73.55);

do $$
declare
  m        record;
  r        record;
  i        int;
  pts      int[] := array[12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
  bonus_id uuid;
begin
  for m in select id, league from public.matches order by week_number, league loop
    i := 0;

    for r in
      select p.id
      from public.players p
      join _skill s on s.nickname = p.nickname
      order by s.skill + (random() * 62 - 13) desc
    loop
      i := i + 1;

      insert into public.results (match_id, player_id, placement, points, raw_score, concept_bonus)
      values (
        m.id, r.id, i,
        case when i <= 10 then pts[i] else 0 end,
        case when m.league = 'map'
             then round((25000 - (i - 1) * 300 + random() * 380)::numeric, 0)
             else round((1000  - (i - 1) * 9   + random() * 26)::numeric, 0)
        end,
        false
      );
    end loop;

    if m.league = 'map' then
      select player_id into bonus_id
      from public.results
      where match_id = m.id and placement <= 8
      order by random() limit 1;

      if bonus_id is not null then
        update public.results
        set concept_bonus = true, points = points + 3
        where match_id = m.id and player_id = bonus_id;
      end if;
    end if;
  end loop;
end $$;

drop table if exists _skill;

-- ------------------------------------------------------------
--  Χ2: Patreon Δεκέμβριος (Αγ. 5) & Ιανουάριος (Αγ. 8)
--  Οι εορταστικές κληρώσεις (Αγ. 6 & 7) γίνονται από το admin
--  panel ώστε να είναι πραγματικά τυχαίες.
-- ------------------------------------------------------------
insert into public.multipliers (player_id, source, used_week)
select p.id, 'patreon_dec', 5
from public.players p
where p.is_patreon = true
on conflict do nothing;

insert into public.multipliers (player_id, source, used_week)
select p.id, 'patreon_jan', 8
from public.players p
where p.is_patreon = true
on conflict do nothing;
