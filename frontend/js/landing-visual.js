/**
 * BrandGraph AI — 3D Editorial Flowing Ribbon Sculpture
 * Three.js Interactive Parametric Visualization closely inspired by Forma Studio
 */

(function initLanding3D() {
  const container = document.getElementById('hero3DContainer');
  if (!container || !window.THREE) return;

  // Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 2000);
  camera.position.set(0, 15, 460);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Lighting (Warm Studio Rig)
  const ambientLight = new THREE.AmbientLight(0xFDFBF7, 1.3);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xFFF7EC, 2.0);
  mainLight.position.set(300, 340, 240);
  scene.add(mainLight);

  const violetRim = new THREE.DirectionalLight(0x8055E8, 1.8);
  violetRim.position.set(-260, -160, -120);
  scene.add(violetRim);

  const cyanRim = new THREE.DirectionalLight(0x06B6D4, 1.5);
  cyanRim.position.set(-160, 260, 160);
  scene.add(cyanRim);

  const centerPointLight = new THREE.PointLight(0x8055E8, 2.2, 350);
  centerPointLight.position.set(0, 10, 50);
  scene.add(centerPointLight);

  // Master Group for continuous rotation & parallax
  const sculptureGroup = new THREE.Group();
  // Initial tilt so the horizontal infinity loop and central eye are prominent immediately
  sculptureGroup.rotation.x = -0.10;
  sculptureGroup.rotation.y = 0.28;
  scene.add(sculptureGroup);

  // --------------------------------------------------------------------------
  // 1. Central Braided Eye Loop (Forma Reference Feature)
  // --------------------------------------------------------------------------
  const eyePoints1 = [];
  const eyePoints2 = [];
  for (let i = 0; i <= 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    const r1 = 46 + Math.sin(a * 3) * 3;
    const r2 = 42 - Math.cos(a * 2) * 2;
    eyePoints1.push(new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1 * 0.9 + 5, Math.sin(a * 2) * 16));
    eyePoints2.push(new THREE.Vector3(Math.cos(a + 0.3) * r2, Math.sin(a + 0.3) * r2 * 0.95 + 5, -Math.sin(a * 2) * 14));
  }
  const eyeCurve1 = new THREE.CatmullRomCurve3(eyePoints1, true);
  const eyeCurve2 = new THREE.CatmullRomCurve3(eyePoints2, true);

  const eyeGeom1 = new THREE.TubeGeometry(eyeCurve1, 100, 3.8, 16, true);
  const eyeMat1 = new THREE.MeshStandardMaterial({
    color: 0xECE5D8,
    roughness: 0.22,
    metalness: 0.25,
    emissive: 0x1F1A14,
    emissiveIntensity: 0.35,
  });
  sculptureGroup.add(new THREE.Mesh(eyeGeom1, eyeMat1));

  const eyeGeom2 = new THREE.TubeGeometry(eyeCurve2, 100, 2.2, 16, true);
  const eyeMat2 = new THREE.MeshStandardMaterial({
    color: 0x8055E8,
    roughness: 0.2,
    metalness: 0.5,
    emissive: 0x2A1550,
    emissiveIntensity: 0.45,
  });
  sculptureGroup.add(new THREE.Mesh(eyeGeom2, eyeMat2));

  // --------------------------------------------------------------------------
  // 2. Parametric Flowing Braided Curves (Horizontal Infinity Ribbon)
  // --------------------------------------------------------------------------
  function createRibbonCurve(radiusX, radiusY, radiusZ, twistOffset, phaseOffset) {
    const points = [];
    const segments = 260;
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      const cosU = Math.cos(u + phaseOffset);
      const sinU = Math.sin(u + phaseOffset);
      
      // Horizontal infinity sweep with voluptuous wings
      const x = sinU * radiusX * (0.88 + 0.22 * Math.abs(cosU));
      const y = Math.sin(2 * (u + phaseOffset)) * 0.48 * radiusY + cosU * twistOffset + 6;
      const z = cosU * Math.sin(u + phaseOffset) * radiusZ;
      points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(points, true);
  }

  // Strand definitions (Braided Silk, Violet Governance, Cyan Evidence, Silver Tech)
  const strandConfigs = [
    { rx: 220, ry: 90, rz: 140, twist: 24, phase: 0, radius: 4.2, color: 0xECE4D6, roughness: 0.24, metalness: 0.22, emissive: 0x1A1713 },
    { rx: 212, ry: 84, rz: 135, twist: -20, phase: 0.14, radius: 2.8, color: 0x8055E8, roughness: 0.2, metalness: 0.52, emissive: 0x301860 },
    { rx: 228, ry: 94, rz: 145, twist: 16, phase: -0.16, radius: 2.4, color: 0x06B6D4, roughness: 0.2, metalness: 0.52, emissive: 0x0C3E4C },
    { rx: 206, ry: 78, rz: 130, twist: -28, phase: 0.32, radius: 2.0, color: 0xC8D0DA, roughness: 0.15, metalness: 0.88, emissive: 0x181C24 },
    { rx: 234, ry: 98, rz: 150, twist: 32, phase: -0.30, radius: 1.6, color: 0xE0D7C4, roughness: 0.32, metalness: 0.42, emissive: 0x221C14 },
    { rx: 216, ry: 86, rz: 138, twist: 8, phase: 0.48, radius: 1.4, color: 0xD8D0C0, roughness: 0.28, metalness: 0.3, emissive: 0x1C1812 },
  ];

  const tubeMeshes = [];
  strandConfigs.forEach(cfg => {
    const curve = createRibbonCurve(cfg.rx, cfg.ry, cfg.rz, cfg.twist, cfg.phase);
    const geom = new THREE.TubeGeometry(curve, 180, cfg.radius, 16, true);
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      emissive: cfg.emissive,
      emissiveIntensity: 0.38,
    });
    const mesh = new THREE.Mesh(geom, mat);
    sculptureGroup.add(mesh);
    tubeMeshes.push(mesh);
  });

  // --------------------------------------------------------------------------
  // 3. Dispersed Particle Cloud & Pearl Droplets (Forma Reference Style)
  // --------------------------------------------------------------------------
  const particleCount = 3400;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const mainCurve = createRibbonCurve(220, 90, 140, 0, 0);

  const colorPalette = [
    new THREE.Color(0xF6F0EB), // Champagne pearl
    new THREE.Color(0x8055E8), // Governance Violet
    new THREE.Color(0x06B6D4), // Evidence Cyan
    new THREE.Color(0xD4D9E2), // Platinum silver
    new THREE.Color(0xC4AB7C), // Warm gold sand
    new THREE.Color(0x0D9488), // Emerald compliant
  ];

  for (let i = 0; i < particleCount; i++) {
    const t = Math.random();
    const ptOnCurve = mainCurve.getPoint(t);

    // Enhanced particle dispersion with trailing bursts on the outer edges
    const isWingBurst = Math.abs(ptOnCurve.x) > 130;
    const spreadRadius = (isWingBurst ? 22 : 12) + Math.pow(Math.random(), 2.0) * (isWingBurst ? 58 : 36);
    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadElevation = (Math.random() - 0.5) * spreadRadius;

    positions[i * 3] = ptOnCurve.x + Math.cos(spreadAngle) * spreadRadius;
    positions[i * 3 + 1] = ptOnCurve.y + spreadElevation;
    positions[i * 3 + 2] = ptOnCurve.z + Math.sin(spreadAngle) * spreadRadius;

    const chosenColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = chosenColor.r;
    colors[i * 3 + 1] = chosenColor.g;
    colors[i * 3 + 2] = chosenColor.b;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const particleMaterial = new THREE.PointsMaterial({
    size: 2.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.NormalBlending,
  });

  const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  sculptureGroup.add(particleSystem);

  // --------------------------------------------------------------------------
  // 4. Symbolic Interconnected Brand Governance Nodes (Glowing Orbs)
  // --------------------------------------------------------------------------
  const nodeData = [
    { t: 0.05, label: 'Brand Core', color: 0x8055E8, size: 8.5 },
    { t: 0.22, label: 'Product Copilot', color: 0x06B6D4, size: 7.0 },
    { t: 0.45, label: 'Deterministic Rule', color: 0xD97706, size: 6.4 },
    { t: 0.62, label: 'SOC-2 Evidence', color: 0x3B82F6, size: 6.8 },
    { t: 0.78, label: 'Verified Claim', color: 0x0D9488, size: 6.0 },
    { t: 0.92, label: 'Disclaimer Guard', color: 0xE11D48, size: 5.6 },
  ];

  const nodeMeshes = [];
  nodeData.forEach(nd => {
    const pt = mainCurve.getPoint(nd.t);
    const sphereGeo = new THREE.SphereGeometry(nd.size, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: nd.color,
      roughness: 0.18,
      metalness: 0.45,
      emissive: nd.color,
      emissiveIntensity: 0.6,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.copy(pt);
    sculptureGroup.add(sphereMesh);

    // Glowing halo ring
    const haloGeo = new THREE.RingGeometry(nd.size * 1.3, nd.size * 1.55, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: nd.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    sphereMesh.add(haloMesh);

    nodeMeshes.push({ mesh: sphereMesh, halo: haloMesh, initialSize: nd.size });
  });

  // Connecting dynamic filament line between the 6 nodes
  const nodeLinePoints = nodeMeshes.map(n => n.mesh.position);
  nodeLinePoints.push(nodeMeshes[0].mesh.position); // closed cycle
  const nodeLineGeo = new THREE.BufferGeometry().setFromPoints(nodeLinePoints);
  const nodeLineMat = new THREE.LineBasicMaterial({
    color: 0x8055E8,
    transparent: true,
    opacity: 0.4,
    linewidth: 1.2,
  });
  const nodeLine = new THREE.Line(nodeLineGeo, nodeLineMat);
  sculptureGroup.add(nodeLine);

  // --------------------------------------------------------------------------
  // 5. Smooth Mouse Parallax & Dynamic Rotation
  // --------------------------------------------------------------------------
  let mouseX = 0;
  let mouseY = 0;
  let targetRotationX = -0.10;
  let targetRotationY = 0.28;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    mouseX = (e.clientX - halfWidth) / halfWidth;
    mouseY = (e.clientY - halfHeight) / halfHeight;

    targetRotationY = 0.28 + mouseX * 0.42;
    targetRotationX = -0.10 + mouseY * 0.22;

    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      sculptureGroup.rotation.y += deltaX * 0.005;
      sculptureGroup.rotation.x += deltaY * 0.005;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch Support for mobile
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;
      sculptureGroup.rotation.y += deltaX * 0.006;
      sculptureGroup.rotation.x += deltaY * 0.006;
      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // --------------------------------------------------------------------------
  // 6. Render Loop & Micro-Animations
  // --------------------------------------------------------------------------
  let clock = new THREE.Clock();
  let isVisible = !document.hidden;
  let animId = null;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate() {
    if (!isVisible) {
      animId = null;
      return;
    }
    animId = requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (!prefersReducedMotion) {
      // Gentle continuous spin & breathing float
      if (!isDragging) {
        sculptureGroup.rotation.y += 0.0018;
        sculptureGroup.rotation.x += (targetRotationX - sculptureGroup.rotation.x) * 0.04;
        sculptureGroup.rotation.z = Math.sin(elapsedTime * 0.35) * 0.04;
      }

      sculptureGroup.position.y = Math.sin(elapsedTime * 0.75) * 6;

      // Node pulsating halos
      nodeMeshes.forEach((n, idx) => {
        const pulse = 1.0 + 0.16 * Math.sin(elapsedTime * 2.4 + idx * 1.1);
        n.halo.scale.set(pulse, pulse, pulse);
        n.halo.lookAt(camera.position);
      });

      // Particle subtle sparkle / flow
      const posArr = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i += 7) {
        posArr[i * 3 + 1] += Math.sin(elapsedTime * 2 + i) * 0.12;
      }
      particleGeometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  function startAnimation() {
    if (!animId && isVisible) {
      animId = requestAnimationFrame(animate);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isVisible = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    } else {
      isVisible = true;
      clock.start();
      startAnimation();
    }
  });

  startAnimation();

  // --------------------------------------------------------------------------
  // 7. Responsive Window Resize Handler
  // --------------------------------------------------------------------------
  function onWindowResize() {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    
    // Scale camera distance based on viewport width
    if (width < 600) {
      camera.position.z = 600;
    } else if (width < 1024) {
      camera.position.z = 510;
    } else {
      camera.position.z = 450;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onWindowResize);
  onWindowResize();
})();
