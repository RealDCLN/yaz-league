/* ============================================================
   YAZ LEAGUE — World map of past matches
   ------------------------------------------------------------
   Renders a pin for every match that has lat/lng, connected by
   a dashed gold route line in week order. Works without D3
   (fallback = manual equirectangular projection, no landmass),
   and progressively enhances with land + graticule when the
   D3/TopoJSON CDN assets are available.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const W = 1000, H = 500;
  const NS = 'http://www.w3.org/2000/svg';

  let svgEl = null;
  let tooltipEl = null;
  let projection = null;
  let matches = [];
  let currentFilter = 'all';
  let initialized = false;

  function init(data) {
    svgEl = document.getElementById('worldSvg');
    tooltipEl = document.getElementById('mapTooltip');
    if (!svgEl) return;

    matches = ((data && data.matches) || []).filter(m =>
      m && m.lat != null && m.lng != null &&
      isFinite(Number(m.lat)) && isFinite(Number(m.lng))
    );

    if (!initialized) {
      initialized = true;
      buildChips();
      wireRandomBtn();
    }

    renderStatic();
    renderPins();
  }

  /* ---------- static layers (sphere, graticule, land) ---------- */

  function renderStatic() {
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    const d3 = window.d3;
    const topojson = window.topojson;

    if (!d3 || !topojson) {
      // No D3: keep projection=null so project() falls back to plain math.
      projection = null;
      return;
    }

    projection = d3.geoEquirectangular()
      .scale(W / (2 * Math.PI))
      .translate([W / 2, H / 2]);

    const path = d3.geoPath().projection(projection);
    const svg = d3.select(svgEl);

    svg.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere')
      .attr('d', path);

    svg.append('path')
      .datum(d3.geoGraticule()())
      .attr('class', 'graticule')
      .attr('d', path);

    const landSlot = svg.append('g').attr('class', 'land-slot');

    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
      .then(world => {
        if (!world || !world.objects || !world.objects.land) {
          console.warn('[map] world-atlas format unexpected');
          return;
        }
        const land = topojson.feature(world, world.objects.land);
        landSlot.append('path')
          .datum(land)
          .attr('class', 'land')
          .attr('d', path);
      })
      .catch(err => console.warn('[map] land fetch failed:', err));
  }

  /* ---------- projection helper (works with or without D3) ---------- */

  function project(lat, lng) {
    const la = Number(lat), lo = Number(lng);
    if (projection) return projection([lo, la]);
    return [
      ((lo + 180) / 360) * W,
      ((90 - la) / 180) * H
    ];
  }

  /* ---------- pins + route ---------- */

  function renderPins() {
    if (!svgEl) return;

    svgEl.querySelectorAll('.route, .pins-layer').forEach(el => el.remove());

    const sorted = matches.slice().sort((a, b) => {
      const aw = Number(a.week_number) || 0;
      const bw = Number(b.week_number) || 0;
      if (aw !== bw) return aw - bw;
      return String(a.league || '').localeCompare(String(b.league || ''));
    });

    const visible = currentFilter === 'all'
      ? sorted
      : sorted.filter(m => String(m.week_number) === String(currentFilter));

    const points = visible.map(m => project(m.lat, m.lng));

    if (points.length >= 2) {
      let d = 'M' + points[0][0].toFixed(2) + ' ' + points[0][1].toFixed(2);
      for (let i = 1; i < points.length; i++) {
        d += ' L' + points[i][0].toFixed(2) + ' ' + points[i][1].toFixed(2);
      }
      const route = document.createElementNS(NS, 'path');
      route.setAttribute('class', 'route');
      route.setAttribute('d', d);
      svgEl.appendChild(route);
    }

    const layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'pins-layer');

    visible.forEach((m, i) => {
      const x = points[i][0];
      const y = points[i][1];

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'pin');
      g.setAttribute('data-id', m.id);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label',
        'Αγωνιστική ' + m.week_number + ': ' + (m.location_name || 'Quiz'));

      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('class', 'pin-ring');
      ring.setAttribute('cx', x);
      ring.setAttribute('cy', y);
      ring.setAttribute('r', 9);

      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'pin-dot');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      dot.setAttribute('r', 4.5);

      g.appendChild(ring);
      g.appendChild(dot);

      const weekLabel = 'Αγωνιστική ' + m.week_number;
      const nameLabel = m.location_name || (m.league === 'quiz' ? 'Quiz' : '—');

      g.addEventListener('mouseenter', () => showTip(x, y, weekLabel, nameLabel));
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('focus',      () => showTip(x, y, weekLabel, nameLabel));
      g.addEventListener('blur',       hideTip);
      g.addEventListener('click',      () => activatePin(m.id));

      layer.appendChild(g);
    });

    svgEl.appendChild(layer);
  }

  /* ---------- tooltip ---------- */

  function showTip(x, y, weekLabel, nameLabel) {
    if (!tooltipEl) return;

    tooltipEl.innerHTML = '';

    const weekSpan = document.createElement('span');
    weekSpan.className = 'tt-week';
    weekSpan.textContent = weekLabel;

    const name = document.createElement('strong');
    name.textContent = nameLabel;

    tooltipEl.appendChild(weekSpan);
    tooltipEl.appendChild(name);

    const leftPct = (x / W) * 100;
    const topPct = (y / H) * 100;

    tooltipEl.style.left = leftPct + '%';
    tooltipEl.style.top = topPct + '%';
    // Flip below the pin if the pin sits too close to the top edge,
    // otherwise the tooltip would be clipped out of the shell.
    tooltipEl.classList.toggle('below', topPct < 16);
    tooltipEl.classList.add('is-visible');
  }

  function hideTip() {
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }

  /* ---------- interactions ---------- */

  function activatePin(id) {
    svgEl.querySelectorAll('.pin').forEach(p => p.classList.remove('is-active'));
    const pin = svgEl.querySelector('.pin[data-id="' + cssEscape(id) + '"]');
    if (pin) {
      pin.classList.add('is-active');
      const m = matches.find(match => String(match.id) === String(id));
      if (m) {
        const pt = project(m.lat, m.lng);
        const weekLabel = 'Αγωνιστική ' + m.week_number;
        const nameLabel = m.location_name || (m.league === 'quiz' ? 'Quiz' : '—');
        showTip(pt[0], pt[1], weekLabel, nameLabel);
      }
    }
  }

  function buildChips() {
    const box = document.getElementById('weekChips');
    if (!box) return;

    const weeks = Array.from(new Set(matches.map(m => Number(m.week_number))))
      .filter(w => !isNaN(w))
      .sort((a, b) => a - b);

    let html = '<button class="chip is-active" data-week="all" type="button">Όλες</button>';
    weeks.forEach(w => {
      html += '<button class="chip" data-week="' + w + '" type="button">Αγ. ' + w + '</button>';
    });
    box.innerHTML = html;

    box.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilter = chip.getAttribute('data-week');
        box.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
        hideTip();
        renderPins();
      });
    });
  }

  function wireRandomBtn() {
    const btn = document.getElementById('randomPinBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!matches.length) return;
      const m = matches[Math.floor(Math.random() * matches.length)];

      // If the current filter hides this pin, reset to "all" first.
      if (currentFilter !== 'all' && String(m.week_number) !== String(currentFilter)) {
        currentFilter = 'all';
        const box = document.getElementById('weekChips');
        if (box) {
          box.querySelectorAll('.chip').forEach(c =>
            c.classList.toggle('is-active', c.getAttribute('data-week') === 'all'));
        }
        renderPins();
      }
      activatePin(m.id);
    });
  }

  /* ---------- utils ---------- */

  function cssEscape(s) {
    return String(s).replace(/(["\\])/g, '\\$1');
  }

  YAZ.map = { init };
})(window.YAZ);
