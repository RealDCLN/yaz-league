/* ============================================================
   YAZ LEAGUE — 3D globe view (globe.gl)
   Golden points for every week, animated arcs between them,
   auto-rotation, hover tooltips, and a fly-through tour.
   ============================================================ */

window.YAZ = window.YAZ || {};

(function (YAZ) {
  'use strict';

  let tourInterval = null;
  let points = [];

  /* Pick one map match per week (the league = 'map' one with coords). */
  function uniqueMapWeeks(matches) {
    const byWeek = new Map();
    (matches || []).forEach(m => {
      if (m.league !== 'map') return;
      if (m.lat == null || m.lng == null) return;
      const w = Number(m.week_number);
      if (!byWeek.has(w)) byWeek.set(w, m);
    });
    return Array.from(byWeek.values()).sort((a, b) => Number(a.week_number) - Number(b.week_number));
  }

  function buildTooltip(d) {
    return (
      '<div style="background:rgba(10,16,28,.96);border:1px solid #E3B341;padding:7px 11px;' +
      'color:#F0E4C8;font-family:Inter,sans-serif;font-size:12px;line-height:1.4;' +
      'box-shadow:0 10px 30px -8px #000">' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:.15em;' +
      'text-transform:uppercase;color:#7C8BA3;margin-bottom:2px">Αγωνιστική ' + d.week + '</div>' +
      '<strong style="color:#FFD166">' + d.name + '</strong>' +
      '</div>'
    );
  }

  function init(matches) {
    const container = document.getElementById('globeViz');
    if (!container) return;

    const emptyEl = document.getElementById('globeEmpty');
    const tourBtn = document.getElementById('globeTour');

    points = uniqueMapWeeks(matches).map(m => ({
      lat: Number(m.lat),
      lng: Number(m.lng),
      week: Number(m.week_number),
      name: m.location_name || '—'
    }));

    if (!points.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Δεν υπάρχουν ακόμη καταγεγραμμένες τοποθεσίες.';
      }
      if (tourBtn) tourBtn.disabled = true;
      return;
    }

    if (typeof window.Globe === 'undefined') {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Η τρισδιάστατη σφαίρα δεν φόρτωσε. Έλεγξε τη σύνδεση.';
      }
      if (tourBtn) tourBtn.disabled = true;
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Φόρτωση σφαίρας…';
    }

    /* Build arcs between consecutive weeks. */
    const arcs = [];
    for (let i = 0; i < points.length - 1; i++) {
      arcs.push({
        startLat: points[i].lat,
        startLng: points[i].lng,
        endLat: points[i + 1].lat,
        endLng: points[i + 1].lng
      });
    }

    const globe = window.Globe()(container)
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg')
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#E3B341')
      .atmosphereAltitude(0.18)
      .pointsData(points)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor(() => '#FFD166')
      .pointAltitude(0.012)
      .pointRadius(0.32)
      .pointLabel(buildTooltip)
      .arcsData(arcs)
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor(() => ['rgba(227,179,65,.08)', 'rgba(255,209,102,.9)'])
      .arcStroke(0.5)
      .arcDashLength(0.35)
      .arcDashGap(0.15)
      .arcDashAnimateTime(2800)
      .arcsTransitionDuration(0)
      .ringsData(points)
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(() => t => 'rgba(255,209,102,' + (1 - t) + ')')
      .ringMaxRadius(2.8)
      .ringPropagationSpeed(1.8)
      .ringRepeatPeriod(1400);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.35;
    globe.controls().enableZoom = true;
    globe.controls().enablePan = false;

    /* Pause auto-rotation on user interaction. */
    container.addEventListener('mousedown', () => { globe.controls().autoRotate = false; });
    container.addEventListener('touchstart', () => { globe.controls().autoRotate = false; }, { passive: true });

    /* Size handling. */
    const resize = () => {
      const w = container.clientWidth || 600;
      globe.width(w).height(w);
    };
    resize();
    window.addEventListener('resize', resize);

    /* Hide loading once globe is ready. */
    if (emptyEl) {
      globe.onGlobeReady(() => { emptyEl.hidden = true; });
      /* Safety net if onGlobeReady doesn't fire (e.g. texture slow). */
      setTimeout(() => { emptyEl.hidden = true; }, 2500);
    }

    /* Tour: fly to each location, loop. */
    if (tourBtn) {
      let idx = 0;
      tourBtn.addEventListener('click', () => {
        if (tourInterval) {
          clearInterval(tourInterval);
          tourInterval = null;
          tourBtn.textContent = 'Περιήγηση στους σταθμούς';
          globe.controls().autoRotate = true;
          return;
        }
        globe.controls().autoRotate = false;
        tourBtn.textContent = 'Διακοπή περιήγησης';
        idx = 0;
        const step = () => {
          const p = points[idx];
          globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.6 }, 1400);
          idx = (idx + 1) % points.length;
        };
        step();
        tourInterval = setInterval(step, 2600);
      });
    }
  }

  YAZ.globeView = { init };
})(window.YAZ);
