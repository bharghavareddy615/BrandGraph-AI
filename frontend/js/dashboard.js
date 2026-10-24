/**
 * Dashboard View Controller for BrandGraph AI
 */

const dashboardView = {
  async render(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading real-time governance metrics...</p>
      </div>
    `;

    try {
      const data = await api.getDashboard();
      const evalData = await api.getEvaluation().catch(() => null);

      const metrics = data.metrics || {};
      const totalDrafts = metrics.total_drafts || 0;
      const stateCounts = metrics.state_counts || {};
      const categoryCounts = metrics.category_counts || {};
      const severityCounts = metrics.severity_counts || {};
      const recentDrafts = data.recent_drafts || [];

      // Calculate total active issues
      const totalIssues = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
      const accuracyPct = evalData?.accuracy_percentage !== undefined ? `${evalData.accuracy_percentage}%` : 'Pending';

      container.innerHTML = `
        <!-- Top Stats Row -->
        <div class="stat-grid">
          <div class="card stat-card" style="cursor: pointer; transition: transform var(--transition-fast), border-color var(--transition-fast);" onclick="app.navigateTo('workflow')" title="View all drafts in Workflow">
            <div class="stat-header">
              <span>Total Drafts</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
            <div class="stat-value">${totalDrafts}</div>
            <div class="stat-subtitle">${stateCounts['Approved'] || 0} approved &bull; ${stateCounts['Submitted for Review'] || 0} in review &bull; ${stateCounts['Needs Revision'] || 0} revisions</div>
          </div>

          <div class="card stat-card" style="cursor: pointer; transition: transform var(--transition-fast), border-color var(--transition-fast);" onclick="workflowView.setFilter('Needs Revision'); app.navigateTo('workflow')" title="Inspect active policy issues">
            <div class="stat-header">
              <span>Active Issues</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="stat-value" style="color: ${totalIssues > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">${totalIssues}</div>
            <div class="stat-subtitle">${severityCounts['critical'] || 0} critical &bull; ${severityCounts['high'] || 0} high priority</div>
          </div>

          <div class="card stat-card" style="cursor: pointer; transition: transform var(--transition-fast), border-color var(--transition-fast);" onclick="app.navigateTo('evaluation')" title="View live Stress Tester results">
            <div class="stat-header">
              <span>Stress Test Accuracy</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div class="stat-value" style="color: var(--accent-cyan);">${accuracyPct}</div>
            <div class="stat-subtitle">${evalData?.passed_tests || 0} passed / ${evalData?.total_tests || 0} real synthetic tests</div>
          </div>

          <div class="card stat-card" style="cursor: pointer; transition: transform var(--transition-fast), border-color var(--transition-fast);" onclick="app.navigateTo('settings')" title="View Responsible AI Disclosures">
            <div class="stat-header">
              <span>AI Engine Mode</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div class="stat-value" style="font-size: 1.35rem; color: var(--accent-primary);">Local &amp; RAG</div>
            <div class="stat-subtitle">Zero data leakage &bull; Fully explainable</div>
          </div>
        </div>

        <!-- Middle 2-Column Analytics Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
          <!-- Issues by Category -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <span>Violations by Category</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Live stored findings</span>
            </h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${this.renderCategoryBars(categoryCounts)}
            </div>
          </div>

          <!-- Review Status Breakdown -->
          <div class="card">
            <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
              <span>Workflow States</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Human-in-the-loop</span>
            </h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${this.renderStateBars(stateCounts, totalDrafts)}
            </div>
          </div>
        </div>

        <!-- Recent Drafts Table -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <h3 style="font-size: 1rem; font-weight: 700;">Recent Content Drafts</h3>
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
                    <td><strong>${escapeHtml(d.title || 'Untitled Draft')}</strong><br><span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${d.id}</span></td>
                    <td>${escapeHtml(d.author || 'Content Creator')}</td>
                    <td>${app.renderStateBadge(d.current_state)}</td>
                    <td>v${d.version || 1}</td>
                    <td>
                      <span class="badge ${d.finding_count > 0 ? 'badge-critical' : 'badge-low'}">
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

  renderCategoryBars(counts) {
    const categories = [
      { key: 'prohibited_term', label: 'Prohibited Phrases', color: 'var(--accent-rose)' },
      { key: 'unapproved_name', label: 'Unapproved Product Names', color: 'var(--accent-amber)' },
      { key: 'missing_disclaimer', label: 'Missing Mandatory Disclaimers', color: 'var(--accent-blue)' },
      { key: 'contradicted_claim', label: 'Contradicted Factual Claims', color: '#EC4899' },
      { key: 'unsupported_claim', label: 'Unsupported Claims (Needs Verification)', color: '#F59E0B' },
      { key: 'tone_voice', label: 'Tone & Voice Deviations', color: 'var(--accent-primary)' },
      { key: 'rule_conflict', label: 'Rule Conflicts & Superseded', color: '#EAB308' },
    ];

    const maxCount = Math.max(...Object.values(counts), 1);

    return categories.map(cat => {
      const val = counts[cat.key] || 0;
      const pct = Math.round((val / maxCount) * 100);
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 4px;">
            <span>${cat.label}</span>
            <span style="font-weight: 700;">${val}</span>
          </div>
          <div style="height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${cat.color}; border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderStateBars(counts, total) {
    const states = [
      { key: 'Draft', color: '#94A3B8' },
      { key: 'Needs Revision', color: 'var(--accent-rose)' },
      { key: 'Submitted for Review', color: 'var(--accent-primary)' },
      { key: 'Approved', color: 'var(--accent-emerald)' },
      { key: 'Rejected', color: 'var(--accent-amber)' },
    ];

    const denom = Math.max(total, 1);

    return states.map(st => {
      const val = counts[st.key] || 0;
      const pct = Math.round((val / denom) * 100);
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; margin-bottom: 4px;">
            <span>${st.key}</span>
            <span style="font-weight: 700;">${val} (${pct}%)</span>
          </div>
          <div style="height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${st.color}; border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  },
};
