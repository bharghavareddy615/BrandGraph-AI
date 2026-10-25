/**
 * API client for BrandGraph AI
 */

const API_BASE = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  if (window.location.protocol === 'file:') return 'http://localhost:8000';
  if (!window.location.port || window.location.port === '80' || window.location.port === '443' || window.location.port === '8000') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
})();

window.escapeHtml = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

function formatApiError(errorData, status) {
  if (!errorData) return `HTTP Error ${status}`;
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map(d => (d.msg ? `${d.loc ? d.loc.filter(l => l !== 'body').join('.') + ': ' : ''}${d.msg}` : JSON.stringify(d)))
      .join('; ');
  }
  if (errorData.detail && typeof errorData.detail === 'object') {
    return JSON.stringify(errorData.detail);
  }
  if (errorData.message) return errorData.message;
  return `HTTP Error ${status}`;
}

const api = {
  async get(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(formatApiError(errorData, res.status));
      }
      return await res.json();
    } catch (err) {
      console.error(`API GET error on ${endpoint}:`, err);
      throw err;
    }
  },

  async post(endpoint, data = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(formatApiError(errorData, res.status));
      }
      return await res.json();
    } catch (err) {
      console.error(`API POST error on ${endpoint}:`, err);
      throw err;
    }
  },

  async patch(endpoint, data = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(formatApiError(errorData, res.status));
      }
      return await res.json();
    } catch (err) {
      console.error(`API PATCH error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Specific Endpoint Helpers
  getHealth: () => api.get('/api/health'),
  getDashboard: () => api.get('/api/dashboard'),
  getBrandKnowledge: () => api.get('/api/brand/rules'),
  getBrandGraph: (productId) => api.get(`/api/brand/graph${productId ? `?product_id=${productId}` : ''}`),
  searchEvidence: (query) => api.get(`/api/evidence/search?q=${encodeURIComponent(query)}`),
  reviewContent: (payload) => api.post('/api/review', payload),
  listDrafts: () => api.get('/api/drafts'),
  getDraft: (id) => api.get(`/api/drafts/${id}`),
  createDraft: (payload) => api.post('/api/drafts', payload),
  addComment: (id, payload) => api.post(`/api/drafts/${id}/comments`, payload),
  updateStatus: (id, payload) => api.patch(`/api/drafts/${id}/status`, payload),
  applyRewrite: (id, findingId) => api.post(`/api/drafts/${id}/rewrite`, { finding_id: findingId }),
  dismissFinding: (id, findingId, reason) => api.post(`/api/drafts/${id}/dismiss`, { finding_id: findingId, reason }),
  getEvaluation: () => api.get('/api/evaluation'),
  runEvaluation: () => api.post('/api/evaluation/run'),
  getSettings: () => api.get('/api/settings'),
};
