/* ============================================================
   YAZ LEAGUE · WINTER 2026-27
   Demo dataset: 24 παίκτες, 12 αγωνιστικές, Χ2, όμιλοι & Final-8.
   Παράγεται ντετερμινιστικά (ίδιο κάθε φορά) για τοπική προεπισκόπηση.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const NICKNAMES = [
    'MR. LAG', 'VISIT KASTORIA', 'KARIPIDIS', 'DCLN', 'AEGEAN_FOX',
    'MAPMAKER_GR', 'THESSALONIKI_DRIFT', 'PINDUS_WALKER', 'KYRA_VASILIKI', 'GEOMANIS',
    'SARONIC_SAILOR', 'CRETAN_ARROW', 'NORTH_WIND', 'ATHENS_NOCTURNE', 'OLIVE_BRANCH',
    'CYCLADES_7', 'EPIRUS_ECHO', 'SPORADES_SALT', 'KASTORIA_BLUE', 'PELOPONNESE_KID',
    'GRAMMOS_GHOST', 'LEMNOS_LIGHT', 'ZAGORI_ZOI', 'MERCHANT_OF_MAPS'
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

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function build() {
    const cfg = YAZ.config;
    const pts = cfg.points || [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const rnd = mulberry32(20261120);
    const schedule = (cfg.schedule || []).slice().sort((a, b) => a.week - b.week);

    const players = NICKNAMES.map((nick, i) => ({
      id: 'p' + String(i + 1).padStart(2, '0'),
      nickname: nick,
      joined_at: '2026-11-' + String(10 + (i % 8)).padStart(2, '0') + 'T12:00:00Z',
      is_active: true,
      is_patreon: [1, 4, 8, 13].includes(i)
    }));

    const skill = new Map(players.map((p, i) => [p.id, 100 - i * 1.15]));

    const matches = [];
    const results = [];

    schedule.forEach(meta => {
      ['map', 'quiz'].forEach(league => {
        const id = 'm' + meta.week + '-' + league;
        matches.push({
          id,
          week_number: meta.week,
          match_date: meta.date,
          league
        });

        const order = players
          .map(p => ({ p, perf: skill.get(p.id) + (rnd() * 62 - 13) }))
          .sort((a, b) => b.perf - a.perf);

        order.forEach((entry, idx) => {
          const placement = idx + 1;
          const base = placement <= pts.length ? pts[placement - 1] : 0;
          const raw = league === 'map'
            ? Math.round(25000 - (placement - 1) * 300 + rnd() * 380)
            : Math.round(1000 - (placement - 1) * 9 + rnd() * 26);

          results.push({
            id: id + '-' + entry.p.id,
            match_id: id,
            player_id: entry.p.id,
            placement,
            points: base,
            raw_score: raw,
            concept_bonus: false
          });
        });

        if (league === 'map') {
          const candidates = results.filter(r => r.match_id === id && r.placement <= 8);
          const lucky = candidates[Math.floor(rnd() * candidates.length)];
          if (lucky) {
            lucky.concept_bonus = true;
            lucky.points += (cfg.conceptBonus || 3);
          }
        }
      });
    });

    /* --- X2: Patreon Δεκέμβριος / Ιανουάριος + εορταστικές κληρώσεις --- */
    const multipliers = [];
    let mid = 0;
    const patronWeeks = { 5: 'patreon_dec', 8: 'patreon_jan' };
    players.filter(p => p.is_patreon).forEach(p => {
      Object.keys(patronWeeks).forEach(week => {
        multipliers.push({
          id: 'x' + (++mid),
          player_id: p.id,
          source: patronWeeks[week],
          awarded_week: null,
          used_week: Number(week)
        });
      });
    });

    const nonPatrons = players.filter(p => !p.is_patreon);
    [[6, 2], [7, 2]].forEach(([week, count]) => {
      shuffle(nonPatrons, rnd).slice(0, count).forEach(p => {
        multipliers.push({
          id: 'x' + (++mid),
          player_id: p.id,
          source: 'holiday',
          awarded_week: week,
          used_week: week
        });
      });
    });

    /* --- Κατάταξη προκριματικών & pots --- */
    const data = { players, matches, results, multipliers };
    const rows = YAZ.stats.standings(data);
    const top16 = rows.slice(0, 16);

    const groupMembers = [];
    const groups = (cfg.format && cfg.format.groupLabels) || ['A', 'B', 'C', 'D'];
    for (let pot = 1; pot <= 4; pot++) {
      const potRows = shuffle(top16.slice((pot - 1) * 4, pot * 4), rnd);
      potRows.forEach((row, i) => {
        groupMembers.push({
          id: 'gm' + groupMembers.length,
          group_label: groups[i],
          player_id: row.id,
          seed_rank: row.rank,
          pot
        });
      });
    }

    /* --- Όμιλοι: round robin 3 αγωνιστικών --- */
    const phaseMatches = [];
    let pmId = 0;
    const groupGames = [
      [[0, 1], [2, 3]],
      [[0, 2], [3, 1]],
      [[3, 0], [1, 2]]
    ];

    groups.forEach(label => {
      const members = groupMembers.filter(m => m.group_label === label);
      let slot = 0;
      groupGames.forEach((round, ri) => {
        round.forEach(pair => {
          const a = members[pair[0]];
          const b = members[pair[1]];
          slot += 1;
          const aSkill = skill.get(a.player_id) + 3;
          const bSkill = skill.get(b.player_id);
          const aWins = (aSkill - bSkill + 6) > rnd() * 12;
          const sa = aWins ? 8 + Math.floor(rnd() * 4) : 4 + Math.floor(rnd() * 4);
          const sb = aWins ? 3 + Math.floor(rnd() * 4) : 8 + Math.floor(rnd() * 4);
          phaseMatches.push({
            id: 'pm' + (++pmId),
            phase: 'group',
            group_label: label,
            round: ri + 1,
            slot,
            player_a: a.player_id,
            player_b: b.player_id,
            score_a: aWins ? Math.max(sa, sb + 1) : sa,
            score_b: aWins ? sb : Math.max(sb, sa + 1),
            winner_id: aWins ? a.player_id : b.player_id,
            played_at: null
          });
        });
      });
    });

    /* --- Οι 2 πρώτοι κάθε ομίλου --- */
    const groupStanding = {};
    groups.forEach(label => {
      const members = groupMembers.filter(m => m.group_label === label).map(m => ({
        id: m.player_id, wins: 0, diff: 0, pf: 0, seed: m.seed_rank
      }));
      const byId = new Map(members.map(m => [m.id, m]));
      phaseMatches.filter(m => m.phase === 'group' && m.group_label === label).forEach(m => {
        const a = byId.get(m.player_a);
        const b = byId.get(m.player_b);
        if (m.score_a != null) {
          a.pf += m.score_a; b.pf += m.score_b;
          a.diff += m.score_a - m.score_b;
          b.diff += m.score_b - m.score_a;
        }
        if (m.winner_id === m.player_a) a.wins += 1; else b.wins += 1;
      });
      members.sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pf - a.pf || a.seed - b.seed);
      groupStanding[label] = members;
    });

    const A = groupStanding.A, B = groupStanding.B, C = groupStanding.C, D = groupStanding.D;

    function duel(phase, slot, a, b, round) {
      const aSkill = skill.get(a) + (rnd() * 8 - 3);
      const bSkill = skill.get(b) + (rnd() * 8 - 3);
      const aWins = aSkill >= bSkill;
      let sa = 8 + Math.floor(rnd() * 4);
      let sb = 4 + Math.floor(rnd() * 4);
      if (!aWins) { const t = sa; sa = sb + 2; sb = t + 2; }
      else { sa = Math.max(sa, sb + 1); }
      return {
        id: 'pm' + (++pmId),
        phase,
        group_label: null,
        round,
        slot,
        player_a: a,
        player_b: b,
        score_a: sa,
        score_b: sb,
        winner_id: aWins ? a : b,
        played_at: null
      };
    }

    const qfPairs = [
      [A[0].id, B[1].id],
      [B[0].id, A[1].id],
      [C[0].id, D[1].id],
      [D[0].id, C[1].id]
    ];
    const qf = qfPairs.map((p, i) => duel('qf', i + 1, p[0], p[1], 1));
    phaseMatches.push(...qf);

    const sf1 = duel('sf', 1, qf[0].winner_id, qf[1].winner_id, 1);
    const sf2 = duel('sf', 2, qf[2].winner_id, qf[3].winner_id, 1);
    phaseMatches.push(sf1, sf2);

    const final = duel('final', 1, sf1.winner_id, sf2.winner_id, 1);
    final.score_a = 9;
    final.score_b = 7;
    final.winner_id = final.player_a;
    phaseMatches.push(final);

    const third = duel('third', 1,
      sf1.winner_id === sf1.player_a ? sf1.player_b : sf1.player_a,
      sf2.winner_id === sf2.player_a ? sf2.player_b : sf2.player_a,
      1
    );
    phaseMatches.push(third);

    return {
      players,
      matches,
      results,
      multipliers,
      groupMembers,
      phaseMatches
    };
  }

  YAZ.seed = { build };
})(window.YAZ);
