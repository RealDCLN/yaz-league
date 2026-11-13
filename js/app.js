/* ============================================================
   YAZ LEAGUE · WINTER 2026-27
   Δημόσια σελίδα: countdown, κατάταξη, αγωνιστικές, φάσεις, φόρμα.
   ============================================================ */

(function () {
  'use strict';

  const Y = window.YAZ;
  const cfg = Y.config;
  const TZ = (cfg.season && cfg.season.timeZone) || 'Europe/Athens';

  const state = {
    players: [],
    matches: [],
    results: [],
    multipliers: [],
    groupMembers: [],
    phaseMatches: [],
    standings: [],
    summaries: [],
    groups: [],
    bracket: null,
    sort: { key: 'points', dir: 'desc' },
    chart: null,
    schema: {}
  };

  const $ = id => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    wireLinks();
    wireNav();
    wireReveal();
    wireModal();
    wireForm();
    wireBoardSorting();
    renderCalendarDots();

    const yearEl = $('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    startCountdown();
    boot();
  });

  async function boot() {
    try {
      const data = await Promise.race([
        Y.data.load(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Δεν υπάρχει απάντηση από τη βάση (timeout).')), 8000)
        )
      ]);

      state.players = data.players || [];
      state.matches = data.matches || [];
      state.results = data.results || [];
      state.multipliers = data.multipliers || [];
      state.groupMembers = data.groupMembers || [];
      state.phaseMatches = data.phaseMatches || [];
      state.schema = data.schema || Y.data.getSchema();

      const payload = {
        players: state.players,
        matches: state.matches,
        results: state.results,
        multipliers: state.multipliers
      };

      state.standings = Y.stats.standings(payload);
      state.summaries = Y.stats.matchdaySummaries(Object.assign({}, payload, { standings: state.standings }));

      const phasePayload = Object.assign({}, payload, {
        groupMembers: state.groupMembers,
        phaseMatches: state.phaseMatches
      });
      state.groups = Y.stats.groupTables(phasePayload);
      state.bracket = Y.stats.bracket(phasePayload);

      renderLeaders();
      renderBoard();
      renderMatchdays();
      renderPhases();
      updateSeasonUI();
    } catch (err) {
      console.error('[YAZ] data load failed:', err);
      const tbody = $('boardBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-row">Δεν ήταν δυνατή η φόρτωση της βαθμολογίας. Δοκίμασε ξανά σε λίγο.</td></tr>';
      }
      const md = $('matchdays');
      if (md) md.innerHTML = '<p class="loading-row">Δεν ήταν δυνατή η φόρτωση των αγωνιστικών.</p>';
    }
  }

  /* ---------------- links / nav / reveal ---------------- */

  function wireLinks() {
    document.querySelectorAll('[data-link]').forEach(el => {
      const key = el.getAttribute('data-link');
      let url = cfg.links && cfg.links[key];
      if (key === 'patreon' && !url) {
        url = cfg.links.discord;
        el.textContent = 'Ρώτα στο Discord για το VIVRE CARD →';
      }
      el.setAttribute('href', url || '#');
    });
  }

  function wireNav() {
    const toggle = $('navToggle');
    const nav = $('mainNav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού');
    });

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (ev) => {
      if (nav.classList.contains('is-open') && !nav.contains(ev.target) && !toggle.contains(ev.target)) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function wireReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
  }

  function renderCalendarDots() {
    const box = $('calendarDots');
    if (!box) return;
    box.innerHTML = Y.stats.schedule().map(meta => {
      const cls = meta.holiday ? 'is-holiday' : (meta.label === 'Πέμπτη' ? 'is-thursday' : '');
      return '<i class="' + cls + '"></i>';
    }).join('');
  }

  /* ---------------- countdown / season ---------------- */

  let countdownStarted = false;

  function playedWeekList() {
    return state.summaries.filter(s => s.hasResults).map(s => s.week);
  }

  function startCountdown() {
    if (countdownStarted) return;
    countdownStarted = true;

    const live = $('liveBadge');
    const nums = {
      days: document.querySelector('[data-cd="days"]'),
      hours: document.querySelector('[data-cd="hours"]'),
      minutes: document.querySelector('[data-cd="minutes"]'),
      seconds: document.querySelector('[data-cd="seconds"]')
    };
    const pad = n => String(n).padStart(2, '0');

    function tick() {
      const next = Y.stats.nextMatchday(new Date(), playedWeekList());
      if (!next) {
        if (live) live.classList.remove('is-on');
        if (nums.days) nums.days.textContent = '00';
        if (nums.hours) nums.hours.textContent = '00';
        if (nums.minutes) nums.minutes.textContent = '00';
        if (nums.seconds) nums.seconds.textContent = '00';
        const weekEl = $('nextWeek');
        if (weekEl) weekEl.textContent = '—';
        const when = $('nextWhen');
        if (when) when.textContent = 'Προκριματικά ολοκληρώθηκαν';
        const note = $('nextNote');
        if (note) note.textContent = 'Η σεζόν των προκριματικών ολοκληρώθηκε. Ακολουθούν οι φάσεις και το Final-8.';
        return;
      }

      const diff = next.start.getTime() - Date.now();
      if (live) live.classList.toggle('is-on', next.isLive);

      const remaining = Math.max(0, diff);
      const s = Math.floor(remaining / 1000);
      if (nums.days) nums.days.textContent = pad(Math.floor(s / 86400));
      if (nums.hours) nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      if (nums.minutes) nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      if (nums.seconds) nums.seconds.textContent = pad(s % 60);

      const weekEl = $('nextWeek');
      if (weekEl) weekEl.textContent = String(next.meta.week);
      const when = $('nextWhen');
      if (when) when.textContent = formatSession(next.start) + ' · ' + cfg.season.time;

      const note = $('nextNote');
      if (note) {
        if (next.isLive) {
          note.textContent = 'Είμαστε live! Μπες στο Party Mode και στο YouTube για την αγωνιστική ' + next.meta.week + '.';
        } else if (next.meta.holiday) {
          note.textContent = 'Εορταστική αγωνιστική: δύο τυχαίοι παίκτες κερδίζουν από ένα Χ2.';
        } else if (next.meta.label === 'Πέμπτη') {
          note.textContent = 'Εξαίρεση εβδομάδας: η αγωνιστική παίζεται Πέμπτη 3/12, όχι Παρασκευή.';
        } else {
          note.textContent = 'Το concept μένει μυστικό. Η δουλειά σου είναι να το ανακαλύψεις πρώτος.';
        }
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  function updateSeasonUI() {
    const played = state.summaries.filter(s => s.hasResults).length;
    const total = Y.stats.schedule().length || 12;
    if ($('seasonProgressText')) $('seasonProgressText').textContent = played + ' / ' + total;
    if ($('seasonProgressBar')) $('seasonProgressBar').style.width = Math.min(100, (played / total) * 100) + '%';
    if ($('boardRound')) $('boardRound').textContent = String(played).padStart(2, '0');
    if ($('boardSeason')) $('boardSeason').textContent = cfg.season.label;

    const status = $('seasonStatus');
    if (status) {
      if (played === 0) status.textContent = 'Η σεζόν ξεκινά';
      else if (played < total) status.textContent = 'Πρόοδος προκριματικών';
      else status.textContent = 'Προκριματικά ολοκληρώθηκαν';
    }

    const note = $('boardNote');
    if (note) {
      if (state.standings.length > 16) {
        note.textContent = played >= total
          ? 'Οι 16 πρώτοι προκρίνονται στα pots. Ισοπαλία: wild cards → concept → καλύτερη εβδομάδα.'
          : 'Προσωρινή κατάταξη. Η γραμμή μετά τη 16η θέση δείχνει τη ζώνη πρόκρισης. Ισοπαλία: wild cards → concept → καλύτερη εβδομάδα.';
      } else {
        note.textContent = 'Σε ισοπαλία πόντων μετράνε τα wild cards, μετά τα concept και το καλύτερο εβδομαδιαίο σκορ.';
      }
    }

    if ($('nextWeek')) {
      const next = Y.stats.nextMatchday(new Date(), playedWeekList());
      if (next) $('nextWeek').textContent = String(next.meta.week);
      else $('nextWeek').textContent = '—';
    }
  }

  /* ---------------- standings ---------------- */

  function ascendingName(a, b) {
    return String(a.nickname).localeCompare(String(b.nickname), 'el');
  }

  function sortedStandings() {
    const list = state.standings.slice();
    const { key, dir } = state.sort;
    const m = dir === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (key === 'nickname') return ascendingName(a, b) * m;
      if (key === 'rank') return (a.rank - b.rank) * m;
      const av = Number(a[key] || 0);
      const bv = Number(b[key] || 0);
      if (av === bv) return a.rank - b.rank;
      return (av - bv) * m;
    });

    return list;
  }

  function isNaturalOrder() {
    return (state.sort.key === 'points' && state.sort.dir === 'desc') ||
           (state.sort.key === 'rank' && state.sort.dir === 'asc');
  }

  function deltaHtml(delta) {
    if (!delta) return '<span class="delta flat" title="Χωρίς μεταβολή">-</span>';
    if (delta > 0) return '<span class="delta up" title="Ανέβηκε ' + delta + ' θέσεις">▲' + delta + '</span>';
    return '<span class="delta down" title="Έπεσε ' + Math.abs(delta) + ' θέσεις">▼' + Math.abs(delta) + '</span>';
  }

  function renderBoard() {
    const tbody = $('boardBody');
    if (!tbody) return;

    if (!state.standings.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading-row">Η σεζόν δεν έχει ξεκινήσει ακόμη. Η πρώτη αγωνιστική είναι στις ' + formatShort(Y.stats.weekDate(1)) + '.</td></tr>';
      return;
    }

    const list = sortedStandings();
    const natural = isNaturalOrder();
    const rows = [];
    let cutInserted = false;

    list.forEach((row, index) => {
      if (natural && !cutInserted && index === 16) {
        rows.push('<tr class="cut-row"><td colspan="9"><span class="cut-label"><i></i>Γραμμή πρόκρισης · Top 16 · Pots 1–4</span></td></tr>');
        cutInserted = true;
      }

      const rankClass = row.rank <= 3 ? 'rank-' + row.rank : '';
      const qualified = (row.position || row.rank) <= 16;
      const badges = [];
      if (row.wildcards) badges.push('<span class="wild-badge is-on" title="Wild cards">W' + row.wildcards + '</span>');
      if (row.x2) badges.push('<span class="x2-badge is-on" title="Χ2 που χρησιμοποιήθηκαν">×2</span>');
      if (row.concept) badges.push('<span class="concept-badge is-on" title="Concept bonus">C' + row.concept + '</span>');

      rows.push('' +
        '<tr class="' + rankClass + (qualified ? ' is-qualified' : '') + '">' +
          '<td class="col-rank">' +
            '<div class="rank-cell">' +
              '<span class="rank-badge">' + row.rank + '</span>' +
              deltaHtml(row.delta) +
            '</div>' +
          '</td>' +
          '<td class="col-player">' +
            '<button class="player-btn" type="button" data-player="' + escapeAttr(row.id) + '">' +
              '<span class="avatar" aria-hidden="true">' + escapeHtml(initials(row.nickname)) + '</span>' +
              '<span class="player-meta">' +
                '<span class="player-line">' +
                  '<span class="player-name">' + (qualified ? '<i class="qualified-marker" aria-hidden="true"></i>' : '') + escapeHtml(upperName(row.nickname)) + '</span>' +
                  '<span class="player-badges">' + badges.join('') + '</span>' +
                '</span>' +
              '</span>' +
            '</button>' +
          '</td>' +
          '<td class="num">' + row.points + '</td>' +
          '<td class="num">' + row.mapPoints + '</td>' +
          '<td class="num">' + row.quizPoints + '</td>' +
          '<td class="num">' + row.wildcards + '</td>' +
          '<td class="num">' + row.x2 + '</td>' +
          '<td class="num">' + row.matchdays + '</td>' +
          '<td class="num">' + row.concept + '</td>' +
        '</tr>');
    });

    tbody.innerHTML = rows.join('');

    tbody.querySelectorAll('.player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-player');
        const row = state.standings.find(r => String(r.id) === id);
        if (row) openPlayer(row, btn);
      });
    });

    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll('#boardTable thead th').forEach(th => {
      const key = th.getAttribute('data-sort');
      if (!key) return;
      th.removeAttribute('aria-sort');
      if (key === state.sort.key) {
        th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
      }
    });
  }

  function wireBoardSorting() {
    document.addEventListener('click', (ev) => {
      const th = ev.target.closest('#boardTable thead th[data-sort]');
      if (!th) return;
      const key = th.getAttribute('data-sort');
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'desc' ? 'asc' : 'desc';
      } else {
        state.sort.key = key;
        state.sort.dir = (key === 'nickname' || key === 'rank') ? 'asc' : 'desc';
      }
      renderBoard();
    });
  }

  function renderLeaders() {
    const box = $('leaderStrip');
    if (!box) return;
    if (!state.standings.length) {
      box.innerHTML = '';
      return;
    }

    const leader = state.standings[0];
    const wild = state.standings.slice().sort((a, b) => b.wildcards - a.wildcards || b.points - a.points || ascendingName(a, b))[0];
    const concept = state.standings.slice().sort((a, b) => b.concept - a.concept || b.points - a.points || ascendingName(a, b))[0];

    box.innerHTML = '' +
      leaderChip('★', 'Πρωτοπόρος', leader.nickname, leader.points + ' πόντοι') +
      leaderChip('W', 'Περισσότερα wild cards', wild.nickname, wild.wildcards) +
      leaderChip('C', 'Περισσότερα concept', concept.nickname, concept.concept);
  }

  function leaderChip(icon, kicker, name, value) {
    return '' +
      '<div class="leader-chip">' +
        '<span class="leader-chip-icon" aria-hidden="true">' + icon + '</span>' +
        '<div>' +
          '<span class="leader-chip-kicker">' + escapeHtml(kicker) + '</span>' +
          '<span class="leader-chip-name">' + escapeHtml(upperName(name)) + '</span>' +
        '</div>' +
        '<span class="leader-chip-val">' + escapeHtml(String(value)) + '</span>' +
      '</div>';
  }

  /* ---------------- matchdays ---------------- */

  function renderMatchdays() {
    const box = $('matchdays');
    if (!box) return;

    const list = state.summaries.slice().sort((a, b) => b.week - a.week);
    if (!list.length) {
      box.innerHTML = '<p class="loading-row">Δεν υπάρχουν αγωνιστικές.</p>';
      return;
    }

    const latestPlayed = state.summaries.filter(s => s.hasResults).sort((a, b) => b.week - a.week)[0];
    const next = state.summaries.filter(s => !s.hasResults).sort((a, b) => a.week - b.week)[0];

    box.innerHTML = list.map(s => matchdayHtml(s, latestPlayed, next)).join('');
  }

  function matchdayHtml(s, latestPlayed, next) {
    const open = (latestPlayed && latestPlayed.week === s.week) || (!latestPlayed && next && next.week === s.week);
    const flags = [];
    if (s.meta.holiday) flags.push('<span class="md-flag md-flag--holiday">Εορταστική</span>');
    if (s.meta.label === 'Πέμπτη') flags.push('<span class="md-flag md-flag--thursday">Πέμπτη</span>');
    if (s.status === 'live') flags.push('<span class="md-flag md-flag--live">Live τώρα</span>');
    if (s.status === 'upcoming') flags.push('<span class="md-flag md-flag--upcoming">Έρχεται</span>');
    if (s.hasResults) flags.push('<span class="md-flag">Ολοκληρώθηκε</span>');

    const body = s.hasResults ? playedBody(s) : upcomingBody(s);

    return '' +
      '<details class="matchday-card' + (s.hasResults ? '' : ' matchday-card--upcoming') + '"' + (open ? ' open' : '') + '>' +
        '<summary>' +
          '<span class="md-week">Αγ. ' + s.week + ' / 12</span>' +
          '<span class="md-date">' + formatShort(s.date) + '</span>' +
          '<span class="md-flags">' + flags.join('') + '</span>' +
          '<span class="md-caret" aria-hidden="true">▾</span>' +
        '</summary>' +
        '<div class="md-body">' + body + '</div>' +
      '</details>';
  }

  function playedBody(s) {
    const map = eventPanel('Concept Map', s.mapTop, s.mapResults, s.conceptFinders, 'map', s.week);
    const quiz = eventPanel('Quiz', s.quizTop, s.quizResults, [], 'quiz', s.week);
    const wild = wildcardPanel(s);
    return map + quiz + wild;
  }

  function eventPanel(title, top, all, conceptFinders, kind, week) {
    const winner = top[0];
    if (!winner) {
      return '' +
        '<div class="md-event md-event--' + kind + '">' +
          '<div class="md-event-head"><h4>' + title + '</h4><span>Αγ. ' + week + '</span></div>' +
          '<p class="md-empty">Δεν έχει καταχωρηθεί αποτέλεσμα.</p>' +
        '</div>';
    }

    const podium = top.map((r, i) =>
      '<li><em>' + (i + 1) + '</em>' +
        '<button class="md-player" type="button" data-player="' + escapeAttr(r.playerId) + '">' + escapeHtml(upperName(r.nickname)) + '</button>' +
        (r.concept ? ' <span class="md-flag md-flag--holiday">+3</span>' : '') +
        (r.points !== r.basePoints ? ' <span class="x2-badge is-on">×2</span>' : '') +
        '<b>' + r.points + '</b>' +
      '</li>'
    ).join('');

    const concept = conceptFinders.length
      ? '<div class="md-concept"><span>Concept</span><div>' + conceptFinders.map(r =>
          '<button class="md-player" type="button" data-player="' + escapeAttr(r.playerId) + '">' + escapeHtml(upperName(r.nickname)) + '</button>'
        ).join(', ') + ' βρήκε πρώτος το concept <strong>+3</strong>.</div></div>'
      : '';

    return '' +
      '<div class="md-event md-event--' + kind + '">' +
        '<div class="md-event-head"><h4>' + title + '</h4><span>' + all.length + ' παίκτες</span></div>' +
        '<div class="md-winner">' +
          '<span class="md-winner-crown" aria-hidden="true">◆</span>' +
          '<button class="md-player md-winner-name" type="button" data-player="' + escapeAttr(winner.playerId) + '">' + escapeHtml(upperName(winner.nickname)) + '</button>' +
          '<span class="md-winner-pts">' + winner.points + ' πόντοι' +
            (winner.points !== winner.basePoints ? ' <span class="x2-badge is-on">×2</span>' : '') +
          '</span>' +
        '</div>' +
        '<ol class="md-podium">' + podium + '</ol>' +
        concept +
      '</div>';
  }

  function wildcardPanel(s) {
    const winners = s.wildcardWinners || [];
    const x2 = s.x2Players || [];

    const winnerHtml = winners.length
      ? winners.map(w => '<button class="md-player md-winner-name" type="button" data-player="' + escapeAttr(w.playerId) + '">' + escapeHtml(upperName(w.nickname)) + '</button>' +
          (w.multiplier > 1 ? ' <span class="x2-badge is-on">×2</span>' : '')
        ).join(', ')
      : '<span class="md-empty">—</span>';

    const x2Html = x2.length
      ? '<p class="md-x2"><b>×2:</b> ' + x2.map(x =>
          '<button class="md-player" type="button" data-player="' + escapeAttr(x.playerId) + '">' + escapeHtml(upperName(x.nickname)) + '</button>'
        ).join(', ') + '</p>'
      : '';

    return '' +
      '<div class="md-event md-wild">' +
        '<div class="md-event-head"><h4>Wild Card</h4><span>Χάρτης + Quiz</span></div>' +
        '<div class="md-winner">' +
          '<span class="md-winner-crown" aria-hidden="true">W</span>' +
          winnerHtml +
          (winners.length ? '<span class="md-winner-pts">' + s.wildcardPoints + ' πόντοι</span>' : '') +
        '</div>' +
        '<p class="md-x2">' + (winners.length === 1 ? 'Ο πιο σταθερός της αγωνιστικής.' : winners.length > 1 ? 'Ισοπαλία στην κορυφή — το wild card μοιράζεται.' : 'Δεν έχει κριθεί ακόμη.') + '</p>' +
        x2Html +
      '</div>';
  }

  function upcomingBody(s) {
    return '' +
      '<div class="md-event">' +
        '<div class="md-event-head"><h4>Concept Map</h4><span>' + formatShort(s.date) + '</span></div>' +
        '<p class="md-empty">25 τοποθεσίες, ένα κρυφό concept. Το μυστικό αποκαλύπτεται στο τέλος.</p>' +
      '</div>' +
      '<div class="md-event">' +
        '<div class="md-event-head"><h4>Quiz</h4><span>' + formatShort(s.date) + '</span></div>' +
        '<p class="md-empty">25 ερωτήσεις γεωγραφίας. Ίδια κλίμακα πόντων με τον χάρτη.</p>' +
      '</div>' +
      '<div class="md-event md-wild">' +
        '<div class="md-event-head"><h4>Wild Card</h4><span>' + formatShort(s.date) + '</span></div>' +
        '<p class="md-empty">Ο παίκτης με τους περισσότερους συνολικούς πόντους παίρνει το wild card.</p>' +
        (s.meta.holiday ? '<p class="md-x2"><b>×2:</b> δύο τυχαίοι παίκτες θα κληρωθούν απόψε.</p>' : '') +
      '</div>';
  }

  /* ---------------- phases ---------------- */

  function renderPhases() {
    renderPots();
    renderGroups();
    renderBracket();
  }

  function renderPots() {
    const box = $('potsGrid');
    if (!box) return;

    const top = state.standings.slice(0, 16);
    const pots = Y.stats.pots(top);

    if (!top.length) {
      box.innerHTML = '<p class="loading-row">Τα pots συμπληρώνονται από τη γενική κατάταξη.</p>';
      return;
    }

    box.innerHTML = pots.map(pot => {
      const rows = pot.rows.map(r =>
        '<div class="pot-slot"><em>#' + r.rank + '</em><span>' + escapeHtml(upperName(r.nickname)) + '</span><span class="pot-rank">' + r.points + 'π</span></div>'
      ).join('');
      const empty = new Array(Math.max(0, 4 - pot.rows.length)).fill('<div class="pot-slot is-empty"><em>—</em><span>Κενή θέση</span></div>').join('');
      return '' +
        '<div class="pot-card">' +
          '<div class="pot-card-head"><strong>Pot ' + pot.pot + '</strong><span>θέσεις ' + pot.range + '</span></div>' +
          rows + empty +
        '</div>';
    }).join('');
  }

  function renderGroups() {
    const box = $('groupsGrid');
    if (!box) return;

    const drawn = state.groups.some(g => g.hasDraw);
    if (!drawn) {
      box.innerHTML = '<p class="loading-row">Η κλήρωση θα γίνει μετά την 12η αγωνιστική. Οι 4 όμιλοι θα σχηματιστούν με έναν παίκτη από κάθε pot.</p>';
      return;
    }

    box.innerHTML = state.groups.map(g => {
      const table = g.table.map((r, i) => {
        return '<tr class="' + (r.qualified ? 'is-qualified' : '') + '">' +
          '<td>' + (i + 1) + '</td>' +
          '<td class="gt-name"><button class="md-player" type="button" data-player="' + escapeAttr(r.playerId) + '">' + escapeHtml(upperName(r.nickname)) + '</button></td>' +
          '<td class="num">' + r.played + '</td>' +
          '<td class="num">' + r.wins + '</td>' +
          '<td class="num">' + r.losses + '</td>' +
          '<td class="num">' + r.points + '</td>' +
        '</tr>';
      }).join('');

      const fixtures = g.fixtures.slice(0, 6).map(f =>
        '<li>' +
          '<b class="' + (f.aWon ? 'fx-winner' : '') + '">' + escapeHtml(upperName(f.playerAName)) + '</b>' +
          '<span>' + (f.complete ? (f.score_a != null ? f.score_a + '–' + f.score_b : 'νίκη') : 'vs') + '</span>' +
          '<b class="' + (f.bWon ? 'fx-winner' : '') + '">' + escapeHtml(upperName(f.playerBName)) + '</b>' +
          (f.complete ? '<em>R' + f.round + '</em>' : '') +
        '</li>'
      ).join('');

      return '' +
        '<div class="group-card">' +
          '<div class="group-card-head">' +
            '<span class="group-letter">' + g.label + '</span>' +
            '<h4>Όμιλος ' + g.label + '</h4>' +
            '<span>' + (g.complete ? 'Ολοκληρώθηκε' : 'Σε εξέλιξη') + '</span>' +
          '</div>' +
          '<table class="group-table">' +
            '<thead><tr><th>#</th><th>Παίκτης</th><th class="num">Α</th><th class="num">Ν</th><th class="num">Η</th><th class="num">Β</th></tr></thead>' +
            '<tbody>' + table + '</tbody>' +
          '</table>' +
          '<ul class="group-fixtures">' + fixtures + '</ul>' +
        '</div>';
    }).join('');
  }

  function renderBracket() {
    const box = $('bracket');
    if (!box) return;

    const b = state.bracket;
    const hasBracket = b && (b.qf.length || b.sf.length || b.final || b.third);

    const champion = $('championBanner');
    if (champion) {
      if (b && b.championName) {
        champion.hidden = false;
        $('championName').textContent = upperName(b.championName);
        $('championSub').textContent = b.runnerUp ? 'Τελικός απέναντι στον ' + upperName(b.runnerUp) : '';
      } else {
        champion.hidden = true;
      }
    }

    if (!hasBracket) {
      const groupsDrawn = state.groups.some(g => g.hasDraw);
      if (!groupsDrawn) {
        box.innerHTML = '<p class="loading-row">Το bracket θα συμπληρωθεί μετά τη φάση ομίλων.</p>';
        return;
      }

      const g = {};
      state.groups.forEach(x => {
        g[x.label] = x.table;
      });
      const seed = (label, pos) => (g[label] && g[label][pos - 1]) ? upperName(g[label][pos - 1].nickname) : label + pos;
      const qfSlots = [
        ['A1', 'B2'], ['B1', 'A2'], ['C1', 'D2'], ['D1', 'C2']
      ].map((p, i) => {
        const a = seed(p[0][0], Number(p[0][1]));
        const bb = seed(p[1][0], Number(p[1][1]));
        return bracketMatch('QF' + (i + 1), a, bb);
      }).join('');

      box.innerHTML = '' +
        '<div class="bracket-round"><div class="bracket-round-head">Προημιτελικά</div>' + qfSlots + '</div>' +
        '<div class="bracket-round"><div class="bracket-round-head">Ημιτελικά</div>' + bracketMatch('SF1', 'Νικητής QF1', 'Νικητής QF2') + bracketMatch('SF2', 'Νικητής QF3', 'Νικητής QF4') + '</div>' +
        '<div class="bracket-round"><div class="bracket-round-head">Τελικός</div>' + bracketMatch('F', 'Νικητής SF1', 'Νικητής SF2') + '</div>' +
        '<div class="bracket-round bracket-round--final"><div class="bracket-round-head">Χάλκινο</div>' + bracketMatch('3rd', 'Ηττημένος SF1', 'Ηττημένος SF2') + '</div>';
      return;
    }

    const round = (title, matches, fallback) => {
      const html = matches.length
        ? matches.map(m => bracketMatchFrom(m)).join('')
        : fallback;
      return '<div class="bracket-round"><div class="bracket-round-head">' + title + '</div>' + html + '</div>';
    };

    box.innerHTML = '' +
      round('Προημιτελικά', b.qf, bracketMatch('QF', 'A1 / B2', 'C1 / D2')) +
      round('Ημιτελικά', b.sf, bracketMatch('SF1', 'Νικητής QF1', 'Νικητής QF2') + bracketMatch('SF2', 'Νικητής QF3', 'Νικητής QF4')) +
      round('Τελικός', b.final ? [b.final] : [], bracketMatch('F', 'Νικητής SF1', 'Νικητής SF2')) +
      round('Χάλκινο', b.third ? [b.third] : [], bracketMatch('3rd', 'Ηττημένος SF1', 'Ηττημένος SF2')) +
      (b.championName ? '<div class="bracket-champion"><span>Πρωταθλητής</span><strong>' + escapeHtml(upperName(b.championName)) + '</strong></div>' : '');
  }

  function bracketMatch(id, a, b) {
    return '' +
      '<div class="bracket-match">' +
        '<div class="bracket-team is-empty"><span class="bt-name">' + escapeHtml(a) + '</span></div>' +
        '<div class="bracket-team is-empty"><span class="bt-name">' + escapeHtml(b) + '</span></div>' +
        '<div class="bracket-meta">' + escapeHtml(id) + ' · 1v1 GeoQuiz</div>' +
      '</div>';
  }

  function bracketMatchFrom(m) {
    const row = (name, score, won, empty) => '' +
      '<div class="bracket-team' + (won ? ' is-winner' : '') + (empty ? ' is-empty' : '') + '">' +
        '<span class="bt-name">' + escapeHtml(name ? upperName(name) : '—') + '</span>' +
        (score != null ? '<span class="bt-score">' + score + '</span>' : '') +
      '</div>';

    return '' +
      '<div class="bracket-match">' +
        row(m.playerAName, m.score_a, m.aWon, !m.playerAName) +
        row(m.playerBName, m.score_b, m.bWon, !m.playerBName) +
        '<div class="bracket-meta">' + escapeHtml(phaseLabel(m.phase)) + ' · 1v1 GeoQuiz</div>' +
      '</div>';
  }

  function phaseLabel(phase) {
    return { qf: 'Προημιτελικός', sf: 'Ημιτελικός', final: 'Τελικός', third: 'Μικρός τελικός' }[phase] || phase;
  }

  /* ---------------- player modal ---------------- */

  let lastFocusedEl = null;

  function wireModal() {
    const modal = $('playerModal');
    const closeBtn = $('pmClose');
    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) closeModal();
    });
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.md-player');
      if (!btn) return;
      const id = btn.getAttribute('data-player');
      const row = state.standings.find(r => String(r.id) === id);
      if (row) openPlayer(row, btn);
    });
  }

  function closeModal() {
    const modal = $('playerModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
      lastFocusedEl = null;
    }
  }

  function openPlayer(row, triggerEl) {
    lastFocusedEl = triggerEl || document.activeElement;
    const modal = $('playerModal');
    if (!modal) return;

    const pot = (row.position || row.rank) <= 16 ? Math.floor(((row.position || row.rank) - 1) / 4) + 1 : null;
    const banner = $('pmTierBanner');
    banner.className = 'pm-tier-banner';
    $('pmTierName').textContent = pot ? 'Pot ' + pot + ' · Top 16' : 'Εκτός Top 16';

    $('pmAvatar').className = 'pm-avatar';
    $('pmAvatar').textContent = initials(row.nickname);
    $('pmName').textContent = upperName(row.nickname);
    $('pmRank').textContent = 'Θέση ' + row.rank + ' / ' + state.standings.length;

    const badges = [];
    if (row.is_patreon) badges.push('<span class="pm-badge pm-badge--gold">Patreon</span>');
    if (row.wildcards) badges.push('<span class="pm-badge pm-badge--gold">' + row.wildcards + ' wild card' + (row.wildcards > 1 ? 's' : '') + '</span>');
    if (row.x2) badges.push('<span class="pm-badge pm-badge--pin">' + row.x2 + ' × Χ2</span>');
    if (row.concept) badges.push('<span class="pm-badge pm-badge--teal">' + row.concept + ' concept</span>');
    $('pmBadges').innerHTML = badges.join('');

    const leaderPoints = state.standings[0] ? state.standings[0].points : 0;
    const pct = leaderPoints > 0 ? Math.max(2, Math.min(100, (row.points / leaderPoints) * 100)) : 0;
    $('pmXpVal').textContent = row.points + ' / ' + leaderPoints + ' πόντοι';
    requestAnimationFrame(() => {
      $('pmXpFill').style.width = pct + '%';
    });

    const stats = [
      ['Σύνολο', row.points],
      ['Χάρτης', row.mapPoints],
      ['Quiz', row.quizPoints],
      ['Wild cards', row.wildcards],
      ['Χ2', row.x2],
      ['Concept', row.concept],
      ['Αγωνιστικές', row.matchdays],
      ['Καλύτερη εβδομάδα', row.bestWeek]
    ];

    $('pmStats').innerHTML = stats.map(s =>
      '<dl class="pm-stat"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>'
    ).join('');

    const weeks = Array.from(row.perWeek.values()).sort((a, b) => a.week - b.week);
    $('pmWeeks').innerHTML = weeks.length
      ? '<h4>Ανά αγωνιστική</h4><div class="pm-week-list">' + weeks.map(w =>
          '<div class="pm-week">' +
            '<span>Αγ. ' + w.week + '</span>' +
            (w.wildcard ? '<i title="Wild card">W</i>' : '') +
            (w.multiplier > 1 ? '<i title="Χ2">×2</i>' : '') +
            (w.concept ? '<i title="Concept bonus">C</i>' : '') +
            '<strong>' + w.points + '</strong>' +
          '</div>'
        ).join('') + '</div>'
      : '';

    renderChart(row);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('pmClose').focus();
  }

  function renderChart(row) {
    const canvas = $('pmChart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    if (state.chart) state.chart.destroy();

    const hist = row.rankHistory || [];
    const wrap = canvas.closest('.pm-chart-wrap');
    if (!hist.length) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = '';

    const labels = hist.map(h => 'Αγ. ' + h.week);
    const data = hist.map(h => h.rank);
    const maxRank = Math.max(state.standings.length, ...data, 2);

    state.chart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Θέση',
          data: data,
          borderColor: '#E8B94A',
          backgroundColor: 'rgba(87,199,188,.12)',
          borderWidth: 2,
          pointBackgroundColor: '#071523',
          pointBorderColor: '#E8B94A',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(7,21,35,.96)',
            borderColor: '#57C7BC',
            borderWidth: 1,
            titleColor: '#F1E6CC',
            bodyColor: '#FFD577',
            bodyFont: { family: 'JetBrains Mono, monospace', size: 12 },
            callbacks: { label: ctx => 'Θέση ' + ctx.parsed.y }
          }
        },
        scales: {
          y: {
            reverse: true,
            min: 1,
            max: maxRank,
            ticks: {
              stepSize: Math.max(1, Math.round(maxRank / 6)),
              color: '#72899A',
              font: { size: 11, family: 'JetBrains Mono, monospace' }
            },
            grid: { color: 'rgba(87,199,188,.1)' },
            title: { display: true, text: 'Θέση', color: '#72899A', font: { size: 10 } }
          },
          x: {
            ticks: { color: '#72899A', font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });

    if (canvas.parentElement) canvas.parentElement.style.height = '220px';
    canvas.style.height = '220px';
  }

  /* ---------------- signup ---------------- */

  function wireForm() {
    const form = $('signupForm');
    if (!form) return;

    const currentYear = new Date().getFullYear();
    form.birth_year.max = String(currentYear);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const msg = $('signupMsg');
      const btn = $('signupBtn');

      const nickname = form.nickname.value.trim();
      const firstName = form.first_name.value.trim();
      const birthYear = Number(form.birth_year.value);
      const city = form.city.value.trim();
      const consent = form.consent.checked;
      const honey = form.website.value;

      form.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));
      msg.className = 'form-msg';
      msg.textContent = '';

      if (honey) {
        msg.className = 'form-msg ok';
        msg.textContent = 'Ευχαριστούμε! Η αίτησή σου καταχωρήθηκε.';
        form.reset();
        return;
      }

      const problems = [];
      if (nickname.length < 2) { problems.push('Το όνομα είναι υποχρεωτικό.'); form.nickname.classList.add('invalid'); }
      if (firstName.length < 2) { problems.push('Το username στο GeoGuessr είναι υποχρεωτικό.'); form.first_name.classList.add('invalid'); }
      if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
        problems.push('Συμπλήρωσε ένα έγκυρο έτος γέννησης.'); form.birth_year.classList.add('invalid');
      }
      if (!city.length) { problems.push('Η περιοχή εκπροσώπησης είναι υποχρεωτική.'); form.city.classList.add('invalid'); }
      if (!consent) { problems.push('Πρέπει να αποδεχτείς τους κανόνες για να συμμετάσχεις.'); }

      if (problems.length) {
        msg.className = 'form-msg err';
        msg.textContent = problems.join(' ');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Αποστολή…';

      try {
        const res = await Y.data.submitRegistration({
          nickname: nickname,
          first_name: firstName,
          birth_year: birthYear,
          city: city
        });

        if (res.ok) {
          msg.className = 'form-msg ok';
          msg.textContent = 'Ευχαριστούμε, ' + firstName.toUpperCase() + '! Η αίτησή σου καταχωρήθηκε και θα ελεγχθεί πριν την πρώτη αγωνιστική.';
          form.reset();
        } else {
          msg.className = 'form-msg err';
          const text = String(res.error || '');
          const isRateLimited = /Πολλές αιτήσεις|rate limit|too many/i.test(text);
          const isDuplicate = /duplicate key|registrations_pending_nickname_uniq/i.test(text);
          msg.textContent = isRateLimited
            ? 'Έγιναν πολλές αιτήσεις σε λίγο χρόνο. Δοκίμασε ξανά σε λίγα λεπτά.'
            : isDuplicate
              ? 'Υπάρχει ήδη εκκρεμής αίτηση με αυτό το username.'
              : 'Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο ή στείλε μήνυμα στο Discord.';
          console.error('[YAZ] registration error:', res.error);
        }
      } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = 'Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο ή στείλε μήνυμα στο Discord.';
        console.error('[YAZ] registration error:', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Στείλε αίτηση';
      }
    });
  }

  /* ---------------- utils ---------------- */

  function formatSession(date) {
    return date.toLocaleDateString('el-GR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ
    });
  }

  function formatShort(date) {
    if (!date) return '—';
    return date.toLocaleDateString('el-GR', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ
    });
  }

  function initials(name) {
    if (!name) return '-';
    const parts = String(name).replace(/[._-]+/g, ' ').trim().split(/\s+/);
    if (!parts.length || !parts[0]) return '-';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function upperName(str) {
    return String(str == null ? '' : str).toUpperCase();
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }
})();
