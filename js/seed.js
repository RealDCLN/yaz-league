/* ============================================================
   YAZ LEAGUE — Demo dataset
   Παράγει ντετερμινιστικά (ίδια κάθε φορά) 40 παίκτες,
   8 αγωνιστικές × 2 leagues και τα αποτελέσματά τους.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const NICKNAMES = [
    'MR. LAG', 'VISIT KASTORIA', 'KARIPIDIS', 'DCLN', 'AEGEAN_FOX',
    'MAPMAKER_GR', 'THESSALONIKI_DRIFT', 'PINDUS_WALKER', 'KYRA_VASILIKI', 'GEOMANIS',
    'SARONIC_SAILOR', 'CRETAN_ARROW', 'NORTH_WIND', 'ATHENS_NOCTURNE', 'OLIVE_BRANCH',
    'CYCLADES_7', 'EPIRUS_ECHO', 'SPORADES_SALT', 'KASTORIA_BLUE', 'PELOPONNESE_KID',
    'GRAMMOS_GHOST', 'LEMNOS_LIGHT', 'ZAGORI_ZOI', 'MERCHANT_OF_MAPS', 'CHIOS_MASTIC',
    'RODOS_RIDER', 'ARTA_BRIDGE', 'MYTILENE_MOON', 'KALAMATA_EYE', 'VOYAGEUR_JR',
    'SANTORINI_STEP', 'DRAMA_DUSK', 'PRESPA_PELICAN', 'KERKYRA_RAIN', 'NAXOS_NORTH',
    'TRIKALA_TRACK', 'SKYROS_SHADE', 'PATRAS_PIER', 'ITHACA_ITH', 'LAST_PORT'
  ];

  const WEEKS = [
    { week: 1, date: '2026-09-18T19:00:00+03:00' },
    { week: 2, date: '2026-09-25T19:00:00+03:00' },
    { week: 3, date: '2026-10-02T19:00:00+03:00' },
    { week: 4, date: '2026-10-09T19:00:00+03:00' },
    { week: 5, date: '2026-10-16T19:00:00+03:00' },
    { week: 6, date: '2026-10-23T19:00:00+03:00' },
    { week: 7, date: '2026-10-30T19:00:00+02:00' },
    { week: 8, date: '2026-11-06T19:00:00+02:00' }
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }


  function build() {
    const cfg = YAZ.config;
    const pts = cfg.points || [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const rnd = mulberry32(20260918);

    const players = NICKNAMES.map((nick, i) => ({
      id: 'p' + String(i + 1).padStart(2, '0'),
      nickname: nick,
      joined_at: '2026-09-' + String(10 + (i % 8)).padStart(2, '0') + 'T12:00:00Z',
      is_active: true,
      _skill: 100 - i * 0.85
    }));

    const matches = [];
    WEEKS.forEach(w => {
      ['map', 'quiz'].forEach(league => {
        matches.push({
          id: 'm' + w.week + '-' + league,
          week_number: w.week,
          match_date: w.date,
          league: league
        });
      });
    });

    const results = [];

    matches.forEach(m => {
      const order = players
        .map(p => ({ p, perf: p._skill + (rnd() * 70 - 15) }))
        .sort((a, b) => b.perf - a.perf);

      order.forEach((entry, idx) => {
        const placement = idx + 1;
        const base = placement <= pts.length ? pts[placement - 1] : 0;
        const raw = m.league === 'map'
          ? Math.round(25000 - (placement - 1) * 380 + rnd() * 400)
          : Math.round(1000 - (placement - 1) * 12 + rnd() * 30);

        results.push({
          id: m.id + '-' + entry.p.id,
          match_id: m.id,
          player_id: entry.p.id,
          placement: placement,
          points: base,
          raw_score: raw,
          concept_bonus: false
        });
      });

      if (m.league === 'map') {
        const candidates = results.filter(r => r.match_id === m.id && r.placement <= 6);
        const lucky = candidates[Math.floor(rnd() * candidates.length)];
        lucky.concept_bonus = true;
        lucky.points += (cfg.conceptBonus || 3);
      }
    });

    return {
      players: players.map(p => {
        const clean = Object.assign({}, p);
        delete clean._skill;
        return clean;
      }),
      matches,
      results
    };
  }

  YAZ.seed = { build };
})(window.YAZ);
