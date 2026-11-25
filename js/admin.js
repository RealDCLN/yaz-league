/* ============================================================
   YAZ LEAGUE · WINTER 2026-27
   Admin panel: matchday entry, X2/Patreon, groups & Final-8,
   registrations, players, history.
   Requires: js/config.js, js/stats.js, Supabase JS, admin.html.
   ============================================================ */

(function () {
  'use strict';

  const Y = window.YAZ || {};
  const cfg = Y.config || {};
  const S = Y.stats || {};
  const PTS = cfg.points || [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
  const BONUS = cfg.conceptBonus || 3;
  const SCHEDULE = (cfg.schedule || []).slice().sort((a, b) => a.week - b.week);
  const HOLIDAY_WEEKS = SCHEDULE.filter(m => m.holiday).map(m => m.week);
  const QUALIFIERS = Number(cfg.format && cfg.format.qualifiers) || 16;
  const POT_COUNT = Number(cfg.format && cfg.format.pots) || 4;
  const TZ = (cfg.season && cfg.season.timeZone) || 'Europe/Athens';

  let sb = null;
  let currentUser = null;

  const cache = {
    players: [],
    matches: [],
    results: [],
    multipliers: [],
    groupMembers: [],
    phaseMatches: [],
    regs: []
  };

  const schema = {
    patreon: false,
    multipliers: false,
    groups: false,
    phases: false
  };

  let currentWeek = 1;
  let entries = { map: [], quiz: [] };
  let patreonSearch = '';
  let playerSearch = '';

  const $ = id => document.getElementById(id);
  const esc = str => String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const upperName = str => String(str == null ? '' : str).toUpperCase();
  const num = v => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

  function pointsFor(place) {
    return (place >= 1 && place <= PTS.length) ? num(PTS[place - 1]) : 0;
  }

  function weekMeta(week) {
    return SCHEDULE.find(m => Number(m.week) === Number(week)) || null;
  }

  function sourceLabel(source) {
    return {
      patreon_dec: 'Patreon · Δεκέμβριος',
      patreon_jan: 'Patreon · Ιανουάριος',
      holiday: 'Κλήρωση εορτών'
    }[source] || source;
  }

  function sourceShort(source) {
    return { patreon_dec: 'Patreon Δεκ', patreon_jan: 'Patreon Ιαν', holiday: 'Εορτών' }[source] || source;
  }

  // Χ2 Patreon που έχουν ήδη «δεθεί» με αγωνιστική. Η απενεργοποίηση
  // του Patreon τα διαγράφει και αλλάζει πόντους που έχουν μετρηθεί.
  function usedPatreonMultipliers(playerId) {
    return cache.multipliers.filter(m =>
      String(m.player_id) === String(playerId) &&
      (m.source === 'patreon_dec' || m.source === 'patreon_jan') &&
      m.used_week
    );
  }

  function monthWeeks(month) {
    return SCHEDULE.filter(m => String(m.date).slice(5, 7) === month);
  }

  function weeksForSource(source) {
    if (source === 'patreon_dec') return monthWeeks('12');
    if (source === 'patreon_jan') return monthWeeks('01');
    return SCHEDULE;
  }

  function zoneParts(date) {
    const dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = {};
    dtf.formatToParts(date).forEach(part => {
      if (part.type !== 'literal') parts[part.type] = part.value;
    });
    return parts;
  }

  function zoneOffsetMs(date) {
    const p = zoneParts(date);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
  }

  // Το datetime-local δεν έχει ζώνη. Διάβασέ το ως ώρα Ελλάδας, ώστε
  // η αποθήκευση να μην εξαρτάται από το ρολόι του υπολογιστή του admin.
  function toLocalInput(date) {
    if (!date || isNaN(date.getTime())) return '';
    const p = zoneParts(date);
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }

  function parseInputDate(value) {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value));
    if (!m) return null;

    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    let offset = zoneOffsetMs(new Date(wall));
    let d = new Date(wall - offset);
    const offset2 = zoneOffsetMs(d);
    if (offset2 !== offset) d = new Date(wall - offset2);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }) +
      ' · ' + date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  }

  function formatDay(date) {
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', timeZone: TZ });
  }

  function escapeLike(s) {
    return String(s).replace(/[\\%_*]/g, '\\$&');
  }

  function playerById(id) {
    return cache.players.find(p => String(p.id) === String(id)) || null;
  }

  function displayName(p) {
    return p ? (p.first_name || p.nickname || '—') : '—';
  }

  function displayPlayers() {
    return cache.players.map(p => Object.assign({}, p, { nickname: displayName(p) }));
  }

  function playerByName(name) {
    const lower = String(name || '').toLowerCase();
    return cache.players.find(p => String(p.first_name || '').toLowerCase() === lower) ||
      cache.players.find(p => String(p.nickname || '').toLowerCase() === lower) ||
      null;
  }

  function matchFor(week, league) {
    return cache.matches.find(m => Number(m.week_number) === Number(week) && m.league === league) || null;
  }

  /* ==================== INIT ==================== */

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    wireTabs();
    wireMatchday();
    wireX2();
    wirePhases();
    wirePlayerForm();
    wireLoginForm();
    wireLogout();

    renderWeekSelect();

    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      $('supabaseWarn').hidden = false;
      $('loginBtn').disabled = true;
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      $('supabaseWarn').hidden = false;
      $('supabaseWarn').textContent = 'Το Supabase JS δεν φορτώθηκε. Έλεγξε τη σύνδεση.';
      $('loginBtn').disabled = true;
      return;
    }

    // Τα reads του admin δεν πρέπει ποτέ να σερβίρονται από browser cache:
    // μια παλιά απάντηση (π.χ. λίστα εκκρεμών αιτήσεων) θα έδειχνε λάθος
    // δεδομένα. Το Supabase REST δεν στέλνει Cache-Control, οπότε το
    // κλειδώνουμε ρητά στο fetch.
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      global: {
        fetch: (input, init) => window.fetch(input, Object.assign({}, init, { cache: 'no-store' }))
      }
    });

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) {
        currentUser = session.user;
        if (await checkAdminRights()) await onSignedIn();
        else await sb.auth.signOut();
      }
    } catch (err) {
      console.warn('[admin] session restore failed', err);
    }

    sb.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') onSignedOut();
    });
  }

  /* ==================== AUTH ==================== */

  function wireLoginForm() {
    const form = $('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!sb) return;

      const email = $('loginEmail').value.trim();
      const password = $('loginPass').value;
      const msg = $('loginMsg');
      const btn = $('loginBtn');

      msg.className = 'form-msg';
      msg.textContent = '';
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Σύνδεση…';

      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;

        if (!(await checkAdminRights())) {
          await sb.auth.signOut();
          throw new Error('Ο λογαριασμός δεν έχει δικαιώματα διαχειριστή.');
        }
        await onSignedIn();
      } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = err.message || 'Αποτυχία σύνδεσης.';
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });
  }

  function wireLogout() {
    const btn = $('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (sb) await sb.auth.signOut();
      onSignedOut();
    });
  }

  async function checkAdminRights() {
    if (!sb || !currentUser) return false;
    try {
      const { data, error } = await sb.rpc('is_admin');
      if (error) {
        console.error('[admin] is_admin RPC failed:', error);
        return false;
      }
      return data === true;
    } catch (err) {
      console.error('[admin] is_admin RPC failed:', err);
      return false;
    }
  }

  async function onSignedIn() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('adminUser').hidden = false;
    $('adminEmailLabel').textContent = currentUser.email || '';
    $('loginMsg').textContent = '';

    try {
      await loadAll();
      await probeSchema();
    } catch (err) {
      $('loginView').hidden = false;
      $('appView').hidden = true;
      $('adminUser').hidden = true;
      const msg = $('loginMsg');
      msg.className = 'form-msg err';
      msg.textContent = err.message;
      return;
    }

    const week = nextWeekNumber();
    currentWeek = week;
    renderWeekSelect();
    await loadWeek(week);

    renderPlayersTable();
    renderPlayerOptions();
    renderHistory();
    renderX2();
    renderPhases();
    await loadRegs();
  }

  function onSignedOut() {
    currentUser = null;
    cache.players = []; cache.matches = []; cache.results = [];
    cache.multipliers = []; cache.groupMembers = []; cache.phaseMatches = []; cache.regs = [];
    entries = { map: [], quiz: [] };
    $('loginView').hidden = false;
    $('appView').hidden = true;
    $('adminUser').hidden = true;
    $('loginPass').value = '';
  }

  /* ==================== TABS ==================== */

  function wireTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });
  }

  function switchTab(target) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('is-active', t.getAttribute('data-tab') === target));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('is-active', p.id === 'tab-' + target));

    // Τα δεδομένα των καρτελών μπορεί να έχουν αλλάξει στο μεταξύ.
    if (!currentUser) return;
    if (target === 'regs') loadRegs();
    else if (target === 'players') renderPlayersTable();
    else if (target === 'x2') renderX2();
    else if (target === 'phases') renderPhases();
    else if (target === 'history') renderHistory();
  }

  /* ==================== DATA ==================== */

  async function loadAll() {
    const [p, m, r] = await Promise.all([
      sb.from('players').select('*').order('nickname').limit(10000),
      sb.from('matches').select('*').order('week_number').limit(10000),
      sb.from('results').select('*').limit(10000)
    ]);
    const err = p.error || m.error || r.error;
    if (err) {
      console.error('[admin] load failed:', err);
      throw new Error('Σφάλμα φόρτωσης δεδομένων: ' + err.message + '. Έλεγξε ότι έχεις τρέξει το supabase/schema.sql.');
    }

    cache.players = p.data || [];
    cache.matches = m.data || [];
    cache.results = r.data || [];

    await Promise.all([loadMultipliers(true), loadPhaseData(true)]);
  }

  async function loadMultipliers(silent) {
    if (!schema.multipliers && !silent) return;
    try {
      const { data, error } = await sb.from('multipliers')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(10000);
      if (error) throw error;
      cache.multipliers = data || [];
    } catch (err) {
      if (!silent) throw err;
      cache.multipliers = [];
    }
  }

  async function loadPhaseData(silent) {
    if (!schema.groups && !silent) return;
    const [g, p] = await Promise.all([
      sb.from('group_members').select('*').limit(1000),
      sb.from('phase_matches').select('*').limit(1000)
    ]);
    if (g.error || p.error) {
      if (!silent) throw (g.error || p.error);
      cache.groupMembers = [];
      cache.phaseMatches = [];
      return;
    }
    cache.groupMembers = g.data || [];
    cache.phaseMatches = p.data || [];
  }

  async function probeSchema() {
    const checks = await Promise.all([
      sb.from('players').select('is_patreon').limit(1),
      sb.from('multipliers').select('id').limit(1),
      sb.from('group_members').select('id').limit(1),
      sb.from('phase_matches').select('id').limit(1)
    ]);

    schema.patreon = !checks[0].error;
    schema.multipliers = !checks[1].error;
    schema.groups = !checks[2].error;
    schema.phases = !checks[3].error;

    const missing = !schema.patreon || !schema.multipliers || !schema.groups || !schema.phases;
    $('schemaWarn').hidden = !missing;
    $('x2Warn').hidden = schema.multipliers;
    $('phaseWarn').hidden = schema.groups && schema.phases;

    if (!schema.multipliers || !schema.groups || !schema.phases) {
      $('drawGroupsBtn').disabled = true;
      $('advanceBtn').disabled = true;
      $('resetPhasesBtn').disabled = true;
    }

    if (!schema.patreon) {
      // Χωρίς is_patreon δεν μπορούμε να αποθηκεύσουμε το toggle.
      document.querySelectorAll('[data-patreon]').forEach(el => { el.disabled = true; });
    }
  }

  function nextWeekNumber() {
    for (const meta of SCHEDULE) {
      if (!matchFor(meta.week, 'map') || !matchFor(meta.week, 'quiz')) return meta.week;
    }
    return SCHEDULE.length ? SCHEDULE[SCHEDULE.length - 1].week : 1;
  }

  function renderWeekSelect() {
    const sel = $('mWeek');
    if (!sel) return;
    sel.innerHTML = SCHEDULE.map(meta => {
      const d = new Date(meta.date);
      const flag = meta.holiday ? ' · εορταστική' : (meta.label === 'Πέμπτη' ? ' · Πέμπτη' : '');
      return '<option value="' + meta.week + '">Αγωνιστική ' + meta.week + ' · ' + formatDay(d) + flag + '</option>';
    }).join('');
    sel.value = String(currentWeek);
  }

  function renderPlayerOptions() {
    const dl = $('playerOptions');
    if (!dl) return;
    dl.innerHTML = cache.players.map(p => '<option value="' + esc(p.first_name || p.nickname) + '"></option>').join('');
  }

  /* ==================== MATCHDAY ==================== */

  function wireMatchday() {
    const weekSel = $('mWeek');
    if (weekSel) {
      weekSel.addEventListener('change', () => {
        currentWeek = Number(weekSel.value);
        loadWeek(currentWeek);
      });
    }

    if ($('mapAddBtn')) $('mapAddBtn').addEventListener('click', () => {
      entries.map.push({ nickname: '', concept: false });
      renderEntryList('map');
      renderPreview();
    });

    if ($('quizAddBtn')) $('quizAddBtn').addEventListener('click', () => {
      entries.quiz.push({ nickname: '', concept: false });
      renderEntryList('quiz');
      renderPreview();
    });

    if ($('saveMatchBtn')) $('saveMatchBtn').addEventListener('click', saveMatch);
    if ($('clearWeekBtn')) $('clearWeekBtn').addEventListener('click', () => loadWeek(currentWeek, true));
  }

  async function loadWeek(week, forceReset) {
    currentWeek = Number(week) || 1;
    const meta = weekMeta(currentWeek);
    const map = matchFor(currentWeek, 'map');
    const quiz = matchFor(currentWeek, 'quiz');

    const dateInput = $('mDate');
    if (dateInput) {
      if (map && map.match_date) dateInput.value = toLocalInput(new Date(map.match_date));
      else if (meta) dateInput.value = toLocalInput(new Date(meta.date));
    }

    entries.map = forceReset ? [{ nickname: '', concept: false }] : existingEntries(map);
    entries.quiz = forceReset ? [{ nickname: '', concept: false }] : existingEntries(quiz);

    const status = $('matchStatus');
    if (status) {
      status.textContent = (map || quiz) ? 'Επεξεργασία · Αγ. ' + currentWeek : 'Νέα αγωνιστική';
      status.classList.toggle('is-edit', !!(map || quiz));
    }

    renderEntryList('map');
    renderEntryList('quiz');
    renderPreview();
    updateWeekInfo();
    if ($('matchMsg')) {
      $('matchMsg').className = 'form-msg';
      $('matchMsg').textContent = '';
    }
  }

  function existingEntries(match) {
    if (!match) return [{ nickname: '', concept: false }];
    const rows = cache.results
      .filter(r => String(r.match_id) === String(match.id))
      .sort((a, b) => num(a.placement) - num(b.placement))
      .map(r => {
        const p = playerById(r.player_id);
        return {
          nickname: p ? (p.first_name || p.nickname) : '',
          concept: !!r.concept_bonus
        };
      })
      .filter(r => r.nickname);
    return rows.length ? rows : [{ nickname: '', concept: false }];
  }

  function updateWeekInfo() {
    const box = $('mWeekInfo');
    if (!box) return;
    const meta = weekMeta(currentWeek);
    if (!meta) { box.textContent = '—'; return; }

    const map = matchFor(currentWeek, 'map');
    const quiz = matchFor(currentWeek, 'quiz');
    const x2 = cache.multipliers.filter(m => num(m.used_week) === currentWeek);
    const flags = [];
    if (meta.holiday) flags.push('<span class="mini-flag mini-flag--gold">Εορταστική · 2 κληρώσεις Χ2</span>');
    if (meta.label === 'Πέμπτη') flags.push('<span class="mini-flag mini-flag--pin">Πέμπτη 3/12</span>');

    box.innerHTML = '' +
      '<span class="week-info-date">' + (meta.label === 'Πέμπτη' ? 'Πέμπτη' : 'Παρασκευή') + ' · ' + formatDay(new Date(meta.date)) + ' · ' + (cfg.season.time || '19:30') + '</span>' +
      '<span class="week-info-flags">' + flags.join('') + '</span>' +
      '<span class="week-info-state">' +
        '<span class="mini-state ' + (map ? 'is-on' : '') + '">Χάρτης</span>' +
        '<span class="mini-state ' + (quiz ? 'is-on' : '') + '">Quiz</span>' +
        '<span class="mini-state mini-state--x2 ' + (x2.length ? 'is-on' : '') + '">Χ2: ' + x2.length + '</span>' +
      '</span>';
  }

  function renderEntryList(kind) {
    const box = $(kind === 'map' ? 'mapEntryList' : 'quizEntryList');
    if (!box) return;
    const rows = entries[kind];

    box.innerHTML = rows.map((entry, i) => {
      const pts = pointsFor(i + 1);
      const concept = kind === 'map'
        ? '<label class="entry-bonus" title="Concept bonus +3"><input type="checkbox" data-role="concept"' + (entry.concept ? ' checked' : '') + '> +3</label>'
        : '';
      return '' +
        '<div class="entry-row" style="grid-template-columns:44px 1fr auto' + (kind === 'map' ? ' auto' : '') + ' auto" data-i="' + i + '">' +
          '<span class="entry-pos">' + (i + 1) + '</span>' +
          '<input type="text" list="playerOptions" value="' + esc(entry.nickname) + '" placeholder="Όνομα παίκτη" data-role="nick">' +
          '<span class="entry-points">' + pts + 'π</span>' +
          concept +
          '<div class="entry-tools">' +
            '<button class="icon-btn" type="button" data-act="up" title="Πάνω">↑</button>' +
            '<button class="icon-btn" type="button" data-act="down" title="Κάτω">↓</button>' +
            '<button class="icon-btn danger" type="button" data-act="rm" title="Αφαίρεση">×</button>' +
          '</div>' +
        '</div>';
    }).join('');

    box.querySelectorAll('.entry-row').forEach(row => {
      const i = Number(row.getAttribute('data-i'));
      const nickEl = row.querySelector('[data-role="nick"]');
      const conceptEl = row.querySelector('[data-role="concept"]');

      nickEl.addEventListener('input', () => {
        entries[kind][i].nickname = nickEl.value;
        renderPreview();
      });

      nickEl.addEventListener('change', () => {
        nickEl.value = upperName(nickEl.value.trim());
        entries[kind][i].nickname = nickEl.value;
        renderPreview();
      });

      nickEl.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        if (!nickEl.value.trim()) return;
        entries[kind].push({ nickname: '', concept: false });
        renderEntryList(kind);
        renderPreview();
        const rowsNow = box.querySelectorAll('.entry-row');
        const last = rowsNow[rowsNow.length - 1];
        if (last) last.querySelector('[data-role="nick"]').focus();
      });

      if (conceptEl) {
        conceptEl.addEventListener('change', () => {
          if (conceptEl.checked) {
            box.querySelectorAll('[data-role="concept"]').forEach((cb, j) => {
              if (j !== i) { cb.checked = false; entries[kind][j].concept = false; }
            });
          }
          entries[kind][i].concept = conceptEl.checked;
          renderPreview();
        });
      }

      row.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          if (act === 'rm') entries[kind].splice(i, 1);
          else if (act === 'up' && i > 0) [entries[kind][i - 1], entries[kind][i]] = [entries[kind][i], entries[kind][i - 1]];
          else if (act === 'down' && i < entries[kind].length - 1) [entries[kind][i + 1], entries[kind][i]] = [entries[kind][i], entries[kind][i + 1]];
          if (!entries[kind].length) entries[kind].push({ nickname: '', concept: false });
          renderEntryList(kind);
          renderPreview();
        });
      });
    });
  }

  function cleanEntries(kind) {
    return entries[kind]
      .map(e => ({
        nickname: upperName(String(e.nickname || '').trim()),
        concept: !!(kind === 'map' && e.concept)
      }))
      .filter(e => e.nickname);
  }

  function multiplierFor(playerId, week) {
    return cache.multipliers.find(m => String(m.player_id) === String(playerId) && num(m.used_week) === Number(week)) || null;
  }

  function renderPreview() {
    const tbody = $('previewBody');
    if (!tbody) return;

    const mapEntries = cleanEntries('map');
    const quizEntries = cleanEntries('quiz');
    const mapPts = new Map(mapEntries.map((e, i) => [e.nickname.toLowerCase(), pointsFor(i + 1) + (e.concept ? BONUS : 0)]));
    const quizPts = new Map(quizEntries.map((e, i) => [e.nickname.toLowerCase(), pointsFor(i + 1)]));

    const names = Array.from(new Set([...mapEntries, ...quizEntries].map(e => e.nickname)));
    if (!names.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Δεν υπάρχουν καταχωρήσεις.</td></tr>';
      return;
    }

    const rows = names.map(name => {
      const player = playerByName(name);
      const map = mapPts.get(name.toLowerCase()) || 0;
      const quiz = quizPts.get(name.toLowerCase()) || 0;
      const mult = player ? multiplierFor(player.id, currentWeek) : null;
      const multiplier = mult ? 2 : 1;
      return {
        name,
        player,
        map,
        quiz,
        multiplier,
        total: (map + quiz) * multiplier
      };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'el'));

    const max = rows.length ? Math.max(...rows.map(r => r.total)) : 0;
    const wildcardWinners = max > 0 ? rows.filter(r => r.total === max) : [];

    tbody.innerHTML = rows.map((r, i) => {
      const isWild = wildcardWinners.includes(r);
      const newTag = r.player ? '' : ' <span class="badge-new">νέος</span>';
      return '<tr class="' + (isWild ? 'is-wild-preview' : '') + '">' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + esc(r.name) + newTag + '</td>' +
        '<td class="num">' + r.map + '</td>' +
        '<td class="num">' + r.quiz + '</td>' +
        '<td class="num">' + (r.multiplier > 1 ? '<span class="x2-badge is-on">×2</span>' : '—') + '</td>' +
        '<td class="num"><strong>' + r.total + '</strong></td>' +
        '<td class="num">' + (isWild ? '<span class="wild-badge is-on">W</span>' : '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  async function saveMatch() {
    const msg = $('matchMsg');
    const btn = $('saveMatchBtn');
    msg.className = 'form-msg';
    msg.textContent = '';

    const week = Number(currentWeek);
    const date = parseInputDate($('mDate').value);
    const mapEntries = cleanEntries('map');
    const quizEntries = cleanEntries('quiz');

    const problems = [];
    if (!Number.isInteger(week) || week < 1) problems.push('Συμπλήρωσε έγκυρη αγωνιστική.');
    if (!date) problems.push('Συμπλήρωσε έγκυρη ημερομηνία.');
    if (!mapEntries.length && !quizEntries.length) problems.push('Πρόσθεσε τουλάχιστον έναν παίκτη.');

    ['map', 'quiz'].forEach(kind => {
      const list = kind === 'map' ? mapEntries : quizEntries;
      const lowers = list.map(e => e.nickname.toLowerCase());
      const dups = Array.from(new Set(lowers.filter((n, i) => lowers.indexOf(n) !== i)));
      if (dups.length) problems.push('Διπλό όνομα στο ' + (kind === 'map' ? 'Concept Map' : 'Quiz') + ': ' + dups.join(', '));
    });

    if (mapEntries.filter(e => e.concept).length > 1) {
      problems.push('Μόνο ένας παίκτης μπορεί να πάρει το concept bonus.');
    }

    if (problems.length) {
      msg.className = 'form-msg err';
      msg.textContent = problems.join(' ');
      return;
    }

    // Ένα άγνωστο όνομα δημιουργεί μόνιμα νέο παίκτη. Ρώτα πρώτα, ώστε
    // ένα typo να μη γίνει σιωπηλά νέος παίκτης στην κατάταξη.
    const allNames = Array.from(new Set([...mapEntries, ...quizEntries].map(e => e.nickname)));
    const unknown = allNames.filter(name => !playerByName(name));
    if (unknown.length) {
      const ok = confirm(
        'Οι παρακάτω παίκτες δεν υπάρχουν και θα δημιουργηθούν:\n\n' +
        unknown.join(', ') +
        '\n\nΣυνέχεια;'
      );
      if (!ok) return;
    }

    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Αποθήκευση…';

    const createdPlayerIds = [];
    const createdMatchIds = [];
    const snapshot = snapshotWeek(week);
    let mutated = false;
    let committed = false;

    try {
      const resolved = new Map();

      for (const name of allNames) {
        const { player, created } = await resolveOrCreatePlayer(name);
        if (created) createdPlayerIds.push(player.id);
        resolved.set(name.toLowerCase(), player);
      }

      // Δύο διαφορετικά ονόματα μπορεί να δείχνουν στον ίδιο παίκτη
      // (username + ιδιωτικό όνομα). Το unique(match_id, player_id) θα
      // αποτύγχανε μετά τη διαγραφή των παλιών αποτελεσμάτων.
      ['map', 'quiz'].forEach(kind => {
        const list = kind === 'map' ? mapEntries : quizEntries;
        const seenIds = new Set();
        list.forEach(entry => {
          const player = resolved.get(entry.nickname.toLowerCase());
          if (!player) return;
          const key = String(player.id);
          if (seenIds.has(key)) {
            throw new Error('Ο ίδιος παίκτης εμφανίζεται δύο φορές στο ' +
              (kind === 'map' ? 'Concept Map' : 'Quiz') + ': ' + entry.nickname + '.');
          }
          seenIds.add(key);
        });
      });

      const applyLeague = async (league, list) => {
        const existing = matchFor(week, league);
        let matchId;

        // Διατήρησε τα raw scores όσων παικτών ξαναμπαίνουν στην ίδια δοκιμασία.
        const previous = new Map();
        if (existing) {
          cache.results
            .filter(r => String(r.match_id) === String(existing.id))
            .forEach(r => previous.set(String(r.player_id), r.raw_score));
        }

        if (existing) {
          const { error: uErr } = await sb.from('matches')
            .update({ match_date: date.toISOString() })
            .eq('id', existing.id);
          if (uErr) throw uErr;
          matchId = existing.id;

          const { error: dErr } = await sb.from('results').delete().eq('match_id', matchId);
          if (dErr) throw dErr;
        } else {
          const { data: matchRow, error: mErr } = await sb.from('matches').insert({
            week_number: week,
            match_date: date.toISOString(),
            league
          }).select().single();
          if (mErr) throw mErr;
          matchId = matchRow.id;
          createdMatchIds.push(matchId);
        }

        const rows = list.map((e, i) => {
          const player = resolved.get(e.nickname.toLowerCase());
          const pts = pointsFor(i + 1) + (league === 'map' && e.concept ? BONUS : 0);
          const prevRaw = previous.get(String(player.id));
          return {
            match_id: matchId,
            player_id: player.id,
            placement: i + 1,
            points: pts,
            raw_score: prevRaw == null ? null : prevRaw,
            concept_bonus: !!(league === 'map' && e.concept)
          };
        });

        if (rows.length) {
          const { error: rErr } = await sb.from('results').insert(rows);
          if (rErr) throw rErr;
        }
      };

      if (mapEntries.length) { mutated = true; await applyLeague('map', mapEntries); }
      else { mutated = true; await removeLeague(week, 'map'); }

      if (quizEntries.length) { mutated = true; await applyLeague('quiz', quizEntries); }
      else { mutated = true; await removeLeague(week, 'quiz'); }

      // Και τα δύο σκέλη γράφτηκαν. Από εδώ και πέρα μια αποτυχία δεν
      // πρέπει να κάνει rollback — μόνο να ενημερώσει για το refresh.
      committed = true;

      await loadAll();
      renderPlayerOptions();
      renderPlayersTable();
      renderHistory();
      await loadWeek(week);

      msg.className = 'form-msg ok';
      msg.textContent = 'Αποθηκεύτηκε η αγωνιστική ' + week + ' · Concept Map ' + mapEntries.length + ' παίκτες · Quiz ' + quizEntries.length + ' παίκτες.';
      renderX2();
      renderPhases();
    } catch (err) {
      console.error('[admin] save matchday failed:', err);

      let restored = false;

      if (!committed) {
        for (const id of createdMatchIds) {
          try { await sb.from('matches').delete().eq('id', id); } catch (_) {}
        }
        if (createdPlayerIds.length) {
          try { await sb.from('players').delete().in('id', createdPlayerIds); } catch (_) {}
        }

        if (mutated) {
          try {
            await restoreWeek(week, snapshot);
            restored = true;
          } catch (restoreErr) {
            console.error('[admin] restore failed:', restoreErr);
          }
        } else if (createdPlayerIds.length) {
          // Οι «νέοι» παίκτες της αποτυχημένης προσπάθειας διαγράφηκαν —
          // καθάρισε και την τοπική λίστα.
          try {
            await loadAll();
            renderPlayerOptions();
            renderPlayersTable();
          } catch (_) {}
        }
      }

      msg.className = 'form-msg err';
      msg.textContent = committed
        ? 'Τα αποτελέσματα αποθηκεύτηκαν, αλλά η ανανέωση της προβολής απέτυχε (' +
          (err.message || 'άγνωστο σφάλμα') + '). Ανανέωσε τη σελίδα.'
        : 'Αποτυχία: ' + (err.message || 'άγνωστο σφάλμα') +
          (restored ? ' Τα προηγούμενα αποτελέσματα της αγωνιστικής επαναφέρθηκαν.' : '');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  /* Πλήρες αντίγραφο της αγωνιστικής πριν από κάθε εγγραφή, ώστε μια
     αποτυχημένη αποθήκευση να μπορεί να επαναφέρει τα προηγούμενα
     αποτελέσματα. Το Supabase REST δεν προσφέρει transactions. */
  function snapshotWeek(week) {
    const legs = {};
    ['map', 'quiz'].forEach(league => {
      const match = matchFor(week, league);
      legs[league] = match ? {
        match: {
          match_date: match.match_date,
          league: match.league
        },
        results: cache.results
          .filter(r => String(r.match_id) === String(match.id))
          .map(r => ({
            player_id: r.player_id,
            placement: r.placement,
            points: r.points,
            raw_score: r.raw_score,
            concept_bonus: r.concept_bonus
          }))
      } : null;
    });
    return { legs };
  }

  async function restoreWeek(week, snapshot) {
    await loadAll();

    for (const league of ['map', 'quiz']) {
      const saved = snapshot.legs[league];
      const current = matchFor(week, league);

      if (!saved) {
        if (current) {
          const { error } = await sb.from('matches').delete().eq('id', current.id);
          if (error) throw error;
        }
        continue;
      }

      let matchId = current ? current.id : null;

      if (!matchId) {
        const { data, error } = await sb.from('matches').insert({
          week_number: week,
          match_date: saved.match.match_date,
          league
        }).select('id').single();
        if (error) throw error;
        matchId = data.id;
      } else {
        const { error } = await sb.from('matches')
          .update({ match_date: saved.match.match_date })
          .eq('id', matchId);
        if (error) throw error;
      }

      const { error: dErr } = await sb.from('results').delete().eq('match_id', matchId);
      if (dErr) throw dErr;

      if (saved.results.length) {
        const rows = saved.results.map(r => ({
          match_id: matchId,
          player_id: r.player_id,
          placement: r.placement,
          points: r.points,
          raw_score: r.raw_score,
          concept_bonus: r.concept_bonus
        }));
        const { error: rErr } = await sb.from('results').insert(rows);
        if (rErr) throw rErr;
      }
    }

    await loadAll();
    renderPlayerOptions();
    renderPlayersTable();
    renderHistory();
    renderX2();
    renderPhases();
    await loadWeek(week);
  }

  async function removeLeague(week, league) {
    const existing = matchFor(week, league);
    if (!existing) return;
    const { error } = await sb.from('matches').delete().eq('id', existing.id);
    if (error) throw error;
  }

  async function resolveOrCreatePlayer(rawNickname) {
    const username = upperName(String(rawNickname || '').trim());
    const lower = username.toLowerCase();
    const existing = cache.players.find(p => String(p.first_name || '').toLowerCase() === lower) ||
      cache.players.find(p => String(p.nickname || '').toLowerCase() === lower);
    if (existing) return { player: existing, created: false };

    // Νέος παίκτης από τη λίστα αγωνιστικής: το username πάει δημόσια,
    // το ιδιωτικό όνομα συμπληρώνεται αργότερα από την έγκριση.
    const { data, error } = await sb.from('players')
      .insert({ nickname: username, first_name: username })
      .select()
      .single();
    if (error) {
      const { data: again } = await sb.from('players')
        .select('*')
        .ilike('first_name', escapeLike(username))
        .maybeSingle();
      if (again) return { player: again, created: false };
      const { data: again2 } = await sb.from('players')
        .select('*')
        .ilike('nickname', escapeLike(username))
        .maybeSingle();
      if (again2) return { player: again2, created: false };
      throw error;
    }
    cache.players.push(data);
    return { player: data, created: true };
  }

  /* ==================== X2 / PATREON ==================== */

  function wireX2() {
    const search = $('patreonSearch');
    if (search) search.addEventListener('input', () => {
      patreonSearch = search.value.trim().toLowerCase();
      renderPatreonGrid();
    });
  }

  function renderX2() {
    renderPatreonGrid();
    renderHolidayGrid();
    renderX2Table();
    renderX2WeekGrid();
    updateWeekInfo();
  }

  function renderPatreonGrid() {
    const box = $('patreonGrid');
    if (!box) return;

    const list = cache.players
      .filter(p => !patreonSearch ||
        (displayName(p) + ' ' + String(p.nickname || '')).toLowerCase().includes(patreonSearch))
      .slice()
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'el'));

    if (!list.length) {
      box.innerHTML = '<p class="empty">Κανένας παίκτης.</p>';
      return;
    }

    box.innerHTML = list.map(p => {
      const dec = cache.multipliers.find(m => String(m.player_id) === String(p.id) && m.source === 'patreon_dec');
      const jan = cache.multipliers.find(m => String(m.player_id) === String(p.id) && m.source === 'patreon_jan');
      const isPatron = !!p.is_patreon;
      const decValue = dec && dec.used_week ? String(dec.used_week) : '';
      const janValue = jan && jan.used_week ? String(jan.used_week) : '';

      const weekOptions = (source, selected) => '<option value="">—</option>' +
        weeksForSource(source).map(m =>
          '<option value="' + m.week + '"' + (String(selected) === String(m.week) ? ' selected' : '') + '>Αγ. ' + m.week + ' · ' + formatDay(new Date(m.date)) + '</option>'
        ).join('');

      return '' +
        '<div class="patron-card' + (isPatron ? ' is-patron' : '') + '">' +
          '<label class="patron-toggle">' +
            '<input type="checkbox" data-patreon="' + esc(p.id) + '"' + (isPatron ? ' checked' : '') + (schema.patreon ? '' : ' disabled') + '>' +
            '<span>' + esc(upperName(displayName(p))) + '</span>' +
          '</label>' +
          (isPatron
            ? '<div class="patreon-weeks">' +
                '<label>Δεκ <select data-patreon-week="' + esc(p.id) + '" data-source="patreon_dec">' + weekOptions('patreon_dec', decValue) + '</select></label>' +
                '<label>Ιαν <select data-patreon-week="' + esc(p.id) + '" data-source="patreon_jan">' + weekOptions('patreon_jan', janValue) + '</select></label>' +
              '</div>'
            : '<span class="patron-off">Μη συνδρομητής</span>') +
        '</div>';
    }).join('');

    box.querySelectorAll('[data-patreon]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-patreon');
        if (!schema.patreon) return alert('Τρέξε πρώτα το migration 005.');
        const value = cb.checked;
        if (!value) {
          const used = usedPatreonMultipliers(id);
          if (used.length && !confirm('Τα Χ2 Patreon αυτού του παίκτη έχουν ήδη δηλωθεί σε αγωνιστικές. Θα διαγραφούν και θα αλλάξουν πόντοι που έχουν ήδη μετρηθεί. Συνέχεια;')) {
            cb.checked = true;
            return;
          }
        }
        cb.disabled = true;
        try {
          const { error } = await sb.from('players').update({ is_patreon: value }).eq('id', id);
          if (error) throw error;
          const p = playerById(id);
          if (p) p.is_patreon = value;
          if (!value && schema.multipliers) {
            const del = await sb.from('multipliers').delete().eq('player_id', id)
              .in('source', ['patreon_dec', 'patreon_jan']);
            if (del.error) throw del.error;
            await loadMultipliers();
          }
          renderPatreonGrid();
          renderX2Table();
          renderX2WeekGrid();
          renderPreview();
        } catch (err) {
          alert('Αποτυχία: ' + (err.message || ''));
          cb.checked = !value;
        } finally {
          cb.disabled = false;
        }
      });
    });

    box.querySelectorAll('[data-patreon-week]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.getAttribute('data-patreon-week');
        const source = sel.getAttribute('data-source');
        const week = sel.value ? Number(sel.value) : null;
        await setPatreonWeek(id, source, week, sel);
      });
    });
  }

  async function setPatreonWeek(playerId, source, week, selectEl) {
    if (!schema.multipliers) return alert('Τρέξε πρώτα το migration 005.');
    if (week != null) {
      const conflict = cache.multipliers.find(m =>
        String(m.player_id) === String(playerId) &&
        num(m.used_week) === week &&
        !(m.source === source)
      );
      if (conflict) {
        alert('Ο παίκτης έχει ήδη Χ2 στην αγωνιστική ' + week + '.');
        renderX2();
        return;
      }
    }

    if (selectEl) selectEl.disabled = true;
    try {
      const existing = cache.multipliers.find(m =>
        String(m.player_id) === String(playerId) && m.source === source
      );

      if (existing) {
        const { error } = await sb.from('multipliers').update({ used_week: week }).eq('id', existing.id);
        if (error) throw error;
      } else if (week != null) {
        const { error } = await sb.from('multipliers').insert({
          player_id: playerId,
          source,
          awarded_week: null,
          used_week: week
        });
        if (error) throw error;
      }

      await loadMultipliers();
      renderX2();
      renderPreview();
    } catch (err) {
      alert('Αποτυχία: ' + (err.message || ''));
      renderX2();
    } finally {
      if (selectEl) selectEl.disabled = false;
    }
  }

  function renderHolidayGrid() {
    const box = $('holidayGrid');
    if (!box) return;

    if (!HOLIDAY_WEEKS.length) {
      box.innerHTML = '<p class="empty">Δεν υπάρχουν εορταστικές αγωνιστικές στο πρόγραμμα.</p>';
      return;
    }

    box.innerHTML = HOLIDAY_WEEKS.map(week => {
      const meta = weekMeta(week);
      const awards = cache.multipliers.filter(m => m.source === 'holiday' && num(m.awarded_week) === week);
      const done = awards.length >= 2;
      const winners = awards.map(a => {
        const p = playerById(a.player_id);
        return '<span class="holiday-winner">' + esc(p ? upperName(displayName(p)) : '—') + '</span>';
      }).join('');

      return '' +
        '<div class="holiday-card' + (done ? ' is-done' : '') + '">' +
          '<div class="holiday-card-head">' +
            '<strong>Αγ. ' + week + ' · ' + formatDay(new Date(meta.date)) + '</strong>' +
            '<span>' + awards.length + ' / 2</span>' +
          '</div>' +
          '<div class="holiday-winners">' + (winners || '<span class="empty">Δεν έχει γίνει κλήρωση.</span>') + '</div>' +
          '<button class="btn ' + (done ? 'btn-outline' : 'btn-primary') + ' btn-sm" data-draw="' + week + '" type="button"' +
            (done || !schema.multipliers ? ' disabled' : '') + '>' + (done ? 'Ολοκληρώθηκε' : 'Κλήρωση 2 παικτών') + '</button>' +
        '</div>';
    }).join('');

    box.querySelectorAll('[data-draw]').forEach(btn => {
      btn.addEventListener('click', () => drawHoliday(Number(btn.getAttribute('data-draw'))));
    });
  }

  async function drawHoliday(week) {
    if (!schema.multipliers) return alert('Τρέξε πρώτα το migration 005.');
    const existing = cache.multipliers.filter(m => m.source === 'holiday' && num(m.awarded_week) === week);
    if (existing.length >= 2) return;

    // Μετά την καταχώριση αποτελεσμάτων το Χ2 αλλάζει αναδρομικά
    // πόντους που έχουν ήδη μετρηθεί. Ζήτα ρητή επιβεβαίωση.
    const weekHasResults = cache.matches.some(m =>
      Number(m.week_number) === week &&
      cache.results.some(r => String(r.match_id) === String(m.id))
    );
    if (weekHasResults && !confirm('Η αγωνιστική ' + week + ' έχει ήδη αποτελέσματα. Το Χ2 θα διπλασιάσει αναδρομικά τους πόντους της. Συνέχεια;')) {
      return;
    }

    const taken = new Set(existing.map(m => String(m.player_id)));
    const usedThisWeek = new Set(cache.multipliers.filter(m => num(m.used_week) === week).map(m => String(m.player_id)));

    const candidates = cache.players.filter(p =>
      p.is_active !== false &&
      !taken.has(String(p.id)) &&
      !usedThisWeek.has(String(p.id))
    );

    if (candidates.length < (2 - existing.length)) {
      alert('Δεν υπάρχουν αρκετοί διαθέσιμοι παίκτες για κλήρωση αυτή την εβδομάδα.');
      return;
    }

    const picks = shuffle(candidates).slice(0, 2 - existing.length);
    if (!confirm('Κλήρωση: ' + picks.map(p => displayName(p)).join(' και ') + ';\nΤο Χ2 θα εφαρμοστεί στην αγωνιστική ' + week + '.')) {
      return;
    }

    try {
      const rows = picks.map(p => ({
        player_id: p.id,
        source: 'holiday',
        awarded_week: week,
        used_week: week
      }));
      const { error } = await sb.from('multipliers').insert(rows);
      if (error) throw error;
      await loadMultipliers();
      renderX2();
      renderPreview();
    } catch (err) {
      alert('Αποτυχία κλήρωσης: ' + (err.message || ''));
    }
  }

  function renderX2Table() {
    const tbody = $('x2Table');
    if (!tbody) return;

    if (!cache.multipliers.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Δεν υπάρχουν καταγεγραμμένα Χ2.</td></tr>';
      return;
    }

    const sorted = cache.multipliers.slice().sort((a, b) => {
      const wa = num(a.used_week) || 99;
      const wb = num(b.used_week) || 99;
      if (wa !== wb) return wa - wb;
      return String(a.source).localeCompare(String(b.source));
    });

    tbody.innerHTML = sorted.map(m => {
      const p = playerById(m.player_id);
      const options = '<option value="">—</option>' + weeksForSource(m.source).map(meta =>
        '<option value="' + meta.week + '"' + (num(m.used_week) === meta.week ? ' selected' : '') + '>Αγ. ' + meta.week + ' · ' + formatDay(new Date(meta.date)) + '</option>'
      ).join('');

      return '<tr>' +
        '<td>' + esc(p ? upperName(displayName(p)) : '—') + '</td>' +
        '<td><span class="x2-source-chip x2-source-chip--' + esc(m.source) + '">' + esc(sourceLabel(m.source)) + '</span></td>' +
        '<td class="num">' + (m.awarded_week ? 'Αγ. ' + m.awarded_week : '—') + '</td>' +
        '<td><select data-x2-week="' + esc(m.id) + '" class="x2-select">' + options + '</select></td>' +
        '<td><button class="icon-btn danger" data-x2-del="' + esc(m.id) + '" title="Διαγραφή">×</button></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-x2-week]').forEach(sel => {
      sel.addEventListener('change', () => setUsedWeek(sel.getAttribute('data-x2-week'), sel.value ? Number(sel.value) : null));
    });

    tbody.querySelectorAll('[data-x2-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Διαγραφή αυτού του Χ2;')) return;
        try {
          const { error } = await sb.from('multipliers').delete().eq('id', btn.getAttribute('data-x2-del'));
          if (error) throw error;
          await loadMultipliers();
          renderX2();
          renderPreview();
        } catch (err) {
          alert('Αποτυχία: ' + (err.message || ''));
        }
      });
    });
  }

  async function setUsedWeek(id, week) {
    const row = cache.multipliers.find(m => String(m.id) === String(id));
    if (!row) return;

    if (week != null) {
      const conflict = cache.multipliers.find(m =>
        String(m.player_id) === String(row.player_id) &&
        num(m.used_week) === week &&
        String(m.id) !== String(id)
      );
      if (conflict) {
        alert('Ο παίκτης έχει ήδη Χ2 στην αγωνιστική ' + week + '.');
        renderX2();
        return;
      }
    }

    try {
      const { error } = await sb.from('multipliers').update({ used_week: week }).eq('id', id);
      if (error) throw error;
      await loadMultipliers();
      renderX2();
      renderPreview();
    } catch (err) {
      alert('Αποτυχία: ' + (err.message || ''));
      renderX2();
    }
  }

  function renderX2WeekGrid() {
    const box = $('x2WeekGrid');
    if (!box) return;

    box.innerHTML = SCHEDULE.map(meta => {
      const list = cache.multipliers.filter(m => num(m.used_week) === meta.week);
      const chips = list.map(m => {
        const p = playerById(m.player_id);
        return '<span class="x2-chip">' + esc(p ? upperName(displayName(p)) : '—') + '<em>' + esc(sourceShort(m.source)) + '</em></span>';
      }).join('');
      return '' +
        '<div class="x2-week-card' + (list.length ? ' has-x2' : '') + '">' +
          '<span class="x2-week-label">Αγ. ' + meta.week + '<em>' + formatDay(new Date(meta.date)) + '</em></span>' +
          '<div class="x2-week-chips">' + (chips || '<span class="empty">—</span>') + '</div>' +
        '</div>';
    }).join('');
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ==================== PHASES ==================== */

  function wirePhases() {
    if ($('drawGroupsBtn')) $('drawGroupsBtn').addEventListener('click', drawGroups);
    if ($('advanceBtn')) $('advanceBtn').addEventListener('click', advancePhase);
    if ($('resetPhasesBtn')) $('resetPhasesBtn').addEventListener('click', resetPhases);
  }

  function standingsNow() {
    return S.standings({
      players: displayPlayers(),
      matches: cache.matches,
      results: cache.results,
      multipliers: cache.multipliers
    });
  }

  // Μόνο όσοι έχουν παίξει τουλάχιστον μία δοκιμασία μπορούν να
  // προκριθούν — αλλιώς 0-ποντοι παίκτες που δεν έχουν αγωνιστεί
  // καταλαμβάνουν θέσεις στα pots.
  function qualifierRows(rows) {
    return (rows || []).filter(r => num(r.matchdays) > 0);
  }

  function phasePayload() {
    return {
      players: displayPlayers(),
      matches: cache.matches,
      results: cache.results,
      multipliers: cache.multipliers,
      groupMembers: cache.groupMembers,
      phaseMatches: cache.phaseMatches
    };
  }

  function renderPhases() {
    const rows = standingsNow();
    const qualifiers = qualifierRows(rows);
    const b = S.bracket(phasePayload());
    const status = $('phaseStatus');

    if (status) {
      if (b.championName) status.textContent = 'Ολοκληρώθηκε';
      else if (cache.groupMembers.length) status.textContent = 'Φάση ομίλων';
      else if (qualifiers.length >= QUALIFIERS) status.textContent = 'Έτοιμο για κλήρωση';
      else status.textContent = 'Προκριματικά';
    }

    renderPotsAdmin(rows);
    renderGroupsAdmin();
    renderBracketAdmin(b);
  }

  function renderPotsAdmin(rows) {
    const box = $('potsAdmin');
    if (!box) return;

    const top = qualifierRows(rows).slice(0, QUALIFIERS);

    if (!top.length) {
      box.innerHTML = '<p class="empty">Δεν υπάρχουν ακόμη αποτελέσματα.</p>';
      return;
    }

    const pots = S.pots(top);
    box.innerHTML = pots.map(pot => {
      const size = pot.size || 4;
      const items = pot.rows.map((r, i) =>
        '<div class="pot-admin-row"><span>#' + ((pot.pot - 1) * size + i + 1) + '</span><strong>' + esc(upperName(r.nickname)) + '</strong><em>' + r.points + 'π</em></div>'
      ).join('');
      return '<div class="pot-admin-card"><div class="pot-admin-head"><strong>Pot ' + pot.pot + '</strong><span>' + pot.range + '</span></div>' + (items || '<p class="empty">—</p>') + '</div>';
    }).join('');
  }

  function renderGroupsAdmin() {
    const box = $('groupsAdmin');
    if (!box) return;

    if (!cache.groupMembers.length) {
      box.innerHTML = '<p class="empty">Δεν έχει γίνει κλήρωση. Πάτησε «Κλήρωση ομίλων» όταν ολοκληρωθούν οι 12 αγωνιστικές.</p>';
      return;
    }

    const groups = S.groupTables(phasePayload());

    box.innerHTML = groups.map(g => {
      const table = g.table.map((r, i) =>
        '<tr class="' + (r.qualified ? 'is-qualified' : '') + '">' +
          '<td class="num">' + (i + 1) + '</td>' +
          '<td>' + esc(upperName(r.nickname)) + '</td>' +
          '<td class="num">' + r.played + '</td>' +
          '<td class="num">' + r.wins + '</td>' +
          '<td class="num">' + r.losses + '</td>' +
          '<td class="num">' + r.points + '</td>' +
        '</tr>'
      ).join('');

      const fixtures = g.fixtures.map(f =>
        '<div class="fixture-row" data-match="' + esc(f.id) + '">' +
          '<span class="fixture-team">' + esc(upperName(f.playerAName)) + '</span>' +
          '<input type="number" min="0" max="99" value="' + (f.score_a != null ? f.score_a : '') + '" data-score="a" aria-label="Σκορ πρώτου">' +
          '<span class="fixture-dash">–</span>' +
          '<input type="number" min="0" max="99" value="' + (f.score_b != null ? f.score_b : '') + '" data-score="b" aria-label="Σκορ δεύτερου">' +
          '<span class="fixture-team fixture-team--b">' + esc(upperName(f.playerBName)) + '</span>' +
          '<button class="btn btn-outline btn-sm fixture-save" type="button">Αποθήκευση</button>' +
        '</div>'
      ).join('');

      return '' +
        '<div class="group-admin-card">' +
          '<div class="group-admin-head"><span class="group-letter">' + g.label + '</span><strong>Όμιλος ' + g.label + '</strong><em>' + (g.complete ? 'Ολοκληρώθηκε' : 'Σε εξέλιξη') + '</em></div>' +
          '<table class="group-table">' +
            '<thead><tr><th>#</th><th>Παίκτης</th><th class="num">Α</th><th class="num">Ν</th><th class="num">Η</th><th class="num">Β</th></tr></thead>' +
            '<tbody>' + table + '</tbody>' +
          '</table>' +
          '<div class="fixture-list">' + fixtures + '</div>' +
        '</div>';
    }).join('');

    box.querySelectorAll('.fixture-row').forEach(row => {
      const btn = row.querySelector('.fixture-save');
      btn.addEventListener('click', () => {
        const a = row.querySelector('[data-score="a"]').value;
        const b = row.querySelector('[data-score="b"]').value;
        savePhaseScore(row.getAttribute('data-match'), a, b, 'group');
      });
    });
  }

  function renderBracketAdmin(b) {
    const box = $('bracketAdmin');
    if (!box) return;

    const hasAny = b.qf.length || b.sf.length || b.final || b.third;
    if (!hasAny) {
      box.innerHTML = '<p class="empty">Το bracket θα εμφανιστεί όταν ολοκληρωθούν οι όμιλοι και πατήσεις «Προχώρησε στην επόμενη φάση».</p>';
      return;
    }

    const block = (title, matches) => {
      const list = matches.filter(Boolean);
      if (!list.length) return '';
      return '<div class="bracket-admin-round"><h4>' + title + '</h4>' + list.map(m => {
        const complete = !!m.winner;
        return '' +
          '<div class="bracket-admin-match' + (complete ? ' is-complete' : '') + '" data-match="' + esc(m.id) + '">' +
            '<div class="ba-top"><span>' + esc(m.playerAName ? upperName(m.playerAName) : '—') + '</span>' +
              '<input type="number" min="0" max="99" value="' + (m.score_a != null ? m.score_a : '') + '" data-score="a" aria-label="Σκορ πρώτου">' +
            '</div>' +
            '<div class="ba-top"><span>' + esc(m.playerBName ? upperName(m.playerBName) : '—') + '</span>' +
              '<input type="number" min="0" max="99" value="' + (m.score_b != null ? m.score_b : '') + '" data-score="b" aria-label="Σκορ δεύτερου">' +
            '</div>' +
            '<div class="ba-bottom">' +
              '<span class="ba-phase">' + esc({ qf: 'Προημιτελικός', sf: 'Ημιτελικός', final: 'Τελικός', third: 'Μικρός τελικός' }[m.phase] || m.phase) + '</span>' +
              '<span class="ba-winner">' + (m.winner ? 'Νικητής: ' + esc(upperName(m.winner === m.player_a ? m.playerAName : m.playerBName)) : 'Εκκρεμεί') + '</span>' +
              '<button class="btn btn-outline btn-sm fixture-save" type="button">Αποθήκευση</button>' +
            '</div>' +
          '</div>';
      }).join('') + '</div>';
    };

    box.innerHTML = '' +
      block('Προημιτελικά', b.qf) +
      block('Ημιτελικά', b.sf) +
      block('Τελικός', b.final ? [b.final] : []) +
      block('Χάλκινο', b.third ? [b.third] : []) +
      (b.championName ? '<div class="bracket-champion"><span>Πρωταθλητής</span><strong>' + esc(upperName(b.championName)) + '</strong></div>' : '');

    box.querySelectorAll('.bracket-admin-match').forEach(row => {
      const id = row.getAttribute('data-match');
      const match = cache.phaseMatches.find(m => String(m.id) === String(id));
      row.querySelector('.fixture-save').addEventListener('click', () => {
        const a = row.querySelector('[data-score="a"]').value;
        const bScore = row.querySelector('[data-score="b"]').value;
        savePhaseScore(id, a, bScore, match ? match.phase : 'qf');
      });
    });
  }

  async function savePhaseScore(id, a, b, phase) {
    // Το Number('') είναι 0, οπότε ένα κενό πεδίο θα αποθηκευόταν
    // σιωπηλά ως 0–x. Έλεγξε πρώτα ότι υπάρχει τιμή.
    const rawA = String(a == null ? '' : a).trim();
    const rawB = String(b == null ? '' : b).trim();
    if (!rawA || !rawB) {
      alert('Συμπλήρωσε και τα δύο σκορ.');
      return;
    }

    const na = Number(rawA);
    const nb = Number(rawB);
    if (!Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) {
      alert('Συμπλήρωσε έγκυρα σκορ (0 ή μεγαλύτερο).');
      return;
    }
    if (na > 99 || nb > 99) {
      alert('Το σκορ δεν μπορεί να ξεπερνά το 99.');
      return;
    }
    if (na === nb) {
      alert('Στο 1v1 GeoQuiz δεν επιτρέπεται ισοπαλία. Άλλαξε ένα σκορ.');
      return;
    }

    const match = cache.phaseMatches.find(m => String(m.id) === String(id));
    if (!match) return;

    const downstream = {
      group: ['qf', 'sf', 'final', 'third'],
      qf: ['sf', 'final', 'third'],
      sf: ['final', 'third'],
      final: [],
      third: []
    }[phase] || [];

    const hasDownstream = cache.phaseMatches.some(m => downstream.includes(m.phase));
    if (hasDownstream) {
      if (!confirm('Έχουν ήδη δημιουργηθεί επόμενες φάσεις. Αν αλλάξεις αυτό το σκορ, θα διαγραφούν. Συνέχεια;')) return;
    }

    try {
      const { error } = await sb.from('phase_matches').update({
        score_a: na,
        score_b: nb,
        winner_id: na > nb ? match.player_a : match.player_b
      }).eq('id', id);
      if (error) throw error;

      if (hasDownstream) {
        const { error: dErr } = await sb.from('phase_matches').delete().in('phase', downstream);
        if (dErr) throw dErr;
      }

      await loadPhaseData();
      renderPhases();
      $('phaseMsg').className = 'form-msg ok';
      $('phaseMsg').textContent = 'Το σκορ αποθηκεύτηκε.';
    } catch (err) {
      alert('Αποτυχία: ' + (err.message || ''));
    }
  }

  async function drawGroups() {
    if (!schema.groups || !schema.phases) return alert('Τρέξε πρώτα το migration 005.');

    const rows = standingsNow();
    const qualified = qualifierRows(rows);
    if (qualified.length < QUALIFIERS) {
      alert('Χρειάζονται τουλάχιστον ' + QUALIFIERS + ' παίκτες με αποτελέσματα για την κλήρωση (τώρα ' + qualified.length + ').');
      return;
    }

    const played = S.playedWeeks(cache.matches, cache.results).length;
    if (played < SCHEDULE.length) {
      if (!confirm('Δεν έχουν ολοκληρωθεί και οι ' + SCHEDULE.length + ' αγωνιστικές (' + played + '/' + SCHEDULE.length + '). Η κλήρωση θα γίνει με την τρέχουσα κατάταξη. Συνέχεια;')) return;
    }

    if (cache.groupMembers.length && !confirm('Υπάρχει ήδη κλήρωση. Θα διαγραφούν οι όμιλοι και όλο το bracket. Συνέχεια;')) return;

    const labels = (cfg.format && cfg.format.groupLabels) || ['A', 'B', 'C', 'D'];
    const top16 = qualified.slice(0, QUALIFIERS);
    const members = [];
    const perPot = labels.length;

    for (let pot = 1; pot <= POT_COUNT; pot++) {
      const potRows = shuffle(top16.slice((pot - 1) * perPot, pot * perPot));
      potRows.forEach((row, i) => {
        members.push({
          group_label: labels[i],
          player_id: row.id,
          seed_rank: row.rank,
          pot
        });
      });
    }

    try {
      await deleteAllPhaseData();

      const { data: inserted, error: mErr } = await sb.from('group_members').insert(members).select();
      if (mErr) throw mErr;

      const byGroup = {};
      (inserted || []).forEach(m => {
        byGroup[m.group_label] = byGroup[m.group_label] || [];
        byGroup[m.group_label].push(m);
      });

      const fixtures = [];
      const rounds = [
        [[0, 1], [2, 3]],
        [[0, 2], [3, 1]],
        [[3, 0], [1, 2]]
      ];

      labels.forEach(label => {
        const group = byGroup[label] || [];
        let slot = 0;
        rounds.forEach((round, ri) => {
          round.forEach(pair => {
            if (!group[pair[0]] || !group[pair[1]]) return;
            slot += 1;
            fixtures.push({
              phase: 'group',
              group_label: label,
              round: ri + 1,
              slot,
              player_a: group[pair[0]].player_id,
              player_b: group[pair[1]].player_id
            });
          });
        });
      });

      if (fixtures.length) {
        const { error: fErr } = await sb.from('phase_matches').insert(fixtures);
        if (fErr) throw fErr;
      }

      await loadPhaseData();
      renderPhases();

      $('phaseMsg').className = 'form-msg ok';
      $('phaseMsg').textContent = 'Η κλήρωση ολοκληρώθηκε. Οι όμιλοι και οι 24 αγώνες είναι έτοιμοι.';
    } catch (err) {
      alert('Αποτυχία κλήρωσης: ' + (err.message || ''));
    }
  }

  async function advancePhase() {
    if (!schema.groups || !schema.phases) return alert('Τρέξε πρώτα το migration 005.');
    if (!cache.groupMembers.length) return alert('Πρώτα κάνε την κλήρωση των ομίλων.');

    const groups = S.groupTables(phasePayload());
    const allGroupsComplete = groups.every(g => g.fixtures.length && g.complete);
    if (!allGroupsComplete) return alert('Ολοκλήρωσε πρώτα όλους τους αγώνες των ομίλων.');

    const b = S.bracket(phasePayload());

    try {
      if (!b.qf.length) {
        const g = {};
        groups.forEach(x => { g[x.label] = x.table; });
        const pairs = [
          [g.A[0], g.B[1]],
          [g.B[0], g.A[1]],
          [g.C[0], g.D[1]],
          [g.D[0], g.C[1]]
        ];
        const rows = pairs.map((p, i) => ({
          phase: 'qf',
          group_label: null,
          round: 1,
          slot: i + 1,
          player_a: p[0].playerId,
          player_b: p[1].playerId
        }));
        const { error } = await sb.from('phase_matches').insert(rows);
        if (error) throw error;
        $('phaseMsg').className = 'form-msg ok';
        $('phaseMsg').textContent = 'Τα προημιτελικά δημιουργήθηκαν. Καταχώρισε τα σκορ.';
      } else if (!b.qf.every(m => m.complete)) {
        return alert('Ολοκλήρωσε πρώτα όλους τους προημιτελικούς.');
      } else if (!b.sf.length) {
        const w = b.qf.slice().sort((x, y) => num(x.slot) - num(y.slot)).map(m => m.winner);
        const rows = [
          { phase: 'sf', group_label: null, round: 1, slot: 1, player_a: w[0], player_b: w[1] },
          { phase: 'sf', group_label: null, round: 1, slot: 2, player_a: w[2], player_b: w[3] }
        ];
        const { error } = await sb.from('phase_matches').insert(rows);
        if (error) throw error;
        $('phaseMsg').className = 'form-msg ok';
        $('phaseMsg').textContent = 'Οι ημιτελικοί δημιουργήθηκαν.';
      } else if (!b.sf.every(m => m.complete)) {
        return alert('Ολοκλήρωσε πρώτα και τους δύο ημιτελικούς.');
      } else if (!b.final) {
        const sf = b.sf.slice().sort((x, y) => num(x.slot) - num(y.slot));
        const winners = sf.map(m => m.winner);
        const losers = sf.map(m => m.winner === String(m.player_a) ? m.player_b : m.player_a);
        const rows = [
          { phase: 'final', group_label: null, round: 1, slot: 1, player_a: winners[0], player_b: winners[1] },
          { phase: 'third', group_label: null, round: 1, slot: 1, player_a: losers[0], player_b: losers[1] }
        ];
        const { error } = await sb.from('phase_matches').insert(rows);
        if (error) throw error;
        $('phaseMsg').className = 'form-msg ok';
        $('phaseMsg').textContent = 'Ο τελικός και ο μικρός τελικός δημιουργήθηκαν.';
      } else {
        return alert('Το bracket έχει ήδη ολοκληρωθεί.');
      }

      await loadPhaseData();
      renderPhases();
    } catch (err) {
      alert('Αποτυχία: ' + (err.message || ''));
    }
  }

  async function resetPhases() {
    if (!schema.groups || !schema.phases) return alert('Τρέξε πρώτα το migration 005.');
    if (!confirm('Να διαγραφούν ΟΛΟΙ οι όμιλοι και το bracket; Τα αποτελέσματα των προκριματικών δεν αγγίζονται.')) return;

    try {
      await deleteAllPhaseData();
      await loadPhaseData();
      renderPhases();
      $('phaseMsg').className = 'form-msg ok';
      $('phaseMsg').textContent = 'Οι φάσεις επαναφέρθηκαν.';
    } catch (err) {
      alert('Αποτυχία: ' + (err.message || ''));
    }
  }

  async function deleteAllPhaseData() {
    const zero = '00000000-0000-0000-0000-000000000000';
    const [a, b] = await Promise.all([
      sb.from('phase_matches').delete().neq('id', zero),
      sb.from('group_members').delete().neq('id', zero)
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
  }

  /* ==================== PLAYERS ==================== */

  function wirePlayerForm() {
    const form = $('playerForm');
    if (!form) return;
    const currentYear = new Date().getFullYear();
    const birthInput = $('pBirthYear');
    if (birthInput) birthInput.max = String(currentYear);

    const search = $('playerSearch');
    if (search) search.addEventListener('input', () => {
      playerSearch = search.value.trim().toLowerCase();
      renderPlayersTable();
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const msg = $('playerMsg');
      msg.className = 'form-msg';
      msg.textContent = '';

      const nickname = upperName($('pNick').value.trim());
      const firstName = upperName($('pFirst').value.trim()) || null;
      const birthYear = Number($('pBirthYear').value);
      const city = $('pCity').value.trim() || null;

      if (nickname.length < 2) {
        msg.className = 'form-msg err';
        msg.textContent = 'Το όνομα είναι υποχρεωτικό.';
        return;
      }
      if (!firstName) {
        msg.className = 'form-msg err';
        msg.textContent = 'Το username στο GeoGuessr είναι υποχρεωτικό.';
        return;
      }
      if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
        msg.className = 'form-msg err';
        msg.textContent = 'Συμπλήρωσε έγκυρο έτος γέννησης.';
        return;
      }
      if (!city) {
        msg.className = 'form-msg err';
        msg.textContent = 'Η περιοχή εκπροσώπησης είναι υποχρεωτική.';
        return;
      }

      try {
        const payload = {
          nickname,
          first_name: firstName,
          birth_year: birthYear,
          city
        };
        if (schema.patreon) payload.is_patreon = false;

        const { error } = await sb.from('players').insert(payload);
        if (error) throw error;
        msg.className = 'form-msg ok';
        msg.textContent = 'Ο παίκτης προστέθηκε.';
        form.reset();
        await loadAll();
        renderPlayersTable();
        renderPlayerOptions();
        renderX2();
        renderPhases();
      } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = 'Αποτυχία: ' + (err.message || 'άγνωστο');
      }
    });
  }

  function renderPlayersTable() {
    const tbody = $('playersBody');
    if (!tbody) return;

    const list = cache.players
      .filter(p => !playerSearch || (String(p.first_name || p.nickname || '') + ' ' + String(p.nickname || '')).toLowerCase().includes(playerSearch))
      .slice()
      .sort((a, b) => String(a.first_name || a.nickname || '').localeCompare(String(b.first_name || b.nickname || ''), 'el'));

    const count = $('playersCount');
    if (count) count.textContent = cache.players.length;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Κανένας παίκτης.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(p => {
      const patron = schema.patreon
        ? '<label class="patron-toggle patron-toggle--inline"><input type="checkbox" data-player-patreon="' + esc(p.id) + '"' + (p.is_patreon ? ' checked' : '') + '><span>' + (p.is_patreon ? 'Ναι' : 'Όχι') + '</span></label>'
        : '<span class="empty">—</span>';
      return '<tr>' +
        '<td>' + esc(p.first_name ? upperName(p.first_name) : upperName(p.nickname)) + '</td>' +
        '<td>' + esc(p.nickname ? upperName(p.nickname) : '—') + '</td>' +
        '<td class="num">' + esc(p.birth_year || '—') + '</td>' +
        '<td>' + esc(p.city || '—') + '</td>' +
        '<td>' + patron + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-player-patreon]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-player-patreon');
        const value = cb.checked;
        if (!value) {
          const used = usedPatreonMultipliers(id);
          if (used.length && !confirm('Τα Χ2 Patreon αυτού του παίκτη έχουν ήδη δηλωθεί σε αγωνιστικές. Θα διαγραφούν και θα αλλάξουν πόντοι που έχουν ήδη μετρηθεί. Συνέχεια;')) {
            cb.checked = true;
            return;
          }
        }
        cb.disabled = true;
        try {
          const { error } = await sb.from('players').update({ is_patreon: value }).eq('id', id);
          if (error) throw error;
          const p = playerById(id);
          if (p) p.is_patreon = value;
          if (!value && schema.multipliers) {
            const del = await sb.from('multipliers').delete().eq('player_id', id)
              .in('source', ['patreon_dec', 'patreon_jan']);
            if (del.error) throw del.error;
            await loadMultipliers();
          }
          renderPlayersTable();
          renderPatreonGrid();
          renderX2Table();
          renderX2WeekGrid();
        } catch (err) {
          alert('Αποτυχία: ' + (err.message || ''));
          cb.checked = !value;
        } finally {
          cb.disabled = false;
        }
      });
    });
  }

  /* ==================== REGISTRATIONS ==================== */

  async function loadRegs() {
    const box = $('regsList');
    if (!box) return;

    try {
      const { data, error } = await sb.from('registrations')
        .select('id,nickname,first_name,birth_year,city,created_at,status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;

      cache.regs = data || [];
      const cnt = $('regCount');
      if (cnt) cnt.textContent = cache.regs.length;

      if (!cache.regs.length) {
        box.innerHTML = '<p class="empty">Δεν υπάρχουν εκκρεμείς αιτήσεις.</p>';
        return;
      }

      box.innerHTML = cache.regs.map(r => {
        const meta = [upperName(r.nickname), r.birth_year ? 'γεν. ' + r.birth_year : null, r.city]
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(esc)
          .join(' · ') || '—';
        return '' +
        '<div class="reg-item" data-id="' + esc(r.id) + '">' +
          '<div>' +
            '<p class="reg-name">' + esc(upperName(r.first_name || r.nickname)) + '</p>' +
            '<p class="reg-meta">' + meta + '</p>' +
          '</div>' +
          '<div class="reg-actions">' +
            '<button class="btn btn-primary btn-sm" data-act="approve">Έγκριση</button>' +
            '<button class="btn btn-outline btn-sm" data-act="reject">Απόρριψη</button>' +
          '</div>' +
        '</div>';
      }).join('');

      box.querySelectorAll('.reg-item').forEach(item => {
        const id = item.getAttribute('data-id');
        item.querySelector('[data-act="approve"]').addEventListener('click', () => approveReg(id));
        item.querySelector('[data-act="reject"]').addEventListener('click', () => rejectReg(id));
      });
    } catch (err) {
      box.innerHTML = '<p class="empty">Σφάλμα φόρτωσης: ' + esc(err.message || '') + '</p>';
    }
  }

  async function approveReg(id) {
    const reg = cache.regs.find(r => String(r.id) === String(id));
    if (!reg) return;

    const nickname = upperName(String(reg.nickname || '').trim());
    const firstName = upperName(String(reg.first_name || reg.nickname || '').trim()) || null;
    const birthYear = reg.birth_year != null && reg.birth_year !== '' ? Number(reg.birth_year) : null;
    const city = String(reg.city || '').trim() || null;

    let createdPlayerId = null;
    try {
      const lower = (firstName || '').toLowerCase();
      const existing = cache.players.find(p => String(p.first_name || '').toLowerCase() === lower) ||
        cache.players.find(p => String(p.nickname).toLowerCase() === lower);
      if (existing) {
        if (!confirm('Ο παίκτης "' + (firstName || nickname) + '" υπάρχει ήδη. Έγκριση της αίτησης χωρίς διπλοεγγραφή;')) return;

        const patch = {};
        if (!existing.first_name && firstName) patch.first_name = firstName;
        if (nickname && (!existing.nickname || existing.nickname === existing.first_name)) patch.nickname = nickname;
        if (!existing.birth_year && birthYear) patch.birth_year = birthYear;
        if (!existing.city && city) patch.city = city;
        if (Object.keys(patch).length) {
          const { error: patchErr } = await sb.from('players').update(patch).eq('id', existing.id);
          if (patchErr) throw patchErr;
          await loadAll();
          renderPlayersTable();
          renderPlayerOptions();
        }

        const { error: uErr } = await sb.from('registrations').update({ status: 'approved' }).eq('id', id);
        if (uErr) throw uErr;
        await loadRegs();
        return;
      }

      const payload = { nickname, first_name: firstName, birth_year: birthYear, city };
      if (schema.patreon) payload.is_patreon = false;
      const { data: playerRow, error: pErr } = await sb.from('players').insert(payload).select('id').single();
      if (pErr) throw pErr;
      createdPlayerId = playerRow.id;

      const { error: uErr } = await sb.from('registrations').update({ status: 'approved' }).eq('id', id);
      if (uErr) throw uErr;

      await loadAll();
      renderPlayersTable();
      renderPlayerOptions();
      renderX2();
      await loadRegs();
    } catch (err) {
      if (createdPlayerId) {
        try { await sb.from('players').delete().eq('id', createdPlayerId); } catch (_) {}
      }
      alert('Αποτυχία έγκρισης: ' + (err.message || ''));
    }
  }

  async function rejectReg(id) {
    try {
      const { error } = await sb.from('registrations').update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
      await loadRegs();
    } catch (err) {
      alert('Αποτυχία απόρριψης: ' + (err.message || ''));
    }
  }

  /* ==================== HISTORY ==================== */

  function renderHistory() {
    const tbody = $('historyBody');
    if (!tbody) return;

    const rows = SCHEDULE.map(meta => {
      const map = matchFor(meta.week, 'map');
      const quiz = matchFor(meta.week, 'quiz');
      const date = map && map.match_date ? new Date(map.match_date)
        : (quiz && quiz.match_date ? new Date(quiz.match_date) : new Date(meta.date));
      const hasAny = !!(map || quiz);

      return '<tr>' +
        '<td><strong>Αγ. ' + meta.week + '</strong>' + (meta.holiday ? ' <span class="mini-flag mini-flag--gold">εορταστική</span>' : '') + '</td>' +
        '<td>' + esc(formatDate(date)) + '</td>' +
        '<td class="num">' + (map ? '<span class="mini-state is-on">✓</span>' : '<span class="mini-state">—</span>') + '</td>' +
        '<td class="num">' + (quiz ? '<span class="mini-state is-on">✓</span>' : '<span class="mini-state">—</span>') + '</td>' +
        '<td class="admin-row-actions">' +
          '<button class="btn btn-outline btn-sm" data-edit-week="' + meta.week + '" type="button">Άνοιγμα</button>' +
          (hasAny ? '<button class="icon-btn danger" data-del-week="' + meta.week + '" type="button" title="Διαγραφή αγωνιστικής">×</button>' : '') +
        '</td>' +
      '</tr>';
    }).join('');

    tbody.innerHTML = rows;

    tbody.querySelectorAll('[data-edit-week]').forEach(btn => {
      btn.addEventListener('click', () => {
        const week = Number(btn.getAttribute('data-edit-week'));
        currentWeek = week;
        renderWeekSelect();
        switchTab('match');
        loadWeek(week);
      });
    });

    tbody.querySelectorAll('[data-del-week]').forEach(btn => {
      btn.addEventListener('click', () => deleteWeek(Number(btn.getAttribute('data-del-week'))));
    });
  }

  async function deleteWeek(week) {
    const matches = cache.matches.filter(m => Number(m.week_number) === week);
    if (!matches.length) return;

    const x2Rows = cache.multipliers.filter(m => num(m.used_week) === week);
    const x2Note = x2Rows.length
      ? '\n\n' + x2Rows.length + ' Χ2 ήταν δηλωμένα για αυτή την αγωνιστική. Θα μείνουν χωρίς εβδομάδα χρήσης (θα γίνουν ξανά διαθέσιμα).'
      : '';

    if (!confirm('Διαγραφή ολόκληρης της αγωνιστικής ' + week + ' (χάρτης + quiz); Τα αποτελέσματά της θα χαθούν.' + x2Note)) return;

    try {
      const { error } = await sb.from('matches').delete().in('id', matches.map(m => m.id));
      if (error) throw error;

      // Χωρίς FK στο schedule, ένα used_week θα έμενε να δείχνει σε
      // αγωνιστική που δεν υπάρχει πια.
      if (x2Rows.length) {
        const { error: xErr } = await sb.from('multipliers')
          .update({ used_week: null })
          .eq('used_week', week);
        if (xErr) throw xErr;
      }

      await loadAll();
      renderHistory();
      renderX2();
      renderPhases();
      if (currentWeek === week) await loadWeek(week, true);
      const msg = $('matchMsg');
      msg.className = 'form-msg ok';
      msg.textContent = 'Η αγωνιστική ' + week + ' διαγράφηκε.';
    } catch (err) {
      alert('Αποτυχία διαγραφής: ' + (err.message || ''));
    }
  }
})();
