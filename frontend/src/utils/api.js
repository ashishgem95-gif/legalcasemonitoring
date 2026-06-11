const API_BASE_URL = `http://${window.location.hostname}:5000/api`;

function getAuthToken() {
  return localStorage.getItem('ccms_token');
}

function getUserScope() {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && user.railwayScope && user.railwayScope !== 'All') {
        return user.railwayScope;
      }
    }
  } catch (e) {
    console.error('Error parsing user scope from localStorage:', e);
  }
  return null;
}

function getAiHeaders() {
  return {
    'x-ai-provider': localStorage.getItem('ccms_provider') || 'gemini',
    'x-ai-model': localStorage.getItem('ccms_model') || '',
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const config = { ...options, headers };

  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (response.status === 401 && endpoint !== '/auth/login') {
    localStorage.removeItem('user');
    localStorage.removeItem('ccms_token');
    window.location.reload();
    return;
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) { /* ignore */ }
    throw new Error(errorMessage);
  }

  return response.json();
}

async function requestWithAi(endpoint, options = {}) {
  return request(endpoint, {
    ...options,
    headers: { ...options.headers, ...getAiHeaders() },
  });
}

export const api = {
  // Auth
  login: (email, password) => {
    return request('/auth/login', { method: 'POST', body: { email, password } });
  },
  logout: () => {
    return request('/auth/logout', { method: 'POST' })
      .catch((err) => { console.error('Logout API error:', err); })
      .finally(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('ccms_token');
        window.location.reload();
      });
  },

  // Cases
  getCases: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.case_type) query.append('case_type', params.case_type);
    const scope = getUserScope();
    if (scope) query.append('railway', scope);
    const qs = query.toString();
    return request(`/cases${qs ? `?${qs}` : ''}`);
  },
  getCaseById: (id) => request(`/cases/${id}`),
  createCase: (caseData) => request('/cases', { method: 'POST', body: caseData }),
  updateCase: (id, caseData) => request(`/cases/${id}`, { method: 'PUT', body: caseData }),
  deleteCase: (id) => request(`/cases/${id}`, { method: 'DELETE' }),

  // Hearings
  getHearingsForCase: (caseId) => request(`/cases/${caseId}/hearings`),
  addHearingToCase: (caseId, hearingData) => request(`/cases/${caseId}/hearings`, { method: 'POST', body: hearingData }),

  // Citations
  getCitations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return request(`/citations${qs ? `?${qs}` : ''}`);
  },
  createCitation: (data) => request('/citations', { method: 'POST', body: data }),
  updateCitation: (id, data) => request(`/citations/${id}`, { method: 'PUT', body: data }),
  deleteCitation: (id) => request(`/citations/${id}`, { method: 'DELETE' }),

  // Documents (Court Orders, PDFs)
  getDocumentsForCase: (caseId) => request(`/cases/${caseId}/documents`),
  getDocumentDownloadUrl: (docId) => `${API_BASE_URL}/documents/${docId}/download`,

  // Pleadings
  getPleadingsForCase: (caseId) => request(`/cases/${caseId}/pleadings`),
  addPleading: (caseId, data) => request(`/cases/${caseId}/pleadings`, { method: 'POST', body: data }),
  deletePleading: (id) => request(`/pleadings/${id}`, { method: 'DELETE' }),

  // Affidavits
  getAffidavitsForCase: (caseId) => request(`/cases/${caseId}/affidavits`),
  addAffidavitToCase: (caseId, data) => request(`/cases/${caseId}/affidavits`, { method: 'POST', body: data }),
  deleteAffidavit: (id) => request(`/affidavits/${id}`, { method: 'DELETE' }),

  // AI YAML Parsing (API key sent only here)
  parseCaseFile: (text) => requestWithAi('/cases/parse-file', { method: 'POST', body: { text } }),
  parseCaseFilePdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestWithAi('/cases/parse-pdf', { method: 'POST', body: formData });
  },
  extractPdfText: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestWithAi('/extract-pdf', { method: 'POST', body: formData });
  },

  // Personnel
  getPersonnel: () => request('/personnel'),
  createPersonnel: (data) => request('/personnel', { method: 'POST', body: data }),
  updatePersonnel: (id, data) => request(`/personnel/${id}`, { method: 'PUT', body: data }),
  deletePersonnel: (id) => request(`/personnel/${id}`, { method: 'DELETE' }),

  // Physical Files
  getPhysicalFiles: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.zonal_railway) query.append('zonal_railway', params.zonal_railway);
    const scope = getUserScope();
    if (scope) query.set('zonal_railway', scope);
    const qs = query.toString();
    return request(`/physical-files${qs ? `?${qs}` : ''}`);
  },
  getPhysicalFileById: (id) => request(`/physical-files/${id}`),
  createPhysicalFile: (data) => request('/physical-files', { method: 'POST', body: data }),
  updatePhysicalFile: (id, data) => request(`/physical-files/${id}`, { method: 'PUT', body: data }),
  deletePhysicalFile: (id) => request(`/physical-files/${id}`, { method: 'DELETE' }),

  // File Movements
  getFileMovements: (params = {}) => {
    const query = new URLSearchParams();
    if (params.file_id) query.append('file_id', params.file_id);
    const qs = query.toString();
    return request(`/file-movements${qs ? `?${qs}` : ''}`);
  },
  createFileMovement: (data) => request('/file-movements', { method: 'POST', body: data }),

  // Alerts & Crawler
  getAlerts: () => {
    const query = new URLSearchParams();
    const scope = getUserScope();
    if (scope) query.append('railway', scope);
    const qs = query.toString();
    return request(`/alerts${qs ? `?${qs}` : ''}`);
  },
  markAlertAsRead: (id) => request(`/alerts/${id}/read`, { method: 'PUT' }),
  dismissAllAlerts: () => request('/alerts/read-all', { method: 'PUT' }),
  triggerCrawl: () => requestWithAi('/cases/trigger-crawl', { method: 'POST' }),
  checkDueCases: () => requestWithAi('/cases/check-due-cases', { method: 'POST' }),
  smartSync: () => requestWithAi('/sync/smart', { method: 'POST' }),
};

export default api;
