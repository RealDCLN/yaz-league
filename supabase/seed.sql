-- ============================================================
--  YAZ LEAGUE — Seed data
--  40 παίκτες, 8 αγωνιστικές (Χάρτης + Quiz), πλήρη αποτελέσματα.
--  Τρέξε το ΜΕΤΑ το schema.sql, στο ίδιο SQL Editor.
--
--  ⚠️  DEVELOPMENT ONLY. The TRUNCATE below is intentionally commented
--      out so this file can't wipe a live database by accident. On a
--      fresh / dev project, uncomment it to reset state first.
--
--  Reset (opt-in):
--  truncate public.results, public.matches, public.players cascade;
--
--  The seed uses random() for skill jitter. setseed() makes the run
--  reproducible-ish within a single session; results still won't be
--  byte-identical to the front-end demo seed, but match-by-match they
--  will be consistent across reruns on the same Postgres instance.
-- ============================================================

select setseed(0.20260918);

insert into public.players (nickname) values
  ('MR. LAG'),
  ('VISIT KASTORIA'),
  ('KARIPIDIS'),
  ('DCLN'),
  ('AEGEAN_FOX'),
  ('MAPMAKER_GR'),
  ('THESSALONIKI_DRIFT'),
  ('PINDUS_WALKER'),
  ('KYRA_VASILIKI'),
  ('GEOMANIS'),
  ('SARONIC_SAILOR'),
  ('CRETAN_ARROW'),
  ('NORTH_WIND'),
  ('ATHENS_NOCTURNE'),
  ('OLIVE_BRANCH'),
  ('CYCLADES_7'),
  ('EPIRUS_ECHO'),
  ('SPORADES_SALT'),
  ('KASTORIA_BLUE'),
  ('PELOPONNESE_KID'),
  ('GRAMMOS_GHOST'),
  ('LEMNOS_LIGHT'),
  ('ZAGORI_ZOI'),
  ('MERCHANT_OF_MAPS'),
  ('CHIOS_MASTIC'),
  ('RODOS_RIDER'),
  ('ARTA_BRIDGE'),
  ('MYTILENE_MOON'),
  ('KALAMATA_EYE'),
  ('VOYAGEUR_JR'),
  ('SANTORINI_STEP'),
  ('DRAMA_DUSK'),
  ('PRESPA_PELICAN'),
  ('KERKYRA_RAIN'),
  ('NAXOS_NORTH'),
  ('TRIKALA_TRACK'),
  ('SKYROS_SHADE'),
  ('PATRAS_PIER'),
  ('ITHACA_ITH'),
  ('LAST_PORT');

insert into public.matches (week_number, match_date, league, location_name, lat, lng) values
  (1, '2026-09-18T19:00:00+03:00', 'map',  'Ρέικιαβικ, Ισλανδία',        64.1466, -21.9426),
  (1, '2026-09-18T19:00:00+03:00', 'quiz', null, null, null),
  (2, '2026-09-25T19:00:00+03:00', 'map',  'Κιότο, Ιαπωνία',             35.0116, 135.7681),
  (2, '2026-09-25T19:00:00+03:00', 'quiz', null, null, null),
  (3, '2026-10-02T19:00:00+03:00', 'map',  'Βαλπαραΐσο, Χιλή',          -33.0472, -71.6127),
  (3, '2026-10-02T19:00:00+03:00', 'quiz', null, null, null),
  (4, '2026-10-09T19:00:00+03:00', 'map',  'Σουακοπμούντ, Ναμίμπια',    -22.5594, 17.0832),
  (4, '2026-10-09T19:00:00+03:00', 'quiz', null, null, null),
  (5, '2026-10-16T19:00:00+03:00', 'map',  'Λόφοτεν, Νορβηγία',          68.2094, 13.6106),
  (5, '2026-10-16T19:00:00+03:00', 'quiz', null, null, null),
  (6, '2026-10-23T19:00:00+03:00', 'map',  'Κουίνσταουν, Νέα Ζηλανδία', -45.0312, 168.6626),
  (6, '2026-10-23T19:00:00+03:00', 'quiz', null, null, null),
  (7, '2026-10-30T19:00:00+02:00', 'map',  'Σεφσαουέν, Μαρόκο',          35.1688, -5.2636),
  (7, '2026-10-30T19:00:00+02:00', 'quiz', null, null, null),
  (8, '2026-11-06T19:00:00+02:00', 'map',  'Νιουφαουντλάντ, Καναδάς',    47.5615, -52.7126),
  (8, '2026-11-06T19:00:00+02:00', 'quiz', null, null, null);

create temp table if not exists _skill (nickname text primary key, skill numeric);

insert into _skill (nickname, skill) values
  ('MR. LAG', 100), ('VISIT KASTORIA', 99.15), ('KARIPIDIS', 98.3), ('DCLN', 97.45),
  ('AEGEAN_FOX', 96.6), ('MAPMAKER_GR', 95.75), ('THESSALONIKI_DRIFT', 94.9),
  ('PINDUS_WALKER', 94.05), ('KYRA_VASILIKI', 93.2), ('GEOMANIS', 92.35),
  ('SARONIC_SAILOR', 91.5), ('CRETAN_ARROW', 90.65), ('NORTH_WIND', 89.8),
  ('ATHENS_NOCTURNE', 88.95), ('OLIVE_BRANCH', 88.1), ('CYCLADES_7', 87.25),
  ('EPIRUS_ECHO', 86.4), ('SPORADES_SALT', 85.55), ('KASTORIA_BLUE', 84.7),
  ('PELOPONNESE_KID', 83.85), ('GRAMMOS_GHOST', 83), ('LEMNOS_LIGHT', 82.15),
  ('ZAGORI_ZOI', 81.3), ('MERCHANT_OF_MAPS', 80.45), ('CHIOS_MASTIC', 79.6),
  ('RODOS_RIDER', 78.75), ('ARTA_BRIDGE', 77.9), ('MYTILENE_MOON', 77.05),
  ('KALAMATA_EYE', 76.2), ('VOYAGEUR_JR', 75.35), ('SANTORINI_STEP', 74.5),
  ('DRAMA_DUSK', 73.65), ('PRESPA_PELICAN', 72.8), ('KERKYRA_RAIN', 71.95),
  ('NAXOS_NORTH', 71.1), ('TRIKALA_TRACK', 70.25), ('SKYROS_SHADE', 69.4),
  ('PATRAS_PIER', 68.55), ('ITHACA_ITH', 67.7), ('LAST_PORT', 66.85);

do $$
declare
  m           record;
  r           record;
  i           int;
  pts         int[] := array[12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  bonus_id    uuid;
begin
  for m in select id, league from public.matches order by week_number, league loop
    i := 0;

    for r in
      select p.id
      from public.players p
      join _skill s on s.nickname = p.nickname
      order by s.skill + (random() * 70 - 15) desc
    loop
      i := i + 1;

      insert into public.results (match_id, player_id, placement, points, raw_score, concept_bonus)
      values (
        m.id, r.id, i,
        case when i <= 10 then pts[i] else 0 end,
        case when m.league = 'map'
             then round((25500 - (i - 1) * 380 + random() * 400)::numeric, 0)
             else round((1000  - (i - 1) * 12  + random() * 30)::numeric, 0)
        end,
        false
      );
    end loop;

    if m.league = 'map' then
      select player_id into bonus_id
      from public.results
      where match_id = m.id and placement <= 6
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
