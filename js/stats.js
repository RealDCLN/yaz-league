/* ============================================================
   YAZ LEAGUE — Υπολογισμός στατιστικών (client-side)
   Όλα τα νούμερα της κατάταξης βγαίνουν από τα results.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function weeksOf(matches) {
    const set = new Set(matches.map(m => num(m.week_number)));
    return Array.from(set).sort((a, b) => a - b);
  }

  function tierForRank(rank) {
    const tiers = (YAZ.config && YAZ.config.tiers) || [];
    for (let i = 0; i < tiers.length; i++) {
      if (rank >= tiers[i].from && rank <= tiers[i].to) return tiers[i];
    }
    return { id: 'bronze', name: 'Χάλκινος' };
  }

  function standings(players, matches, results) {
    const matchById = new Map(matches.map(m => [String(m.id), m]));
    const rows = new Map();

    players.forEach(p => {
      rows.set(String(p.id), {
        id: p.id,
        nickname: p.nickname,
        geoguessr_url: p.geoguessr_url || '',
        discord: p.discord || '',
        is_active: p.is_active !== false,
        points: 0,
        games: 0,
        wins: 0,
        podiums: 0,
        best: 0,
        bestPlacement: Infinity,
        perWeek: new Map(),
        perMatch: []
      });
    });

    results.forEach(r => {
      const row = rows.get(String(r.player_id));
      if (!row) return;
      const m = matchById.get(String(r.match_id));
      if (!m) return;

      const pts = num(r.points);
      const placement = num(r.placement);
      const raw = num(r.raw_score);
      const week = num(m.week_number);

      row.points += pts;
      row.games += 1;
      if (placement === 1) row.wins += 1;
      if (placement > 0 && placement <= 3) row.podiums += 1;
      if (raw > row.best) row.best = raw;
      if (placement > 0 && placement < row.bestPlacement) row.bestPlacement = placement;

      row.perWeek.set(week, (row.perWeek.get(week) || 0) + pts);
      row.perMatch.push({
        week: week,
        league: m.league,
        placement: placement,
        points: pts,
        raw_score: raw,
        concept_bonus: !!r.concept_bonus
      });
    });

    const weeks = weeksOf(matches);
    const list = Array.from(rows.values());

    /* Πορεία θέσης: σωρευτική βαθμολογία μετά από κάθε εβδομάδα */
    weeks.forEach(w => {
      const cumulative = list.map(row => {
        let total = 0;
        row.perWeek.forEach((v, k) => { if (k <= w) total += v; });
        return { row, total };
      });

      cumulative.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.row.wins !== a.row.wins) return b.row.wins - a.row.wins;
        if (b.row.podiums !== a.row.podiums) return b.row.podiums - a.row.podiums;
        return a.row.nickname.localeCompare(b.row.nickname, 'el');
      });

      let lastTotal = null;
      let lastRank = 0;
      cumulative.forEach((entry, i) => {
        let rank;
        if (lastTotal !== null && entry.total === lastTotal) {
          rank = lastRank;
        } else {
          rank = i + 1;
          lastRank = rank;
          lastTotal = entry.total;
        }
        if (!entry.row.rankHistory) entry.row.rankHistory = [];
        entry.row.rankHistory.push({ week: w, rank: rank, points: entry.total });
      });
    });

    list.forEach(row => {
      if (!row.rankHistory) row.rankHistory = [];
      row.avg = row.games ? row.points / row.games : 0;
      if (!isFinite(row.bestPlacement)) row.bestPlacement = null;
    });

    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      return a.nickname.localeCompare(b.nickname, 'el');
    });

    list.forEach((row, i) => {
      row.rank = i + 1;
      row.tier = tierForRank(row.rank);

      /* Μετακίνηση θέσης από την προηγούμενη εβδομάδα */
      const h = row.rankHistory;
      row.delta = h.length >= 2 ? (h[h.length - 2].rank - h[h.length - 1].rank) : 0;
    });

    return list;
  }

  /* Επόμενη Παρασκευή 19:00 (τοπική ώρα) */
  function nextFriday19() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0, 0);
    let diff = (5 - d.getDay() + 7) % 7;
    if (diff === 0 && now.getTime() >= d.getTime()) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  YAZ.stats = { standings, weeksOf, nextFriday19, tierForRank };
})(window.YAZ);
