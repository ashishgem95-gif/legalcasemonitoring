import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import './FileRegistry.css';

export default function FileRegistryApp() {
  const [activeTab, setActiveTab] = useState('registry'); // 'dashboard', 'registry', 'movements', 'personnel', 'track'
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Core Data States
  const [files, setFiles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [movements, setMovements] = useState([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [railwayFilter, setRailwayFilter] = useState('All Railways');
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  // Track & Search Specific State
  const [trackSearchQuery, setTrackSearchQuery] = useState('');
  const [trackedFile, setTrackedFile] = useState(null);

  // Modal Visibility States
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showEditFileModal, setShowEditFileModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);

  // Selected Records for Modals
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);

  // Form Field States
  const [fileForm, setFileForm] = useState({
    file_number: '',
    subject: '',
    description: '',
    currently_with_id: '',
    zonal_railway: '',
    status: 'ACTIVE'
  });

  const [dispatchForm, setDispatchForm] = useState({
    to_custodian_id: '',
    movement_date: new Date().toISOString().split('T')[0],
    purpose: '',
    remarks: ''
  });

  const [personnelForm, setPersonnelForm] = useState({
    name: '',
    designation: '',
    department: '',
    contact_no: '',
    email: ''
  });

  // Unique list of zonal railways from files for filter dropdown
  const uniqueRailways = ['All Railways', ...new Set(files.map(f => f.zonal_railway).filter(Boolean))];

  // Initial Data Fetching
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [filesData, personnelData, movementsData] = await Promise.all([
        api.getPhysicalFiles(),
        api.getPersonnel(),
        api.getFileMovements()
      ]);
      setFiles(filesData);
      setPersonnel(personnelData);
      setMovements(movementsData);
    } catch (err) {
      console.error('Error fetching DocuFlow data:', err);
      setError('Failed to load physical registry data.');
    } finally {
      setLoading(false);
    }
  };

  // Quick search handler
  const handleQuickSearchSubmit = (e) => {
    e.preventDefault();
    if (quickSearchQuery.trim()) {
      setTrackSearchQuery(quickSearchQuery);
      handleTrackSearch(quickSearchQuery);
      setActiveTab('track');
    }
  };

  // Track search function
  const handleTrackSearch = async (queryStr) => {
    if (!queryStr.trim()) return;
    try {
      setLoading(true);
      // Find file by number
      const matched = files.find(f => f.file_number.toLowerCase() === queryStr.trim().toLowerCase());
      if (matched) {
        const details = await api.getPhysicalFileById(matched.id);
        setTrackedFile(details);
      } else {
        setTrackedFile(null);
      }
    } catch (err) {
      console.error('Error tracking file:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh lists
  const refreshFiles = async () => {
    try {
      const data = await api.getPhysicalFiles();
      setFiles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshMovements = async () => {
    try {
      const data = await api.getFileMovements();
      setMovements(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshPersonnel = async () => {
    try {
      const data = await api.getPersonnel();
      setPersonnel(data);
    } catch (err) {
      console.error(err);
    }
  };

  // File Form Handlers
  const handleFileFormChange = (e) => {
    const { name, value } = e.target;
    setFileForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddFileSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createPhysicalFile(fileForm);
      setShowAddFileModal(false);
      fetchData();
      resetFileForm();
    } catch (err) {
      alert(err.message || 'Failed to create file');
    }
  };

  const handleEditFileClick = (file) => {
    setSelectedFile(file);
    setFileForm({
      file_number: file.file_number,
      subject: file.subject,
      description: file.description || '',
      currently_with_id: file.currently_with_id || '',
      zonal_railway: file.zonal_railway || '',
      status: file.status || 'ACTIVE'
    });
    setShowEditFileModal(true);
  };

  const handleEditFileSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.updatePhysicalFile(selectedFile.id, fileForm);
      setShowEditFileModal(false);
      fetchData();
      resetFileForm();
    } catch (err) {
      alert(err.message || 'Failed to update file');
    }
  };

  const handleDeleteFileClick = async (id) => {
    if (window.confirm('Are you sure you want to delete this physical file record? This will permanently delete its history.')) {
      try {
        await api.deletePhysicalFile(id);
        fetchData();
      } catch (err) {
        alert('Failed to delete physical file.');
      }
    }
  };

  const resetFileForm = () => {
    setFileForm({
      file_number: '',
      subject: '',
      description: '',
      currently_with_id: '',
      zonal_railway: '',
      status: 'ACTIVE'
    });
    setSelectedFile(null);
  };

  // Dispatch Form Handlers
  const handleDispatchClick = (file) => {
    setSelectedFile(file);
    setDispatchForm({
      to_custodian_id: '',
      movement_date: new Date().toISOString().split('T')[0],
      purpose: '',
      remarks: ''
    });
    setShowDispatchModal(true);
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!dispatchForm.to_custodian_id) {
      alert('Please select a recipient custodian.');
      return;
    }
    try {
      await api.createFileMovement({
        file_id: selectedFile.id,
        to_custodian_id: dispatchForm.to_custodian_id,
        movement_date: dispatchForm.movement_date,
        purpose: dispatchForm.purpose,
        remarks: dispatchForm.remarks
      });
      setShowDispatchModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to record movement');
    }
  };

  // View History Handler
  const handleHistoryClick = async (file) => {
    try {
      const details = await api.getPhysicalFileById(file.id);
      setSelectedFile(details);
      setShowHistoryModal(true);
    } catch (err) {
      alert('Failed to load file movement history.');
    }
  };

  // Personnel Form Handlers
  const handlePersonnelFormChange = (e) => {
    const { name, value } = e.target;
    setPersonnelForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPersonnelClick = () => {
    setSelectedPersonnel(null);
    setPersonnelForm({
      name: '',
      designation: '',
      department: '',
      contact_no: '',
      email: ''
    });
    setShowPersonnelModal(true);
  };

  const handleEditPersonnelClick = (p) => {
    setSelectedPersonnel(p);
    setPersonnelForm({
      name: p.name,
      designation: p.designation || '',
      department: p.department || '',
      contact_no: p.contact_no || '',
      email: p.email || ''
    });
    setShowPersonnelModal(true);
  };

  const handlePersonnelSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedPersonnel) {
        await api.updatePersonnel(selectedPersonnel.id, personnelForm);
      } else {
        await api.createPersonnel(personnelForm);
      }
      setShowPersonnelModal(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to save custodian details');
    }
  };

  const handleDeletePersonnelClick = async (id) => {
    if (window.confirm('Are you sure you want to delete this custodian? Files currently assigned to them will have custodian set to NULL.')) {
      try {
        await api.deletePersonnel(id);
        fetchData();
      } catch (err) {
        alert('Failed to delete custodian.');
      }
    }
  };

  // Filter logic for main table
  const filteredFiles = files.filter(f => {
    const matchesSearch = !searchQuery || 
      f.file_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.currently_with_name && f.currently_with_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.zonal_railway && f.zonal_railway.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All Statuses' || f.status === statusFilter;
    const matchesRailway = railwayFilter === 'All Railways' || (f.zonal_railway && f.zonal_railway.includes(railwayFilter));

    return matchesSearch && matchesStatus && matchesRailway;
  });

  // Dashboard Stats Calculations
  const stats = {
    totalFiles: files.length,
    activeFiles: files.filter(f => f.status === 'ACTIVE').length,
    inTransit: files.filter(f => f.status === 'IN_TRANSIT' || f.status === 'CHECKED_OUT').length,
    lost: files.filter(f => f.status === 'LOST').length
  };

  // Count files per zonal railway for dashboard
  const railwayCounts = files.reduce((acc, f) => {
    if (f.zonal_railway) {
      acc[f.zonal_railway] = (acc[f.zonal_railway] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className={`docuflow-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Sidebar navigation */}
      <aside className="docuflow-sidebar">
        <div className="df-sidebar-logo">
          <div className="df-logo-icon">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM21.5 7.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V9h21V7.5z" />
            </svg>
          </div>
          <span className="df-logo-text">DocuFlow</span>
        </div>

        <nav className="df-sidebar-menu">
          <button 
            className={`df-menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`df-menu-item ${activeTab === 'registry' ? 'active' : ''}`}
            onClick={() => setActiveTab('registry')}
          >
            📂 File Registry
          </button>
          <button 
            className={`df-menu-item ${activeTab === 'movements' ? 'active' : ''}`}
            onClick={() => setActiveTab('movements')}
          >
            🔄 File Movements
          </button>
          <button 
            className={`df-menu-item ${activeTab === 'personnel' ? 'active' : ''}`}
            onClick={() => setActiveTab('personnel')}
          >
            👥 Personnel
          </button>
          <button 
            className={`df-menu-item ${activeTab === 'track' ? 'active' : ''}`}
            onClick={() => setActiveTab('track')}
          >
            🔍 Search & Track
          </button>
        </nav>

        <div className="df-sidebar-footer">
          <div className="df-theme-toggle">
            <span>Dark Mode</span>
            <label className="df-toggle-switch">
              <input 
                type="checkbox" 
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              />
              <span className="df-toggle-slider"></span>
            </label>
          </div>
          <div className="df-version-text">Version 1.0.0</div>
        </div>
      </aside>

      {/* Main content panel */}
      <main className="docuflow-main-panel">
        {/* Top Header */}
        <header className="df-topbar">
          <form className="df-search-bar-container" onSubmit={handleQuickSearchSubmit}>
            <span className="df-search-bar-icon">🔍</span>
            <input 
              type="text" 
              className="df-topbar-search-input" 
              placeholder="Quick search file number (e.g., FIN-2026-008)..."
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
            />
          </form>

          <div className="df-topbar-right">
            <div className="df-date-badge">
              📅 {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="df-user-badge">
              <div className="df-user-avatar">SO</div>
              <span>System Operator</span>
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Panels */}
        <div className="df-workspace-content">
          {error && <div className="alert-banner error" style={{ marginBottom: '1rem' }}>{error}</div>}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="df-dashboard-view">
              <div className="df-page-header">
                <div className="df-page-title-group">
                  <h2>DocuFlow Dashboard</h2>
                  <p>Overview of physical file volumes, status classifications, and recent dispatches.</p>
                </div>
              </div>

              {/* Statistics Row */}
              <div className="df-stats-grid">
                <div className="df-dashboard-card">
                  <div className="df-card-icon-box blue">📁</div>
                  <div className="df-card-details">
                    <span className="df-card-label">Total Files</span>
                    <span className="df-card-value">{stats.totalFiles}</span>
                  </div>
                </div>
                <div className="df-dashboard-card">
                  <div className="df-card-icon-box green">✓</div>
                  <div className="df-card-details">
                    <span className="df-card-label">Active / Stored</span>
                    <span className="df-card-value">{stats.activeFiles}</span>
                  </div>
                </div>
                <div className="df-dashboard-card">
                  <div className="df-card-icon-box orange">⇆</div>
                  <div className="df-card-details">
                    <span className="df-card-label">In Transit / Checked Out</span>
                    <span className="df-card-value">{stats.inTransit}</span>
                  </div>
                </div>
                <div className="df-dashboard-card">
                  <div className="df-card-icon-box red">⚠</div>
                  <div className="df-card-details">
                    <span className="df-card-label">Lost / Flagged</span>
                    <span className="df-card-value">{stats.lost}</span>
                  </div>
                </div>
              </div>

              {/* Cabinet & Recent Movements */}
              <div className="df-dashboard-row">
                {/* Zonal Railway Counts */}
                <div className="df-panel">
                  <h3 className="df-panel-header">File Distribution by Zonal Railway</h3>
                  <div className="df-location-list">
                    {Object.keys(railwayCounts).length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>No zonal railway data available.</p>
                    ) : (
                      Object.entries(railwayCounts).map(([railway, count]) => (
                        <div key={railway} className="df-location-item">
                          <div className="df-location-meta">
                            <span className="df-location-icon">🚂</span>
                            <span className="df-location-name">{railway}</span>
                          </div>
                          <span className="df-location-count">{count} files</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Movements Log */}
                <div className="df-panel">
                  <h3 className="df-panel-header">Recent Dispatches (Logs)</h3>
                  <div className="df-location-list">
                    {movements.slice(0, 5).map((m) => (
                      <div key={m.id} className="df-location-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                          <strong>{m.file_number}</strong>
                          <span>{m.movement_date}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                          {m.from_custodian_name ? m.from_custodian_name : 'Registry'} ➜ {m.to_custodian_name}
                        </div>
                        {m.purpose && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                            Purpose: {m.purpose}
                          </div>
                        )}
                      </div>
                    ))}
                    {movements.length === 0 && (
                      <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>No dispatch logs recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FILE REGISTRY TAB */}
          {activeTab === 'registry' && (
            <div className="df-registry-view">
              <div className="df-page-header">
                <div className="df-page-title-group">
                  <h2>File Registry</h2>
                  <p>Register new physical files and inspect current storage, custodian status, and details.</p>
                </div>
                <button 
                  className="df-btn df-btn-primary"
                  onClick={() => { resetFileForm(); setShowAddFileModal(true); }}
                >
                  ➕ Add New File
                </button>
              </div>

              {/* Search & Filters */}
              <div className="df-filter-bar">
                <div className="df-search-input-wrapper">
                  <span className="df-search-icon">🔍</span>
                  <input 
                    type="text" 
                    className="df-search-input"
                    placeholder="Search registry by File Number, Subject, Custodian, Shelf..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="df-filters-group">
                  <div className="df-filter-control">
                    <label>Status:</label>
                    <select 
                      className="df-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All Statuses">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="CHECKED_OUT">Checked Out</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="ARCHIVED">Archived</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>

                  <div className="df-filter-control">
                    <label>Zonal Railway:</label>
                    <select 
                      className="df-select"
                      value={railwayFilter}
                      onChange={(e) => setRailwayFilter(e.target.value)}
                    >
                      {uniqueRailways.map(railway => (
                        <option key={railway} value={railway}>{railway}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Files Table Grid */}
              <div className="df-table-container">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>SR No</th>
                      <th>File Number</th>
                      <th>Subject & Description</th>
                      <th>Currently With</th>
                      <th>Zonal Railway</th>
                      <th>Status</th>
                      <th style={{ width: '150px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file, idx) => (
                      <tr key={file.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <span className="df-file-no-tag">{file.file_number}</span>
                        </td>
                        <td className="df-subject-cell">
                          <div className="df-subject-title">{file.subject}</div>
                          <div className="df-subject-desc" title={file.description}>
                            {file.description || 'No description provided.'}
                          </div>
                        </td>
                        <td>
                          <div className="df-custodian-cell">
                            <span className="df-custodian-icon">👤</span>
                            <span>{file.currently_with_name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}</span>
                          </div>
                        </td>
                        <td>
                          <div className="df-location-cell">
                            <span className="df-location-icon">🚂</span>
                            <span>{file.zonal_railway || <span style={{ color: '#94a3b8' }}>N/A</span>}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`df-status-badge ${file.status.toLowerCase()}`}>
                            {file.status}
                          </span>
                        </td>
                        <td>
                          <div className="df-actions-cell">
                            <button 
                              className="df-action-btn edit" 
                              title="Edit File"
                              onClick={() => handleEditFileClick(file)}
                            >
                              ✎
                            </button>
                            <button 
                              className="df-action-btn dispatch" 
                              title="Record Movement / Dispatch"
                              onClick={() => handleDispatchClick(file)}
                            >
                              🚀
                            </button>
                            <button 
                              className="df-action-btn history" 
                              title="Movement History"
                              onClick={() => handleHistoryClick(file)}
                            >
                              ⏱
                            </button>
                            <button 
                              className="df-action-btn delete" 
                              title="Delete File"
                              onClick={() => handleDeleteFileClick(file.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                          No physical files match the filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                Showing {filteredFiles.length} of {files.length} files
              </div>
            </div>
          )}

          {/* FILE MOVEMENTS TAB */}
          {activeTab === 'movements' && (
            <div className="df-movements-view">
              <div className="df-page-header">
                <div className="df-page-title-group">
                  <h2>File Movements Log</h2>
                  <p>Comprehensive historical ledger of all physical file custody transitions.</p>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="df-table-container">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>Dispatch Date</th>
                      <th>File Number</th>
                      <th>Subject</th>
                      <th>From Custodian</th>
                      <th>To Custodian</th>
                      <th>Purpose</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.movement_date}</strong></td>
                        <td><span className="df-file-no-tag">{m.file_number}</span></td>
                        <td>{m.subject}</td>
                        <td>{m.from_custodian_name || <span style={{ color: '#94a3b8' }}>Registry Setup</span>}</td>
                        <td><strong>{m.to_custodian_name}</strong></td>
                        <td>{m.purpose || <span style={{ color: '#94a3b8' }}>N/A</span>}</td>
                        <td>{m.remarks || <span style={{ color: '#94a3b8' }}>N/A</span>}</td>
                      </tr>
                    ))}
                    {movements.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                          No movements have been registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PERSONNEL TAB */}
          {activeTab === 'personnel' && (
            <div className="df-personnel-view">
              <div className="df-page-header">
                <div className="df-page-title-group">
                  <h2>Authorized Custodians Directory</h2>
                  <p>Manage personnel and custodians authorized to check out and hold physical files.</p>
                </div>
                <button 
                  className="df-btn df-btn-primary"
                  onClick={handleAddPersonnelClick}
                >
                  ➕ Add Custodian
                </button>
              </div>

              {/* Custodians Table */}
              <div className="df-table-container">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>SR No</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Contact No</th>
                      <th>Email Address</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personnel.map((p, idx) => (
                      <tr key={p.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.designation || 'N/A'}</td>
                        <td>{p.department || 'N/A'}</td>
                        <td>{p.contact_no || 'N/A'}</td>
                        <td>{p.email || 'N/A'}</td>
                        <td>
                          <div className="df-actions-cell">
                            <button 
                              className="df-action-btn edit" 
                              title="Edit Custodian"
                              onClick={() => handleEditPersonnelClick(p)}
                            >
                              ✎
                            </button>
                            <button 
                              className="df-action-btn delete" 
                              title="Delete Custodian"
                              onClick={() => handleDeletePersonnelClick(p.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {personnel.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                          No custodians registered in directory.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEARCH & TRACK TAB */}
          {activeTab === 'track' && (
            <div className="df-track-view">
              <div className="df-page-header">
                <div className="df-page-title-group">
                  <h2>Search & Track Physical Files</h2>
                  <p>Track a physical file's timeline and audit trail of custodian movements.</p>
                </div>
              </div>

              {/* Track Search Bar */}
              <div className="df-track-search-box">
                <h3>Enter Physical File Number</h3>
                <div className="df-track-input-group">
                  <input 
                    type="text" 
                    className="df-track-input"
                    placeholder="e.g. FIN-2026-008"
                    value={trackSearchQuery}
                    onChange={(e) => setTrackSearchQuery(e.target.value)}
                  />
                  <button 
                    className="df-btn df-btn-primary"
                    onClick={() => handleTrackSearch(trackSearchQuery)}
                  >
                    Track Journey
                  </button>
                </div>
              </div>

              {/* Results Details */}
              {trackedFile ? (
                <div className="df-track-result-grid">
                  {/* Left card details */}
                  <div className="df-track-details-card">
                    <div className="df-track-detail-item">
                      <div className="df-track-label">File Number</div>
                      <div className="df-track-value-large">{trackedFile.file_number}</div>
                    </div>
                    <div className="df-track-detail-item">
                      <div className="df-track-label">Subject & Matter</div>
                      <div className="df-track-value">{trackedFile.subject}</div>
                    </div>
                    <div className="df-track-detail-item">
                      <div className="df-track-label">Description</div>
                      <div className="df-track-value" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {trackedFile.description || 'No description provided.'}
                      </div>
                    </div>
                    <div className="df-track-detail-item">
                      <div className="df-track-label">Zonal Railway</div>
                      <div className="df-track-value">{trackedFile.zonal_railway || 'N/A'}</div>
                    </div>
                    <div className="df-track-detail-item">
                      <div className="df-track-label">Current Custodian</div>
                      <div className="df-track-value" style={{ color: '#8b5cf6' }}>
                        👤 {trackedFile.currently_with_name || 'Unassigned / Vault'}
                      </div>
                      {trackedFile.currently_with_designation && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '1.2rem' }}>
                          {trackedFile.currently_with_designation} ({trackedFile.currently_with_department})
                        </div>
                      )}
                    </div>
                    <div className="df-track-detail-item">
                      <div className="df-track-label">Status</div>
                      <span className={`df-status-badge ${trackedFile.status.toLowerCase()}`}>
                        {trackedFile.status}
                      </span>
                    </div>
                  </div>

                  {/* Right card visual timeline */}
                  <div className="df-panel">
                    <h3 className="df-panel-header">Movement Audit Timeline</h3>
                    <div className="timeline-container">
                      {trackedFile.movements && trackedFile.movements.map((m, idx) => (
                        <div key={m.id} className="timeline-item">
                          <div className={`timeline-dot ${!m.from_custodian_id ? 'initial' : ''}`}>
                            {idx === 0 ? '★' : '•'}
                          </div>
                          <div className="timeline-content-card">
                            <div className="timeline-header">
                              <span className="timeline-title">
                                {m.from_custodian_name ? 'Custodian Transfer' : 'File Registration'}
                              </span>
                              <span className="timeline-date">{m.movement_date}</span>
                            </div>
                            <div className="timeline-body">
                              <div className="timeline-people">
                                {m.from_custodian_name ? (
                                  <>
                                    <span>👤 {m.from_custodian_name}</span>
                                    <span className="timeline-arrow">➜</span>
                                  </>
                                ) : null}
                                <span><strong>👤 {m.to_custodian_name}</strong></span>
                              </div>
                              {m.purpose && <div><strong>Purpose:</strong> {m.purpose}</div>}
                              {m.remarks && <div className="timeline-remarks">"{m.remarks}"</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!trackedFile.movements || trackedFile.movements.length === 0) && (
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No movements recorded for this file.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : trackSearchQuery && (
                <div className="df-panel" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No physical file matches number "{trackSearchQuery}". Make sure the number is exact.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}

      {/* Add File Modal */}
      {showAddFileModal && (
        <div className="df-modal-overlay">
          <div className="df-modal-content">
            <div className="df-modal-header">
              <h3>📂 Add New Physical File</h3>
              <button className="df-modal-close-btn" onClick={() => setShowAddFileModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddFileSubmit}>
              <div className="df-modal-body">
                <div className="df-form-group">
                  <label>File Number (Unique)</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="file_number"
                    placeholder="e.g. FIN-2026-008"
                    value={fileForm.file_number}
                    onChange={handleFileFormChange}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Subject / Matter</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="subject"
                    placeholder="Brief description of file contents"
                    value={fileForm.subject}
                    onChange={handleFileFormChange}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Description</label>
                  <textarea 
                    className="df-form-textarea" 
                    name="description"
                    placeholder="Detailed description..."
                    value={fileForm.description}
                    onChange={handleFileFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Initial Custodian (Currently With)</label>
                  <select 
                    className="df-form-select"
                    name="currently_with_id"
                    value={fileForm.currently_with_id}
                    onChange={handleFileFormChange}
                  >
                    <option value="">-- Unassigned / In Vault --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.designation})</option>
                    ))}
                  </select>
                </div>
                <div className="df-form-group">
                  <label>Zonal Railway</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="zonal_railway"
                    placeholder="e.g. ECR, ER, NR, WR"
                    value={fileForm.zonal_railway}
                    onChange={handleFileFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Status</label>
                  <select 
                    className="df-form-select"
                    name="status"
                    value={fileForm.status}
                    onChange={handleFileFormChange}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CHECKED_OUT">CHECKED OUT</option>
                    <option value="IN_TRANSIT">IN TRANSIT</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
              </div>
              <div className="df-modal-footer">
                <button type="button" className="df-btn df-btn-secondary" onClick={() => setShowAddFileModal(false)}>Cancel</button>
                <button type="submit" className="df-btn df-btn-primary">Register File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit File Modal */}
      {showEditFileModal && (
        <div className="df-modal-overlay">
          <div className="df-modal-content">
            <div className="df-modal-header">
              <h3>✎ Edit File Registry Entry</h3>
              <button className="df-modal-close-btn" onClick={() => setShowEditFileModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditFileSubmit}>
              <div className="df-modal-body">
                <div className="df-form-group">
                  <label>File Number</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="file_number"
                    value={fileForm.file_number}
                    onChange={handleFileFormChange}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Subject / Matter</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="subject"
                    value={fileForm.subject}
                    onChange={handleFileFormChange}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Description</label>
                  <textarea 
                    className="df-form-textarea" 
                    name="description"
                    value={fileForm.description}
                    onChange={handleFileFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Custodian (Currently With)</label>
                  <select 
                    className="df-form-select"
                    name="currently_with_id"
                    value={fileForm.currently_with_id}
                    onChange={handleFileFormChange}
                  >
                    <option value="">-- Unassigned / Vault --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.designation})</option>
                    ))}
                  </select>
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    Note: Changing custodian here will log a transfer movement log automatically.
                  </small>
                </div>
                <div className="df-form-group">
                  <label>Zonal Railway</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="zonal_railway"
                    value={fileForm.zonal_railway}
                    onChange={handleFileFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Status</label>
                  <select 
                    className="df-form-select"
                    name="status"
                    value={fileForm.status}
                    onChange={handleFileFormChange}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CHECKED_OUT">CHECKED OUT</option>
                    <option value="IN_TRANSIT">IN TRANSIT</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
              </div>
              <div className="df-modal-footer">
                <button type="button" className="df-btn df-btn-secondary" onClick={() => setShowEditFileModal(false)}>Cancel</button>
                <button type="submit" className="df-btn df-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Dispatch / Movement Modal */}
      {showDispatchModal && (
        <div className="df-modal-overlay">
          <div className="df-modal-content">
            <div className="df-modal-header">
              <h3>🚀 Dispatch File: {selectedFile?.file_number}</h3>
              <button className="df-modal-close-btn" onClick={() => setShowDispatchModal(false)}>×</button>
            </div>
            <form onSubmit={handleDispatchSubmit}>
              <div className="df-modal-body">
                <div style={{ marginBottom: '1rem', background: '#f1f5f9', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Current Custodian:</strong> {selectedFile?.currently_with_name || 'Registry / Vault'}
                </div>
                <div className="df-form-group">
                  <label>Recipient Custodian</label>
                  <select 
                    className="df-form-select"
                    value={dispatchForm.to_custodian_id}
                    onChange={(e) => setDispatchForm(prev => ({ ...prev, to_custodian_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select Recipient --</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.designation})</option>
                    ))}
                  </select>
                </div>
                <div className="df-form-group">
                  <label>Dispatch Date</label>
                  <input 
                    type="date" 
                    className="df-form-input"
                    value={dispatchForm.movement_date}
                    onChange={(e) => setDispatchForm(prev => ({ ...prev, movement_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Purpose of Movement</label>
                  <input 
                    type="text" 
                    className="df-form-input"
                    placeholder="e.g. Case file review, order filing"
                    value={dispatchForm.purpose}
                    onChange={(e) => setDispatchForm(prev => ({ ...prev, purpose: e.target.value }))}
                  />
                </div>
                <div className="df-form-group">
                  <label>Remarks / Notes</label>
                  <textarea 
                    className="df-form-textarea"
                    placeholder="Any specific instructions..."
                    value={dispatchForm.remarks}
                    onChange={(e) => setDispatchForm(prev => ({ ...prev, remarks: e.target.value }))}
                  />
                </div>
              </div>
              <div className="df-modal-footer">
                <button type="button" className="df-btn df-btn-secondary" onClick={() => setShowDispatchModal(false)}>Cancel</button>
                <button type="submit" className="df-btn df-btn-primary">Record Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      {showHistoryModal && (
        <div className="df-modal-overlay">
          <div className="df-modal-content" style={{ maxWidth: '650px' }}>
            <div className="df-modal-header">
              <h3>⏱ Movement History: {selectedFile?.file_number}</h3>
              <button className="df-modal-close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="df-modal-body">
              <div style={{ marginBottom: '1.25rem' }}>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{selectedFile?.subject}</strong>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>{selectedFile?.description}</p>
              </div>
              
              <div className="timeline-container">
                {selectedFile?.movements && selectedFile.movements.map((m, idx) => (
                  <div key={m.id} className="timeline-item">
                    <div className={`timeline-dot ${!m.from_custodian_id ? 'initial' : ''}`}>
                      {idx === 0 ? '★' : '•'}
                    </div>
                    <div className="timeline-content-card">
                      <div className="timeline-header">
                        <span className="timeline-title">
                          {m.from_custodian_name ? 'Custodian Transfer' : 'File Registration'}
                        </span>
                        <span className="timeline-date">{m.movement_date}</span>
                      </div>
                      <div className="timeline-body">
                        <div className="timeline-people">
                          {m.from_custodian_name ? (
                            <>
                              <span>👤 {m.from_custodian_name}</span>
                              <span className="timeline-arrow">➜</span>
                            </>
                          ) : null}
                          <span><strong>👤 {m.to_custodian_name}</strong></span>
                        </div>
                        {m.purpose && <div><strong>Purpose:</strong> {m.purpose}</div>}
                        {m.remarks && <div className="timeline-remarks">"{m.remarks}"</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {(!selectedFile?.movements || selectedFile.movements.length === 0) && (
                  <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No dispatches logged.</p>
                )}
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" className="df-btn df-btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Personnel Modal */}
      {showPersonnelModal && (
        <div className="df-modal-overlay">
          <div className="df-modal-content">
            <div className="df-modal-header">
              <h3>👥 {selectedPersonnel ? 'Edit Custodian Details' : 'Register Authorized Custodian'}</h3>
              <button className="df-modal-close-btn" onClick={() => setShowPersonnelModal(false)}>×</button>
            </div>
            <form onSubmit={handlePersonnelSubmit}>
              <div className="df-modal-body">
                <div className="df-form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="name"
                    value={personnelForm.name}
                    onChange={handlePersonnelFormChange}
                    required
                  />
                </div>
                <div className="df-form-group">
                  <label>Designation</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="designation"
                    placeholder="e.g. Section Officer"
                    value={personnelForm.designation}
                    onChange={handlePersonnelFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Department</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="department"
                    placeholder="e.g. Establishment (G)"
                    value={personnelForm.department}
                    onChange={handlePersonnelFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Contact Number</label>
                  <input 
                    type="text" 
                    className="df-form-input" 
                    name="contact_no"
                    placeholder="10-digit number"
                    value={personnelForm.contact_no}
                    onChange={handlePersonnelFormChange}
                  />
                </div>
                <div className="df-form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="df-form-input" 
                    name="email"
                    placeholder="name@railways.gov.in"
                    value={personnelForm.email}
                    onChange={handlePersonnelFormChange}
                  />
                </div>
              </div>
              <div className="df-modal-footer">
                <button type="button" className="df-btn df-btn-secondary" onClick={() => setShowPersonnelModal(false)}>Cancel</button>
                <button type="submit" className="df-btn df-btn-primary">Save Custodian</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
