/* ============================================================
   YAZ LEAGUE — Main front-end logic
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
    document.getElementById('year').textContent = new Date().getFullYear();
    boot();
  });

  async function boot() {
    const data = await Y.data.load();
    state.players = data.players;
    state.matches = data.matches;
    state.results = data.results;
    state.standings = Y.stats.standings(state.players, state.matches, state.results);

    fillHud();
    renderBoard();
    startCountdown();
    if (Y.globeView) Y.globeView.init(state.matches);

  }

  /* ---------------- hero HUD ---------------- */

  function fillHud() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('statPlayers', state.players.length);
    set('statMatches', state.matches.length);
    set('statWeeks', Y.stats.weeksOf(state.matches).length);
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

    toggle.addEventListener('click', () => {
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
    let target;
    if (cfg.nextMatch && cfg.nextMatch.isoDate) {
      target = new Date(cfg.nextMatch.isoDate);
    } else {
      target = Y.stats.nextFriday19();
    }
    let week = cfg.nextMatch && cfg.nextMatch.weekNumber;
    if (!week) {
      const weeks = Y.stats.weeksOf(state.matches);
      week = (weeks.length ? weeks[weeks.length - 1] : 0) + 1;
    }
    return { target, week };
  }

  function startCountdown() {
    const { target, week } = resolveNextMatch();
    const weekEl = document.getElementById('nextWeek');
    if (weekEl) weekEl.textContent = String(week);

    const live = document.getElementById('liveBadge');
    const nums = {
      days: document.querySelector('[data-cd="days"]'),
      hours: document.querySelector('[data-cd="hours"]'),
      minutes: document.querySelector('[data-cd="minutes"]'),
      seconds: document.querySelector('[data-cd="seconds"]')
    };

    const pad = n => String(n).padStart(2, '0');

    function tick() {
      let diff = target.getTime() - Date.now();
      const liveOn = diff > 0 && diff <= 3600000;
      if (live) live.classList.toggle('is-on', liveOn);

      if (diff < 0) diff = 0;

      const s = Math.floor(diff / 1000);
      if (nums.days) nums.days.textContent = pad(Math.floor(s / 86400));
      if (nums.hours) nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      if (nums.minutes) nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      if (nums.seconds) nums.seconds.textContent = pad(s % 60);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- leaderboard ---------------- */

  function initials(name) {
    const parts = String(name).replace(/[._-]+/g, ' ').trim().split(/\s+/);
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
    if (!delta) return '<span class="delta flat" title="Χωρίς μεταβολή">—</span>';
    if (delta > 0) return '<span class="delta up" title="Ανέβηκε ' + delta + ' θέσεις">▲' + delta + '</span>';
    return '<span class="delta down" title="Έπεσε ' + Math.abs(delta) + ' θέσεις">▼' + Math.abs(delta) + '</span>';
  }

  function renderBoard() {
    const tbody = document.getElementById('boardBody');
    if (!tbody) return;

    if (!state.standings.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Δεν υπάρχουν ακόμη αποτελέσματα.</td></tr>';
      return;
    }

    const list = sortedStandings();

    tbody.innerHTML = list.map(row => {
      const rankClass = row.rank <= 3 ? ' rank-' + row.rank : '';
      const tierId = row.tier ? row.tier.id : 'bronze';
      const tierName = row.tier ? row.tier.name : 'Χάλκινος';

      return '' +
        '<tr class="' + rankClass.trim() + '">' +
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
                '<span class="player-name">' + escapeHtml(row.nickname) + '</span>' +
                '<span class="tier-chip tier-' + tierId + '">' + escapeHtml(tierName) + '</span>' +
              '</span>' +
            '</button>' +
          '</td>' +
          '<td class="num">' + row.points + '</td>' +
          '<td class="num">' + row.games + '</td>' +
          '<td class="num">' + row.wins + '</td>' +
          '<td class="num">' + row.podiums + '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-player');
        const row = state.standings.find(r => String(r.id) === id);
        if (row) openPlayer(row);
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

  function wireModal() {
    const modal = document.getElementById('playerModal');
    const closeBtn = document.getElementById('pmClose');
    if (!modal) return;

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
  }

  function openPlayer(row) {
    const modal = document.getElementById('playerModal');
    if (!modal) return;

    const tier = row.tier || { id: 'bronze', name: 'Χάλκινος' };

    const banner = document.getElementById('pmTierBanner');
    banner.className = 'pm-tier-banner tier-' + tier.id;
    document.getElementById('pmTierName').textContent = tier.name;

    document.getElementById('pmAvatar').className = 'pm-avatar tier-' + tier.id;
    document.getElementById('pmAvatar').textContent = initials(row.nickname);
    document.getElementById('pmName').textContent = row.nickname;
    document.getElementById('pmRank').textContent =
      'Θέση ' + row.rank + ' / ' + state.standings.length +
      (row.bestPlacement ? ' · Top ' + row.bestPlacement : '');

    const links = [];
    if (row.geoguessr_url) {
      links.push('<a href="' + escapeAttr(row.geoguessr_url) + '" target="_blank" rel="noopener">GeoGuessr ↗</a>');
    }
    if (row.discord) {
      links.push('<a href="' + escapeAttr(cfg.links.discord) + '" target="_blank" rel="noopener">Discord · ' + escapeHtml(row.discord) + '</a>');
    }
    document.getElementById('pmLinks').innerHTML = links.join('');

    /* XP bar προς τον πρωτοπόρο */
    const leaderPoints = state.standings[0] ? state.standings[0].points : 0;
    const pct = leaderPoints > 0 ? Math.max(2, Math.min(100, (row.points / leaderPoints) * 100)) : 0;
    document.getElementById('pmXpVal').textContent = row.points + ' / ' + leaderPoints + ' πόντοι';
    requestAnimationFrame(() => {
      document.getElementById('pmXpFill').style.width = pct + '%';
    });

    const stats = [
      ['Σύνολο πόντων', row.points],
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
          borderColor: '#E3B341',
          backgroundColor: 'rgba(227,179,65,.12)',
          borderWidth: 2,
          pointBackgroundColor: '#0F1626',
          pointBorderColor: '#E3B341',
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
            backgroundColor: 'rgba(10,16,28,.96)',
            borderColor: '#E3B341',
            borderWidth: 1,
            titleColor: '#F0E4C8',
            bodyColor: '#FFD166',
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
              color: '#7C8BA3',
              font: { size: 11, family: 'JetBrains Mono, monospace' }
            },
            grid: { color: 'rgba(227,179,65,.1)' },
            title: { display: true, text: 'Θέση', color: '#7C8BA3', font: { size: 10 } }
          },
          x: {
            ticks: { color: '#7C8BA3', font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });

    canvas.parentElement.style.height = '220px';
    canvas.style.height = '220px';
  }

  /* ---------------- signup form ---------------- */

  function wireForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const msg = document.getElementById('signupMsg');
      const btn = document.getElementById('signupBtn');

      const nickname = form.nickname.value.trim();
      const geoguessr = form.geoguessr_url.value.trim();
      const discord = form.discord.value.trim();
      const email = form.email.value.trim();
      const terms = form.terms.checked;
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
      if (nickname.length < 2) { problems.push('Το ψευδώνυμο είναι υποχρεωτικό.'); form.nickname.classList.add('invalid'); }
      if (!/^https?:\/\/.+\..+/i.test(geoguessr)) { problems.push('Χρειάζεται έγκυρο URL προφίλ GeoGuessr.'); form.geoguessr_url.classList.add('invalid'); }
      if (discord.length < 2) { problems.push('Το Discord username είναι υποχρεωτικό.'); form.discord.classList.add('invalid'); }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { problems.push('Το email δεν φαίνεται σωστό.'); form.email.classList.add('invalid'); }
      if (!terms) { problems.push('Πρέπει να αποδεχτείς τους κανόνες.'); }

      if (problems.length) {
        msg.className = 'form-msg err';
        msg.textContent = problems.join(' ');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Αποστολή…';

      const res = await Y.data.submitRegistration({
        nickname, geoguessr_url: geoguessr, discord, email
      });

      btn.disabled = false;
      btn.textContent = 'Στείλε αίτηση';

      if (res.ok) {
        msg.className = 'form-msg ok';
        msg.textContent = 'Ευχαριστούμε, ' + nickname + '! Η αίτησή σου καταχωρήθηκε και θα ελεγχθεί πριν την επόμενη αγωνιστική.';
        form.reset();
      } else {
        msg.className = 'form-msg err';
        msg.textContent = 'Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο ή στείλε μήνυμα στο Discord.';
        console.error('[YAZ] registration error:', res.error);
      }
    });
  }

  /* ---------------- utils ---------------- */

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, '&#96;');
  }
})();
