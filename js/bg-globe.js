/* ============================================================
   YAZ LEAGUE — Background spinning wireframe globe
   Ambient 3D sphere rendered on a canvas. No external deps.
   - Lat/long graticule rotates slowly around the Y axis
   - Back-facing lines are dimmed for depth
   - A few pulsing location pins add life
   ============================================================ */

(function () {
  'use strict';

  const canvas = document.getElementById('bgGlobe');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0, R = 0;
  let angle = 0;
  let raf = null;

  /* ---------- Pre-computed 3D geometry ---------- */

  const LAT_LINES = [];
  const LON_LINES = [];

  // Parallels (horizontal circles) every 20° — skip poles for a cleaner look
  for (let lat = -80; lat <= 80; lat += 20) {
    const phi = (lat * Math.PI) / 180;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const pts = [];
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      pts.push({
        x: cosP * Math.sin(theta),
        y: sinP,
        z: cosP * Math.cos(theta)
      });
    }
    LAT_LINES.push(pts);
  }

  // Meridians (vertical half-circles) every 20°
  for (let lng = 0; lng < 360; lng += 20) {
    const lam = (lng * Math.PI) / 180;
    const sinL = Math.sin(lam);
    const cosL = Math.cos(lam);
    const pts = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const phi = -Math.PI / 2 + (i / steps) * Math.PI;
      pts.push({
        x: Math.cos(phi) * sinL,
        y: Math.sin(phi),
        z: Math.cos(phi) * cosL
      });
    }
    LON_LINES.push(pts);
  }

  // Fixed decorative pins (three real YAZ-relevant spots)
  const PINS = [
    { lat: 37.98, lng: 23.73, color: '226,87,43',  phase: 0.0 },  // Athens
    { lat: 35.01, lng: 135.77, color: '63,191,174', phase: 1.4 }, // Kyoto
    { lat: -33.05, lng: -71.61, color: '255,209,102', phase: 2.7 } // Valparaíso
  ].map(p => {
    const phi = (p.lat * Math.PI) / 180;
    const lam = (p.lng * Math.PI) / 180;
    return {
      x: Math.cos(phi) * Math.sin(lam),
      y: Math.sin(phi),
      z: Math.cos(phi) * Math.cos(lam),
      color: p.color,
      phase: p.phase
    };
  });

  /* ---------- Resize / layout ---------- */

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const narrow = W < 760;
    cx = narrow ? W * 0.5 : W * 0.76;
    cy = narrow ? H * 0.42 : H * 0.5;
    R = Math.min(
      narrow ? W * 0.46 : W * 0.42,
      H * 0.55
    );
  }

  /* ---------- 3D -> 2D ---------- */

  function project(x, y, z, t) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const xr = x * c + z * s;
    const zr = -x * s + z * c;
    return { sx: cx + xr * R, sy: cy + y * R, z: zr };
  }

  // Draw a 3D polyline. Front / back segments are batched into two
  // stroke calls for performance.
  function strokePolyline(pts, t, colorFront, colorBack) {
    const frontSegs = [];
    const backSegs = [];
    let prev = project(pts[0].x, pts[0].y, pts[0].z, t);

    for (let i = 1; i < pts.length; i++) {
      const cur = project(pts[i].x, pts[i].y, pts[i].z, t);
      const zAvg = (prev.z + cur.z) * 0.5;
      (zAvg >= 0 ? frontSegs : backSegs).push([prev, cur]);
      prev = cur;
    }

    if (backSegs.length) {
      ctx.strokeStyle = colorBack;
      ctx.beginPath();
      for (let i = 0; i < backSegs.length; i++) {
        const a = backSegs[i][0], b = backSegs[i][1];
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();
    }
    if (frontSegs.length) {
      ctx.strokeStyle = colorFront;
      ctx.beginPath();
      for (let i = 0; i < frontSegs.length; i++) {
        const a = frontSegs[i][0], b = frontSegs[i][1];
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();
    }
  }

  /* ---------- Frame render ---------- */

  function draw(timeMs) {
    ctx.clearRect(0, 0, W, H);

    // Soft atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.28);
    halo.addColorStop(0, 'rgba(63,191,174,0.055)');
    halo.addColorStop(1, 'rgba(63,191,174,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2);
    ctx.fill();

    // Sphere silhouette
    ctx.strokeStyle = 'rgba(227,179,65,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Graticule
    for (let i = 0; i < LAT_LINES.length; i++) {
      strokePolyline(LAT_LINES[i], angle, 'rgba(63,191,174,0.30)', 'rgba(63,191,174,0.06)');
    }
    for (let i = 0; i < LON_LINES.length; i++) {
      strokePolyline(LON_LINES[i], angle, 'rgba(227,179,65,0.26)', 'rgba(227,179,65,0.055)');
    }

    // Pins (only when on the front hemisphere)
    const t = (timeMs || 0) * 0.001;
    for (let i = 0; i < PINS.length; i++) {
      const pin = PINS[i];
      const p = project(pin.x, pin.y, pin.z, angle);
      if (p.z < 0) continue;

      const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + pin.phase);

      // Soft outer glow
      ctx.fillStyle = 'rgba(' + pin.color + ',1)';
      ctx.globalAlpha = 0.10 + pulse * 0.10;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 16 + pulse * 10, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.globalAlpha = 0.4 + pulse * 0.5;
      ctx.strokeStyle = 'rgba(' + pin.color + ',1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 6 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      // Core dot
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(' + pin.color + ',1)';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Loop ---------- */

  function tick(now) {
    if (!document.hidden) {
      angle += 0.0028;
      draw(now || performance.now());
    }
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  if (reduceMotion) {
    // Static single frame
    draw(0);
  } else {
    raf = requestAnimationFrame(tick);
    window.addEventListener('pagehide', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    });
  }
})();
