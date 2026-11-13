/* ============================================================
   YAZ LEAGUE · WINTER 2026-27
   Data layer: Supabase όταν υπάρχει configuration, αλλιώς demo.

   Το site διαβάζει προαιρετικά και τα νέα objects (multipliers,
   group_members, phase_matches). Αν το migration 005 δεν έχει
   τρέξει ακόμη, η δημόσια σελίδα δουλεύει κανονικά χωρίς Χ2/φάσεις
   αντί να σπάσει.

   SECURITY: το δημόσιο leaderboard διαβάζει μόνο μη-ευαίσθητες
   στήλες. Τα first_name / birth_year / city δεν εκτίθενται ποτέ.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const PUBLIC_PLAYER_COLUMNS = 'id,nickname,joined_at,is_active,is_patreon';
  const PUBLIC_PLAYER_COLUMNS_LEGACY = 'id,nickname,joined_at,is_active';

  let client = null;
  let mode = 'demo';
  let schema = {
    patreon: false,
    multipliers: false,
    groups: false,
    phases: false
  };

  function configured() {
    const c = YAZ.config || {};
    return !!(c.supabaseUrl && c.supabaseAnonKey);
  }

  function getClient() {
    if (!configured()) return null;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Το Supabase JS δεν φορτώθηκε. Έλεγξε τη σύνδεση και ξαναφόρτωσε τη σελίδα.');
    }
    if (!client) {
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

  function isMissingRelation(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const msg = String(error.message || '');
    return code === '42P01' || code === 'PGRST205' || /does not exist|Could not find the table|relation .* does not exist/i.test(msg);
  }

  async function optionalRows(sb, table, select, order) {
    try {
      let q = sb.from(table).select(select).limit(10000);
      if (order) q = q.order(order.column, { ascending: order.ascending !== false });
      const { data, error } = await q;
      if (error) {
        return { rows: [], ok: false, error };
      }
      return { rows: data || [], ok: true };
    } catch (err) {
      return { rows: [], ok: false, error: err };
    }
  }

  async function fromSupabase() {
    const sb = getClient();

    const [playersRes, matchesRes, resultsRes] = await Promise.all([
      sb.from('players').select(PUBLIC_PLAYER_COLUMNS).order('nickname', { ascending: true }).limit(10000),
      sb.from('matches').select('*').order('week_number', { ascending: true }).limit(10000),
      sb.from('results').select('*').limit(10000)
    ]);

    let players = playersRes.data;
    let patreonOk = !playersRes.error;

    if (playersRes.error) {
      // Πιθανότατα δεν έχει τρέξει το migration που προσθέτει το
      // is_patreon. Ξαναδοκίμασε με τις παλιές δημόσιες στήλες.
      const retry = await sb.from('players')
        .select(PUBLIC_PLAYER_COLUMNS_LEGACY)
        .order('nickname', { ascending: true })
        .limit(10000);
      if (retry.error) throw retry.error;
      players = retry.data;
      patreonOk = false;
    }

    if (matchesRes.error) throw matchesRes.error;
    if (resultsRes.error) throw resultsRes.error;

    const [multRes, groupRes, phaseRes] = await Promise.all([
      optionalRows(sb, 'multipliers', 'id,player_id,source,awarded_week,used_week,created_at'),
      optionalRows(sb, 'group_members', 'id,group_label,player_id,seed_rank,pot'),
      optionalRows(sb, 'phase_matches', '*')
    ]);

    schema = {
      patreon: patreonOk,
      multipliers: multRes.ok,
      groups: groupRes.ok,
      phases: phaseRes.ok
    };

    return {
      players: players || [],
      matches: matchesRes.data || [],
      results: resultsRes.data || [],
      multipliers: multRes.rows,
      groupMembers: groupRes.rows,
      phaseMatches: phaseRes.rows,
      schema
    };
  }

  async function load() {
    if (configured()) {
      const data = await fromSupabase();
      mode = 'supabase';
      return data;
    }

    mode = 'demo';
    const seed = YAZ.seed.build();
    schema = { patreon: true, multipliers: true, groups: true, phases: true };
    return Object.assign({ schema }, seed);
  }

  async function submitRegistration(payload) {
    const nickname = String(payload.nickname || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const firstName = String(payload.first_name || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const city = String(payload.city || '').trim().replace(/\s+/g, ' ');
    const currentYear = new Date().getFullYear();

    const birthYear = Number(payload.birth_year);

    if (nickname.length < 2 || nickname.length > 40) {
      return { ok: false, error: 'Το username πρέπει να έχει 2-40 χαρακτήρες.' };
    }
    if (firstName.length < 2 || firstName.length > 40) {
      return { ok: false, error: 'Το username στο GeoGuessr πρέπει να έχει 2-40 χαρακτήρες.' };
    }
    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
      return { ok: false, error: 'Συμπλήρωσε ένα έγκυρο έτος γέννησης.' };
    }
    if (city.length < 1 || city.length > 60) {
      return { ok: false, error: 'Η περιοχή εκπροσώπησης είναι υποχρεωτική (έως 60 χαρακτήρες).' };
    }

    if (!configured()) {
      await new Promise(res => setTimeout(res, 600));
      return { ok: true, demo: true };
    }

    let sb;
    try {
      sb = getClient();
    } catch (err) {
      return { ok: false, error: err.message };
    }

    // Το `first_name` είναι το ιστορικό όνομα της στήλης στη βάση· η
    // φόρμα το χρησιμοποιεί για το ιδιωτικό username του GeoGuessr.
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
    getMode: () => mode,
    getSchema: () => schema
  };
})(window.YAZ);
