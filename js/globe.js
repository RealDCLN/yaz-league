/**
 * YAZ LEAGUE — Ambient Spinning Globe Background Animation
 * Generates a sleek 3D particle sphere using Three.js with auto-rotation.
 */

function initBackgroundGlobe() {
  const canvas = document.getElementById('globe-bg');
  if (!canvas) return;

  // Verify Three.js availability
  if (typeof THREE === 'undefined') {
    console.warn('Three.js not loaded. Falling back to 2D Canvas ambient globe.');
    init2DGlobeFallback(canvas);
    return;
  }

  // Scene, Camera, Renderer Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 240;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Globe Container Group
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // 1. Globe Particles (Sphere shell)
  const particleCount = 1800;
  const radius = 80;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const primaryColor = new THREE.Color('#ff6b00');
  const accentColor = new THREE.Color('#00e5ff');
  const dimColor = new THREE.Color('#475569');

  for (let i = 0; i < particleCount; i++) {
    const phi = Math.acos(-1 + (2 * i) / particleCount);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color distribution
    const rand = Math.random();
    let c = dimColor;
    if (rand > 0.85) c = primaryColor;
    else if (rand > 0.70) c = accentColor;

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });

  const particleGlobe = new THREE.Points(geometry, material);
  globeGroup.add(particleGlobe);

  // 2. Outer Wireframe Rings (Latitude/Equator accent)
  const ringGeo = new THREE.RingGeometry(80.5, 81.2, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff6b00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  globeGroup.add(ring);

  const ringGeo2 = new THREE.RingGeometry(80.5, 81, 64);
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15
  });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.y = Math.PI / 4;
  globeGroup.add(ring2);

  // Initial tilt
  globeGroup.rotation.x = 0.3;
  globeGroup.rotation.z = -0.2;

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Continuous smooth spinning
    globeGroup.rotation.y += 0.0018;

    renderer.render(scene, camera);
  }

  animate();

  // Resize Handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// 2D Canvas Fallback if Three.js is not present
function init2DGlobeFallback(canvas) {
  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  let angle = 0;
  const dots = [];
  const count = 300;
  const radius = Math.min(width, height) * 0.25;

  for (let i = 0; i < count; i++) {
    const lat = (Math.random() - 0.5) * Math.PI;
    const lon = (Math.random() - 0.5) * 2 * Math.PI;
    dots.push({ lat, lon });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    angle += 0.005;

    const cx = width / 2;
    const cy = height / 2;

    dots.forEach((dot) => {
      const x = radius * Math.cos(dot.lat) * Math.sin(dot.lon + angle);
      const y = radius * Math.sin(dot.lat);
      const z = radius * Math.cos(dot.lat) * Math.cos(dot.lon + angle);

      if (z > 0) {
        const scale = 200 / (200 + z);
        const px = cx + x * scale;
        const py = cy + y * scale;

        ctx.fillStyle = z > 30 ? '#ff6b00' : 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(px, py, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    requestAnimationFrame(draw);
  }

  draw();
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', initBackgroundGlobe);