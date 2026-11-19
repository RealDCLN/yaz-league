/* ============================================================
   YAZ LEAGUE · ΙΣΤΟΡΙΑ
   Τα αποτελέσματα της σεζόν 1 (Season 1).

   Οι θέσεις 1–4 έχουν σειρά: είναι οι νικητές των τεσσάρων
   ομίλων. Οι θέσεις 5–20 δίνονται ανά γκρουπ των τεσσάρων και
   ΔΕΝ έχουν εσωτερική κατάταξη — γι' αυτό αποθηκεύονται ως
   σύνολα (bands) και όχι ως λίστα με σειρά.
   Η αντιστοίχιση με τους παίκτες της τρέχουσας σεζόν γίνεται
   με κανονικοποίηση του username (κεφαλαία, χωρίς σημεία
   στίξης). Το ALIASES καλύπτει μικρές αλλαγές ονόματος.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const HISTORY = {
    season: 'Season 1',
    top: [
      { rank: 1, name: 'VISITKASTORIA' },
      { rank: 2, name: 'DCLN' },
      { rank: 3, name: 'MRLAG' },
      { rank: 4, name: 'KARIPIDIS' }
    ],
    bands: [
      { range: '5–8', names: ['AMT78793', 'Fill', 'Ntantas', 'Konios'] },
      { range: '9–12', names: ['CHRISF2011', 'DREWW22', 'KOSTAKIS98', 'SAVVAS213'] },
      { range: '13–16', names: ['KATS1MANIS', 'O EMPIRE', 'VARDAVAKYSS', 'JIDAKI19'] },
      { range: '17–20', names: ['ELENAPAPACHRIST', 'VIC99', 'STEF299', 'PAVLOS.SCH34'] }
    ]
  };

  /* Ιστορικό username → σημερινό username, κανονικοποιημένα. */
  const ALIASES = {
    KONIOS: 'KONIOSS'
  };

  function normalize(name) {
    return String(name == null ? '' : name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  function playerName(player) {
    if (!player) return '';
    return String(player.nickname || player.first_name || '');
  }

  function build(players) {
    const list = Array.isArray(players) ? players : [];
    const byName = new Map();

    list.forEach(player => {
      const key = normalize(playerName(player));
      if (key && !byName.has(key)) byName.set(key, player);
    });

    function resolve(name) {
      const key = normalize(name);
      const player = byName.get(key) || byName.get(ALIASES[key]);
      return {
        name,
        playerId: player ? player.id : null,
        currentName: playerName(player)
      };
    }

    const top = HISTORY.top.map(entry => Object.assign(resolve(entry.name), {
      rank: entry.rank
    }));

    const bands = HISTORY.bands.map(band => ({
      range: band.range,
      names: band.names.map(resolve).sort((a, b) => a.name.localeCompare(b.name, 'el'))
    }));

    const all = [...top, ...bands.flatMap(band => band.names)];
    const byPlayerId = {};
    const matched = new Set();

    all.forEach(entry => {
      if (!entry.playerId) return;
      matched.add(String(entry.playerId));
      byPlayerId[String(entry.playerId)] = {
        season: HISTORY.season,
        label: entry.rank
          ? HISTORY.season + ' · ' + entry.rank + 'η θέση'
          : HISTORY.season + ' · θέσεις ' + bandRangeFor(entry)
      };
    });

    return {
      season: HISTORY.season,
      total: all.length,
      matched: matched.size,
      top,
      bands,
      byPlayerId
    };
  }

  function bandRangeFor(entry) {
    const band = HISTORY.bands.find(b => b.names.indexOf(entry.name) !== -1);
    return band ? band.range : '';
  }

  YAZ.history = {
    data: HISTORY,
    normalize,
    build
  };
})(window.YAZ);
