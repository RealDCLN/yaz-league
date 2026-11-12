/* ============================================================
   YAZ LEAGUE - Main front-end logic
   ============================================================ */

(function () {
  'use strict';

  const Y = window.YAZ;
  const cfg = Y.config;

  const state = {
    players: [],
    matches: [],
    results: [],
    standings: [],
    sort: { key: 'points', dir: 'desc' },
    chart: null
  };

  document.addEventListener('DOMContentLoaded', () => {
    wireLinks();
    wireNav();
    wireReveal();
    wireModal();
    wireForm();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Countdown has zero data dependencies, so start it immediately so a slow
    // or failed Supabase call can never leave it stuck at 00:00:00:00.
    startCountdown();

    boot();
  });

  async function boot() {
    try {
      // Hard timeout so a hung Supabase request can't block the page forever.
      const data = await Promise.race([
        Y.data.load(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Δεν υπάρχει απάντηση από τη βάση (timeout).')), 8000)
        )
      ]);

      state.players = data.players;
      state.matches = data.matches;
      state.results = data.results;
      state.standings = Y.stats.standings(state.players, state.matches, state.results);

      renderBoard();

      // Now that we know the real match list, fix up the week number.
      updateWeekLabel();
    } catch (err) {
      console.error('[YAZ] data load failed:', err);
      const tbody = document.getElementById('boardBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Δεν ήταν δυνατή η φόρτωση της βαθμολογίας. Δοκίμασε ξανά σε λίγο.</td></tr>';
      }
    }
  }

  /* ---------------- links ---------------- */

  function wireLinks() {
    document.querySelectorAll('[data-link]').forEach(el => {
      const key = el.getAttribute('data-link');
      const url = cfg.links && cfg.links[key];
      el.setAttribute('href', url || '#');
    });
  }

  /* ---------------- nav ---------------- */

  function wireNav() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('mainNav');
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

  /* ---------------- reveal ---------------- */

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

  /* ---------------- countdown ---------------- */

  function resolveNextMatch() {
    let target = null;

    if (cfg.nextMatch && cfg.nextMatch.isoDate) {
      const candidate = new Date(cfg.nextMatch.isoDate);
      if (!isNaN(candidate.getTime()) && candidate.getTime() > Date.now()) {
        target = candidate;
      }
    }
    if (!target) {
      target = Y.stats.nextFriday19();
    }

    let week = cfg.nextMatch && cfg.nextMatch.weekNumber;
    if (!week) {
      const weeks = Y.stats.weeksOf(state.matches);
      week = (weeks.length ? weeks[weeks.length - 1] : 0) + 1;
    }
    return { target, week };
  }

  let countdownStarted = false;

  function startCountdown() {
    if (countdownStarted) return;
    countdownStarted = true;

    updateWeekLabel();

    const live = document.getElementById('liveBadge');
    const nums = {
      days: document.querySelector('[data-cd="days"]'),
      hours: document.querySelector('[data-cd="hours"]'),
      minutes: document.querySelector('[data-cd="minutes"]'),
      seconds: document.querySelector('[data-cd="seconds"]')
    };

    const pad = n => String(n).padStart(2, '0');
    const MATCH_DURATION_MS = 2 * 3600 * 1000; // 2 ώρες διάρκεια (19:00 - 21:00)

    function tick() {
      const { target } = resolveNextMatch();
      const now = Date.now();
      const diff = target.getTime() - now;

      // Αν είμαστε μεταξύ έναρξης (19:00) και λήξης (+2 ώρες), η αγωνιστική είναι LIVE!
      const isLive = diff <= 0 && now < target.getTime() + MATCH_DURATION_MS;
      if (live) live.classList.toggle('is-on', isLive);

      const remainingMs = Math.max(0, diff);
      const s = Math.floor(remainingMs / 1000);
      if (nums.days) nums.days.textContent = pad(Math.floor(s / 86400));
      if (nums.hours) nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      if (nums.minutes) nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      if (nums.seconds) nums.seconds.textContent = pad(s % 60);
    }

    tick();
    setInterval(tick, 1000);
  }

  function updateWeekLabel() {
    const { week } = resolveNextMatch();
    const el = document.getElementById('nextWeek');
    if (el) el.textContent = String(week);
  }

  /* ---------------- leaderboard ---------------- */

  function initials(name) {
    if (!name) return '-';
    const parts = String(name).replace(/[._-]+/g, ' ').trim().split(/\s+/);
    if (!parts.length || !parts[0]) return '-';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function sortedStandings() {
    const list = state.standings.slice();
    const { key, dir } = state.sort;
    const m = dir === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (key === 'nickname') {
        return a.nickname.localeCompare(b.nickname, 'el') * m;
      }
      const av = key === 'rank' ? a.rank : a[key];
      const bv = key === 'rank' ? b.rank : b[key];
      if (av === bv) return a.rank - b.rank;
      return (av - bv) * m;
    });

    return list;
  }

  function deltaHtml(delta) {
    if (!delta) return '<span class="delta flat" title="Χωρίς μεταβολή">-</span>';
    if (delta > 0) return '<span class="delta up" title="Ανέβηκε ' + delta + ' θέσεις">▲' + delta + '</span>';
    return '<span class="delta down" title="Έπεσε ' + Math.abs(delta) + ' θέσεις">▼' + Math.abs(delta) + '</span>';
  }

  function renderBoard() {
    const tbody = document.getElementById('boardBody');
    if (!tbody) return;

    if (!state.standings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Δεν υπάρχουν ακόμη αποτελέσματα.</td></tr>';
      return;
    }

    const list = sortedStandings();
    const isNaturalRankOrder = (state.sort.key === 'points' && state.sort.dir === 'desc') ||
                               (state.sort.key === 'rank' && state.sort.dir === 'asc');
    const groupSize = Number(cfg.groupSize) || 4;

    tbody.innerHTML = list.map((row, i) => {
      const rankClass = row.rank <= 3 ? 'rank-' + row.rank : '';
      const group = row.group || 1;
      const groupClass = 'group-' + (group % 2 === 0 ? 'even' : 'odd');
      const isGroupStart = isNaturalRankOrder && i > 0 && (i % groupSize === 0);
      const trClass = [
        rankClass,
        groupClass,
        isGroupStart ? 'group-start' : ''
      ].filter(Boolean).join(' ');

      return '' +
        '<tr class="' + trClass + '" data-group="' + group + '">' +
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
                '<span class="player-name">' + escapeHtml(upperName(row.nickname)) + '</span>' +
              '</span>' +
            '</button>' +
          '</td>' +
          '<td class="num">' + row.points + '</td>' +
          '<td class="num" title="Wildcards: νίκες σε league">' + row.wildcards + '</td>' +
          '<td class="num">' + row.games + '</td>' +
          '<td class="num">' + row.wins + '</td>' +
          '<td class="num">' + row.podiums + '</td>' +
        '</tr>';
    }).join('');

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

  /* ---------------- modal ---------------- */

  let lastFocusedEl = null;

  function wireModal() {
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('pmClose');
    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  function closeModal() {
    const modal = document.getElementById('playerModal');
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
    const modal = document.getElementById('playerModal');
    if (!modal) return;

    const banner = document.getElementById('pmTierBanner');
    banner.className = 'pm-tier-banner';
    document.getElementById('pmTierName').textContent = 'Group ' + (row.group || 1);

    document.getElementById('pmAvatar').className = 'pm-avatar';
    document.getElementById('pmAvatar').textContent = initials(row.nickname);
    document.getElementById('pmName').textContent = upperName(row.nickname);
    document.getElementById('pmRank').textContent =
      'Θέση ' + row.rank + ' / ' + state.standings.length +
      (row.bestPlacement ? ' · Top ' + row.bestPlacement : '');

    const leaderPoints = state.standings[0] ? state.standings[0].points : 0;
    const pct = leaderPoints > 0 ? Math.max(2, Math.min(100, (row.points / leaderPoints) * 100)) : 0;
    document.getElementById('pmXpVal').textContent = row.points + ' / ' + leaderPoints + ' πόντοι';
    requestAnimationFrame(() => {
      document.getElementById('pmXpFill').style.width = pct + '%';
    });

    const stats = [
      ['Σύνολο πόντων', row.points],
      ['Wildcards', row.wildcards],
      ['Αγώνες', row.games],
      ['Νίκες', row.wins],
      ['Βάθρα', row.podiums],
      ['Μ.Ο. ανά αγώνα', row.avg.toFixed(2)],
      ['Καλύτερο σκορ', Math.round(row.best).toLocaleString('el-GR')]
    ];

    document.getElementById('pmStats').innerHTML = stats.map(s =>
      '<dl class="pm-stat"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>'
    ).join('');

    renderChart(row);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('pmClose').focus();
  }

  function renderChart(row) {
    const canvas = document.getElementById('pmChart');
    if (!canvas || typeof window.Chart === 'undefined') return;

    if (state.chart) state.chart.destroy();

    const hist = row.rankHistory || [];
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
            callbacks: { label: (ctx) => 'Θέση ' + ctx.parsed.y }
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

  /* ---------------- signup form ---------------- */

  function wireForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    // Σταθερό upper bound για το έτος γέννησης, ώστε να μη χρειάζεται
    // ενημέρωση του HTML κάθε χρόνο.
    form.birth_year.max = String(new Date().getFullYear());

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const msg = document.getElementById('signupMsg');
      const btn = document.getElementById('signupBtn');

      const nickname = form.nickname.value.trim();
      const firstName = form.first_name.value.trim();
      const birthYear = Number(form.birth_year.value);
      const city = form.city.value.trim();
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

      const currentYear = new Date().getFullYear();
      const problems = [];
      if (nickname.length < 2) { problems.push('Το username (GeoGuessr) είναι υποχρεωτικό.'); form.nickname.classList.add('invalid'); }
      if (firstName.length < 2) { problems.push('Το πραγματικό όνομα είναι υποχρεωτικό.'); form.first_name.classList.add('invalid'); }
      if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
        problems.push('Συμπλήρωσε ένα έγκυρο έτος γέννησης.'); form.birth_year.classList.add('invalid');
      }
      if (!city.length) { problems.push('Η πόλη ή περιφερειακή ενότητα είναι υποχρεωτική.'); form.city.classList.add('invalid'); }

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
          msg.textContent = 'Ευχαριστούμε, ' + nickname.toUpperCase() + '! Η αίτησή σου καταχωρήθηκε και θα ελεγχθεί πριν την επόμενη αγωνιστική.';
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
