/**
 * Human Review Workflow Controller for BrandGraph AI
 */

const workflowView = {
  selectedDraftId: null,

  async render(container, selectId = null) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading review workflow queues...</p>
      </div>
    `;

    try {
      const drafts = await api.listDrafts();
      this.selectedDraftId = selectId || (drafts.length > 0 ? drafts[0].id : null);

      let selectedDraft = null;
      if (this.selectedDraftId) {
        selectedDraft = await api.getDraft(this.selectedDraftId).catch(() => null);
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: 340px 1fr; gap: 24px; height: calc(100vh - 170px);">
          <!-- Left Column: Drafts Queue -->
          <div class="card" style="display: flex; flex-direction: column; padding: 16px; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
              <strong style="font-size: 0.9375rem;">Review Queue (${drafts.length})</strong>
              <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('review')">+ New</button>
            </div>

            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
              ${drafts.length === 0 ? `
                <div style="text-align: center; color: var(--text-muted); padding: 32px 8px; font-size: 0.8125rem;">
                  No drafts in the review workflow queue yet.
                </div>
              ` : drafts.map(d => `
                <div class="draft-queue-item ${d.id === this.selectedDraftId ? 'active' : ''}" 
                     onclick="workflowView.selectDraft('${d.id}')"
                     style="padding: 12px; border-radius: var(--radius-sm); border: 1px solid ${d.id === this.selectedDraftId ? 'var(--accent-primary)' : 'var(--border-color)'}; background: ${d.id === this.selectedDraftId ? 'rgba(139, 92, 246, 0.12)' : '#0B0F19'}; cursor: pointer; transition: all 0.15s ease;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 700; font-size: 0.875rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">
                      ${escapeHtml(d.title || 'Untitled Draft')}
                    </span>
                    ${app.renderStateBadge(d.current_state)}
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
                    <span>${d.author || 'Creator'} &bull; v${d.version || 1}</span>
                    <span style="color: ${d.finding_count > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-weight: 600;">
                      ${d.finding_count} issue${d.finding_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right Column: Selected Draft Review & Audit History -->
          <div class="card" style="display: flex; flex-direction: column; overflow-y: auto; padding: 24px;">
            ${selectedDraft ? this.renderSelectedDraftDetail(selectedDraft) : `
              <div class="loading-state" style="padding: 60px 0;">
                <p>Select a draft from the queue to review and manage decisions.</p>
              </div>
            `}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="border-color: var(--accent-rose); padding: 24px;">
          <h3 style="color: var(--accent-rose);">Failed to load review workflow</h3>
          <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
        </div>
      `;
    }
  },

  async selectDraft(draftId) {
    this.selectedDraftId = draftId;
    this.render(document.getElementById('pageContainer'), draftId);
  },

  renderSelectedDraftDetail(draft) {
    const comments = draft.comments || [];
    const decisions = draft.decisions || [];

    return `
      <!-- Header & State Transition Toolbar -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800;">${escapeHtml(draft.title)}</h2>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
            ID: <span style="font-family: var(--font-mono);">${draft.id}</span> &bull; 
            Author: <strong>${escapeHtml(draft.author)}</strong> &bull; 
            Version: <strong>v${draft.version}</strong>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${app.renderStateBadge(draft.current_state)}
          <button class="btn btn-secondary btn-sm" onclick="app.openDraftInReview('${draft.id}')">
            Edit in Reviewer &rarr;
          </button>
        </div>
      </div>

      <!-- Human Decision Action Bar -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.8125rem; font-weight: 600; color: var(--text-muted);">Reviewer Decision Actions:</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline-danger btn-sm" onclick="workflowView.promptStateTransition('${draft.id}', 'Needs Revision')">
            Request Revision
          </button>
          <button class="btn btn-secondary btn-sm" onclick="workflowView.promptStateTransition('${draft.id}', 'Submitted for Review')">
            Submit for Review
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="workflowView.promptStateTransition('${draft.id}', 'Rejected')">
            Reject Draft
          </button>
          <button class="btn btn-outline-success btn-sm" onclick="workflowView.promptStateTransition('${draft.id}', 'Approved')">
            ✓ Approve Draft
          </button>
        </div>
      </div>

      <!-- Draft Content Body -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 8px;">Current Content Body</h4>
        <div style="background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px; font-size: 0.9375rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap;">
${escapeHtml(draft.content || '(Draft content is empty)')}
        </div>
      </div>

      <!-- Detected Issues Summary -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 8px;">
          Detected Issues (${draft.findings.length})
        </h4>
        ${draft.findings.length === 0 ? `
          <div style="font-size: 0.8125rem; color: var(--accent-emerald);">✓ Zero brand violations detected. Ready for approval.</div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${draft.findings.map(f => `
              <div style="background: #0B0F19; border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-sm); font-size: 0.8125rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge badge-${f.severity}">${f.severity}</span>
                    <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">${f.category.replace('_', ' ')}</span>
                    ${f.rule_id ? `<span style="background: rgba(139, 92, 246, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${f.rule_id}</span>` : ''}
                    ${f.evidence_source_id ? `<span style="background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${f.evidence_source_id}</span>` : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge ${f.evidence_status === 'Needs verification' ? 'badge-high' : 'badge-low'}" style="font-size: 0.68rem;">
                      ${f.evidence_status || 'not_applicable'}
                    </span>
                    <span style="font-size: 0.72rem; color: var(--text-subtle); font-family: var(--font-mono);">${f.id}</span>
                  </div>
                </div>
                <div style="color: var(--text-main); margin-bottom: 4px;">
                  <strong style="color: var(--accent-amber);">"${escapeHtml(f.matched_text)}"</strong> &bull; ${escapeHtml(f.explanation)}
                </div>
                ${f.suggested_rewrite ? `
                  <div style="font-size: 0.75rem; color: var(--accent-emerald); background: rgba(16, 185, 129, 0.08); padding: 6px 10px; border-radius: 4px; margin-top: 6px;">
                    <strong>Approved Alternative:</strong> "${escapeHtml(f.suggested_rewrite)}"
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Comments & Collaboration Thread -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Reviewer Comments -->
        <div>
          <h4 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 8px;">Reviewer Comments</h4>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; margin-bottom: 12px;">
            ${comments.length === 0 ? `
              <div style="font-size: 0.78rem; color: var(--text-muted);">No reviewer comments yet.</div>
            ` : comments.map(c => `
              <div style="background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-subtle); margin-bottom: 4px;">
                  <strong style="color: var(--accent-cyan);">${escapeHtml(c.author)}</strong>
                  <span>${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="font-size: 0.8125rem; color: var(--text-main);">${escapeHtml(c.comment_text)}</div>
              </div>
            `).join('')}
          </div>

          <div style="display: flex; gap: 8px;">
            <input type="text" id="inputComment" placeholder="Add reviewer note or feedback..." 
                   style="flex: 1; background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; color: var(--text-main); font-size: 0.8125rem; outline: none;">
            <button class="btn btn-primary btn-sm" onclick="workflowView.submitComment('${draft.id}')">Post</button>
          </div>
        </div>

        <!-- Decision Audit Trail -->
        <div>
          <h4 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 8px;">Audit Decision Log</h4>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto;">
            ${decisions.length === 0 ? `
              <div style="font-size: 0.78rem; color: var(--text-muted);">No historical transitions recorded.</div>
            ` : decisions.map(d => `
              <div style="background: #0B0F19; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px; font-size: 0.78rem;">
                <div style="display: flex; justify-content: space-between; color: var(--text-subtle); margin-bottom: 2px;">
                  <span>${escapeHtml(d.reviewer)}</span>
                  <span>${new Date(d.timestamp).toLocaleDateString()} ${new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div>
                  State changed from <span style="font-weight: 600;">${d.from_state}</span> &rarr; <span style="font-weight: 700; color: var(--accent-primary);">${d.to_state}</span>
                </div>
                ${d.decision_notes ? `
                  <div style="color: var(--text-muted); margin-top: 4px; font-style: italic;">
                    "${escapeHtml(d.decision_notes)}"
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async promptStateTransition(draftId, newState) {
    const notes = prompt(`Enter optional decision notes for transitioning to "${newState}":`, `Status moved to ${newState} after editorial check.`);
    if (notes === null) return;

    try {
      await api.updateStatus(draftId, {
        new_state: newState,
        reviewer: 'Human Compliance Lead',
        decision_notes: notes,
      });
      app.showToast(`Draft moved to state: ${newState}`, 'success');
      this.render(document.getElementById('pageContainer'), draftId);
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },

  async submitComment(draftId) {
    const input = document.getElementById('inputComment');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    try {
      await api.addComment(draftId, {
        author: 'Lead Reviewer',
        comment_text: text,
      });
      input.value = '';
      app.showToast('Comment added', 'info');
      this.render(document.getElementById('pageContainer'), draftId);
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },
};
