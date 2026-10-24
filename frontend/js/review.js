/**
 * Content Review Controller for BrandGraph AI
 * Enhanced with Brand Compliance Health Score & Interactive Inline Highlights
 */

const reviewView = {
  currentDraft: null,
  viewMode: 'editor', // 'editor' | 'annotated'

  async render(container, draftId = null) {
    if (draftId) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading draft ${draftId}...</p>
        </div>
      `;
      try {
        this.currentDraft = await api.getDraft(draftId);
      } catch (e) {
        app.showToast('Could not load draft', 'error');
        this.currentDraft = null;
      }
    }

    const draft = this.currentDraft || {
      id: null,
      title: 'Q1 AI Assistant Announcement',
      author: 'Marketing Team',
      product_id: 'PROD-COPILOT',
      content: '',
      findings: [],
    };

    const health = this.calculateComplianceScore(draft.findings);

    container.innerHTML = `
      <!-- Brand Compliance Health Score Widget -->
      <div class="compliance-score-card" id="complianceScoreCard">
        <div class="score-gauge-wrapper">
          <svg class="score-circle-svg" viewBox="0 0 72 72">
            <circle class="score-circle-bg" cx="36" cy="36" r="28" />
            <circle class="score-circle-progress" id="scoreProgressCircle" cx="36" cy="36" r="28" 
                    stroke="${health.color}"
                    stroke-dasharray="175.9"
                    stroke-dashoffset="${175.9 - (175.9 * health.score) / 100}" />
          </svg>
          <div>
            <div class="score-number" style="color: ${health.color};" id="scoreNumber">${health.score}%</div>
            <div class="score-label" style="color: ${health.color};">${health.status}</div>
            <div class="score-desc">${health.description}</div>
          </div>
        </div>

        <div class="score-breakdown-pills">
          <div class="score-pill-item">
            <span>Critical Violations</span>
            <strong style="color: ${health.criticalCount > 0 ? 'var(--accent-rose)' : 'var(--text-main)'};">${health.criticalCount}</strong>
          </div>
          <div class="score-pill-item">
            <span>High Severity</span>
            <strong style="color: ${health.highCount > 0 ? 'var(--accent-amber)' : 'var(--text-main)'};">${health.highCount}</strong>
          </div>
          <div class="score-pill-item">
            <span>Missing Disclaimers</span>
            <strong style="color: ${health.disclaimerCount > 0 ? 'var(--accent-blue)' : 'var(--text-main)'};">${health.disclaimerCount}</strong>
          </div>
          <div class="score-pill-item">
            <span>Active Issues</span>
            <strong>${health.activeCount}</strong>
          </div>
        </div>
      </div>

      <div class="review-layout">
        <!-- Left Column: Draft Editor & Annotated Visualizer -->
        <div class="card editor-card">
          <div class="editor-header">
            <div style="flex: 1; margin-right: 12px;">
              <input type="text" id="draftTitle" value="${escapeHtml(draft.title)}" 
                     style="background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 1.05rem; font-weight: 700; color: var(--text-main); outline: none; width: 100%; padding: 8px 12px; transition: border-color 0.15s ease;"
                     placeholder="Enter Draft Title..."
                     onfocus="this.style.borderColor='var(--accent-primary)'"
                     onblur="this.style.borderColor='var(--border-color)'">
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                Product: <strong style="color: var(--accent-cyan);">Inkloom Copilot</strong> &bull; Author: ${draft.author}
                ${draft.id ? `&bull; Draft ID: <span style="font-family: var(--font-mono);">${draft.id}</span>` : ''}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <!-- View Mode Toggle -->
              <div class="view-mode-tabs">
                <button class="view-mode-btn ${this.viewMode === 'editor' ? 'active' : ''}" id="btnModeEditor" onclick="reviewView.switchViewMode('editor')">
                  ✏️ Edit
                </button>
                <button class="view-mode-btn ${this.viewMode === 'annotated' ? 'active' : ''}" id="btnModeAnnotated" onclick="reviewView.switchViewMode('annotated')">
                  🔍 Highlights (${health.activeCount})
                </button>
              </div>
              ${draft.id ? app.renderStateBadge(draft.current_state) : '<span class="badge badge-low">Unsaved</span>'}
            </div>
          </div>

          <!-- Quick Test Presets -->
          <div style="margin: 8px 0 12px 0;">
            <div style="font-size: 0.72rem; color: var(--text-subtle); text-transform: uppercase; margin-bottom: 6px;">Curated Test Presets:</div>
            <div class="preset-pills">
              <button class="pill-preset" onclick="reviewView.loadPreset('violations')">⚠️ Multiple Violations</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('disclaimer')">⏱️ Missing Disclaimer</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('contradiction')">❌ Contradicted Claim</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('unsupported')">🔍 Unsupported Claim</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('compliant')">✅ 100% Compliant</button>
            </div>
          </div>

          <!-- Main Input / Visualizer Area -->
          <div id="editorAreaContainer">
            ${this.renderEditorOrAnnotated(draft)}
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
            <div style="font-size: 0.75rem; color: var(--text-muted);" id="charCount">
              ${draft.content.length} characters &bull; ${draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" onclick="reviewView.clearEditor()">Clear</button>
              <button class="btn btn-secondary" id="btnSubmitWorkflow" onclick="reviewView.submitToWorkflow()" style="${draft.id ? '' : 'display: none;'}">
                <span>Submit to Workflow &rarr;</span>
              </button>
              <button class="btn btn-primary" id="btnRunReview" onclick="reviewView.submitReview()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Check Brand Compliance</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Evidence & Findings -->
        <div class="card" style="display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700;">Governance Findings</h3>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Grounding in deterministic rules, graph paths, and approved sources.
              </div>
            </div>
            <div id="findingsBadgeContainer">
              ${this.renderFindingsSummaryBadge(draft.findings)}
            </div>
          </div>

          <div class="findings-list" id="findingsList">
            ${this.renderFindingsList(draft.findings, draft.id)}
          </div>
        </div>
      </div>
    `;

    this.bindEditorEvents();
  },

  calculateComplianceScore(findings) {
    const active = (findings || []).filter(f => !f.dismissed);
    if (active.length === 0) {
      return {
        score: 100,
        status: '100% Brand Compliant',
        description: 'Zero policy violations detected. Content is verified.',
        color: '#10B981', // Emerald
        criticalCount: 0,
        highCount: 0,
        disclaimerCount: 0,
        activeCount: 0,
      };
    }

    let deductions = 0;
    let criticalCount = 0;
    let highCount = 0;
    let disclaimerCount = 0;

    active.forEach(f => {
      if (f.severity === 'critical') {
        deductions += 25;
        criticalCount++;
      } else if (f.severity === 'high') {
        deductions += 15;
        highCount++;
      } else if (f.category === 'missing_disclaimer') {
        deductions += 12;
        disclaimerCount++;
      } else if (f.severity === 'medium') {
        deductions += 10;
      } else {
        deductions += 5;
      }
    });

    const finalScore = Math.max(10, Math.min(100, 100 - deductions));

    let status = 'Brand Health Warning';
    let color = '#F59E0B'; // Amber
    let desc = 'Policy violations detected. Review suggested corrections below.';

    if (finalScore >= 90) {
      status = 'Excellent Brand Compliance';
      color = '#10B981';
      desc = 'Minor remarks only. Suitable for human sign-off.';
    } else if (finalScore >= 70) {
      status = 'Moderate Compliance Risk';
      color = '#06B6D4';
      desc = 'Required disclaimers or naming adjustments needed.';
    } else if (finalScore < 45 || criticalCount > 0) {
      status = 'Critical Brand Policy Risk';
      color = '#F43F5E'; // Rose
      desc = 'Prohibited phrases or contradicted claims must be resolved.';
    }

    return {
      score: finalScore,
      status,
      description: desc,
      color,
      criticalCount,
      highCount,
      disclaimerCount,
      activeCount: active.length,
    };
  },

  renderEditorOrAnnotated(draft) {
    if (this.viewMode === 'annotated' && draft.findings && draft.findings.length > 0) {
      let annotated = escapeHtml(draft.content || '');
      const active = draft.findings.filter(f => !f.dismissed);

      // Sort findings by length of matched_text descending to avoid partial inner-tag replacements
      const sorted = [...active].sort((a, b) => b.matched_text.length - a.matched_text.length);

      sorted.forEach(f => {
        if (!f.matched_text) return;
        const escapedMatch = escapeHtml(f.matched_text);
        const tag = f.rule_id || f.category.replace('_', ' ');
        const replacement = `<span class="inline-highlight highlight-${f.severity}" onclick="reviewView.scrollToFinding('${f.id}')" title="${escapeHtml(f.explanation)}">${escapedMatch}<span class="highlight-tag">${tag}</span></span>`;
        // Replace first instance safely
        annotated = annotated.replace(escapedMatch, replacement);
      });

      return `
        <div class="annotated-box" id="annotatedBox">${annotated}</div>
      `;
    }

    return `
      <textarea id="draftContent" class="draft-textarea" placeholder="Paste or type marketing copy, product descriptions, or campaign text here...">${escapeHtml(draft.content)}</textarea>
    `;
  },

  switchViewMode(mode) {
    // Preserve textarea value into draft if switching from editor
    if (this.viewMode === 'editor') {
      const textarea = document.getElementById('draftContent');
      if (textarea && this.currentDraft) {
        this.currentDraft.content = textarea.value;
      }
    }

    this.viewMode = mode;
    const btnEdit = document.getElementById('btnModeEditor');
    const btnAnno = document.getElementById('btnModeAnnotated');
    const container = document.getElementById('editorAreaContainer');

    if (btnEdit && btnAnno) {
      btnEdit.classList.toggle('active', mode === 'editor');
      btnAnno.classList.toggle('active', mode === 'annotated');
    }

    if (container) {
      container.innerHTML = this.renderEditorOrAnnotated(this.currentDraft || { content: '', findings: [] });
      this.bindEditorEvents();
    }
  },

  scrollToFinding(findingId) {
    const el = document.getElementById(`card-${findingId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.boxShadow = '0 0 15px var(--accent-primary)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1800);
    }
  },

  bindEditorEvents() {
    const textarea = document.getElementById('draftContent');
    if (textarea) {
      textarea.addEventListener('input', () => {
        const text = textarea.value;
        const countEl = document.getElementById('charCount');
        if (countEl) {
          countEl.innerHTML = `${text.length} characters &bull; ${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
        }
      });
    }
  },

  loadPreset(type) {
    const titleInput = document.getElementById('draftTitle');
    let title = '';
    let content = '';

    if (type === 'violations') {
      title = 'Product Launch: Next-Gen Copilot';
      content = 'Get started with Inkloom Bot today! Our software is 100% bug-free, completely hack-proof, and achieves under 5ms latency with zero false alarms across all workloads.';
    } else if (type === 'disclaimer') {
      title = 'Sentinel Performance Benchmarks';
      content = 'Inkloom Sentinel scans enterprise repositories with an observed latency of under 45ms per 1,000 lines under standard load.';
    } else if (type === 'contradiction') {
      title = 'Accuracy & Verification Guarantee';
      content = 'Inkloom Sentinel guarantees zero false alarms and complete elimination of false positives for all enterprise deployments.';
    } else if (type === 'unsupported') {
      title = 'Cognitive Impact Benchmark Study';
      content = 'Inkloom Sentinel increases developer cognitive IQ by 47 points within two weeks of deployment.';
    } else if (type === 'compliant') {
      title = 'Enterprise Governance Announcement';
      content = 'Inkloom Copilot provides human-in-the-loop governance for enterprise AI workflows. Performance figures depend on workload characteristics, configuration, and cluster capacity. Individual outcomes may vary.';
    }

    if (titleInput) titleInput.value = title;

    if (!this.currentDraft) {
      this.currentDraft = { title, content, findings: [] };
    } else {
      this.currentDraft.title = title;
      this.currentDraft.content = content;
    }

    // Force back to editor mode when loading preset
    this.viewMode = 'editor';
    const container = document.getElementById('editorAreaContainer');
    if (container) {
      container.innerHTML = this.renderEditorOrAnnotated(this.currentDraft);
      this.bindEditorEvents();
    }

    const textarea = document.getElementById('draftContent');
    if (textarea) {
      textarea.value = content;
      textarea.dispatchEvent(new Event('input'));
    }

    app.showToast(`Loaded "${type}" test sample into editor`, 'info');
  },

  clearEditor() {
    const textarea = document.getElementById('draftContent');
    if (textarea) {
      textarea.value = '';
      textarea.dispatchEvent(new Event('input'));
    }
    if (this.currentDraft) {
      this.currentDraft.content = '';
      this.currentDraft.findings = [];
    }

    const container = document.getElementById('editorAreaContainer');
    if (container) {
      container.innerHTML = this.renderEditorOrAnnotated({ content: '', findings: [] });
      this.bindEditorEvents();
    }

    const findingsList = document.getElementById('findingsList');
    if (findingsList) {
      findingsList.innerHTML = `
        <div class="loading-state" style="padding: 40px 0;">
          <p>Editor cleared. Click <strong>"Check Brand Compliance"</strong> to review content.</p>
        </div>
      `;
    }

    this.updateScoreWidget([]);
  },

  async submitReview() {
    const title = document.getElementById('draftTitle')?.value.trim() || 'Untitled Draft';
    let content = '';

    const textarea = document.getElementById('draftContent');
    if (textarea) {
      content = textarea.value.trim();
    } else if (this.currentDraft) {
      content = this.currentDraft.content.trim();
    }

    const btn = document.getElementById('btnRunReview');

    if (!content) {
      app.showToast('Please enter content to review.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div> Checking...`;
    }

    try {
      const draft = await api.reviewContent({
        content,
        title,
        author: 'Content Creator',
        product_id: 'PROD-COPILOT',
        draft_id: this.currentDraft?.id || null,
      });

      this.currentDraft = draft;

      // Update Health Score Card
      this.updateScoreWidget(draft.findings);

      // Automatically switch to annotated highlights if findings exist
      if (draft.findings.length > 0) {
        this.viewMode = 'annotated';
      } else {
        this.viewMode = 'editor';
      }

      // Re-render editor/highlights container
      const container = document.getElementById('editorAreaContainer');
      if (container) {
        container.innerHTML = this.renderEditorOrAnnotated(draft);
        this.bindEditorEvents();
      }

      // Update mode switcher buttons
      const btnEdit = document.getElementById('btnModeEditor');
      const btnAnno = document.getElementById('btnModeAnnotated');
      if (btnEdit && btnAnno) {
        btnEdit.classList.toggle('active', this.viewMode === 'editor');
        btnAnno.classList.toggle('active', this.viewMode === 'annotated');
        btnAnno.innerText = `🔍 Highlights (${draft.findings.filter(f => !f.dismissed).length})`;
      }

      // Update right column findings
      const findingsList = document.getElementById('findingsList');
      const badgeContainer = document.getElementById('findingsBadgeContainer');

      if (badgeContainer) {
        badgeContainer.innerHTML = this.renderFindingsSummaryBadge(draft.findings);
      }
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(draft.findings, draft.id);
      }

      // Show workflow submit button
      const btnWf = document.getElementById('btnSubmitWorkflow');
      if (btnWf) btnWf.style.display = 'inline-flex';

      app.showToast(`Review complete: ${draft.findings.length} findings detected`, draft.findings.length > 0 ? 'warning' : 'success');
    } catch (err) {
      app.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Check Brand Compliance</span>
        `;
      }
    }
  },

  async submitToWorkflow() {
    if (!this.currentDraft || !this.currentDraft.id) {
      app.showToast('Please check brand compliance first to generate a draft record.', 'warning');
      return;
    }
    try {
      await api.updateStatus(this.currentDraft.id, {
        new_state: 'Submitted for Review',
        reviewer: 'Content Creator',
        decision_notes: 'Draft submitted from Content Review Studio.',
      });
      app.showToast('Draft submitted to Human Review queue!', 'success');
      app.navigateTo('workflow', this.currentDraft.id);
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },

  updateScoreWidget(findings) {
    const health = this.calculateComplianceScore(findings);
    const scoreCard = document.getElementById('complianceScoreCard');
    if (!scoreCard) return;

    scoreCard.innerHTML = `
      <div class="score-gauge-wrapper">
        <svg class="score-circle-svg" viewBox="0 0 72 72">
          <circle class="score-circle-bg" cx="36" cy="36" r="28" />
          <circle class="score-circle-progress" id="scoreProgressCircle" cx="36" cy="36" r="28" 
                  stroke="${health.color}"
                  stroke-dasharray="175.9"
                  stroke-dashoffset="${175.9 - (175.9 * health.score) / 100}" />
        </svg>
        <div>
          <div class="score-number" style="color: ${health.color};">${health.score}%</div>
          <div class="score-label" style="color: ${health.color};">${health.status}</div>
          <div class="score-desc">${health.description}</div>
        </div>
      </div>

      <div class="score-breakdown-pills">
        <div class="score-pill-item">
          <span>Critical Violations</span>
          <strong style="color: ${health.criticalCount > 0 ? 'var(--accent-rose)' : 'var(--text-main)'};">${health.criticalCount}</strong>
        </div>
        <div class="score-pill-item">
          <span>High Severity</span>
          <strong style="color: ${health.highCount > 0 ? 'var(--accent-amber)' : 'var(--text-main)'};">${health.highCount}</strong>
        </div>
        <div class="score-pill-item">
          <span>Missing Disclaimers</span>
          <strong style="color: ${health.disclaimerCount > 0 ? 'var(--accent-blue)' : 'var(--text-main)'};">${health.disclaimerCount}</strong>
        </div>
        <div class="score-pill-item">
          <span>Active Issues</span>
          <strong>${health.activeCount}</strong>
        </div>
      </div>
    `;
  },

  renderFindingsSummaryBadge(findings) {
    const active = findings.filter(f => !f.dismissed);
    if (active.length === 0) {
      return `<span class="badge badge-state-approved">0 Issues &bull; Compliant</span>`;
    }
    const critCount = active.filter(f => f.severity === 'critical').length;
    return `
      <span class="badge ${critCount > 0 ? 'badge-critical' : 'badge-high'}">
        ${active.length} Issue${active.length === 1 ? '' : 's'} (${critCount} Critical)
      </span>
    `;
  },

  renderFindingsList(findings, draftId) {
    if (!findings || findings.length === 0) {
      return `
        <div class="loading-state" style="padding: 60px 0; color: var(--accent-emerald);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">100% Brand Compliant</div>
          <p style="font-size: 0.8125rem; color: var(--text-muted); max-width: 320px; text-align: center;">
            No prohibited terms, unapproved aliases, or missing disclaimers detected. Content is approved for human editorial review.
          </p>
        </div>
      `;
    }

    return findings.map(f => {
      if (f.dismissed) {
        return `
          <div class="finding-item" id="card-${f.id}" style="opacity: 0.5; border-left-color: var(--text-subtle);">
            <div class="finding-header">
              <span class="badge badge-low">Dismissed</span>
              <span style="font-size: 0.75rem; color: var(--text-subtle);">${f.id}</span>
            </div>
            <div style="font-size: 0.8125rem; color: var(--text-muted); text-decoration: line-through;">
              "${escapeHtml(f.matched_text)}"
            </div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">
              Reason: ${escapeHtml(f.dismissed_reason || 'Dismissed')}
            </div>
          </div>
        `;
      }

      return `
        <div class="finding-item severity-${f.severity}" id="card-${f.id}">
          <div class="finding-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-${f.severity}">${f.severity}</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                ${f.category.replace('_', ' ')}
              </span>
            </div>
            <span style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--text-subtle);">${f.id}</span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 8px; margin: 4px 0;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Matched Excerpt:</span>
            <span class="finding-matched">"${escapeHtml(f.matched_text)}"</span>
          </div>

          <div class="finding-explanation">
            ${escapeHtml(f.explanation)}
          </div>

          <!-- Evidence & Provenance Bar -->
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.72rem; flex-wrap: wrap; margin-top: 4px;">
            ${f.rule_id ? `
              <span style="background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px; color: var(--accent-primary);">
                Rule: <strong>${f.rule_id}</strong>
              </span>
            ` : ''}
            ${f.evidence_source_id ? `
              <span style="background: rgba(6, 182, 212, 0.1); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan); border: 1px solid rgba(6, 182, 212, 0.2);">
                Evidence: <strong>${f.evidence_source_id}</strong>
              </span>
            ` : ''}
            <span style="color: ${f.evidence_status === 'Needs verification' ? 'var(--accent-amber)' : 'var(--text-subtle)'};">
              Status: <strong>${f.evidence_status || 'not_applicable'}</strong>
            </span>
          </div>

          ${f.suggested_rewrite ? `
            <div class="finding-suggestion">
              <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #10B981;">Recommended Correction:</span>
              <span style="font-weight: 600;">"${escapeHtml(f.suggested_rewrite.trim())}"</span>
            </div>
          ` : ''}

          <!-- Action buttons -->
          <div class="finding-actions">
            <button class="btn btn-secondary btn-sm" onclick="reviewView.promptDismiss('${draftId}', '${f.id}')">
              Dismiss
            </button>
            ${f.suggested_rewrite ? `
              <button class="btn btn-outline-success btn-sm" onclick="reviewView.applyRewrite('${draftId}', '${f.id}')">
                Apply Correction &rarr;
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async applyRewrite(draftId, findingId) {
    try {
      const updated = await api.applyRewrite(draftId, findingId);
      this.currentDraft = updated;

      // Update Health Score
      this.updateScoreWidget(updated.findings);

      // Re-render editor area
      const container = document.getElementById('editorAreaContainer');
      if (container) {
        container.innerHTML = this.renderEditorOrAnnotated(updated);
        this.bindEditorEvents();
      }

      // Re-render findings list
      const findingsList = document.getElementById('findingsList');
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(updated.findings, updated.id);
      }

      // Update badges
      const badgeContainer = document.getElementById('findingsBadgeContainer');
      if (badgeContainer) {
        badgeContainer.innerHTML = this.renderFindingsSummaryBadge(updated.findings);
      }

      app.showToast('Suggested rewrite applied to draft', 'success');
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },

  async promptDismiss(draftId, findingId) {
    const reason = prompt('Please enter the reviewer reason for dismissing this finding:', 'Verified exception by brand committee');
    if (!reason) return;

    try {
      const updated = await api.dismissFinding(draftId, findingId, reason);
      this.currentDraft = updated;

      // Update Health Score
      this.updateScoreWidget(updated.findings);

      const findingsList = document.getElementById('findingsList');
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(updated.findings, updated.id);
      }

      const badgeContainer = document.getElementById('findingsBadgeContainer');
      if (badgeContainer) {
        badgeContainer.innerHTML = this.renderFindingsSummaryBadge(updated.findings);
      }

      app.showToast('Finding dismissed', 'info');
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
