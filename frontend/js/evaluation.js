/**
 * Brand Stress Tester Controller for BrandGraph AI
 */

const evaluationView = {
  currentSummary: null,

  async render(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading evaluation results...</p>
      </div>
    `;

    try {
      this.currentSummary = await api.getEvaluation();
      this.renderSuite(container, this.currentSummary);
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Failed to load stress tests</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="evaluationView.runLiveSuite()">
            Run Test Suite Now
          </button>
        </div>
      `;
    }
  },

  renderSuite(container, summary) {
    const s = summary || {};
    const total = s.total_tests || 0;
    const passed = s.passed_tests || 0;
    const failed = s.failed_tests || 0;
    const accuracy = s.accuracy_percentage !== undefined ? `${s.accuracy_percentage}%` : '0%';
    const execTime = s.execution_time_seconds || 0;
    const results = s.results || [];

    container.innerHTML = `
      <!-- Top Action Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800;">Curated Brand Stress Test Suite</h2>
          <div style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 2px;">
            10 synthetic test cases evaluating policy violations, supported grounding, contradictions, and offline fallbacks.
          </div>
        </div>
        <button class="btn btn-primary" id="btnRunEval" onclick="evaluationView.runLiveSuite()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Run Live Stress Test Suite</span>
        </button>
      </div>

      <!-- Metrics Row -->
      <div class="stat-grid" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-header"><span>Overall Accuracy</span></div>
          <div class="stat-value" style="color: var(--accent-cyan);">${accuracy}</div>
          <div class="stat-subtitle">${passed} / ${total} real test cases passed</div>
        </div>

        <div class="card stat-card">
          <div class="stat-header"><span>Passed Tests</span></div>
          <div class="stat-value" style="color: var(--accent-emerald);">${passed}</div>
          <div class="stat-subtitle">Expected outcomes matched</div>
        </div>

        <div class="card stat-card">
          <div class="stat-header"><span>Failed / Deviations</span></div>
          <div class="stat-value" style="color: ${failed > 0 ? 'var(--accent-rose)' : 'var(--text-subtle)'};">${failed}</div>
          <div class="stat-subtitle">${s.false_positives || 0} false pos &bull; ${s.false_negatives || 0} false neg</div>
        </div>

        <div class="card stat-card">
          <div class="stat-header"><span>Execution Latency</span></div>
          <div class="stat-value" style="font-size: 1.5rem; color: var(--text-main);">${execTime}s</div>
          <div class="stat-subtitle">Timestamp: ${s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : 'N/A'}</div>
        </div>
      </div>

      <!-- Test Cases Table -->
      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <h3 style="font-size: 1rem; font-weight: 700;">Synthetic Evaluation Scenarios</h3>
          <span class="badge badge-low">Real execution metrics &bull; No fabricated scores</span>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 80px;">Test ID</th>
              <th style="width: 170px;">Scenario Name</th>
              <th>Input Content Excerpt</th>
              <th>Expected vs Actual</th>
              <th style="width: 90px;">Status</th>
              <th>Evaluation Details</th>
              <th style="width: 100px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-primary);">${r.test_id}</td>
                <td>
                  <strong>${escapeHtml(r.name)}</strong>
                </td>
                <td style="font-size: 0.78rem; color: var(--text-muted); max-width: 250px; font-style: italic;">
                  ${this.getTestCaseInputPreview(r.test_id)}
                </td>
                <td style="font-size: 0.75rem;">
                  <div>
                    <strong style="color: var(--text-subtle);">Expected:</strong> ${r.expected_category || 'None'} 
                    ${r.expected_rule_or_evidence ? (
                      r.expected_rule_or_evidence.startsWith('RULE-')
                        ? `<span class="badge-clickable badge-rule-link" onclick="app.openRuleDetail('${r.expected_rule_or_evidence}')">(${r.expected_rule_or_evidence})</span>`
                        : `<span class="badge-clickable badge-source-link" onclick="app.openEvidenceSource('${r.expected_rule_or_evidence}')">(${r.expected_rule_or_evidence})</span>`
                    ) : ''}
                  </div>
                  <div><strong style="color: var(--accent-cyan);">Actual:</strong> ${r.actual_categories.length > 0 ? r.actual_categories.join(', ') : 'None'}</div>
                </td>
                <td>
                  <span class="badge ${r.passed ? 'badge-state-approved' : 'badge-state-rejected'}">
                    ${r.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted);">
                  ${escapeHtml(r.details || '')}
                  ${r.error_message ? `<div style="color: var(--accent-rose);">${escapeHtml(r.error_message)}</div>` : ''}
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="evaluationView.testInStudio('${r.test_id}')" title="Load prompt and test in Content Review">
                    Inspect &rarr;
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${results.length === 0 ? `
          <div class="empty-state" style="padding: 48px 16px;">
            <div class="empty-state-icon">⚡</div>
            <div class="empty-state-title">No Stress Tests Executed Yet</div>
            <div class="empty-state-desc">Run the curated 10-scenario stress benchmark to evaluate accuracy, offline resilience, and rule detection.</div>
            <button class="btn btn-primary" onclick="evaluationView.runLiveSuite()">Run Test Suite Now</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  async runLiveSuite() {
    const btn = document.getElementById('btnRunEval');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div> Running live test suite...`;
    }

    try {
      const summary = await api.runEvaluation();
      this.currentSummary = summary;
      this.renderSuite(document.getElementById('pageContainer'), summary);
      app.showToast(`Stress test suite complete! Accuracy: ${summary.accuracy_percentage}%`, 'success');
    } catch (e) {
      app.showToast(e.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Run Live Stress Test Suite</span>
        `;
      }
    }
  },

  getTestCaseInputPreview(testId) {
    const map = {
      'STRESS-01': '"Our platform is guaranteed to be 100% bug-free and completely hack-proof..."',
      'STRESS-02': '"Get started today with Inkloom Bot to automate your team\'s compliance..."',
      'STRESS-03': '"Inkloom Sentinel scans enterprise code with under 45ms latency..."',
      'STRESS-04': '"Inkloom Copilot provides human-in-the-loop governance... Performance figures depend..."',
      'STRESS-05': '"Inkloom Cloud encrypts data using TLS 1.3 in transit and AES-256 at rest..."',
      'STRESS-06': '"Inkloom Sentinel guarantees zero false alarms and complete elimination of false positives."',
      'STRESS-07': '"Inkloom Sentinel increases developer cognitive IQ by 47 points within two weeks..."',
      'STRESS-08': '"Deploy the Inkloom Suite for marketing, or switch to Inkloom Assistant for legacy support."',
      'STRESS-09': '"(Whitespace only input)"',
      'STRESS-10': '"Inkloom Bot claims to be 100% bug-free with instantaneous execution (Offline test)"',
    };
    return map[testId] || 'Synthetic prompt input';
  },

  testInStudio(testId) {
    const inputs = {
      'STRESS-01': {
        title: 'STRESS-01: Prohibited Phrase Test',
        content: 'Our platform is guaranteed to be 100% bug-free and completely hack-proof across all environments.',
      },
      'STRESS-02': {
        title: 'STRESS-02: Unapproved Product Alias',
        content: 'Get started today with Inkloom Bot to automate your team\'s compliance review workflows.',
      },
      'STRESS-03': {
        title: 'STRESS-03: Missing Mandatory Disclaimer',
        content: 'Inkloom Sentinel scans enterprise code with under 45ms latency and ultra-fast throughput.',
      },
      'STRESS-04': {
        title: 'STRESS-04: Fully Compliant Content',
        content: 'Inkloom Copilot provides human-in-the-loop governance for enterprise AI workflows. Performance figures depend on workload characteristics, configuration, and cluster capacity. Individual outcomes may vary.',
      },
      'STRESS-05': {
        title: 'STRESS-05: Supported Claim by Synthetic Evidence',
        content: 'Inkloom Cloud encrypts data using TLS 1.3 in transit and AES-256 at rest across all tiers.',
      },
      'STRESS-06': {
        title: 'STRESS-06: Claim Contradicted by Synthetic Evidence',
        content: 'Inkloom Sentinel guarantees zero false alarms and complete elimination of false positives.',
      },
      'STRESS-07': {
        title: 'STRESS-07: Unsupported Claim (Needs Verification)',
        content: 'Inkloom Sentinel increases developer cognitive IQ by 47 points within two weeks of deployment.',
      },
      'STRESS-08': {
        title: 'STRESS-08: Conflicting & Superseded Rules',
        content: 'Deploy the Inkloom Suite for marketing, or switch to Inkloom Assistant for legacy support.',
      },
      'STRESS-09': {
        title: 'STRESS-09: Empty Content Handling',
        content: '   ',
      },
      'STRESS-10': {
        title: 'STRESS-10: Offline / Local Resilience',
        content: 'Inkloom Bot claims to be 100% bug-free with instantaneous execution.',
      },
    };
    const tc = inputs[testId];
    if (tc) {
      reviewView.currentDraft = {
        id: null,
        title: tc.title,
        author: 'Stress Suite Tester',
        product_id: 'PROD-COPILOT',
        content: tc.content,
        findings: [],
      };
      app.navigateTo('review');
      setTimeout(() => reviewView.submitReview(), 150);
    }
  },
};
