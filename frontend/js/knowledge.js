/**
 * Brand Knowledge & Graph Explorer Controller for BrandGraph AI
 */

const knowledgeView = {
  currentData: null,
  graphData: null,
  activeSubTab: 'graph',

  async render(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading brand knowledge graph &amp; approved sources...</p>
      </div>
    `;

    try {
      const [knowledge, graph] = await Promise.all([
        api.getBrandKnowledge(),
        api.getBrandGraph(),
      ]);

      this.currentData = knowledge;
      this.graphData = graph;

      container.innerHTML = `
        <!-- Sub-tabs bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm ${this.activeSubTab === 'graph' ? 'active' : ''}" id="btnSubGraph" onclick="knowledgeView.switchSubTab('graph')">
              🕸️ Interactive Knowledge Graph (${graph.node_count} Nodes)
            </button>
            <button class="btn btn-secondary btn-sm ${this.activeSubTab === 'rules' ? 'active' : ''}" id="btnSubRules" onclick="knowledgeView.switchSubTab('rules')">
              📜 Brand Rules (${knowledge.rules.length})
            </button>
            <button class="btn btn-secondary btn-sm ${this.activeSubTab === 'terms' ? 'active' : ''}" id="btnSubTerms" onclick="knowledgeView.switchSubTab('terms')">
              🔤 Preferred &amp; Prohibited Terms
            </button>
            <button class="btn btn-secondary btn-sm ${this.activeSubTab === 'sources' ? 'active' : ''}" id="btnSubSources" onclick="knowledgeView.switchSubTab('sources')">
              📑 Evidence Sources &amp; Disclaimers
            </button>
          </div>

          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Brand: <strong style="color: var(--accent-primary);">Inkloom AI</strong> &bull; Provenance: Synthetic Approved
          </div>
        </div>

        <div id="subTabContent">
          <!-- Rendered below -->
        </div>
      `;

      this.renderSubTabContent();
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Failed to load brand knowledge</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
        </div>
      `;
    }
  },

  switchSubTab(tabName) {
    this.activeSubTab = tabName;
    ['graph', 'rules', 'terms', 'sources'].forEach(t => {
      const btn = document.getElementById(`btnSub${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.style.borderColor = 'var(--accent-primary)';
          btn.style.color = 'var(--accent-primary)';
          btn.style.fontWeight = '700';
        } else {
          btn.classList.remove('active');
          btn.style.borderColor = 'var(--border-color)';
          btn.style.color = 'var(--text-main)';
        }
      }
    });
    this.renderSubTabContent();
  },

  renderSubTabContent() {
    const content = document.getElementById('subTabContent');
    if (!content) return;

    if (this.activeSubTab === 'graph') {
      this.renderGraphTab(content);
    } else if (this.activeSubTab === 'rules') {
      this.renderRulesTab(content);
    } else if (this.activeSubTab === 'terms') {
      this.renderTermsTab(content);
    } else if (this.activeSubTab === 'sources') {
      this.renderSourcesTab(content);
    }
  },

  graphMode: '3d', // '3d' | '2d'
  selectedProductId: 'ALL',
  activeCategoryFilter: 'ALL',
  autoOrbit: true,
  threeState: null,

  // 2D SVG Pan/Zoom state
  zoomLevel: 1.0,
  panX: 0,
  panY: 0,
  isPanning: false,
  startX: 0,
  startY: 0,

  renderGraphTab(container) {
    const g = this.graphData;
    if (!g || !g.nodes) {
      container.innerHTML = `<div class="card">No graph data found.</div>`;
      return;
    }

    // Clean up previous Three.js animation and scene if present
    this.cleanup3D();

    container.innerHTML = `
      <div class="card" style="padding: 0; overflow: hidden;">
        <!-- Command Center Graph Header -->
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface); flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <div>
              <strong style="font-size: 0.9375rem; letter-spacing: -0.01em;">Brand Knowledge Graph</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;" id="graphNodeCounter">
                ${g.node_count} Nodes &bull; ${g.edge_count} Directed Edges
              </span>
            </div>

            <!-- View Mode Switcher -->
            <div class="view-mode-tabs" style="margin-left: 6px;">
              <button class="view-mode-btn ${this.graphMode === '3d' ? 'active' : ''}" id="btnMode3D" onclick="knowledgeView.switchGraphMode('3d')">
                🌐 3D Neural Space
              </button>
              <button class="view-mode-btn ${this.graphMode === '2d' ? 'active' : ''}" id="btnMode2D" onclick="knowledgeView.switchGraphMode('2d')">
                🕸️ 2D Blueprint
              </button>
            </div>

            <!-- Subgraph Filter -->
            <select id="graphProductFilter" onchange="knowledgeView.filterByProduct(this.value)"
                    style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-main); font-size: 0.75rem; padding: 5px 10px; outline: none; cursor: pointer;">
              <option value="ALL" ${this.selectedProductId === 'ALL' ? 'selected' : ''}>All Graph Entities</option>
              <option value="PROD-COPILOT" ${this.selectedProductId === 'PROD-COPILOT' ? 'selected' : ''}>Inkloom Copilot Subgraph</option>
              <option value="PROD-SENTINEL" ${this.selectedProductId === 'PROD-SENTINEL' ? 'selected' : ''}>Inkloom Sentinel Subgraph</option>
              <option value="PROD-CORE" ${this.selectedProductId === 'PROD-CORE' ? 'selected' : ''}>Knowledge Core Subgraph</option>
            </select>
          </div>

          <div style="font-size: 0.75rem; color: var(--text-subtle);">
            ${this.graphMode === '3d' ? 'Left-click + drag to rotate &bull; Right-click to pan &bull; Scroll to zoom' : 'Drag to pan &bull; Click node for connections &bull; Toolbar for zoom'}
          </div>
        </div>

        <!-- 3D Neural Space Container -->
        <div id="threeGraphWrapper" style="display: ${this.graphMode === '3d' ? 'block' : 'none'}; position: relative;">
          <div class="three-graph-container" id="threeCanvasContainer">
            <!-- 3D Canvas injected here -->
            <div id="threeCanvasWrapper" class="three-canvas-wrapper"></div>

            <!-- Floating 3D HUD Tooltip -->
            <div id="threeNodeTooltip" class="three-node-tooltip"></div>

            <!-- HUD Control Bar -->
            <div class="three-hud-controls">
              <button class="three-hud-btn ${this.autoOrbit ? 'active' : ''}" id="btnAutoOrbit" onclick="knowledgeView.toggleAutoOrbit()">
                <span>${this.autoOrbit ? '↺ Auto-Orbit ON' : '⏸ Auto-Orbit OFF'}</span>
              </button>
              <button class="three-hud-btn" onclick="knowledgeView.reset3DCamera()" title="Reset Camera View">
                <span>🎯 Reset View</span>
              </button>
              <div style="width: 1px; height: 18px; background: var(--border-color); margin: 0 4px;"></div>
              <!-- Category Filter Chips -->
              <button class="three-hud-btn ${this.activeCategoryFilter === 'ALL' ? 'active' : ''}" onclick="knowledgeView.filter3DCategory('ALL')">All</button>
              <button class="three-hud-btn ${this.activeCategoryFilter === 'PRODUCT' ? 'active' : ''}" onclick="knowledgeView.filter3DCategory('PRODUCT')">Products</button>
              <button class="three-hud-btn ${this.activeCategoryFilter === 'RULE' ? 'active' : ''}" onclick="knowledgeView.filter3DCategory('RULE')">Rules</button>
              <button class="three-hud-btn ${this.activeCategoryFilter === 'CLAIM' ? 'active' : ''}" onclick="knowledgeView.filter3DCategory('CLAIM')">Claims</button>
              <button class="three-hud-btn ${this.activeCategoryFilter === 'EVIDENCE' ? 'active' : ''}" onclick="knowledgeView.filter3DCategory('EVIDENCE')">Evidence</button>
            </div>

            <!-- Telemetry Indicator -->
            <div class="three-telemetry-box">
              <span class="hud-pulse-radar"></span>
              <span>RENDER: <strong>THREE.JS 3D</strong></span>
              <span>FILTER: <strong id="hudFilterLabel">${this.activeCategoryFilter}</strong></span>
              <span>GRAPH: <strong>${g.node_count} ENTITIES</strong></span>
            </div>
          </div>
        </div>

        <!-- 2D SVG Blueprint Container -->
        <div id="svgGraphWrapper" style="display: ${this.graphMode === '2d' ? 'block' : 'none'}; position: relative;">
          <div class="graph-container">
            <!-- Graph Toolbar -->
            <div class="graph-toolbar">
              <button class="graph-btn" onclick="knowledgeView.zoomIn()" title="Zoom In">+</button>
              <button class="graph-btn" onclick="knowledgeView.zoomOut()" title="Zoom Out">&minus;</button>
              <button class="graph-btn" onclick="knowledgeView.resetZoom()" title="Reset View">&#x21bb;</button>
            </div>

            <svg class="graph-svg" id="brandGraphSvg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="edgeArrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(148, 163, 184, 0.45)"></path>
                </marker>
              </defs>
              <g id="graphViewport" transform="translate(0, 0) scale(1)">
                <g id="svgEdgesGroup"></g>
                <g id="svgNodesGroup"></g>
              </g>
            </svg>
          </div>
        </div>

        <!-- Shared Graph Legend -->
        <div class="graph-legend" style="position: static; border-radius: 0; border-left: none; border-right: none; background: #0A0F1D; color: #94A3B8;">
          <div class="legend-item"><div class="legend-color" style="background: #8055E8;"></div> Brand Core</div>
          <div class="legend-item"><div class="legend-color" style="background: #06B6D4;"></div> Product</div>
          <div class="legend-item"><div class="legend-color" style="background: #EF4444;"></div> Rule</div>
          <div class="legend-item"><div class="legend-color" style="background: #10B981;"></div> Preferred Term</div>
          <div class="legend-item"><div class="legend-color" style="background: #F59E0B;"></div> Prohibited Term</div>
          <div class="legend-item"><div class="legend-color" style="background: #3B82F6;"></div> Evidence Source</div>
          <div class="legend-item"><div class="legend-color" style="background: #EC4899;"></div> Disclaimer</div>
          <div class="legend-item"><div class="legend-color" style="background: #A855F7;"></div> Claim</div>
        </div>

        <!-- Node Inspector Drawer (Shown on click in either 3D or 2D) -->
        <div id="nodeDetailDrawer" style="display: none; padding: 18px 24px; background: var(--bg-card); border-top: 1px solid var(--border-color); animation: fadeIn 0.2s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div id="drawerNodeTitle" style="font-weight: 700; font-size: 1rem;"></div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('nodeDetailDrawer').style.display='none'">Close &times;</button>
          </div>
          <div id="drawerNodeContent" style="margin-top: 10px; font-size: 0.8125rem; color: var(--text-muted);"></div>
        </div>
      </div>
    `;

    if (this.graphMode === '3d' && window.THREE) {
      setTimeout(() => this.init3DGraph(g), 50);
    } else {
      this.drawSvgGraph(g);
      this.bindPanEvents();
    }
  },

  switchGraphMode(mode) {
    if (mode === '3d' && !window.THREE) {
      app.showToast('Three.js 3D engine is still initializing. Using 2D Blueprint.', 'info');
      mode = '2d';
    }

    this.graphMode = mode;
    const btn3D = document.getElementById('btnMode3D');
    const btn2D = document.getElementById('btnMode2D');
    const wrapper3D = document.getElementById('threeGraphWrapper');
    const wrapper2D = document.getElementById('svgGraphWrapper');

    if (btn3D) btn3D.classList.toggle('active', mode === '3d');
    if (btn2D) btn2D.classList.toggle('active', mode === '2d');
    if (wrapper3D) wrapper3D.style.display = mode === '3d' ? 'block' : 'none';
    if (wrapper2D) wrapper2D.style.display = mode === '2d' ? 'block' : 'none';

    if (mode === '3d') {
      this.init3DGraph(this.graphData);
    } else {
      this.cleanup3D();
      this.drawSvgGraph(this.graphData);
      this.bindPanEvents();
    }
  },

  cleanup3D() {
    if (this.threeState) {
      if (this.threeState.animId) cancelAnimationFrame(this.threeState.animId);
      if (this.threeState.resizeObserver) {
        this.threeState.resizeObserver.disconnect();
      }
      if (this.threeState.renderer) {
        this.threeState.renderer.dispose();
        if (this.threeState.renderer.domElement && this.threeState.renderer.domElement.parentNode) {
          this.threeState.renderer.domElement.parentNode.removeChild(this.threeState.renderer.domElement);
        }
      }
      this.threeState = null;
    }
  },

  // --------------------------------------------------------------------------
  // Three.js 3D Neural Space Implementation
  // --------------------------------------------------------------------------
  init3DGraph(g) {
    this.cleanup3D();

    const container = document.getElementById('threeCanvasWrapper');
    if (!container || !window.THREE) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 620;

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070D, 0.0012);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 3000);
    camera.position.set(0, 120, 520);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05070D, 0.95);
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    let controls = null;
    if (window.THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.8;
      controls.maxDistance = 1200;
      controls.minDistance = 60;
    }

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x2E1065, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x06B6D4, 1.3);
    dirLight1.position.set(250, 350, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8B5CF6, 1.1);
    dirLight2.position.set(-250, -200, -200);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x8B5CF6, 2.5, 300);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 6. Starfield Background Particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 1600;
      starPos[i + 1] = (Math.random() - 0.5) * 1200;
      starPos[i + 2] = (Math.random() - 0.5) * 1600;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x38BDF8, size: 2.2, transparent: true, opacity: 0.45 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 7. Ground Orbital Concentric Grid Rings
    const ringGroup = new THREE.Group();
    [100, 200, 300, 420].forEach(r => {
      const ringGeo = new THREE.RingGeometry(r - 0.75, r + 0.75, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x8B5CF6, side: THREE.DoubleSide, transparent: true, opacity: 0.1 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -140;
      ringGroup.add(ringMesh);
    });
    scene.add(ringGroup);

    // 8. 3D Nodes Setup
    const nodeMap = {};
    const nodeMeshList = [];
    const interactiveMeshes = [];

    g.nodes.forEach(n => {
      // Determine size and colors
      let radius = 10;
      if (n.type === 'Brand') radius = 22;
      else if (n.type === 'Product') radius = 15;
      else if (n.type === 'Evidence Source') radius = 12;
      else if (n.type === 'Rule') radius = 11;
      else if (n.type === 'Disclaimer') radius = 10;
      else radius = 9;

      const nodeColor = parseInt(n.color.replace('#', '0x'), 16) || 0x64748B;

      // Sphere Geometry
      const sphereGeo = new THREE.SphereGeometry(radius, 28, 28);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: 0.25,
        metalness: 0.35,
        emissive: nodeColor,
        emissiveIntensity: n.type === 'Brand' ? 0.45 : (n.type === 'Product' ? 0.3 : 0.18),
      });

      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      const x = n.x3d !== undefined ? n.x3d : (n.x - 400) * 0.7;
      const y = n.y3d !== undefined ? n.y3d : (300 - n.y) * 0.7;
      const z = n.z3d !== undefined ? n.z3d : (Math.random() - 0.5) * 120;
      sphereMesh.position.set(x, y, z);
      sphereMesh.userData = { node: n, radius, baseScale: 1.0, color: nodeColor };

      // Extra outer wireframe ring for Brand core
      let outerAura = null;
      if (n.type === 'Brand') {
        const auraGeo = new THREE.SphereGeometry(radius * 1.35, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0xA855F7, wireframe: true, transparent: true, opacity: 0.35 });
        outerAura = new THREE.Mesh(auraGeo, auraMat);
        sphereMesh.add(outerAura);
      }

      // Warning beacon ring for Superseded or Conflicting rules
      if (n.type === 'Rule' && n.properties && (n.properties.status === 'Superseded' || n.properties.superseded_by)) {
        const warnGeo = new THREE.RingGeometry(radius * 1.35, radius * 1.55, 32);
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const warnRing = new THREE.Mesh(warnGeo, warnMat);
        sphereMesh.add(warnRing);
      }

      // Billboard Canvas Text Sprite
      const sprite = this.createLabelSprite(n.label, n.color);
      sprite.position.set(0, radius + 11, 0);
      sphereMesh.add(sprite);

      scene.add(sphereMesh);
      nodeMap[n.id] = sphereMesh;
      nodeMeshList.push(sphereMesh);
      interactiveMeshes.push(sphereMesh);
    });

    // 9. 3D Edges Setup & Moving Energy Packets
    const edgeLines = [];
    const energyPhotons = [];

    g.edges.forEach(e => {
      const sMesh = nodeMap[e.source];
      const tMesh = nodeMap[e.target];
      if (sMesh && tMesh) {
        const p1 = sMesh.position;
        const p2 = tMesh.position;

        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x64748B,
          transparent: true,
          opacity: 0.3,
          linewidth: 1.5,
        });

        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { sourceId: e.source, targetId: e.target, type: e.type };
        scene.add(line);
        edgeLines.push(line);

        // Energy photon traveling along edge
        const photonGeo = new THREE.SphereGeometry(1.8, 8, 8);
        const photonMat = new THREE.MeshBasicMaterial({
          color: e.type === 'PROHIBITS' ? 0xF59E0B : (e.type === 'REQUIRES' ? 0xEC4899 : 0x06B6D4),
          transparent: true,
          opacity: 0.85,
        });
        const photonMesh = new THREE.Mesh(photonGeo, photonMat);
        scene.add(photonMesh);

        energyPhotons.push({
          mesh: photonMesh,
          sourcePos: p1,
          targetPos: p2,
          t: Math.random(),
          speed: 0.004 + Math.random() * 0.004,
        });
      }
    });

    // 10. Raycasting & Tooltip Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let hoveredMesh = null;
    let pointerDownPos = { x: 0, y: 0 };
    const tooltip = document.getElementById('threeNodeTooltip');

    const onPointerMove = (evt) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

      // Update tooltip position
      if (tooltip && hoveredMesh) {
        tooltip.style.left = `${evt.clientX - rect.left}px`;
        tooltip.style.top = `${evt.clientY - rect.top}px`;
      }
    };

    const onPointerDown = (evt) => {
      pointerDownPos = { x: evt.clientX, y: evt.clientY };
    };

    const onPointerUp = (evt) => {
      const dist = Math.hypot(evt.clientX - pointerDownPos.x, evt.clientY - pointerDownPos.y);
      if (dist < 6 && hoveredMesh) {
        // Registered as a click!
        const node = hoveredMesh.userData.node;
        this.showNodeDetail(node.id);

        // Smooth camera target transition towards clicked node
        if (controls) {
          const targetPos = hoveredMesh.position;
          controls.target.copy(targetPos);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // 11. Responsive Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 620;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 12. Animation Loop
    this.threeState = {
      scene,
      camera,
      renderer,
      controls,
      nodeMeshList,
      edgeLines,
      energyPhotons,
      starField,
      resizeObserver,
      animId: null,
    };

    const animate = () => {
      if (!this.threeState) return;
      this.threeState.animId = requestAnimationFrame(animate);

      // Auto-Orbit
      if (this.autoOrbit && controls && !controls.state) {
        scene.rotation.y += 0.0018;
      }

      // Rotate star background subtly
      starField.rotation.y += 0.0004;

      // Pulse energy photons along edges
      energyPhotons.forEach(p => {
        p.t = (p.t + p.speed) % 1.0;
        p.mesh.position.lerpVectors(p.sourcePos, p.targetPos, p.t);
      });

      // Raycast checks
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        const topMesh = intersects[0].object;
        if (hoveredMesh !== topMesh) {
          if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1);
          hoveredMesh = topMesh;
          hoveredMesh.scale.set(1.3, 1.3, 1.3);

          const n = hoveredMesh.userData.node;
          if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${n.color};"></span>
                <strong>${escapeHtml(n.label)}</strong>
              </div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${n.id} &bull; <span style="text-transform:uppercase;">${n.type}</span></div>
              <div style="font-size:0.68rem; color:var(--accent-cyan); margin-top:3px;">Click to view entity connections &rarr;</div>
            `;
          }
          container.style.cursor = 'pointer';

          // Highlight connected edges
          edgeLines.forEach(l => {
            if (l.userData.sourceId === n.id || l.userData.targetId === n.id) {
              l.material.opacity = 0.9;
              l.material.color.setHex(0x06B6D4);
            } else {
              l.material.opacity = 0.12;
              l.material.color.setHex(0x475569);
            }
          });
        }
      } else {
        if (hoveredMesh) {
          hoveredMesh.scale.set(1, 1, 1);
          hoveredMesh = null;
          if (tooltip) tooltip.style.display = 'none';
          container.style.cursor = 'grab';

          // Restore edge lines
          edgeLines.forEach(l => {
            l.material.opacity = 0.3;
            l.material.color.setHex(0x64748B);
          });
        }
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
    };

    animate();
  },

  createLabelSprite(text, color = '#FFFFFF') {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(7, 9, 19, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3;

    const r = 20;
    const w = 360, h = 76, x = 12, y = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text Label
    ctx.fillStyle = color;
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const display = text.length > 20 ? text.slice(0, 18) + '...' : text;
    ctx.fillText(display, 192, 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(48, 12, 1);
    return sprite;
  },

  toggleAutoOrbit() {
    this.autoOrbit = !this.autoOrbit;
    const btn = document.getElementById('btnAutoOrbit');
    if (btn) {
      btn.classList.toggle('active', this.autoOrbit);
      btn.innerHTML = `<span>${this.autoOrbit ? '↺ Auto-Orbit ON' : '⏸ Auto-Orbit OFF'}</span>`;
    }
    app.showToast(this.autoOrbit ? 'Auto-Orbit enabled' : 'Auto-Orbit paused', 'info');
  },

  reset3DCamera() {
    if (this.threeState && this.threeState.camera && this.threeState.controls) {
      this.threeState.camera.position.set(0, 120, 520);
      this.threeState.controls.target.set(0, 0, 0);
      this.threeState.controls.update();
      app.showToast('3D Camera reset to center', 'info');
    }
  },

  async filterByProduct(productId) {
    this.selectedProductId = productId;
    try {
      const g = await api.getBrandGraph(productId === 'ALL' ? null : productId);
      this.graphData = g;
      const counterEl = document.getElementById('graphNodeCounter');
      if (counterEl) {
        counterEl.innerText = `${g.node_count} Nodes • ${g.edge_count} Directed Edges`;
      }

      if (this.graphMode === '3d') {
        this.init3DGraph(g);
      } else {
        this.resetZoom();
        this.drawSvgGraph(g);
      }
      app.showToast(`Filtered graph: ${productId === 'ALL' ? 'All Entities' : productId}`, 'info');
    } catch (e) {
      app.showToast('Could not filter graph: ' + e.message, 'error');
    }
  },

  drawSvgGraph(g) {
    const nodesGroup = document.getElementById('svgNodesGroup');
    const edgesGroup = document.getElementById('svgEdgesGroup');
    if (!nodesGroup || !edgesGroup) return;

    // Node lookup map
    const nodeMap = {};
    g.nodes.forEach(n => { nodeMap[n.id] = n; });

    // Render Edges
    let edgesHtml = '';
    g.edges.forEach(e => {
      const s = nodeMap[e.source];
      const t = nodeMap[e.target];
      if (s && t) {
        edgesHtml += `
          <line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" 
                stroke="rgba(148, 163, 184, 0.25)" stroke-width="1.75"
                marker-end="url(#edgeArrow)">
            <title>${escapeHtml(e.type || 'RELATES_TO')}: ${s.label} &rarr; ${t.label}</title>
          </line>
        `;
      }
    });
    edgesGroup.innerHTML = edgesHtml;

    // Render Nodes
    let nodesHtml = '';
    g.nodes.forEach(n => {
      const radius = n.type === 'Brand' ? 22 : (n.type === 'Product' ? 17 : 13);
      nodesHtml += `
        <g class="graph-node" style="cursor: pointer;" onclick="knowledgeView.showNodeDetail('${n.id}')">
          <circle cx="${n.x}" cy="${n.y}" r="${radius}" fill="${n.color}" stroke="#FFFFFF" stroke-width="2" opacity="0.95">
            <title>${escapeHtml(n.label)} (${n.type})</title>
          </circle>
          <text x="${n.x}" y="${n.y + radius + 13}" fill="#E2E8F0" font-size="10" font-family="var(--font-sans)" 
                text-anchor="middle" font-weight="700" filter="drop-shadow(0px 1px 3px rgba(0,0,0,0.9))">
            ${escapeHtml(n.label.length > 20 ? n.label.slice(0, 18) + '...' : n.label)}
          </text>
        </g>
      `;
    });
    nodesGroup.innerHTML = nodesHtml;
  },

  filter3DCategory(category) {
    this.activeCategoryFilter = category;
    const filterLabel = document.getElementById('hudFilterLabel');
    if (filterLabel) filterLabel.innerText = category;

    // Update 3D HUD button active styles
    document.querySelectorAll('.three-hud-controls .three-hud-btn').forEach(btn => {
      const text = btn.innerText.trim();
      const catMap = { 'All': 'ALL', 'Products': 'PRODUCT', 'Rules': 'RULE', 'Claims': 'CLAIM', 'Evidence': 'EVIDENCE' };
      if (catMap[text]) {
        btn.classList.toggle('active', catMap[text] === category);
      }
    });

    if (!this.threeState || !this.threeState.nodeMeshList) return;

    this.threeState.nodeMeshList.forEach(mesh => {
      const type = mesh.userData.node.type;
      let match = true;
      if (category === 'PRODUCT') match = (type === 'Brand' || type === 'Product');
      else if (category === 'RULE') match = (type === 'Rule' || type === 'Disclaimer');
      else if (category === 'CLAIM') match = (type === 'Claim' || type === 'Preferred Term' || type === 'Prohibited Term');
      else if (category === 'EVIDENCE') match = (type === 'Evidence Source');

      if (match) {
        mesh.visible = true;
        mesh.scale.set(1.15, 1.15, 1.15);
        mesh.material.opacity = 1.0;
        mesh.material.transparent = false;
      } else {
        mesh.scale.set(0.45, 0.45, 0.45);
        mesh.material.transparent = true;
        mesh.material.opacity = 0.15;
      }
    });

    // Update Edge line opacities accordingly
    if (this.threeState.edgeLines) {
      this.threeState.edgeLines.forEach(l => {
        l.material.opacity = (category === 'ALL') ? 0.3 : 0.08;
      });
    }

    app.showToast(`3D Space filtered: ${category}`, 'info');
  },

  smoothFocusNode(targetPos) {
    if (!this.threeState || !this.threeState.controls || !this.threeState.camera) return;
    const controls = this.threeState.controls;
    controls.target.lerp(targetPos, 0.85);
    controls.update();
  },

  showNodeDetail(nodeId) {
    const node = this.graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Smooth camera focus if in 3D
    if (this.threeState && this.threeState.nodeMeshList) {
      const mesh = this.threeState.nodeMeshList.find(m => m.userData.node.id === nodeId);
      if (mesh) {
        this.smoothFocusNode(mesh.position);
      }
    }

    const drawer = document.getElementById('nodeDetailDrawer');
    const titleEl = document.getElementById('drawerNodeTitle');
    const contentEl = document.getElementById('drawerNodeContent');

    drawer.style.display = 'block';
    
    // Type color pill & status
    const status = node.properties?.status || 'Active';
    const isSuperseded = status === 'Superseded' || node.properties?.superseded_by;

    titleEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${node.color}; box-shadow: 0 0 8px ${node.color};"></span>
        <span style="font-size: 1.05rem; font-weight: 700;">${escapeHtml(node.label)}</span>
        <span class="badge ${isSuperseded ? 'badge-high' : 'badge-low'}">${escapeHtml(node.type)}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${node.id}</span>
        ${isSuperseded ? '<span class="badge badge-critical">SUPERSEDED POLICY</span>' : ''}
      </div>
    `;

    // Filter incoming and outgoing edges
    const incoming = this.graphData.edges.filter(e => e.target === nodeId);
    const outgoing = this.graphData.edges.filter(e => e.source === nodeId);

    let html = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px;">
        <!-- Left: Node Properties & Compliance Details -->
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-subtle); margin-bottom: 8px; font-weight: 700;">
            Node Properties &amp; Metadata
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
    `;

    for (const [k, v] of Object.entries(node.properties || {})) {
      html += `
        <div>
          <span style="font-size: 0.68rem; color: var(--text-subtle); text-transform: uppercase;">${k.replace(/_/g, ' ')}:</span>
          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main);">
            ${Array.isArray(v) ? v.join(', ') : escapeHtml(String(v))}
          </div>
        </div>
      `;
    }

    html += `
          </div>
        </div>

        <!-- Right: Connected Relationships & Actions -->
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-subtle); margin-bottom: 8px; font-weight: 700;">
            Interconnected Topology (${incoming.length + outgoing.length} Connections)
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; max-height: 140px; overflow-y: auto;">
    `;

    if (incoming.length > 0) {
      html += `
        <div style="margin-bottom: 8px;">
          <span style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 700;">INCOMING:</span>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
            ${incoming.map(e => `
              <span class="badge-clickable badge-source-link" onclick="knowledgeView.showNodeDetail('${e.source}')" title="Inspect ${e.source}">
                ${e.source} &bull; ${e.type}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (outgoing.length > 0) {
      html += `
        <div>
          <span style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 700;">OUTGOING:</span>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
            ${outgoing.map(e => `
              <span class="badge-clickable badge-rule-link" onclick="knowledgeView.showNodeDetail('${e.target}')" title="Inspect ${e.target}">
                ${e.type} &rarr; ${e.target}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `
          </div>

          <!-- Quick Action Buttons -->
          <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            ${node.type === 'Evidence Source' ? `
              <button class="btn btn-secondary btn-sm" onclick="app.openEvidenceSource('${node.id}')">Inspect Source Document &rarr;</button>
            ` : ''}
            ${node.type === 'Rule' ? `
              <button class="btn btn-secondary btn-sm" onclick="app.openRuleDetail('${node.id}')">View Full Rule Policy &rarr;</button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('review')">Validate in Review Studio &rarr;</button>
          </div>
        </div>
      </div>
    `;

    contentEl.innerHTML = html;
  },

  renderRulesTab(container) {
    const rules = this.currentData.rules || [];
    container.innerHTML = `
      <div class="card">
        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px;">Approved Governance Rules</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Rule ID</th>
              <th>Rule Title</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${rules.map(r => `
              <tr>
                <td>
                  <span class="badge-clickable badge-rule-link" onclick="app.openRuleDetail('${r.id}')" title="Inspect Rule ${r.id}">
                    ${r.id}
                  </span>
                </td>
                <td>
                  <strong style="cursor: pointer; color: var(--text-main);" onclick="app.openRuleDetail('${r.id}')" title="Inspect ${escapeHtml(r.title)}">
                    ${escapeHtml(r.title)}
                  </strong>
                </td>
                <td><span style="text-transform: uppercase; font-size: 0.7rem; color: var(--text-muted);">${r.category}</span></td>
                <td><span class="badge badge-${r.severity}">${r.severity}</span></td>
                <td>
                  <span class="badge ${r.status === 'active' ? 'badge-state-approved' : (r.status === 'superseded' ? 'badge-low' : 'badge-high')}">
                    ${r.status}
                  </span>
                </td>
                <td style="color: var(--text-muted); font-size: 0.78rem;">
                  ${escapeHtml(r.description)}
                  ${r.superseded_by ? `<br><span style="color: var(--accent-rose);">Superseded by: <strong>${r.superseded_by}</strong></span>` : ''}
                  ${r.conflicts_with ? `<br><span style="color: var(--accent-amber);">Conflicts with: <strong>${r.conflicts_with}</strong></span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderTermsTab(container) {
    const preferred = this.currentData.preferred_terms || [];
    const prohibited = this.currentData.prohibited_terms || [];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <!-- Preferred Terms -->
        <div class="card">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; color: var(--accent-emerald);">
            ✓ Preferred Brand Terminology
          </h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Preferred Term</th>
                <th>Replaces</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              ${preferred.map(pt => `
                <tr>
                  <td style="font-weight: 700; color: var(--accent-emerald);">"${escapeHtml(pt.term)}"</td>
                  <td style="color: var(--text-muted); text-decoration: line-through;">${escapeHtml(pt.preferred_for)}</td>
                  <td style="font-size: 0.75rem; color: var(--text-subtle);">${escapeHtml(pt.context)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Prohibited Terms -->
        <div class="card">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; color: var(--accent-rose);">
            ✕ Prohibited Phrases &amp; Claims
          </h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Prohibited Term</th>
                <th>Reason</th>
                <th>Approved Alternative</th>
              </tr>
            </thead>
            <tbody>
              ${prohibited.map(pr => `
                <tr>
                  <td style="font-weight: 700; color: var(--accent-rose); font-family: var(--font-mono);">"${escapeHtml(pr.term)}"</td>
                  <td style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(pr.reason)}</td>
                  <td style="font-size: 0.75rem; color: var(--accent-emerald);">${escapeHtml(pr.recommended_alternative || 'N/A')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderSourcesTab(container) {
    const sources = this.currentData.evidence_sources || [];
    const disclaimers = this.currentData.disclaimers || [];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Evidence Sources -->
        <div class="card">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px;">Approved Evidence Documents</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Source ID</th>
                <th>Document Title</th>
                <th>Type</th>
                <th>Publication Date</th>
                <th>Approved Excerpt</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              ${sources.map(s => `
                <tr>
                  <td>
                    <span class="badge-clickable badge-source-link" onclick="app.openEvidenceSource('${s.id}')" title="Inspect Source ${s.id}">
                      ${s.id}
                    </span>
                  </td>
                  <td>
                    <strong style="cursor: pointer; color: var(--text-main);" onclick="app.openEvidenceSource('${s.id}')" title="Inspect ${escapeHtml(s.title)}">
                      ${escapeHtml(s.title)}
                    </strong>
                  </td>
                  <td><span class="badge badge-low">${s.source_type}</span></td>
                  <td>${s.publication_date}</td>
                  <td style="font-size: 0.78rem; color: var(--text-muted); max-width: 320px;">
                    "${escapeHtml(s.excerpt)}"
                  </td>
                  <td style="font-size: 0.72rem; color: var(--text-subtle);">${escapeHtml(s.provenance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mandatory Disclaimers -->
        <div class="card">
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px;">Mandatory Legal &amp; Performance Disclaimers</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Disclaimer ID</th>
                <th>Name</th>
                <th>Trigger Keywords</th>
                <th>Required Text</th>
              </tr>
            </thead>
            <tbody>
              ${disclaimers.map(d => `
                <tr>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #EC4899;">${d.id}</td>
                  <td><strong>${escapeHtml(d.name)}</strong></td>
                  <td>
                    ${d.trigger_keywords.map(kw => `<span class="badge badge-low" style="margin: 2px;">${kw}</span>`).join('')}
                  </td>
                  <td style="font-size: 0.8125rem; color: #DDD6FE; font-style: italic;">
                    "${escapeHtml(d.required_text)}"
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
};
