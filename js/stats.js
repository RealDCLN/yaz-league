/* ============================================================
   YAZ LEAGUE · WINTER 2026-27
   Υπολογισμοί κατάταξης, αγωνιστικών, ομίλων και bracket.
   Όλα τα νούμερα βγαίνουν από τα results + multipliers.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function config() {
    return YAZ.config || {};
  }

  function schedule() {
    return (config().schedule || []).slice().sort((a, b) => a.week - b.week);
  }

  function weekMeta(week) {
    return schedule().find(w => Number(w.week) === Number(week)) || null;
  }

  function weekDate(week) {
    const meta = weekMeta(week);
    if (!meta) return null;
    const d = new Date(meta.date);
    return isNaN(d.getTime()) ? null : d;
  }

  function pointsFor(place) {
    const pts = config().points || [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    return (place >= 1 && place <= pts.length) ? num(pts[place - 1]) : 0;
  }

  function weeksOf(matches) {
    return Array.from(new Set((matches || [])
      .map(m => num(m.week_number))
      .filter(w => w > 0)))
      .sort((a, b) => a - b);
  }

  function multiplierMap(multipliers) {
    const map = new Map();
    (multipliers || []).forEach(m => {
      const player = String(m.player_id);
      const week = num(m.used_week);
      if (!week) return;
      if (!map.has(player)) map.set(player, new Set());
      map.get(player).add(week);
    });
    return map;
  }

  function multiplierByWeek(multipliers) {
    const map = new Map();
    (multipliers || []).forEach(m => {
      const week = num(m.used_week);
      if (!week) return;
      if (!map.has(week)) map.set(week, []);
      map.get(week).push(m);
    });
    return map;
  }

  /* ---------------- matchday / season state ---------------- */

  const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

  function nextMatchday(now, played) {
    const n = now ? now.getTime() : Date.now();
    const done = played instanceof Set
      ? played
      : new Set((played || []).map(w => num(w)));
    const list = schedule();

    // Μόνο όταν έχουν καταχωρηθεί ΟΛΕΣ οι αγωνιστικές θεωρούμε ότι
    // τελείωσε η σεζόν. Αλλιώς ακολουθούμε τις ημερομηνίες, ώστε μια
    // πρόωρη καταχώρηση αποτελέσματος να μη «πηδάει» αγωνιστικές.
    if (list.length && list.every(meta => done.has(num(meta.week)))) {
      return null;
    }

    for (const meta of list) {
      const start = new Date(meta.date).getTime();
      if (isNaN(start)) continue;
      const end = start + MATCH_DURATION_MS;
      if (n < end) {
        return {
          meta,
          start: new Date(start),
          end: new Date(end),
          isLive: n >= start,
          isNext: n < start
        };
      }
    }
    return null;
  }

  function seasonStatus(now) {
    const n = now ? now.getTime() : Date.now();
    const list = schedule();
    if (!list.length) return 'unknown';
    const first = new Date(list[0].date).getTime();
    const last = new Date(list[list.length - 1].date).getTime() + MATCH_DURATION_MS;
    if (n < first) return 'upcoming';
    if (n <= last) return 'running';
    return 'finished';
  }

  function playedWeeks(matches, results) {
    const withResults = new Set();
    const matchById = new Map((matches || []).map(m => [String(m.id), m]));
    (results || []).forEach(r => {
      const m = matchById.get(String(r.match_id));
      if (m) withResults.add(num(m.week_number));
    });
    return Array.from(withResults).filter(w => w > 0).sort((a, b) => a - b);
  }

  /* ---------------- standings ---------------- */

  function standings(data) {
    const players = (data && data.players) || [];
    const matches = (data && data.matches) || [];
    const results = (data && data.results) || [];
    const multipliers = (data && data.multipliers) || [];
    const cfg = config();

    const matchById = new Map(matches.map(m => [String(m.id), m]));
    const x2ByPlayer = multiplierMap(multipliers);
    const rows = new Map();

    players.forEach(p => {
      rows.set(String(p.id), {
        id: p.id,
        nickname: p.nickname,
        is_active: p.is_active !== false,
        is_patreon: !!p.is_patreon,
        points: 0,
        basePoints: 0,
        mapPoints: 0,
        quizPoints: 0,
        games: 0,
        matchdays: 0,
        wins: 0,
        podiums: 0,
        wildcards: 0,
        x2: 0,
        concept: 0,
        best: 0,
        bestWeek: 0,
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

      const week = num(m.week_number);
      const placement = num(r.placement);
      const pts = num(r.points);
      const raw = num(r.raw_score);

      if (!row.perWeek.has(week)) {
        row.perWeek.set(week, {
          week,
          map: 0,
          quiz: 0,
          base: 0,
          points: 0,
          multiplier: 1,
          concept: false,
          wildcard: false,
          games: 0,
          results: []
        });
      }
      const wk = row.perWeek.get(week);

      wk.games += 1;
      wk.base += pts;
      if (m.league === 'quiz') wk.quiz += pts;
      else wk.map += pts;

      if (r.concept_bonus) {
        row.concept += 1;
        wk.concept = true;
      }

      if (placement === 1) row.wins += 1;
      if (placement > 0 && placement <= 3) row.podiums += 1;
      if (placement > 0 && placement < row.bestPlacement) row.bestPlacement = placement;
      if (raw > row.best) row.best = raw;

      row.perMatch.push({
        week,
        league: m.league,
        placement,
        points: pts,
        raw_score: raw,
        concept_bonus: !!r.concept_bonus
      });
    });

    const allWeeks = Array.from(new Set([
      ...weeksOf(matches),
      ...schedule().map(w => num(w.week)),
      ...Array.from(rows.values()).flatMap(r => Array.from(r.perWeek.keys()))
    ].filter(w => w > 0))).sort((a, b) => a - b);

    const list = Array.from(rows.values());

    const x2Set = x2ByPlayer;
    x2Set.forEach((weeks, playerId) => {
      const row = rows.get(playerId);
      if (!row) return;
      row.x2 = weeks.size;
    });

    /* Effective points: ο Χ2 διπλασιάζει ΟΛΟΥΣ τους πόντους της
       συγκεκριμένης αγωνιστικής (χάρτης + quiz + concept bonus). */
    list.forEach(row => {
      row.perWeek.forEach(wk => {
        wk.multiplier = x2Set.has(String(row.id)) && x2Set.get(String(row.id)).has(wk.week) ? 2 : 1;
        wk.concept = !!wk.concept;
        wk.points = wk.base * wk.multiplier;
        wk.mapEffective = wk.map * wk.multiplier;
        wk.quizEffective = wk.quiz * wk.multiplier;

        row.basePoints += wk.base;
        row.points += wk.points;
        row.mapPoints += wk.mapEffective;
        row.quizPoints += wk.quizEffective;
        row.matchdays += 1;
        row.games += 0;
      });
    });

    /* Wild cards: ο/οι παίκτης(-ες) με τους περισσότερους συνολικούς
       πόντους (χάρτης + quiz) κάθε αγωνιστικής. Σε ισοπαλία κερδίζουν
       όλοι οι ισόπαλοι πρώτοι. */
    const wildcardWeeks = new Map();
    allWeeks.forEach(week => {
      const totals = list
        .map(row => ({ row, pts: row.perWeek.has(week) ? row.perWeek.get(week).points : 0 }))
        .filter(x => x.pts > 0);

      if (!totals.length) return;
      const max = Math.max(...totals.map(t => t.pts));
      const winners = totals.filter(t => t.pts === max);
      wildcardWeeks.set(week, {
        week,
        points: max,
        winners: winners.map(w => w.row),
        shared: winners.length > 1
      });
      winners.forEach(w => {
        w.row.wildcards += 1;
        w.row.perWeek.get(week).wildcard = true;
      });
    });

    list.forEach(row => {
      row.perWeek.forEach(wk => {
        if (wk.points > row.bestWeek) row.bestWeek = wk.points;
      });
      row.avg = row.matchdays ? row.points / row.matchdays : 0;
      if (!isFinite(row.bestPlacement)) row.bestPlacement = null;
      row.perMatch.sort((a, b) => a.week - b.week || String(a.league).localeCompare(String(b.league)));
    });

    /* Πορεία θέσης: σωρευτικά μετά από κάθε αγωνιστική που έχει
       αποτελέσματα. */
    const actualWeeks = playedWeeks(matches, results);
    actualWeeks.forEach(week => {
      const snapshot = list.map(row => {
        let pts = 0;
        let wc = 0;
        row.perWeek.forEach((wk, w) => {
          if (w <= week) { pts += wk.points; wc += wk.wildcard ? 1 : 0; }
        });
        return { row, pts, wc };
      });

      snapshot.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.wc !== a.wc) return b.wc - a.wc;
        return String(a.row.nickname).localeCompare(String(b.row.nickname), 'el');
      });

      let lastPts = null;
      let lastWc = null;
      let lastRank = 0;
      snapshot.forEach((entry, i) => {
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
        entry.row.rankHistory.push({ week, rank, points: entry.pts, wildcards: entry.wc });
      });
    });

    const tiebreak = (a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wildcards !== a.wildcards) return b.wildcards - a.wildcards;
      if (b.concept !== a.concept) return b.concept - a.concept;
      if (b.bestWeek !== a.bestWeek) return b.bestWeek - a.bestWeek;
      if (b.mapPoints + b.quizPoints !== a.mapPoints + a.quizPoints) {
        return (b.mapPoints + b.quizPoints) - (a.mapPoints + a.quizPoints);
      }
      return String(a.nickname).localeCompare(String(b.nickname), 'el');
    };

    list.sort(tiebreak);

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
      row.position = i + 1;
      row.group = groupForRank(row.rank);
      const h = row.rankHistory || [];
      row.delta = h.length >= 2 ? (h[h.length - 2].rank - h[h.length - 1].rank) : 0;
    });

    return list;
  }

  function groupForRank(rank) {
    const size = Math.max(1, num(config().groupSize) || 4);
    return Math.floor((rank - 1) / size) + 1;
  }

  /* ---------------- pots & qualification ---------------- */

  function pots(rows) {
    const cfg = config();
    const potCount = num((cfg.format && cfg.format.pots)) || 4;
    const out = [];
    for (let p = 1; p <= potCount; p++) {
      out.push({
        pot: p,
        label: 'Pot ' + p,
        range: ((p - 1) * 4 + 1) + '–' + (p * 4),
        rows: rows.slice((p - 1) * 4, p * 4)
      });
    }
    return out;
  }

  /* ---------------- matchday summaries ---------------- */

  function effectiveForWeek(row, week) {
    const wk = row && row.perWeek ? row.perWeek.get(num(week)) : null;
    return wk ? wk.points : 0;
  }

  function matchdaySummaries(data) {
    const players = (data && data.players) || [];
    const matches = (data && data.matches) || [];
    const results = (data && data.results) || [];
    const multipliers = (data && data.multipliers) || [];
    const rows = (data && data.standings) || standings(data);
    const rowById = new Map(rows.map(r => [String(r.id), r]));
    const playerById = new Map(players.map(p => [String(p.id), p]));
    const matchById = new Map(matches.map(m => [String(m.id), m]));

    const mapByWeek = new Map();
    matches.forEach(m => {
      const w = num(m.week_number);
      if (!mapByWeek.has(w)) mapByWeek.set(w, {});
      mapByWeek.get(w)[m.league] = m;
    });

    const resultsByMatch = new Map();
    results.forEach(r => {
      const key = String(r.match_id);
      if (!resultsByMatch.has(key)) resultsByMatch.set(key, []);
      resultsByMatch.get(key).push(r);
    });

    const x2Week = multiplierByWeek(multipliers);
    const playerName = id => {
      const p = playerById.get(String(id));
      const row = rowById.get(String(id));
      return (p && p.nickname) || (row && row.nickname) || '—';
    };

    return schedule().map(meta => {
      const week = num(meta.week);
      const start = new Date(meta.date);
      const end = new Date(start.getTime() + MATCH_DURATION_MS);
      const now = Date.now();
      const pair = mapByWeek.get(week) || {};
      const mapMatch = pair.map || null;
      const quizMatch = pair.quiz || null;

      const enrich = r => {
        const row = rowById.get(String(r.player_id));
        const player = playerById.get(String(r.player_id));
        return {
          playerId: r.player_id,
          nickname: (player && player.nickname) || (row && row.nickname) || '—',
          placement: num(r.placement),
          basePoints: num(r.points),
          points: num(r.points) * (row && row.perWeek.get(week) ? row.perWeek.get(week).multiplier : 1),
          concept: !!r.concept_bonus,
          row
        };
      };

      const mapResults = mapMatch ? (resultsByMatch.get(String(mapMatch.id)) || []).map(enrich) : [];
      const quizResults = quizMatch ? (resultsByMatch.get(String(quizMatch.id)) || []).map(enrich) : [];

      const sortEvent = list => list.slice().sort((a, b) => {
        if (a.placement !== b.placement) return a.placement - b.placement;
        return b.points - a.points;
      });

      const combined = new Map();
      [...mapResults, ...quizResults].forEach(r => {
        const key = String(r.playerId);
        if (!combined.has(key)) {
          combined.set(key, {
            playerId: r.playerId,
            nickname: r.nickname,
            map: 0,
            quiz: 0,
            total: 0,
            concept: false,
            row: r.row
          });
        }
        const c = combined.get(key);
        if (mapResults.includes(r)) c.map += r.basePoints; else c.quiz += r.basePoints;
        c.total += r.points;
        if (r.concept) c.concept = true;
      });

      const combinedList = Array.from(combined.values())
        .map(c => {
          const row = rowById.get(String(c.playerId));
          const mult = row && row.perWeek.get(week) ? row.perWeek.get(week).multiplier : 1;
          return { ...c, multiplier: mult, total: (c.map + c.quiz) * mult };
        })
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total || b.map + b.quiz - (a.map + a.quiz) || String(a.nickname).localeCompare(String(b.nickname), 'el'));

      const max = combinedList.length ? combinedList[0].total : 0;
      const wildcardWinners = max > 0 ? combinedList.filter(c => c.total === max) : [];

      const conceptFinders = mapResults.filter(r => r.concept);

      const x2Players = (x2Week.get(week) || []).map(m => ({
        playerId: m.player_id,
        nickname: playerName(m.player_id),
        source: m.source
      }));

      const hasResults = mapResults.length > 0 || quizResults.length > 0;
      const isLive = now >= start.getTime() && now < end.getTime();
      const isDone = hasResults || now >= end.getTime();
      const status = isLive ? 'live' : (!isDone ? 'upcoming' : (hasResults ? 'played' : 'missed'));

      return {
        week,
        meta,
        date: start,
        end,
        status,
        hasResults,
        mapMatch,
        quizMatch,
        mapResults: sortEvent(mapResults),
        quizResults: sortEvent(quizResults),
        mapTop: sortEvent(mapResults).slice(0, 3),
        quizTop: sortEvent(quizResults).slice(0, 3),
        mapWinner: sortEvent(mapResults)[0] || null,
        quizWinner: sortEvent(quizResults)[0] || null,
        conceptFinders,
        combined: combinedList,
        wildcardWinners,
        wildcardPoints: max,
        x2Players,
        participants: combined.size
      };
    });
  }

  /* ---------------- groups ---------------- */

  function winnerOfMatch(m) {
    if (!m) return null;
    if (m.winner_id) return String(m.winner_id);
    const a = m.score_a;
    const b = m.score_b;
    if (a != null && b != null) {
      const na = num(a);
      const nb = num(b);
      if (na > nb) return String(m.player_a);
      if (nb > na) return String(m.player_b);
    }
    return null;
  }

  function groupTables(data) {
    const players = (data && data.players) || [];
    const members = (data && data.groupMembers) || [];
    const phaseMatches = (data && data.phaseMatches) || [];
    const cfg = config();
    const labels = (cfg.format && cfg.format.groupLabels) || ['A', 'B', 'C', 'D'];
    const advance = num((cfg.format && cfg.format.advancePerGroup)) || 2;
    const playerById = new Map(players.map(p => [String(p.id), p]));

    const groupMatches = phaseMatches.filter(m => m.phase === 'group');

    return labels.map(label => {
      const groupMembers = members
        .filter(m => m.group_label === label)
        .map(m => {
          const p = playerById.get(String(m.player_id));
          return {
            playerId: m.player_id,
            nickname: (p && p.nickname) || '—',
            seed_rank: num(m.seed_rank),
            pot: num(m.pot),
            played: 0, wins: 0, draws: 0, losses: 0,
            pointsFor: 0, pointsAgainst: 0, diff: 0, points: 0
          };
        });

      const byId = new Map(groupMembers.map(m => [String(m.playerId), m]));
      const fixtures = groupMatches
        .filter(m => m.group_label === label)
        .sort((a, b) => num(a.round) - num(b.round) || num(a.slot) - num(b.slot))
        .map(m => {
          const winner = winnerOfMatch(m);
          const a = byId.get(String(m.player_a));
          const b = byId.get(String(m.player_b));
          if (winner && a && b) {
            const aWon = winner === String(m.player_a);
            const bWon = winner === String(m.player_b);
            a.played += 1; b.played += 1;
            if (aWon) { a.wins += 1; b.losses += 1; }
            else if (bWon) { b.wins += 1; a.losses += 1; }
            else { a.draws += 1; b.draws += 1; }

            if (m.score_a != null && m.score_b != null) {
              const sa = num(m.score_a);
              const sb = num(m.score_b);
              a.pointsFor += sa; a.pointsAgainst += sb;
              b.pointsFor += sb; b.pointsAgainst += sa;
            } else if (aWon) {
              a.pointsFor += 1; b.pointsAgainst += 1;
            } else if (bWon) {
              b.pointsFor += 1; a.pointsAgainst += 1;
            }
          }
          return {
            ...m,
            winner,
            playerAName: (playerById.get(String(m.player_a)) || {}).nickname || '—',
            playerBName: (playerById.get(String(m.player_b)) || {}).nickname || '—',
            aWon: winner === String(m.player_a),
            bWon: winner === String(m.player_b),
            complete: !!winner
          };
        });

      groupMembers.forEach(m => {
        m.diff = m.pointsFor - m.pointsAgainst;
        m.points = m.wins * 3 + m.draws;
      });

      const table = groupMembers.slice().sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        if (a.seed_rank !== b.seed_rank) return a.seed_rank - b.seed_rank;
        return String(a.nickname).localeCompare(String(b.nickname), 'el');
      });

      table.forEach((m, i) => {
        m.position = i + 1;
        m.qualified = i < advance;
      });

      return {
        label,
        members: groupMembers,
        table,
        fixtures,
        complete: fixtures.length > 0 && fixtures.every(f => f.complete),
        hasDraw: groupMembers.length > 0
      };
    });
  }

  /* ---------------- final-8 bracket ---------------- */

  function bracket(data) {
    const players = (data && data.players) || [];
    const phaseMatches = (data && data.phaseMatches) || [];
    const playerById = new Map(players.map(p => [String(p.id), p]));
    const groups = groupTables(data);
    const groupWinner = {};
    const groupRunner = {};
    groups.forEach(g => {
      const t = g.table || [];
      if (t[0]) groupWinner[g.label] = t[0];
      if (t[1]) groupRunner[g.label] = t[1];
    });

    function name(id) {
      if (!id) return null;
      const p = playerById.get(String(id));
      return p ? p.nickname : null;
    }

    function decorate(m) {
      if (!m) return null;
      const winner = winnerOfMatch(m);
      return {
        ...m,
        winner,
        playerAName: name(m.player_a),
        playerBName: name(m.player_b),
        complete: !!winner,
        aWon: winner === String(m.player_a),
        bWon: winner === String(m.player_b)
      };
    }

    const qf = phaseMatches.filter(m => m.phase === 'qf').sort((a, b) => num(a.slot) - num(b.slot)).map(decorate);
    const sf = phaseMatches.filter(m => m.phase === 'sf').sort((a, b) => num(a.slot) - num(b.slot)).map(decorate);
    const final = decorate(phaseMatches.find(m => m.phase === 'final'));
    const third = decorate(phaseMatches.find(m => m.phase === 'third'));

    return {
      groups,
      groupWinner,
      groupRunner,
      qf, sf, final, third,
      champion: final && final.winner ? final.winner : null,
      championName: final && final.winner ? name(final.winner) : null,
      runnerUp: final && final.winner
        ? (String(final.winner) === String(final.player_a) ? name(final.player_b) : name(final.player_a))
        : null,
      bronze: third && third.winner ? name(third.winner) : null
    };
  }

  YAZ.stats = {
    num,
    schedule,
    weekMeta,
    weekDate,
    weeksOf,
    playedWeeks,
    pointsFor,
    nextMatchday,
    seasonStatus,
    standings,
    pots,
    groupForRank,
    matchdaySummaries,
    groupTables,
    bracket,
    winnerOfMatch,
    multiplierMap,
    multiplierByWeek
  };
})(window.YAZ);
