/**
 * Main Application Controller for BrandGraph AI
 */

const app = {
  currentTab: 'dashboard',

  init() {
    this.bindNavigation();
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'dashboard';
    this.navigateTo(initialTab);
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          this.navigateTo(tab);
        }
      });
    });
  },

  navigateTo(tabName, param = null) {
    // Teardown previous view resources if navigating away from knowledge
    if (this.currentTab === 'knowledge' && tabName !== 'knowledge') {
      if (typeof knowledgeView !== 'undefined' && knowledgeView && typeof knowledgeView.cleanup3D === 'function') {
        knowledgeView.cleanup3D();
      }
    }

    this.currentTab = tabName;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Header Titles
    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSubtitle');
    const container = document.getElementById('pageContainer');

    const meta = {
      dashboard: {
        title: 'Brand Governance Dashboard',
        sub: 'Real-time overview of drafts, violations, workflow states, and stress test metrics.',
      },
      review: {
        title: 'Content Review & Evidence Grounding',
        sub: 'Evaluate drafts before publication against approved brand guidelines and sources.',
      },
      knowledge: {
        title: 'Brand Knowledge Base & Graph',
        sub: 'Approved rules, preferred terms, prohibited phrases, disclaimers, and interactive graph.',
      },
      evidence: {
        title: 'Evidence Explorer & Provenance',
        sub: 'Inspect retrieved benchmark reports, audit certifications, and source-grounded excerpts.',
      },
      workflow: {
        title: 'Human Review Workflow & Audit Log',
        sub: 'Human-in-the-loop review decisions, revision comments, and state transition history.',
      },
      evaluation: {
        title: 'Brand Stress Tester & Synthetic Evaluation',
        sub: 'Curated 10-scenario synthetic benchmark suite with live execution and actual outcomes.',
      },
      settings: {
        title: 'System Settings & Responsible AI Disclosures',
        sub: 'AI provider status, privacy safeguards, synthetic data notice, and architectural limitations.',
      },
    };

    if (meta[tabName]) {
      titleEl.innerText = meta[tabName].title;
      subEl.innerText = meta[tabName].sub;
    }

    // Render corresponding view
    if (tabName === 'dashboard') {
      dashboardView.render(container);
    } else if (tabName === 'review') {
      reviewView.render(container, param);
    } else if (tabName === 'knowledge') {
      knowledgeView.render(container);
    } else if (tabName === 'evidence') {
      this.renderEvidenceExplorer(container);
    } else if (tabName === 'workflow') {
      workflowView.render(container, param);
    } else if (tabName === 'evaluation') {
      evaluationView.render(container);
    } else if (tabName === 'settings') {
      this.renderSettings(container);
    }
  },

  refreshCurrentTab() {
    this.navigateTo(this.currentTab);
    this.showToast('View refreshed with latest data', 'info');
  },

  openDraftInReview(draftId) {
    this.navigateTo('review', draftId);
  },

  async renderEvidenceExplorer(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading approved evidence sources and claims...</p>
      </div>
    `;

    try {
      const data = await api.getBrandKnowledge();
      const sources = data.evidence_sources || [];
      const claims = data.claims || [];

      container.innerHTML = `
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700;">Approved Evidence Repository &amp; RAG Explorer</h3>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                Verified technical whitepapers, performance benchmarks, and compliance audit summaries.
              </p>
            </div>
            <div style="position: relative; width: 360px;">
              <input type="text" id="evidenceSearchInput" placeholder="Query evidence retrieval (e.g. 45ms, TLS, cognitive IQ)..."
                     style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 14px; color: var(--text-main); font-size: 0.8125rem; width: 100%; outline: none;">
            </div>
          </div>

          <!-- Quick Query Chips -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.72rem; color: var(--text-subtle); text-transform: uppercase;">Quick RAG Queries:</span>
            <button class="pill-preset" onclick="app.runEvidenceSearch('under 45ms latency benchmark report')">⚡ 45ms Latency</button>
            <button class="pill-preset" onclick="app.runEvidenceSearch('TLS 1.3 AES-256 encryption at rest')">🔒 TLS 1.3 Encryption</button>
            <button class="pill-preset" onclick="app.runEvidenceSearch('reduced false positives by 42% in enterprise trials')">🎯 42% False Positives</button>
            <button class="pill-preset" onclick="app.runEvidenceSearch('increases developer cognitive IQ by 47 points')">⚠️ Unverified IQ Claim</button>
            <button class="pill-preset" onclick="app.resetEvidenceExplorer()">↺ Show All Sources</button>
          </div>
        </div>

        <!-- Live RAG Status Banner (Hidden until query) -->
        <div id="ragStatusBanner" style="display: none; margin-bottom: 20px;"></div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;" id="evidenceCardsGrid">
          ${sources.map(s => {
            const linked = claims.filter(c => c.evidence_source_id === s.id);
            return `
              <div class="card evidence-card">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.8125rem;">${s.id}</span>
                  <span class="badge badge-low">${escapeHtml(s.source_type)}</span>
                </div>
                <h4 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">${escapeHtml(s.title)}</h4>
                <div style="font-size: 0.72rem; color: var(--text-subtle); margin-bottom: 10px;">
                  Published: ${s.publication_date} &bull; Provenance: ${escapeHtml(s.provenance)}
                </div>
                <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.8125rem; color: var(--text-main); line-height: 1.5; margin-bottom: 12px;">
                  "${escapeHtml(s.excerpt)}"
                </div>
                ${linked.length > 0 ? `
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    <strong style="color: var(--accent-emerald);">Supported Claims:</strong>
                    <ul style="margin: 4px 0 0 16px; padding: 0;">
                      ${linked.map(c => `<li>${escapeHtml(c.statement)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                <div style="display: flex; gap: 8px; margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px; flex-wrap: wrap;">
                  <button class="btn btn-secondary btn-sm" onclick="app.openEvidenceSource('${s.id}')">Inspect Source &rarr;</button>
                  <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('knowledge'); setTimeout(() => knowledgeView.showNodeDetail('${s.id}'), 150);" title="Locate in 3D Graph">🌐 3D Graph &rarr;</button>
                  <button class="btn btn-secondary btn-sm" onclick="app.runEvidenceSearch('${escapeHtml(s.title)}')">Query in RAG &rarr;</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Live search input listener with debounce
      let searchTimeout = null;
      const searchInput = document.getElementById('evidenceSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(searchTimeout);
          const q = searchInput.value.trim();
          if (!q) {
            app.resetEvidenceExplorer();
            return;
          }
          searchTimeout = setTimeout(() => {
            app.runEvidenceSearch(q);
          }, 300);
        });
      }
    } catch (e) {
      container.innerHTML = `
        <div class="card" style="border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Failed to load evidence repository</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${e.message}</p>
          <button class="btn btn-secondary" style="margin-top: 14px;" onclick="app.renderEvidenceExplorer(document.getElementById('pageContainer'))">Retry</button>
        </div>
      `;
    }
  },

  async runEvidenceSearch(query) {
    const input = document.getElementById('evidenceSearchInput');
    if (input) input.value = query;

    const banner = document.getElementById('ragStatusBanner');
    const grid = document.getElementById('evidenceCardsGrid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="loading-state" style="grid-column: 1 / -1;">
        <div class="spinner"></div>
        <p>Querying backend evidence retriever for "${escapeHtml(query)}"...</p>
      </div>
    `;

    try {
      const resp = await api.searchEvidence(query);
      const results = resp.results || [];
      const status = resp.evidence_status;

      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <div style="background: ${status === 'Supported' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${status === 'Supported' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; border-radius: var(--radius-sm); padding: 12px 18px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: ${status === 'Supported' ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">
                Evidence Status: ${status}
              </span>
              <div style="font-size: 0.8125rem; color: var(--text-main); margin-top: 2px;">
                ${results.length > 0 ? `Matched ${results.length} approved document chunk(s) via token-weighted retrieval.` : `No approved sources verify this assertion. Labelled <strong>"Needs verification"</strong>.`}
              </div>
            </div>
            <span class="badge ${status === 'Supported' ? 'badge-state-approved' : 'badge-high'}">${status}</span>
          </div>
        `;
      }

      if (results.length === 0) {
        grid.innerHTML = `
          <div class="card empty-state" style="grid-column: 1 / -1; padding: 48px 24px;">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No Approved Evidence Matches</div>
            <div class="empty-state-desc">
              No approved synthetic evidence sources substantiate "<strong>${escapeHtml(query)}</strong>".
              In BrandGraph AI, ungrounded claims are strictly categorized as <em>"Needs verification"</em> rather than presumed true.
            </div>
            <button class="btn btn-secondary" onclick="app.resetEvidenceExplorer()">Show All Verified Sources</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = results.map(r => `
        <div class="card" style="border-left: 3px solid var(--accent-cyan); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.8125rem;">${r.source_id} &bull; ${r.chunk_id}</span>
              <span class="badge badge-state-approved">Relevance: ${Math.round(r.score * 100)}%</span>
            </div>
            <h4 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 4px;">${escapeHtml(r.source_title)}</h4>
            <div style="font-size: 0.72rem; color: var(--text-subtle); margin-bottom: 10px;">
              Section: ${escapeHtml(r.section || 'Findings')} &bull; Provenance: ${escapeHtml(r.provenance || 'Official Audit')}
            </div>
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.8125rem; color: var(--text-main); line-height: 1.5; margin-bottom: 12px;">
              "${escapeHtml(r.text)}"
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="app.openEvidenceSource('${r.source_id}')">Inspect Source Document &rarr;</button>
          </div>
        </div>
      `).join('');

    } catch (e) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Search Query Failed</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${e.message}</p>
          <button class="btn btn-secondary" style="margin-top: 14px;" onclick="app.runEvidenceSearch('${escapeHtml(query)}')">Retry Search</button>
        </div>
      `;
    }
  },

  resetEvidenceExplorer() {
    const input = document.getElementById('evidenceSearchInput');
    if (input) input.value = '';
    const banner = document.getElementById('ragStatusBanner');
    if (banner) banner.style.display = 'none';
    this.renderEvidenceExplorer(document.getElementById('pageContainer'));
  },

  async renderSettings(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading system configuration &amp; disclosures...</p>
      </div>
    `;

    try {
      const data = await api.getSettings();
      const aiStatus = data.ai_provider_status || {};

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px; max-width: 900px;">
          <!-- AI Provider Card -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
              <span>AI Provider &amp; Model Integration</span>
              <span class="badge ${aiStatus.status.includes('Disabled') ? 'badge-low' : 'badge-state-approved'}">
                ${aiStatus.status}
              </span>
            </h3>
            <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 14px;">
              BrandGraph AI operates primarily with local deterministic rule checks and source-grounded RAG. 
              External LLMs are purely optional and only called when explicitly enabled in <code>.env</code>.
            </p>

            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; font-size: 0.8125rem;">
              <div style="margin-bottom: 6px;"><strong>Active Provider:</strong> ${aiStatus.provider}</div>
              <div style="margin-bottom: 6px;"><strong>Configured Model:</strong> ${aiStatus.model}</div>
              <div style="color: var(--text-subtle);"><strong>Notice:</strong> ${aiStatus.message}</div>
            </div>
          </div>

          <!-- Privacy & Safeguards -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: var(--accent-emerald);">
              🛡️ Privacy &amp; Data Safeguards
            </h3>
            <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.6;">
              ${data.privacy_policy}
            </p>
            <div style="margin-top: 12px; font-size: 0.8125rem; color: var(--text-muted);">
              <strong>Governance Policy:</strong> ${data.governance_rule}
            </div>
          </div>

          <!-- Synthetic Demo Disclosure -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: var(--accent-amber);">
              ⚠️ Synthetic Demonstration Disclosure
            </h3>
            <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.6;">
              ${data.synthetic_data_notice}
            </p>
          </div>

          <!-- Limitations -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 12px;">
              Architectural Limitations
            </h3>
            <ul style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.6; padding-left: 20px;">
              ${data.limitations.map(l => `<li>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="card" style="border-color: var(--accent-rose);">${e.message}</div>`;
    }
  },

  renderStateBadge(state) {
    const s = state || 'Draft';
    if (s === 'Draft') return `<span class="badge badge-state-draft">Draft</span>`;
    if (s === 'Needs Revision') return `<span class="badge badge-state-needs-revision">Needs Revision</span>`;
    if (s === 'Submitted for Review') return `<span class="badge badge-state-submitted">Submitted</span>`;
    if (s === 'Approved') return `<span class="badge badge-state-approved">Approved</span>`;
    if (s === 'Rejected') return `<span class="badge badge-state-rejected">Rejected</span>`;
    return `<span class="badge badge-low">${s}</span>`;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span>${type === 'error' ? '❌' : (type === 'success' ? '✅' : 'ℹ️')}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // --------------------------------------------------------------------------
  // Universal Source & Rule Navigation Modals
  // --------------------------------------------------------------------------
  cachedKnowledge: null,

  async ensureKnowledgeLoaded() {
    if (!this.cachedKnowledge) {
      this.cachedKnowledge = await api.getBrandKnowledge().catch(() => null);
    }
    return this.cachedKnowledge;
  },

  async openEvidenceSource(sourceId) {
    const k = await this.ensureKnowledgeLoaded();
    const source = k?.evidence_sources?.find(s => s.id === sourceId);
    if (!source) {
      this.showToast(`Evidence source ${sourceId} not found.`, 'warning');
      return;
    }

    const linkedClaims = (k?.claims || []).filter(c => c.evidence_source_id === source.id);

    this.showInspectorModal({
      title: `${source.id}: ${source.title}`,
      badge: `<span class="badge badge-state-approved">${escapeHtml(source.source_type)}</span>`,
      bodyHtml: `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-size: 0.75rem;">
          <span style="color: var(--text-subtle);">Published: <strong style="color: var(--text-main);">${source.publication_date}</strong></span>
          &bull;
          <span style="color: var(--text-subtle);">Provenance: <strong style="color: var(--accent-cyan);">${escapeHtml(source.provenance)}</strong></span>
          &bull;
          <span style="color: var(--text-subtle);">Verification: <strong style="color: var(--accent-emerald);">Synthetic Approved</strong></span>
        </div>

        <div>
          <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 6px;">
            Verified Document Excerpt
          </label>
          <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-cyan); border-radius: var(--radius-sm); padding: 14px; font-size: 0.875rem; color: var(--text-main); line-height: 1.6;">
            "${escapeHtml(source.excerpt)}"
          </div>
        </div>

        ${linkedClaims.length > 0 ? `
          <div style="margin-top: 14px;">
            <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 6px;">
              Substantiated Factual Claims (${linkedClaims.length})
            </label>
            <ul style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 16px 12px 28px; margin: 0; font-size: 0.8125rem; color: var(--text-main); line-height: 1.6;">
              ${linkedClaims.map(c => `<li>${escapeHtml(c.statement)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      `,
      actionsHtml: `
        <button class="btn btn-secondary" onclick="app.closeInspectorModal()">Close</button>
        <button class="btn btn-secondary" onclick="app.closeInspectorModal(); app.navigateTo('knowledge'); setTimeout(() => knowledgeView.showNodeDetail('${source.id}'), 200);" title="Fly to Evidence node in 3D Space">
          🌐 Explore in 3D Graph &rarr;
        </button>
        <button class="btn btn-primary" onclick="app.closeInspectorModal(); app.navigateTo('evidence'); setTimeout(() => app.runEvidenceSearch('${source.id}'), 200);">
          Search in Explorer &rarr;
        </button>
      `,
    });
  },

  async openRuleDetail(ruleId) {
    const k = await this.ensureKnowledgeLoaded();
    const rule = k?.rules?.find(r => r.id === ruleId);
    if (!rule) {
      this.showToast(`Rule ${ruleId} not found.`, 'warning');
      return;
    }

    const disclaimer = rule.disclaimer_id ? k?.disclaimers?.find(d => d.id === rule.disclaimer_id) : null;

    this.showInspectorModal({
      title: `${rule.id}: ${rule.title}`,
      badge: `<span class="badge badge-${rule.severity}">${rule.severity}</span>`,
      bodyHtml: `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-size: 0.75rem;">
          <span style="color: var(--text-subtle);">Category: <strong style="color: var(--text-main); text-transform: uppercase;">${rule.category}</strong></span>
          &bull;
          <span style="color: var(--text-subtle);">Status: <span class="badge ${rule.status === 'active' ? 'badge-state-approved' : 'badge-high'}">${rule.status}</span></span>
          &bull;
          <span style="color: var(--text-subtle);">Applies To: <strong style="color: var(--accent-cyan);">${escapeHtml(rule.applies_to_product_id || 'All Inkloom Products')}</strong></span>
        </div>

        <div>
          <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 6px;">
            Rule Specification
          </label>
          <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-primary); border-radius: var(--radius-sm); padding: 14px; font-size: 0.875rem; color: var(--text-main); line-height: 1.6;">
            ${escapeHtml(rule.description)}
          </div>
        </div>

        ${rule.superseded_by ? `
          <div style="margin-top: 10px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 0.8125rem; color: var(--accent-rose);">
            ⚠️ This rule has been <strong>superseded by ${rule.superseded_by}</strong>.
          </div>
        ` : ''}

        ${rule.conflicts_with ? `
          <div style="margin-top: 10px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 0.8125rem; color: var(--accent-amber);">
            ⚠️ This rule <strong>conflicts with ${rule.conflicts_with}</strong>.
          </div>
        ` : ''}

        ${disclaimer ? `
          <div style="margin-top: 14px;">
            <label style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-subtle); display: block; margin-bottom: 6px;">
              Mandatory Associated Disclaimer (${disclaimer.id})
            </label>
            <div style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.8125rem; color: var(--accent-primary); font-style: italic;">
              "${escapeHtml(disclaimer.required_text)}"
            </div>
          </div>
        ` : ''}
      `,
      actionsHtml: `
        <button class="btn btn-secondary" onclick="app.closeInspectorModal()">Close</button>
        <button class="btn btn-secondary" onclick="app.closeInspectorModal(); app.navigateTo('knowledge'); setTimeout(() => knowledgeView.showNodeDetail('${rule.id}'), 200);" title="Fly to Rule node in 3D Space">
          🌐 Explore in 3D Graph &rarr;
        </button>
        <button class="btn btn-primary" onclick="app.closeInspectorModal(); app.navigateTo('knowledge'); setTimeout(() => knowledgeView.switchSubTab('rules'), 200);">
          View All Rules &rarr;
        </button>
      `,
    });
  },

  showInspectorModal({ title, badge, bodyHtml, actionsHtml }) {
    this.closeInspectorModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'inspector-backdrop';
    backdrop.id = 'inspectorBackdrop';
    backdrop.onclick = (e) => {
      if (e.target === backdrop) app.closeInspectorModal();
    };

    backdrop.innerHTML = `
      <div class="inspector-modal">
        <div class="inspector-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h3 style="font-size: 1rem; font-weight: 700; margin: 0;">${escapeHtml(title)}</h3>
            ${badge || ''}
          </div>
          <button class="banner-close" onclick="app.closeInspectorModal()">&times;</button>
        </div>
        <div class="inspector-body">
          ${bodyHtml}
        </div>
        <div class="inspector-footer">
          ${actionsHtml || '<button class="btn btn-secondary" onclick="app.closeInspectorModal()">Close</button>'}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
  },

  closeInspectorModal() {
    const existing = document.getElementById('inspectorBackdrop');
    if (existing) existing.remove();
  },
};

// Global escape key listener to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    app.closeInspectorModal();
  }
});

// Boot application when DOM is ready (or immediately if already interactive/complete)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}
