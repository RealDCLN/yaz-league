/* ============================================================
   YAZ LEAGUE — Data layer
   Reads from Supabase when configured, otherwise from the local
   seed (demo mode).

   IMPORTANT: when Supabase IS configured but a request fails, we
   deliberately do NOT fall back to the demo dataset. Showing 40
   fake players to real users on a transient network error is a
   worse outcome than showing an honest "couldn't load" state.

   SECURITY: the public leaderboard may only read the non-sensitive
   columns of `players`. `first_name` is private and is blocked at
   the database privilege level (see supabase/schema.sql). Never
   change PUBLIC_PLAYER_COLUMNS to `*`.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const PUBLIC_PLAYER_COLUMNS = 'id,nickname,joined_at,is_active';

  let client = null;
  let mode = 'demo';

  function configured() {
    const c = YAZ.config;
    // Only check the keys. If the CDN script failed to load we still
    // want the caller to show an error — NOT silently render demo data.
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }

  function getClient() {
    if (!configured()) return null;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Το Supabase JS δεν φορτώθηκε. Έλεγξε τη σύνδεση και ξαναφόρτωσε τη σελίδα.');
    }
    if (!client) {
      // Public pages must always talk to Supabase as `anon`, even if the
      // same browser has an admin (or other) session in localStorage.
      // Otherwise an authenticated non-admin gets zero rows from `players`
      // (RLS allows only admins), and an admin session could change which
      // policies apply. No session is needed for public reads/registration.
      client = window.supabase.createClient(YAZ.config.supabaseUrl, YAZ.config.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }
    return client;
  }

  async function fromSupabase() {
    const sb = getClient();
    const [p, m, r] = await Promise.all([
      sb.from('players').select(PUBLIC_PLAYER_COLUMNS).order('nickname', { ascending: true }).limit(10000),
      sb.from('matches').select('*').order('week_number', { ascending: true }).limit(10000),
      sb.from('results').select('*').limit(10000)
    ]);

    if (p.error) throw p.error;
    if (m.error) throw m.error;
    if (r.error) throw r.error;

    return {
      players: p.data || [],
      matches: m.data || [],
      results: r.data || []
    };
  }

  async function load() {
    if (configured()) {
      // Do NOT swallow Supabase errors here. If keys are set, the caller
      // expects live data — let errors bubble so app.js can show the
      // error state instead of silently rendering 40 fake players.
      const data = await fromSupabase();
      mode = 'supabase';
      return data;
    }
    mode = 'demo';
    return YAZ.seed.build();
  }

  async function submitRegistration(payload) {
    const nickname = String(payload.nickname || '').trim().replace(/\s+/g, ' ');
    const firstName = String(payload.first_name || '').trim().replace(/\s+/g, ' ');

    if (nickname.length < 2 || nickname.length > 40) {
      return { ok: false, error: 'Το ψευδώνυμο πρέπει να έχει 2-40 χαρακτήρες.' };
    }
    if (firstName.length < 2 || firstName.length > 40) {
      return { ok: false, error: 'Το πραγματικό όνομα πρέπει να έχει 2-40 χαρακτήρες.' };
    }

    if (!configured()) {
      // No Supabase configured → pretend success (demo mode).
      await new Promise(res => setTimeout(res, 600));
      return { ok: true, demo: true };
    }

    let sb;
    try {
      sb = getClient();
    } catch (err) {
      return { ok: false, error: err.message };
    }

    // The registration form collects ONLY nickname + first_name.
    // Never send email/discord/geoguessr_url/status here — the database
    // only grants INSERT on these two columns, and `status` is forced to
    // 'pending' by a trigger.
    try {
      const { error } = await sb.from('registrations').insert({
        nickname: nickname,
        first_name: firstName
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, demo: false };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  YAZ.data = {
    load,
    submitRegistration,
    getClient,
    isConfigured: configured,
    getMode: () => mode
  };
})(window.YAZ);
