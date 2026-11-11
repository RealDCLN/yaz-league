/* ============================================================
   YAZ LEAGUE — Admin panel logic
   Handles: login, match entry, registrations, players, history.
   Requires: js/config.js (Supabase URL/key), admin.html DOM.
   ============================================================ */

(function () {
  'use strict';

  const Y = window.YAZ || {};
  const cfg = Y.config || {};
  const PTS = cfg.points || [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const CONCEPT_BONUS = cfg.conceptBonus || 3;

  let sb = null;
  let currentUser = null;
  const cache = { players: [], matches: [], results: [], regs: [] };
  let entries = [];
  let league = 'map';

  const $ = id => document.getElementById(id);
  const esc = str => String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const pad = n => String(n).padStart(2, '0');

  function pointsFor(place) {
    return (place >= 1 && place <= PTS.length) ? PTS[place - 1] : 0;
  }

  // Escape SQL LIKE wildcards so "_" and "%" in nicknames are matched literally.
  function escapeLike(s) {
    return String(s).replace(/[\\%_]/g, '\\$&');
  }

  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function nextFriday19() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0, 0);
    let diff = (5 - d.getDay() + 7) % 7;
    if (diff === 0 && now.getTime() >= d.getTime()) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  /* ==================== INIT ==================== */

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    wireTabs();
    wireLeagueChange();
    wireAddEntry();
    wireSaveMatch();
    wirePlayerForm();
    wireLoginForm();
    wireLogout();

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

    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

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
      if (!error) return data === true;
    } catch (_) {}
    return currentUser.email === cfg.adminEmail;
  }

  async function onSignedIn() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('adminUser').hidden = false;
    $('adminEmailLabel').textContent = currentUser.email || '';
    $('loginMsg').textContent = '';

    try {
      await loadAll();
    } catch (err) {
      $('loginView').hidden = false;
      $('appView').hidden = true;
      $('adminUser').hidden = true;
      const msg = $('loginMsg');
      msg.className = 'form-msg err';
      msg.textContent = err.message;
      return;
    }

    $('mDate').value = toLocalInput(nextFriday19());
    $('mWeek').value = nextWeekNumber();

    if (!entries.length) entries = [{ nickname: '', concept: false }];

    renderEntries();
    renderPreview();
    renderPlayersTable();
    renderHistoryTable();
    populateDatalist();
    await loadRegs();
  }

  function onSignedOut() {
    currentUser = null;
    cache.players = []; cache.matches = []; cache.results = []; cache.regs = [];
    entries = [];
    $('loginView').hidden = false;
    $('appView').hidden = true;
    $('adminUser').hidden = true;
    $('loginPass').value = '';
  }

  /* ==================== TABS ==================== */

  function wireTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('is-active', t === tab));
        document.querySelectorAll('.admin-panel').forEach(p =>
          p.classList.toggle('is-active', p.id === 'tab-' + target)
        );
      });
    });
  }

  function wireLeagueChange() {
    const sel = $('mLeague');
    const row = $('locationRow');
    if (!sel || !row) return;
    const update = () => {
      league = sel.value;
      row.style.display = league === 'map' ? '' : 'none';
      // The concept bonus only applies to the map league (rules state quiz
      // has no concept bonus). Clear stale flags so a checked box can't
      // leak into a quiz result and silently award +3.
      if (league !== 'map') entries.forEach(e => { e.concept = false; });
      renderEntries();
      renderPreview();
    };
    sel.addEventListener('change', update);
    update();
  }

  /* ==================== DATA ==================== */

  async function loadAll() {
    const [p, m, r] = await Promise.all([
      sb.from('players').select('*').order('nickname'),
      sb.from('matches').select('*').order('week_number'),
      sb.from('results').select('*')
    ]);
    const err = p.error || m.error || r.error;
    if (err) {
      console.error('[admin] load failed:', err);
      throw new Error('Σφάλμα φόρτωσης δεδομένων: ' + err.message + ' — έχεις τρέξει το schema.sql;');
    }
    cache.players = p.data || [];
    cache.matches = m.data || [];
    cache.results = r.data || [];
  }

  function nextWeekNumber() {
    if (!cache.matches.length) return 1;
    const max = cache.matches.reduce((acc, m) => Math.max(acc, Number(m.week_number) || 0), 0);
    return max + 1;
  }

  function populateDatalist() {
    const dl = $('playerOptions');
    if (!dl) return;
    dl.innerHTML = cache.players.map(p =>
      '<option value="' + esc(p.nickname) + '"></option>'
    ).join('');
  }

  /* ==================== ENTRY LIST ==================== */

  function wireAddEntry() {
    const btn = $('addEntryBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      entries.push({ nickname: '', concept: false });
      renderEntries();
      renderPreview();
    });
  }

  function renderEntries() {
    const list = $('entryList');
    if (!list) return;

    const cols = league === 'map' ? '44px 1fr auto auto auto' : '44px 1fr auto auto';

    list.innerHTML = entries.map((e, i) => {
      const pts = pointsFor(i + 1);
      return '' +
        '<div class="entry-row" style="grid-template-columns:' + cols + '" data-i="' + i + '">' +
          '<span class="entry-pos">' + (i + 1) + '</span>' +
          '<input type="text" list="playerOptions" value="' + esc(e.nickname) + '" placeholder="Όνομα παίκτη" data-role="nick">' +
          '<span class="entry-points">' + pts + ' πόντοι</span>' +
          (league === 'map'
            ? '<label class="entry-bonus"><input type="checkbox" data-role="concept"' + (e.concept ? ' checked' : '') + '> +3</label>'
            : '') +
          '<div class="entry-tools">' +
            '<button class="icon-btn" type="button" data-act="up" title="Πάνω">↑</button>' +
            '<button class="icon-btn" type="button" data-act="down" title="Κάτω">↓</button>' +
            '<button class="icon-btn danger" type="button" data-act="rm" title="Αφαίρεση">×</button>' +
          '</div>' +
        '</div>';
    }).join('');

    list.querySelectorAll('.entry-row').forEach(row => {
      const i = Number(row.getAttribute('data-i'));
      const nickEl = row.querySelector('[data-role="nick"]');
      const conceptEl = row.querySelector('[data-role="concept"]');

      nickEl.addEventListener('input', () => {
        entries[i].nickname = nickEl.value;
        renderPreview();
      });

      if (conceptEl) {
        conceptEl.addEventListener('change', () => {
          if (conceptEl.checked) {
            list.querySelectorAll('[data-role="concept"]').forEach((cb, j) => {
              if (j !== i) { cb.checked = false; entries[j].concept = false; }
            });
          }
          entries[i].concept = conceptEl.checked;
          renderPreview();
        });
      }

      row.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          if (act === 'rm') entries.splice(i, 1);
          else if (act === 'up' && i > 0) [entries[i - 1], entries[i]] = [entries[i], entries[i - 1]];
          else if (act === 'down' && i < entries.length - 1) [entries[i + 1], entries[i]] = [entries[i], entries[i + 1]];
          renderEntries();
          renderPreview();
        });
      });
    });
  }

  /* ==================== PREVIEW ==================== */

  function currentTotals() {
    const totals = new Map();
    cache.results.forEach(r => {
      const id = String(r.player_id);
      totals.set(id, (totals.get(id) || 0) + Number(r.points || 0));
    });
    return totals;
  }

  function renderPreview() {
    const tbody = $('previewBody');
    if (!tbody) return;

    const totals = currentTotals();
    const playersByName = new Map(cache.players.map(p => [p.nickname.toLowerCase(), p]));

    const rows = entries.map((e, i) => {
      const name = (e.nickname || '').trim();
      const player = name ? playersByName.get(name.toLowerCase()) : null;
      const current = player ? (totals.get(String(player.id)) || 0) : 0;
      // Concept bonus is map-only. Guard the preview the same way the save
      // path does so the projected totals don't mislead the admin.
      const pts = pointsFor(i + 1) + ((league === 'map' && e.concept) ? CONCEPT_BONUS : 0);
      return {
        name: name || '—',
        matchPts: pts,
        current,
        after: current + pts,
        isNew: !player && name.length > 0
      };
    });

    rows.sort((a, b) => b.after - a.after || a.name.localeCompare(b.name, 'el'));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Δεν υπάρχουν καταχωρήσεις.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r, i) => {
      const marker = r.isNew ? ' <span class="badge-new">νέος</span>' : '';
      return '<tr>' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + esc(r.name) + marker + '</td>' +
        '<td class="num">' + r.matchPts + '</td>' +
        '<td class="num">' + r.current + '</td>' +
        '<td class="num">' + r.after + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ==================== SAVE MATCH ==================== */

  function wireSaveMatch() {
    const btn = $('saveMatchBtn');
    if (!btn) return;
    btn.addEventListener('click', saveMatch);
  }

  async function saveMatch() {
    const msg = $('matchMsg');
    const btn = $('saveMatchBtn');
    msg.className = 'form-msg';
    msg.textContent = '';

    const week = Number($('mWeek').value);
    const dateStr = $('mDate').value;
    const leagueSel = $('mLeague').value;

    const problems = [];
    if (!Number.isInteger(week) || week < 1) problems.push('Συμπλήρωσε έγκυρη αγωνιστική.');
    if (!dateStr) problems.push('Συμπλήρωσε ημερομηνία.');

    const clean = entries.map((e, i) => ({
      nickname: (e.nickname || '').trim(),
      concept: !!e.concept,
      place: i + 1
    })).filter(e => e.nickname);

    if (!clean.length) problems.push('Πρόσθεσε τουλάχιστον έναν παίκτη.');

    const lowers = clean.map(e => e.nickname.toLowerCase());
    const dups = Array.from(new Set(lowers.filter((n, i) => lowers.indexOf(n) !== i)));
    if (dups.length) problems.push('Διπλό όνομα: ' + dups.join(', '));

    if (leagueSel === 'map' && clean.filter(e => e.concept).length > 1) {
      problems.push('Μόνο ένας παίκτης μπορεί να πάρει το concept bonus.');
    }

    if (problems.length) {
      msg.className = 'form-msg err';
      msg.textContent = problems.join(' ');
      return;
    }

    if (cache.matches.some(m => Number(m.week_number) === week && m.league === leagueSel)) {
      msg.className = 'form-msg err';
      msg.textContent = 'Υπάρχει ήδη αγωνιστική ' + week + ' (' + leagueSel + '). Διάγραψέ την από το ιστορικό πρώτα.';
      return;
    }

    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Αποθήκευση…';

    let matchId = null;
    const createdPlayerIds = [];
    try {
      const loc = leagueSel === 'map' ? ($('mLocation').value.trim() || null) : null;
      const lat = leagueSel === 'map' ? (Number($('mLat').value) || null) : null;
      const lng = leagueSel === 'map' ? (Number($('mLng').value) || null) : null;

      const { data: matchRow, error: mErr } = await sb.from('matches').insert({
        week_number: week,
        match_date: new Date(dateStr).toISOString(),
        league: leagueSel,
        location_name: loc,
        lat, lng
      }).select().single();
      if (mErr) throw mErr;
      matchId = matchRow.id;

      const resolved = [];
      for (const e of clean) {
        const { player, created } = await resolveOrCreatePlayer(e.nickname);
        if (created) createdPlayerIds.push(player.id);
        resolved.push({ player, entry: e });
      }

      // Defense-in-depth: enforce that the concept bonus only applies to
      // the map league. Even if stale state or a crafted request sneaks a
      // concept:true into a quiz entry, it can't corrupt the results here.
      const applyConcept = leagueSel === 'map';

      const resultRows = resolved.map(r => ({
        match_id: matchId,
        player_id: r.player.id,
        placement: r.entry.place,
        points: pointsFor(r.entry.place) + (applyConcept && r.entry.concept ? CONCEPT_BONUS : 0),
        raw_score: null,
        concept_bonus: !!(applyConcept && r.entry.concept)
      }));

      const { error: rErr } = await sb.from('results').insert(resultRows);
      if (rErr) throw rErr;

      msg.className = 'form-msg ok';
      msg.textContent = 'Αποθηκεύτηκε η αγωνιστική ' + week + ' (' + leagueSel + ') με ' + resultRows.length + ' αποτελέσματα.';

      entries = [{ nickname: '', concept: false }];
      $('mWeek').value = week + 1;
      $('mLocation').value = '';
      $('mLat').value = '';
      $('mLng').value = '';

      await loadAll();
      renderEntries();
      renderPreview();
      renderPlayersTable();
      renderHistoryTable();
      populateDatalist();
    } catch (err) {
      console.error('[admin] save failed:', err);
      if (matchId) { try { await sb.from('matches').delete().eq('id', matchId); } catch (_) {} }
      // Roll back any players we auto-created for this failed attempt so a retry
      // doesn't try to insert results for player IDs that no longer exist.
      if (createdPlayerIds.length) {
        try { await sb.from('players').delete().in('id', createdPlayerIds); } catch (_) {}
        cache.players = cache.players.filter(p => !createdPlayerIds.includes(p.id));
      }
      msg.className = 'form-msg err';
      msg.textContent = 'Αποτυχία: ' + (err.message || 'άγνωστο σφάλμα');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function resolveOrCreatePlayer(nickname) {
    const lower = nickname.toLowerCase();
    const existing = cache.players.find(p => p.nickname.toLowerCase() === lower);
    if (existing) return { player: existing, created: false };

    const { data, error } = await sb.from('players').insert({ nickname }).select().single();
    if (error) {
      // Race: nickname may have been created between our cache read and insert.
      // Escape LIKE wildcards so "_" and "%" in nicknames are matched literally.
      const { data: again } = await sb.from('players')
        .select('*')
        .ilike('nickname', escapeLike(nickname))
        .maybeSingle();
      if (again) return { player: again, created: false };
      throw error;
    }
    cache.players.push(data);
    return { player: data, created: true };
  }

  /* ==================== PLAYERS TAB ==================== */

  function wirePlayerForm() {
    const form = $('playerForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const msg = $('playerMsg');
      msg.className = 'form-msg';
      msg.textContent = '';

      const nickname = $('pNick').value.trim();
      const geoguessr = $('pGeo').value.trim() || null;
      const discord = $('pDiscord').value.trim() || null;

      if (nickname.length < 2) {
        msg.className = 'form-msg err';
        msg.textContent = 'Το ψευδώνυμο είναι υποχρεωτικό.';
        return;
      }

      try {
        const { error } = await sb.from('players').insert({
          nickname, geoguessr_url: geoguessr, discord
        });
        if (error) throw error;
        msg.className = 'form-msg ok';
        msg.textContent = 'Ο παίκτης προστέθηκε.';
        form.reset();
        await loadAll();
        renderPlayersTable();
        populateDatalist();
      } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = 'Αποτυχία: ' + (err.message || 'άγνωστο');
      }
    });
  }

  function renderPlayersTable() {
    const tbody = $('playersBody');
    if (!tbody) return;
    const count = $('playersCount');
    if (count) count.textContent = cache.players.length;

    if (!cache.players.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="loading-row">Κανένας παίκτης ακόμη.</td></tr>';
      return;
    }

    tbody.innerHTML = cache.players.map(p =>
      '<tr>' +
        '<td>' + esc(p.nickname) + '</td>' +
        '<td>' + esc(p.discord || '—') + '</td>' +
        '<td>' + (p.geoguessr_url
          ? '<a href="' + esc(p.geoguessr_url) + '" target="_blank" rel="noopener">Προφίλ ↗</a>'
          : '—') + '</td>' +
      '</tr>'
    ).join('');
  }

  /* ==================== REGISTRATIONS ==================== */

  async function loadRegs() {
    const box = $('regsList');
    if (!box) return;

    try {
      const { data, error } = await sb.from('registrations')
        .select('*')
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

      box.innerHTML = cache.regs.map(r =>
        '<div class="reg-item" data-id="' + esc(r.id) + '">' +
          '<div>' +
            '<p class="reg-name">' + esc(r.nickname) + '</p>' +
            '<p class="reg-meta">' +
              'Discord: ' + esc(r.discord || '—') +
              (r.geoguessr_url ? ' · <a href="' + esc(r.geoguessr_url) + '" target="_blank" rel="noopener">GeoGuessr ↗</a>' : '') +
              (r.email ? ' · ' + esc(r.email) : '') +
            '</p>' +
          '</div>' +
          '<div class="reg-actions">' +
            '<button class="btn btn-primary btn-sm" data-act="approve">Έγκριση</button>' +
            '<button class="btn btn-outline btn-sm" data-act="reject">Απόρριψη</button>' +
          '</div>' +
        '</div>'
      ).join('');

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
    try {
      const { error: pErr } = await sb.from('players').insert({
        nickname: reg.nickname,
        geoguessr_url: reg.geoguessr_url,
        discord: reg.discord
      });
      if (pErr) throw pErr;
      const { error: uErr } = await sb.from('registrations').update({ status: 'approved' }).eq('id', id);
      if (uErr) throw uErr;
      await loadAll();
      renderPlayersTable();
      populateDatalist();
      await loadRegs();
    } catch (err) {
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

  function renderHistoryTable() {
    const tbody = $('historyBody');
    if (!tbody) return;

    if (!cache.matches.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Καμία αγωνιστική ακόμη.</td></tr>';
      return;
    }

    const sorted = cache.matches.slice().sort((a, b) => {
      if (Number(a.week_number) !== Number(b.week_number)) return Number(a.week_number) - Number(b.week_number);
      return String(a.league).localeCompare(String(b.league));
    });

    tbody.innerHTML = sorted.map(m => {
      const date = m.match_date ? new Date(m.match_date) : null;
      const dateStr = date
        ? date.toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' }) +
          ' · ' + date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      return '<tr>' +
        '<td><strong>' + m.week_number + '</strong></td>' +
        '<td>' + esc(m.league) + '</td>' +
        '<td>' + esc(dateStr) + '</td>' +
        '<td>' + esc(m.location_name || '—') + '</td>' +
        '<td><button class="icon-btn danger" data-del="' + esc(m.id) + '" title="Διαγραφή">×</button></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => deleteMatch(btn.getAttribute('data-del')));
    });
  }

  async function deleteMatch(id) {
    const m = cache.matches.find(x => String(x.id) === String(id));
    if (!m) return;
    if (!confirm('Διαγραφή αγωνιστικής ' + m.week_number + ' (' + m.league + '); Τα αποτελέσματα θα χαθούν.')) return;
    try {
      const { error } = await sb.from('matches').delete().eq('id', id);
      if (error) throw error;
      await loadAll();
      renderHistoryTable();
      renderPreview();
    } catch (err) {
      alert('Αποτυχία διαγραφής: ' + (err.message || ''));
    }
  }
})();
