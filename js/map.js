/* ============================================================
   YAZ LEAGUE — Interactive world map
   SVG χάρτης με pins ανά αγωνιστική, route line, tooltip.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  const W = 960;
  const H = 500;
  const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

  let pinNodes = [];
  let tooltipEl = null;
  let canvasEl = null;
  let activeIndex = -1;
  let points = [];
  let projectionFn = null;

  function uniqueByWeek(matches) {
    const byWeek = new Map();
    matches.forEach(m => {
      if (m.lat == null || m.lng == null) return;
      const w = Number(m.week_number);
      const existing = byWeek.get(w);
      if (!existing || (existing.league !== 'map' && m.league === 'map')) {
        byWeek.set(w, m);
      }
    });
    return Array.from(byWeek.values()).sort((a, b) => Number(a.week_number) - Number(b.week_number));
  }

  function showTooltip(index) {
    if (!tooltipEl || !pinNodes[index]) return;
    const p = points[index];
    const node = pinNodes[index];
    const canvasRect = canvasEl.getBoundingClientRect();
    const pinRect = node.getBoundingClientRect();

    tooltipEl.innerHTML =
      '<span class="tt-week">Αγωνιστική ' + p.week_number + '</span>' +
      '<strong>' + escapeHtml(p.location_name || '—') + '</strong>';

    const x = pinRect.left - canvasRect.left + pinRect.width / 2;
    const y = pinRect.top - canvasRect.top;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
    tooltipEl.classList.add('is-visible');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function setActive(index) {
    pinNodes.forEach((n, i) => n.classList.toggle('is-active', i === index));
    activeIndex = index;
    const chips = document.querySelectorAll('#weekChips .chip');
    chips.forEach(c => c.classList.toggle('is-active', Number(c.dataset.index) === index));
    if (index >= 0) showTooltip(index);
  }

  /* ---------- fallback ---------- */

  function renderFallback(svg) {
    projectionFn = (lngLat) => {
      const [lng, lat] = lngLat;
      return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
    };
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');

    for (let lat = -60; lat <= 60; lat += 30) {
      const line = document.createElementNS(ns, 'line');
      const y = ((90 - lat) / 180) * H;
      line.setAttribute('x1', 0); line.setAttribute('x2', W);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('class', 'graticule');
      g.appendChild(line);
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      const line = document.createElementNS(ns, 'line');
      const x = ((lng + 180) / 360) * W;
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', 0); line.setAttribute('y2', H);
      line.setAttribute('class', 'graticule');
      g.appendChild(line);
    }
    svg.appendChild(g);
  }

  /* ---------- d3 ---------- */

  function renderD3(svg) {
    const d3 = window.d3;
    const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: 'Sphere' });
    const path = d3.geoPath(projection);
    projectionFn = (lngLat) => projection(lngLat);

    const root = d3.select(svg);
    root.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));

    const landLayer = root.append('g').attr('class', 'land-layer');
    root.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));

    if (window.topojson) {
      d3.json(LAND_URL)
        .then(world => {
          const land = window.topojson.feature(world, world.objects.land);
          landLayer.append('path').attr('class', 'land').attr('d', path(land));
        })
        .catch(() => {});
    }
  }

  /* ---------- route + pins ---------- */

  function drawRoute(svg) {
    if (points.length < 2) return;
    const coords = points.map(p => projectionFn([Number(p.lng), Number(p.lat)])).filter(Boolean);
    if (coords.length < 2) return;

    const d = coords.map((xy, i) =>
      (i === 0 ? 'M' : 'L') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1)
    ).join(' ');

    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'route');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }

  function drawPins(svg) {
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'pin-layer');
    svg.appendChild(layer);

    pinNodes = [];

    points.forEach((p, i) => {
      const xy = projectionFn([Number(p.lng), Number(p.lat)]);
      if (!xy) return;

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'pin');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', 'Αγωνιστική ' + p.week_number + ': ' + (p.location_name || ''));
      g.dataset.index = String(i);

      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('class', 'pin-ring');
      ring.setAttribute('cx', xy[0]);
      ring.setAttribute('cy', xy[1]);
      ring.setAttribute('r', 11);

      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('class', 'pin-dot');
      dot.setAttribute('cx', xy[0]);
      dot.setAttribute('cy', xy[1]);
      dot.setAttribute('r', 5);

      g.appendChild(ring);
      g.appendChild(dot);

      g.addEventListener('mouseenter', () => showTooltip(i));
      g.addEventListener('mouseleave', () => { if (activeIndex !== i) hideTooltip(); });
      g.addEventListener('focus', () => { showTooltip(i); });
      g.addEventListener('blur', () => { if (activeIndex !== i) hideTooltip(); });
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setActive(i);
      });
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          setActive(i);
        }
      });

      layer.appendChild(g);
      pinNodes.push(g);
    });
  }

  function renderChips() {
    const box = document.getElementById('weekChips');
    if (!box) return;
    box.innerHTML = '';
    points.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.index = String(i);
      b.textContent = 'ΑΓ.' + String(p.week_number).padStart(2, '0');
      b.addEventListener('click', () => setActive(i));
      box.appendChild(b);
    });
  }

  function init(matches) {
    const svg = document.getElementById('worldSvg');
    canvasEl = document.getElementById('mapCanvas');
    tooltipEl = document.getElementById('mapTooltip');
    if (!svg || !canvasEl) return;

    points = uniqueByWeek(matches || []);
    svg.innerHTML = '';

    if (!points.length) {
      svg.innerHTML = '<text x="480" y="250" text-anchor="middle" fill="#7C8BA3" font-family="Inter,sans-serif" font-size="14">Δεν υπάρχουν καταγεγραμμένες τοποθεσίες ακόμη.</text>';
      return;
    }

    if (window.d3) {
      renderD3(svg);
    } else {
      renderFallback(svg);
    }

    drawRoute(svg);
    drawPins(svg);
    renderChips();

    canvasEl.addEventListener('click', () => {
      if (activeIndex >= 0) {
        setActive(-1);
        hideTooltip();
      }
    });

    const rndBtn = document.getElementById('randomPin');
    if (rndBtn) {
      rndBtn.addEventListener('click', () => {
        let next = Math.floor(Math.random() * points.length);
        if (points.length > 1 && next === activeIndex) next = (next + 1) % points.length;
        setActive(next);
      });
    }
  }

  YAZ.mapView = { init };
})(window.YAZ);
