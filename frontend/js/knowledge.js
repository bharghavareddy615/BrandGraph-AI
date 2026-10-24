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
          btn.style.color = '#DDD6FE';
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

  renderGraphTab(container) {
    const g = this.graphData;
    if (!g || !g.nodes) {
      container.innerHTML = `<div class="card">No graph data found.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div>
              <strong style="font-size: 0.9375rem;">Connected Brand Knowledge Graph</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;" id="graphNodeCounter">
                Nodes: ${g.node_count} &bull; Directed Edges: ${g.edge_count}
              </span>
            </div>
            <select id="graphProductFilter" onchange="knowledgeView.filterByProduct(this.value)"
                    style="background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-main); font-size: 0.75rem; padding: 4px 10px; outline: none; cursor: pointer;">
              <option value="ALL">All Graph Entities</option>
              <option value="PROD-COPILOT">Inkloom Copilot Subgraph</option>
              <option value="PROD-SENTINEL">Inkloom Sentinel Subgraph</option>
              <option value="PROD-CORE">Knowledge Core Subgraph</option>
            </select>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-subtle);">
            Click on any node to view entity details and connections.
          </div>
        </div>

        <div class="graph-container" id="svgGraphWrapper">
          <svg class="graph-svg" id="brandGraphSvg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
            <!-- Edges -->
            <g id="svgEdgesGroup"></g>
            <!-- Nodes -->
            <g id="svgNodesGroup"></g>
          </svg>

          <!-- Graph Legend -->
          <div class="graph-legend">
            <div class="legend-item"><div class="legend-color" style="background: #8B5CF6;"></div> Brand</div>
            <div class="legend-item"><div class="legend-color" style="background: #06B6D4;"></div> Product</div>
            <div class="legend-item"><div class="legend-color" style="background: #EF4444;"></div> Rule</div>
            <div class="legend-item"><div class="legend-color" style="background: #10B981;"></div> Preferred Term</div>
            <div class="legend-item"><div class="legend-color" style="background: #F59E0B;"></div> Prohibited Term</div>
            <div class="legend-item"><div class="legend-color" style="background: #3B82F6;"></div> Evidence Source</div>
            <div class="legend-item"><div class="legend-color" style="background: #EC4899;"></div> Disclaimer</div>
            <div class="legend-item"><div class="legend-color" style="background: #94A3B8;"></div> Draft Node</div>
            <div class="legend-item"><div class="legend-color" style="background: #F43F5E;"></div> Finding Node</div>
          </div>
        </div>

        <!-- Node Inspector Drawer (Shown on click) -->
        <div id="nodeDetailDrawer" style="display: none; padding: 16px 20px; background: rgba(11, 15, 25, 0.95); border-top: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div id="drawerNodeTitle" style="font-weight: 700; font-size: 0.9375rem;"></div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('nodeDetailDrawer').style.display='none'">Close</button>
          </div>
          <div id="drawerNodeContent" style="margin-top: 8px; font-size: 0.8125rem; color: var(--text-muted);"></div>
        </div>
      </div>
    `;

    this.drawSvgGraph(g);
  },

  async filterByProduct(productId) {
    try {
      const g = await api.getBrandGraph(productId === 'ALL' ? null : productId);
      this.graphData = g;
      const counterEl = document.getElementById('graphNodeCounter');
      if (counterEl) {
        counterEl.innerText = `Nodes: ${g.node_count} • Directed Edges: ${g.edge_count}`;
      }
      this.drawSvgGraph(g);
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
                stroke="rgba(148, 163, 184, 0.22)" stroke-width="1.5" />
        `;
      }
    });
    edgesGroup.innerHTML = edgesHtml;

    // Render Nodes
    let nodesHtml = '';
    g.nodes.forEach(n => {
      const radius = n.type === 'Brand' ? 20 : (n.type === 'Product' ? 16 : 12);
      nodesHtml += `
        <g class="graph-node" style="cursor: pointer;" onclick="knowledgeView.showNodeDetail('${n.id}')">
          <circle cx="${n.x}" cy="${n.y}" r="${radius}" fill="${n.color}" stroke="#FFFFFF" stroke-width="2" opacity="0.95">
            <title>${escapeHtml(n.label)} (${n.type})</title>
          </circle>
          <text x="${n.x}" y="${n.y + radius + 12}" fill="#CBD5E1" font-size="9" font-family="var(--font-sans)" 
                text-anchor="middle" font-weight="600">
            ${escapeHtml(n.label.length > 18 ? n.label.slice(0, 16) + '...' : n.label)}
          </text>
        </g>
      `;
    });
    nodesGroup.innerHTML = nodesHtml;
  },

  showNodeDetail(nodeId) {
    const node = this.graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const drawer = document.getElementById('nodeDetailDrawer');
    const titleEl = document.getElementById('drawerNodeTitle');
    const contentEl = document.getElementById('drawerNodeContent');

    drawer.style.display = 'block';
    titleEl.innerHTML = `
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${node.color}; margin-right: 6px;"></span>
      ${escapeHtml(node.label)} <span style="font-size: 0.72rem; color: var(--text-subtle); font-family: var(--font-mono);">(${node.id} &bull; ${node.type})</span>
    `;

    let propsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">';
    for (const [k, v] of Object.entries(node.properties || {})) {
      propsHtml += `
        <div>
          <span style="font-size: 0.7rem; color: var(--text-subtle); text-transform: uppercase;">${k.replace('_', ' ')}:</span>
          <div>${Array.isArray(v) ? v.join(', ') : escapeHtml(String(v))}</div>
        </div>
      `;
    }
    propsHtml += '</div>';

    // Show linked edges
    const incoming = this.graphData.edges.filter(e => e.target === nodeId);
    const outgoing = this.graphData.edges.filter(e => e.source === nodeId);

    let linksHtml = '<div style="margin-top: 12px; font-size: 0.75rem;">';
    if (incoming.length > 0) {
      linksHtml += `<div><strong>Incoming:</strong> ${incoming.map(e => `[${e.source}] &rarr; <em>${e.type}</em>`).join(', ')}</div>`;
    }
    if (outgoing.length > 0) {
      linksHtml += `<div><strong>Outgoing:</strong> ${outgoing.map(e => `<em>${e.type}</em> &rarr; [${e.target}]`).join(', ')}</div>`;
    }
    linksHtml += '</div>';

    contentEl.innerHTML = propsHtml + linksHtml;
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
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-primary);">${r.id}</td>
                <td><strong>${escapeHtml(r.title)}</strong></td>
                <td><span style="text-transform: uppercase; font-size: 0.7rem; color: var(--text-muted);">${r.category}</span></td>
                <td><span class="badge badge-${r.severity}">${r.severity}</span></td>
                <td>
                  <span class="badge ${r.status === 'active' ? 'badge-state-approved' : (r.status === 'superseded' ? 'badge-low' : 'badge-high')}">
                    ${r.status}
                  </span>
                </td>
                <td style="color: var(--text-muted); font-size: 0.78rem;">
                  ${escapeHtml(r.description)}
                  ${r.superseded_by ? `<br><span style="color: var(--accent-rose);">Superseded by: ${r.superseded_by}</span>` : ''}
                  ${r.conflicts_with ? `<br><span style="color: var(--accent-amber);">Conflicts with: ${r.conflicts_with}</span>` : ''}
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
                  <td style="font-weight: 700; color: #6EE7B7;">"${escapeHtml(pt.term)}"</td>
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
                  <td style="font-weight: 700; color: #FDA4AF; font-family: var(--font-mono);">"${escapeHtml(pr.term)}"</td>
                  <td style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(pr.reason)}</td>
                  <td style="font-size: 0.75rem; color: #6EE7B7;">${escapeHtml(pr.recommended_alternative || 'N/A')}</td>
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
                  <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${s.id}</td>
                  <td><strong>${escapeHtml(s.title)}</strong></td>
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
