const API_BASE_URL = `http://${window.location.hostname}:5000/api`;

/**
 * Helper to handle fetch requests and return JSON or throw error
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const token = localStorage.getItem('ccms_token');
  const isFormData = options.body instanceof FormData;
  const headers = {
    'x-ai-provider': localStorage.getItem('ccms_provider') || 'gemini',
    'x-ai-model': localStorage.getItem('ccms_model') || '',
    'x-ai-api-key': localStorage.getItem('ccms_apikey') || '',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

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
    } catch (e) {
      // ignore JSON parse errors for non-JSON error responses
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Auth APIs
  login: (email, password) => {
    return request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  logout: () => {
    return request('/auth/logout', {
      method: 'POST',
    })
      .catch((err) => {
        console.error('Logout API error:', err);
      })
      .finally(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('ccms_token');
        window.location.reload();
      });
  },

  // Case APIs
  getCases: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.case_type) query.append('case_type', params.case_type);
    
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.railwayScope && user.railwayScope !== 'All') {
          query.append('railway', user.railwayScope);
        }
      }
    } catch (e) {
      console.error('Error parsing user scope from localStorage:', e);
    }
    
    const queryString = query.toString();
    return request(`/cases${queryString ? `?${queryString}` : ''}`);
  },

  getCaseById: (id) => {
    return request(`/cases/${id}`);
  },

  createCase: (caseData) => {
    return request('/cases', {
      method: 'POST',
      body: caseData,
    });
  },

  updateCase: (id, caseData) => {
    return request(`/cases/${id}`, {
      method: 'PUT',
      body: caseData,
    });
  },

  deleteCase: (id) => {
    return request(`/cases/${id}`, {
      method: 'DELETE',
    });
  },

  // Hearing APIs
  getHearingsForCase: (caseId) => {
    return request(`/cases/${caseId}/hearings`);
  },

  addHearingToCase: (caseId, hearingData) => {
    return request(`/cases/${caseId}/hearings`, {
      method: 'POST',
      body: hearingData,
    });
  },

  // Citation APIs
  getCitations: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    const queryString = query.toString();
    return request(`/citations${queryString ? `?${queryString}` : ''}`);
  },

  createCitation: (citationData) => {
    return request('/citations', {
      method: 'POST',
      body: citationData,
    });
  },

  updateCitation: (id, citationData) => {
    return request(`/citations/${id}`, {
      method: 'PUT',
      body: citationData,
    });
  },

  deleteCitation: (id) => {
    return request(`/citations/${id}`, {
      method: 'DELETE',
    });
  },

  // Affidavit APIs
  getAffidavitsForCase: (caseId) => {
    return request(`/cases/${caseId}/affidavits`);
  },

  addAffidavitToCase: (caseId, affidavitData) => {
    return request(`/cases/${caseId}/affidavits`, {
      method: 'POST',
      body: affidavitData,
    });
  },

  deleteAffidavit: (id) => {
    return request(`/affidavits/${id}`, {
      method: 'DELETE',
    });
  },

  // AI YAML Ingestion
  parseCaseFile: (text) => {
    return request('/cases/parse-file', {
      method: 'POST',
      body: { text },
    });
  },

  parseCaseFilePdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/cases/parse-pdf', {
      method: 'POST',
      body: formData,
    });
  },

  extractPdfText: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/extract-pdf', {
      method: 'POST',
      body: formData,
    });
  },

  // Personnel APIs
  getPersonnel: () => {
    return request('/personnel');
  },
  createPersonnel: (personnelData) => {
    return request('/personnel', {
      method: 'POST',
      body: personnelData,
    });
  },
  updatePersonnel: (id, personnelData) => {
    return request(`/personnel/${id}`, {
      method: 'PUT',
      body: personnelData,
    });
  },
  deletePersonnel: (id) => {
    return request(`/personnel/${id}`, {
      method: 'DELETE',
    });
  },

  // Physical Files APIs
  getPhysicalFiles: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.zonal_railway) query.append('zonal_railway', params.zonal_railway);
    
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.railwayScope && user.railwayScope !== 'All') {
          query.set('zonal_railway', user.railwayScope);
        }
      }
    } catch (e) {
      console.error('Error parsing user scope from localStorage:', e);
    }

    const queryString = query.toString();
    return request(`/physical-files${queryString ? `?${queryString}` : ''}`);
  },
  getPhysicalFileById: (id) => {
    return request(`/physical-files/${id}`);
  },
  createPhysicalFile: (fileData) => {
    return request('/physical-files', {
      method: 'POST',
      body: fileData,
    });
  },
  updatePhysicalFile: (id, fileData) => {
    return request(`/physical-files/${id}`, {
      method: 'PUT',
      body: fileData,
    });
  },
  deletePhysicalFile: (id) => {
    return request(`/physical-files/${id}`, {
      method: 'DELETE',
    });
  },

  // File Movements APIs
  getFileMovements: (params = {}) => {
    const query = new URLSearchParams();
    if (params.file_id) query.append('file_id', params.file_id);
    const queryString = query.toString();
    return request(`/file-movements${queryString ? `?${queryString}` : ''}`);
  },
  createFileMovement: (movementData) => {
    return request('/file-movements', {
      method: 'POST',
      body: movementData,
    });
  },

  // Alerts & Crawler APIs
  getAlerts: () => {
    const query = new URLSearchParams();
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.railwayScope && user.railwayScope !== 'All') {
          query.append('railway', user.railwayScope);
        }
      }
    } catch (e) {
      console.error('Error parsing user scope from localStorage:', e);
    }
    const queryString = query.toString();
    return request(`/alerts${queryString ? `?${queryString}` : ''}`);
  },
  markAlertAsRead: (id) => {
    return request(`/alerts/${id}/read`, {
      method: 'PUT',
    });
  },
  triggerCrawl: () => {
    return request('/cases/trigger-crawl', {
      method: 'POST',
    });
  },
  checkDueCases: () => {
    return request('/cases/check-due-cases', {
      method: 'POST',
    });
  },
};

export default api;
