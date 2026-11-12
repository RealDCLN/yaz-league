/* ============================================================
   YAZ LEAGUE - Data layer
   Reads from Supabase when configured, otherwise from the local
   seed (demo mode).

   IMPORTANT: when Supabase IS configured but a request fails, we
   deliberately do NOT fall back to the demo dataset. Showing 40
   fake players to real users on a transient network error is a
   worse outcome than showing an honest "couldn't load" state.

   SECURITY: the public leaderboard may only read the non-sensitive
   columns of `players`. `first_name`, `birth_year` and `city` are
   private and are blocked at the database privilege level (see
   supabase/schema.sql). Never change PUBLIC_PLAYER_COLUMNS to `*`.
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
    // want the caller to show an error, NOT silently render demo data.
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
      // expects live data, so let errors bubble so app.js can show the
      // error state instead of silently rendering 40 fake players.
      const data = await fromSupabase();
      mode = 'supabase';
      return data;
    }
    mode = 'demo';
    return YAZ.seed.build();
  }

  async function submitRegistration(payload) {
    // Names/usernames are stored in ALL CAPS everywhere. Do it here so the
    // public form and the admin panel produce identical values.
    const nickname = String(payload.nickname || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const firstName = String(payload.first_name || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const city = String(payload.city || '').trim().replace(/\s+/g, ' ');
    const birthYear = Number(payload.birth_year);
    const currentYear = new Date().getFullYear();

    if (nickname.length < 2 || nickname.length > 40) {
      return { ok: false, error: 'Το username (GeoGuessr) πρέπει να έχει 2-40 χαρακτήρες.' };
    }
    if (firstName.length < 2 || firstName.length > 40) {
      return { ok: false, error: 'Το πραγματικό όνομα πρέπει να έχει 2-40 χαρακτήρες.' };
    }
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
      return { ok: false, error: 'Συμπλήρωσε ένα έγκυρο έτος γέννησης.' };
    }
    if (city.length < 1 || city.length > 60) {
      return { ok: false, error: 'Η πόλη ή περιφερειακή ενότητα είναι υποχρεωτική (έως 60 χαρακτήρες).' };
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

    // The registration form collects ONLY nickname + first_name +
    // birth_year + city. Never send email/discord/geoguessr_url/status
    // here: the database only grants INSERT on these four columns, and
    // `status` is forced to 'pending' by a trigger.
    try {
      const { error } = await sb.from('registrations').insert({
        nickname: nickname,
        first_name: firstName,
        birth_year: birthYear,
        city: city
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
