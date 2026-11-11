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

insert into public.players (nickname, geoguessr_url, discord) values
  ('MR. LAG',              'https://www.geoguessr.com/user/1000000', 'mr.lag'),
  ('VISIT KASTORIA',       'https://www.geoguessr.com/user/1007717', 'visitkastoria'),
  ('KARIPIDIS',            'https://www.geoguessr.com/user/1015434', 'karipidis'),
  ('DCLN',                 'https://www.geoguessr.com/user/1023151', 'dcln'),
  ('AEGEAN_FOX',           'https://www.geoguessr.com/user/1030868', 'aegean_fox'),
  ('MAPMAKER_GR',          'https://www.geoguessr.com/user/1038585', 'mapmaker_gr'),
  ('THESSALONIKI_DRIFT',   'https://www.geoguessr.com/user/1046302', 'thessaloniki_drift'),
  ('PINDUS_WALKER',        'https://www.geoguessr.com/user/1054019', 'pindus_walker'),
  ('KYRA_VASILIKI',        'https://www.geoguessr.com/user/1061736', 'kyra_vasiliki'),
  ('GEOMANIS',             'https://www.geoguessr.com/user/1069453', 'geomanis'),
  ('SARONIC_SAILOR',       'https://www.geoguessr.com/user/1077170', 'saronic_sailor'),
  ('CRETAN_ARROW',         'https://www.geoguessr.com/user/1084887', 'cretan_arrow'),
  ('NORTH_WIND',           'https://www.geoguessr.com/user/1092604', 'north_wind'),
  ('ATHENS_NOCTURNE',      'https://www.geoguessr.com/user/1100321', 'athens_nocturne'),
  ('OLIVE_BRANCH',         'https://www.geoguessr.com/user/1108038', 'olive_branch'),
  ('CYCLADES_7',           'https://www.geoguessr.com/user/1115755', 'cyclades_7'),
  ('EPIRUS_ECHO',          'https://www.geoguessr.com/user/1123472', 'epirus_echo'),
  ('SPORADES_SALT',        'https://www.geoguessr.com/user/1131189', 'sporades_salt'),
  ('KASTORIA_BLUE',        'https://www.geoguessr.com/user/1138906', 'kastoria_blue'),
  ('PELOPONNESE_KID',      'https://www.geoguessr.com/user/1146623', 'peloponnese_kid'),
  ('GRAMMOS_GHOST',        'https://www.geoguessr.com/user/1154340', 'grammos_ghost'),
  ('LEMNOS_LIGHT',         'https://www.geoguessr.com/user/1162057', 'lemnos_light'),
  ('ZAGORI_ZOI',           'https://www.geoguessr.com/user/1169774', 'zagori_zoi'),
  ('MERCHANT_OF_MAPS',     'https://www.geoguessr.com/user/1177491', 'merchant_of_maps'),
  ('CHIOS_MASTIC',         'https://www.geoguessr.com/user/1185208', 'chios_mastic'),
  ('RODOS_RIDER',          'https://www.geoguessr.com/user/1192925', 'rodos_rider'),
  ('ARTA_BRIDGE',          'https://www.geoguessr.com/user/1200642', 'arta_bridge'),
  ('MYTILENE_MOON',        'https://www.geoguessr.com/user/1208359', 'mytilene_moon'),
  ('KALAMATA_EYE',         'https://www.geoguessr.com/user/1216076', 'kalamata_eye'),
  ('VOYAGEUR_JR',          'https://www.geoguessr.com/user/1223793', 'voyageur_jr'),
  ('SANTORINI_STEP',       'https://www.geoguessr.com/user/1231510', 'santorini_step'),
  ('DRAMA_DUSK',           'https://www.geoguessr.com/user/1239227', 'drama_dusk'),
  ('PRESPA_PELICAN',       'https://www.geoguessr.com/user/1246944', 'prespa_pelican'),
  ('KERKYRA_RAIN',         'https://www.geoguessr.com/user/1254661', 'kerkyra_rain'),
  ('NAXOS_NORTH',          'https://www.geoguessr.com/user/1262378', 'naxos_north'),
  ('TRIKALA_TRACK',        'https://www.geoguessr.com/user/1270095', 'trikala_track'),
  ('SKYROS_SHADE',         'https://www.geoguessr.com/user/1277812', 'skyros_shade'),
  ('PATRAS_PIER',          'https://www.geoguessr.com/user/1285529', 'patras_pier'),
  ('ITHACA_ITH',           'https://www.geoguessr.com/user/1293246', 'ithaca_ith'),
  ('LAST_PORT',            'https://www.geoguessr.com/user/1300963', 'last_port');

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

create temp table _skill (nickname text primary key, skill numeric) on commit drop;

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
