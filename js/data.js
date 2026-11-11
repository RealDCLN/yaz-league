/* ============================================================
   YAZ LEAGUE — Data layer
   Reads from Supabase when configured, otherwise from the local
   seed (demo mode).

   IMPORTANT: when Supabase IS configured but a request fails, we
   deliberately do NOT fall back to the demo dataset. Showing 40
   fake players to real users on a transient network error is a
   worse outcome than showing an honest "couldn't load" state.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  let client = null;
  let mode = 'demo';

  function configured() {
    const c = YAZ.config;
    return !!(c.supabaseUrl && c.supabaseAnonKey && window.supabase && window.supabase.createClient);
  }

  function getClient() {
    if (!configured()) return null;
    if (!client) {
      client = window.supabase.createClient(YAZ.config.supabaseUrl, YAZ.config.supabaseAnonKey);
    }
    return client;
  }

  async function fromSupabase() {
    const sb = getClient();
    const [p, m, r] = await Promise.all([
      sb.from('players').select('*').order('nickname', { ascending: true }),
      sb.from('matches').select('*').order('week_number', { ascending: true }),
      sb.from('results').select('*')
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
    const sb = getClient();
    if (!sb) {
      // No Supabase configured → pretend success (demo mode).
      await new Promise(res => setTimeout(res, 600));
      return { ok: true, demo: true };
    }
    const { error } = await sb.from('registrations').insert({
      nickname: payload.nickname,
      geoguessr_url: payload.geoguessr_url,
      discord: payload.discord,
      email: payload.email || null,
      status: 'pending'
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, demo: false };
  }

  YAZ.data = {
    load,
    submitRegistration,
    getClient,
    isConfigured: configured,
    getMode: () => mode
  };
})(window.YAZ);
