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
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19
