/**
 * Content Review Controller for BrandGraph AI
 */

const reviewView = {
  currentDraft: null,

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

    container.innerHTML = `
      <div class="review-layout">
        <!-- Left Column: Draft Editor -->
        <div class="card editor-card">
          <div class="editor-header">
            <div>
              <input type="text" id="draftTitle" value="${escapeHtml(draft.title)}" 
                     style="background: transparent; border: none; font-size: 1.15rem; font-weight: 700; color: var(--text-main); outline: none; width: 100%; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px;"
                     placeholder="Enter Draft Title...">
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                Product: <strong style="color: var(--accent-cyan);">Inkloom Copilot</strong> &bull; Author: ${draft.author}
                ${draft.id ? `&bull; Draft ID: <span style="font-family: var(--font-mono);">${draft.id}</span>` : ''}
              </div>
            </div>
            ${draft.id ? app.renderStateBadge(draft.current_state) : '<span class="badge badge-low">Unsaved</span>'}
          </div>

          <!-- Quick Test Presets -->
          <div style="margin: 10px 0 14px 0;">
            <div style="font-size: 0.72rem; color: var(--text-subtle); text-transform: uppercase; margin-bottom: 6px;">Test Presets for Evaluation:</div>
            <div class="preset-pills">
              <button class="pill-preset" onclick="reviewView.loadPreset('violations')">⚠️ Multiple Violations</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('disclaimer')">⏱️ Missing Disclaimer</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('contradiction')">❌ Contradicted Claim</button>
              <button class="pill-preset" onclick="reviewView.loadPreset('compliant')">✅ 100% Compliant</button>
            </div>
          </div>

          <!-- Textarea -->
          <textarea id="draftContent" class="draft-textarea" placeholder="Paste or type marketing copy, product descriptions, or campaign text here...">${escapeHtml(draft.content)}</textarea>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
            <div style="font-size: 0.75rem; color: var(--text-muted);" id="charCount">
              ${draft.content.length} characters &bull; ${draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" onclick="reviewView.clearEditor()">Clear</button>
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

    // Bind char counter
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
    const textarea = document.getElementById('draftContent');
    const titleInput = document.getElementById('draftTitle');
    if (!textarea) return;

    if (type === 'violations') {
      titleInput.value = 'Product Launch: Next-Gen Copilot';
      textarea.value = 'Get started with Inkloom Bot today! Our software is 100% bug-free, completely hack-proof, and achieves under 5ms latency with zero false alarms across all workloads.';
    } else if (type === 'disclaimer') {
      titleInput.value = 'Sentinel Performance Benchmarks';
      textarea.value = 'Inkloom Sentinel scans enterprise repositories with an observed latency of under 45ms per 1,000 lines under standard load.';
    } else if (type === 'contradiction') {
      titleInput.value = 'Accuracy & Verification Guarantee';
      textarea.value = 'Inkloom Sentinel guarantees zero false alarms and complete elimination of false positives for all enterprise deployments.';
    } else if (type === 'compliant') {
      titleInput.value = 'Enterprise Governance Announcement';
      textarea.value = 'Inkloom Copilot provides human-in-the-loop governance for enterprise AI workflows. Performance figures depend on workload characteristics, configuration, and cluster capacity. Individual outcomes may vary.';
    }

    textarea.dispatchEvent(new Event('input'));
    app.showToast(`Loaded "${type}" test sample into editor`, 'info');
  },

  clearEditor() {
    const textarea = document.getElementById('draftContent');
    if (textarea) {
      textarea.value = '';
      textarea.dispatchEvent(new Event('input'));
    }
    const findingsList = document.getElementById('findingsList');
    if (findingsList) {
      findingsList.innerHTML = `
        <div class="loading-state" style="padding: 40px 0;">
          <p>Editor cleared. Click <strong>"Check Brand Compliance"</strong> to review content.</p>
        </div>
      `;
    }
  },

  async submitReview() {
    const title = document.getElementById('draftTitle').value.trim() || 'Untitled Draft';
    const content = document.getElementById('draftContent').value.trim();
    const btn = document.getElementById('btnRunReview');

    if (!content) {
      app.showToast('Please enter content to review.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div> Checking...`;

    try {
      const draft = await api.reviewContent({
        content,
        title,
        author: 'Content Creator',
        product_id: 'PROD-COPILOT',
        draft_id: this.currentDraft?.id || null,
      });

      this.currentDraft = draft;

      // Update right column
      const findingsList = document.getElementById('findingsList');
      const badgeContainer = document.getElementById('findingsBadgeContainer');

      if (badgeContainer) {
        badgeContainer.innerHTML = this.renderFindingsSummaryBadge(draft.findings);
      }
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(draft.findings, draft.id);
      }

      app.showToast(`Review complete: ${draft.findings.length} findings detected`, draft.findings.length > 0 ? 'warning' : 'success');
    } catch (err) {
      app.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Check Brand Compliance</span>
      `;
    }
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
          <div class="finding-item" style="opacity: 0.5; border-left-color: var(--text-subtle);">
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
        <div class="finding-item severity-${f.severity}">
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
      const textarea = document.getElementById('draftContent');
      if (textarea) {
        textarea.value = updated.content;
        textarea.dispatchEvent(new Event('input'));
      }
      const findingsList = document.getElementById('findingsList');
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(updated.findings, updated.id);
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
      const findingsList = document.getElementById('findingsList');
      if (findingsList) {
        findingsList.innerHTML = this.renderFindingsList(updated.findings, updated.id);
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
