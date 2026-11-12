/* ============================================================
   YAZ LEAGUE - Υπολογισμός στατιστικών (client-side)
   Όλα τα νούμερα της κατάταξης βγαίνουν από τα results.
   Κατάταξη: πόντοι → wildcards. Τίποτα άλλο.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function weeksOf(matches) {
    const set = new Set((matches || []).map(m => num(m.week_number)).filter(w => w > 0));
    return Array.from(set).sort((a, b) => a - b);
  }

  /* Ομάδα κατάταξης: κάθε N θέσεις = 1 ομάδα. Επιστρέφει μόνο αριθμό
     (1, 2, 3, …) χωρίς ονόματα. Το N έρχεται από config.groupSize. */
  function groupForRank(rank) {
    const size = (YAZ.config && Number(YAZ.config.groupSize)) || 4;
    return Math.floor((rank - 1) / size) + 1;
  }

  function standings(players, matches, results) {
    const matchById = new Map(matches.map(m => [String(m.id), m]));
    const rows = new Map();

    players.forEach(p => {
      rows.set(String(p.id), {
        id: p.id,
        nickname: p.nickname,
        is_active: p.is_active !== false,
        points: 0,
        games: 0,
        wins: 0,
        podiums: 0,
        wildcards: 0,
        best: 0,
        bestPlacement: Infinity,
        perWeek: new Map(),
        perWeekWildcards: new Map(),
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
      if (placement === 1) {
        row.wins += 1;
        row.wildcards += 1;
        row.perWeekWildcards.set(week, (row.perWeekWildcards.get(week) || 0) + 1);
      }
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

    /* Πορεία θέσης: σωρευτική βαθμολογία μετά από κάθε εβδομάδα.
       Ισοπαλία σε πόντους+wildcards → ίδια θέση. */
    weeks.forEach(w => {
      const cumulative = list.map(row => {
        let pts = 0;
        let wc = 0;
        row.perWeek.forEach((v, k) => { if (k <= w) pts += v; });
        row.perWeekWildcards.forEach((v, k) => { if (k <= w) wc += v; });
        return { row, pts, wc };
      });

      cumulative.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.wc !== a.wc) return b.wc - a.wc;
        return String(a.row.id).localeCompare(String(b.row.id));
      });

      let lastPts = null;
      let lastWc = null;
      let lastRank = 0;
      cumulative.forEach((entry, i) => {
        let rank;
        if (lastPts !== null && entry.pts === lastPts && entry.wc === lastWc) {
          rank = lastRank;
        } else {
          rank = i + 1;
          lastRank = rank;
          lastPts = entry.pts;
          lastWc = entry.wc;
        }
        if (!entry.row.rankHistory) entry.row.rankHistory = [];
        entry.row.rankHistory.push({ week: w, rank: rank, points: entry.pts, wildcards: entry.wc });
      });
    });

    list.forEach(row => {
      if (!row.rankHistory) row.rankHistory = [];
      row.avg = row.games ? row.points / row.games : 0;
      if (!isFinite(row.bestPlacement)) row.bestPlacement = null;
    });

    /* Κανονική κατάταξη: πόντοι, μετά wildcards. */
    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wildcards !== a.wildcards) return b.wildcards - a.wildcards;
      return String(a.id).localeCompare(String(b.id));
    });

    let lastPts = null;
    let lastWc = null;
    let lastRank = 0;
    list.forEach((row, i) => {
      if (lastPts !== null && row.points === lastPts && row.wildcards === lastWc) {
        row.rank = lastRank;
      } else {
        row.rank = i + 1;
        lastRank = row.rank;
        lastPts = row.points;
        lastWc = row.wildcards;
      }
      row.group = groupForRank(row.rank);

      /* Μετακίνηση θέσης από την προηγούμενη εβδομάδα */
      const h = row.rankHistory;
      row.delta = h.length >= 2 ? (h[h.length - 2].rank - h[h.length - 1].rank) : 0;
    });

    return list;
  }

  /* Επόμενη Παρασκευή 19:00 (τοπική ώρα).
     Διάρκεια αγωνιστικής: 2 ώρες (19:00 - 21:00).
     Αν είμαστε Παρασκευή μεταξύ 19:00 και 21:00, η αγωνιστική είναι LIVE τώρα. */
  function nextFriday19() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0, 0);
    const matchDurationMs = 2 * 60 * 60 * 1000;
    let diff = (5 - d.getDay() + 7) % 7;
    if (diff === 0 && now.getTime() >= d.getTime() + matchDurationMs) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  YAZ.stats = { standings, weeksOf, nextFriday19, groupForRank };
})(window.YAZ);
