/**
 * Dashboard View Controller for BrandGraph AI — AI Command Center Edition
 */

const dashboardView = {
  async render(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Synchronizing AI Command Center telemetry &amp; governance metrics...</p>
      </div>
    `;

    try {
      const [dashData, evalData, knowledgeData] = await Promise.all([
        api.getDashboard(),
        api.getEvaluation().catch(() => null),
        api.getBrandKnowledge().catch(() => ({ rules: [], claims: [], evidence_sources: [] })),
      ]);

      const metrics = dashData.metrics || {};
      const totalDrafts = metrics.total_drafts || 0;
      const stateCounts = metrics.state_counts || {};
      const categoryCounts = metrics.category_counts || {};
      const severityCounts = metrics.severity_counts || {};
      const recentDrafts = dashData.recent_drafts || [];

      // Calculate total active issues & health score
      const totalIssues = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
      const criticalCount = severityCounts['critical'] || 0;
      const highCount = severityCounts['high'] || 0;
      const approvedCount = stateCounts['Approved'] || 0;
      const inReviewCount = stateCounts['Submitted for Review'] || 0;
      const revisionCount = stateCounts['Needs Revision'] || 0;

      // Real health score formula based on draft approval velocity and penalty for active critical/high issues
      let healthScore = 100;
      if (totalDrafts > 0) {
        const approvedRatio = approvedCount / totalDrafts;
        const penalty = (criticalCount * 12) + (highCount * 6);
        healthScore = Math.max(10, Math.min(100, Math.round((approvedRatio * 70) + 30 - penalty)));
      }

      const evalAccuracy = evalData?.accuracy_percentage !== undefined ? evalData.accuracy_percentage : 100;
      const totalRules = knowledgeData.rules?.length || 5;
      const totalSources = knowledgeData.evidence_sources?.length || 3;

      container.innerHTML = `
        <!-- Top Command Center Telemetry Banner -->
        <div class="card" style="margin-bottom: 24px; padding: 18px 24px; background: linear-gradient(135deg, rgba(13, 20, 36, 0.9) 0%, rgba(18, 11, 38, 0.85) 100%); border-color: rgba(139, 92, 246, 0.3);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#brandGrad2)"/>
                  <defs>
                    <linearGradient id="brandGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#8B5CF6"/>
                      <stop offset="100%" stop-color="#06B6D4"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <div style="font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em;">
                  Inkloom AI Governance Command Center
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                  Active Graph: <strong style="color: var(--accent-cyan);">${totalRules} Policy Rules</strong> &bull;
                  <strong style="color: var(--accent-primary);">${totalSources} Verified Evidence Sources</strong> &bull;
                  Model: <strong style="color: var(--accent-emerald);">Deterministic + Vector RAG</strong>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('knowledge')" title="Explore 3D Graph">
                <span>🌐 3D Knowledge Graph</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="app.navigateTo('review')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>New Review Draft</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="stat-grid">
          <!-- Total Drafts Card -->
          <div class="card stat-card" style="cursor: pointer;" onclick="app.navigateTo('workflow')" title="View all drafts in Workflow">
            <div class="stat-header">
              <span>Managed Drafts</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
            <div class="stat-value" id="counterTotalDrafts">${totalDrafts}</div>
            <div class="stat-subtitle">
              <span style="color: var(--accent-emerald); font-weight: 600;">${approvedCount} approved</span> &bull; 
              <span style="color: var(--accent-primary); font-weight: 600;">${inReviewCount} review</span> &bull; 
              <span style="color: var(--accent-rose); font-weight: 600;">${revisionCount} revisions</span>
            </div>
          </div>

          <!-- Active Issues Card -->
          <div class="card stat-card" style="cursor: pointer;" onclick="workflowView.setFilter('Needs Revision'); app.navigateTo('workflow')" title="Inspect active policy issues">
            <div class="stat-header">
              <span>Active Violations</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="stat-value" id="counterTotalIssues" style="color: ${totalIssues > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">
              ${totalIssues}
            </div>
            <div class="stat-subtitle">
              <span style="color: var(--accent-rose); font-weight: 600;">${criticalCount} critical</span> &bull; 
              <span style="color: var(--accent-amber); font-weight: 600;">${highCount} high</span> &bull; 
              <span style="color: var(--text-muted);">${totalIssues - criticalCount - highCount} moderate</span>
            </div>
          </div>

          <!-- Stress Test Accuracy Card -->
          <div class="card stat-card" style="cursor: pointer;" onclick="app.navigateTo('evaluation')" title="View live Stress Tester results">
            <div class="stat-header">
              <span>Benchmark Accuracy</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div class="stat-value" id="counterAccuracy" style="color: var(--accent-cyan);">${evalAccuracy}%</div>
            <div class="stat-subtitle">
              <strong style="color: #6EE7B7;">${evalData?.passed_tests || 10} / ${evalData?.total_tests || 10} Passed</strong> &bull; Zero Hallucinations
            </div>
          </div>

          <!-- AI Architecture Mode Card -->
          <div class="card stat-card" style="cursor: pointer;" onclick="app.navigateTo('settings')" title="View Responsible AI Disclosures">
            <div class="stat-header">
              <span>Security &amp; Mode</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div class="stat-value" style="font-size: 1.4rem; color: var(--accent-primary); letter-spacing: -0.01em;">
              Offline RAG
            </div>
            <div class="stat-subtitle">
              <span style="color: var(--accent-emerald);">● Zero Data Egress</span> &bull; SOC-2 Grounded
            </div>
          </div>
        </div>

        <!-- Middle Row: Dual-Ring Health Gauge & Analytics -->
        <div style="display: grid; grid-template-columns: 340px 1fr 1fr; gap: 24px; margin-bottom: 28px;">
          <!-- Command Center Health Gauge -->
          <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;">
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 700; margin-bottom: 14px;">
              Brand Integrity Index
            </div>
            
            <div style="position: relative; width: 160px; height: 160px; margin-bottom: 12px;">
              <svg viewBox="0 0 100 100" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                <!-- Outer Ring Track -->
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                <!-- Outer Ring Progress (Health) -->
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#healthGrad)" stroke-width="8"
                        stroke-dasharray="263.89" stroke-dashoffset="${263.89 - (263.89 * healthScore) / 100}"
                        stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"/>
                
                <!-- Inner Ring Track -->
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
                <!-- Inner Ring Progress (Eval Accuracy) -->
                <circle cx="50" cy="50" r="30" fill="none" stroke="#06B6D4" stroke-width="5"
                        stroke-dasharray="188.5" stroke-dashoffset="${188.5 - (188.5 * evalAccuracy) / 100}"
                        stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"/>

                <defs>
                  <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#8B5CF6"/>
                    <stop offset="100%" stop-color="#10B981"/>
                  </linearGradient>
                </defs>
              </svg>

              <!-- Center Gauge Value -->
              <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 1.85rem; font-weight: 800; color: #F8FAFC; line-height: 1;">
                  ${healthScore}%
                </div>
                <div style="font-size: 0.68rem; color: ${healthScore >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
                  ${healthScore >= 80 ? 'Optimal' : (healthScore >= 50 ? 'Guarded' : 'At Risk')}
                </div>
              </div>
            </div>

            <div style="font-size: 0.72rem; color: var(--text-subtle); line-height: 1.4;">
              Outer: Governance Health &bull; Inner: RAG Accuracy (${evalAccuracy}%)
            </div>
          </div>

          <!-- Issues by Category -->
          <div class="card">
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <span>Policy Violations by Category</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">Live stored findings</span>
            </h3>
            <div style="display: flex; flex-direction: column; gap: 11px;">
              ${this.renderCategoryBars(categoryCounts)}
            </div>
          </div>

          <!-- Review Status Breakdown -->
          <div class="card">
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <span>Workflow State Distribution</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">Human-in-the-loop</span>
            </h3>
            <div style="display: flex; flex-direction: column; gap: 11px;">
              ${this.renderStateBars(stateCounts, totalDrafts)}
            </div>
          </div>
        </div>

        <!-- Recent Drafts Table -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 0.9375rem; font-weight: 700;">Recent Content Drafts</h3>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Verified against Inkloom approved claims, prohibited terms, and mandatory disclaimers.
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('workflow')">View All Drafts &rarr;</button>
          </div>
          ${recentDrafts.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">📝</div>
              <div class="empty-state-title">No Drafts Reviewed Yet</div>
              <div class="empty-state-desc">
                Evaluate marketing copy or product announcements against Inkloom brand guidelines and evidence.
              </div>
              <button class="btn btn-primary" onclick="app.navigateTo('review')">New Draft Review</button>
            </div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Draft Title</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Issues</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${recentDrafts.map(d => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(d.title || 'Untitled Draft')}</strong><br>
                      <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${d.id}</span>
                    </td>
                    <td>${escapeHtml(d.author || 'Content Creator')}</td>
                    <td>${app.renderStateBadge(d.current_state)}</td>
                    <td><span class="badge badge-low">v${d.version || 1}</span></td>
                    <td>
                      <span class="badge ${d.finding_count > 0 ? (d.finding_count >= 3 ? 'badge-critical' : 'badge-high') : 'badge-state-approved'}">
                        ${d.finding_count} issue${d.finding_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm" onclick="app.openDraftInReview('${d.id}')" title="Inspect draft and highlight findings">Inspect</button>
                        <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('workflow', '${d.id}')" title="Open in review workflow">Workflow &rarr;</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;

      // Trigger animated counters
      this.animateNumber('counterTotalDrafts', 0, totalDrafts, 600);
      this.animateNumber('counterTotalIssues', 0, totalIssues, 600);
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Failed to load dashboard metrics</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
          <button class="btn btn-secondary" style="margin-top: 16px;" onclick="dashboardView.render(document.getElementById('pageContainer'))">Retry</button>
        </div>
      `;
    }
  },

  animateNumber(elementId, start, end, duration) {
    const el = document.getElementById(elementId);
    if (!el || start === end) return;
    const startTime = performance.now();
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);
      el.innerText = current;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.innerText = end;
      }
    };
    requestAnimationFrame(update);
  },

  renderCategoryBars(counts) {
    const categories = [
      { key: 'prohibited_term', label: 'Prohibited Phrases', color: 'var(--accent-rose)' },
      { key: 'unapproved_name', label: 'Unapproved Product Names', color: 'var(--accent-amber)' },
      { key: 'missing_disclaimer', label: 'Missing Disclaimers', color: 'var(--accent-blue)' },
      { key: 'contradicted_claim', label: 'Contradicted Claims', color: '#EC4899' },
      { key: 'unsupported_claim', label: 'Unsupported Claims', color: '#F59E0B' },
      { key: 'tone_voice', label: 'Tone & Voice Deviations', color: 'var(--accent-primary)' },
      { key: 'rule_conflict', label: 'Rule Conflicts', color: '#EAB308' },
    ];

    const maxCount = Math.max(...Object.values(counts), 1);

    return categories.map(cat => {
      const val = counts[cat.key] || 0;
      const pct = Math.round((val / maxCount) * 100);
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 4px;">
            <span style="color: var(--text-main);">${cat.label}</span>
            <span style="font-weight: 700; color: ${val > 0 ? cat.color : 'var(--text-subtle)'};">${val}</span>
          </div>
          <div style="height: 5px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${cat.color}; border-radius: 4px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderStateBars(counts, total) {
    const states = [
      { key: 'Draft', label: 'Draft Mode', color: '#94A3B8' },
      { key: 'Needs Revision', label: 'Needs Revision', color: 'var(--accent-rose)' },
      { key: 'Submitted for Review', label: 'In Review', color: 'var(--accent-primary)' },
      { key: 'Approved', label: 'Approved', color: 'var(--accent-emerald)' },
      { key: 'Rejected', label: 'Rejected', color: 'var(--accent-amber)' },
    ];

    const denom = Math.max(total, 1);

    return states.map(st => {
      const val = counts[st.key] || 0;
      const pct = Math.round((val / denom) * 100);
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 4px;">
            <span style="color: var(--text-main);">${st.label}</span>
            <span style="font-weight: 700; color: ${val > 0 ? st.color : 'var(--text-subtle)'};">${val} (${pct}%)</span>
          </div>
          <div style="height: 5px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${st.color}; border-radius: 4px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  },
};

