import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

const DEFAULT_COLUMNS = [
  { id: 'sno', label: 'S.No.' },
  { id: 'railway', label: 'Railway' },
  { id: 'name', label: 'Name (Parties)', minWidth: '180px' },
  { id: 'designation', label: 'Designation' },
  { id: 'caseType', label: 'Case Type' },
  { id: 'caseNumber', label: 'Case Number' },
  { id: 'year', label: 'Year' },
  { id: 'forum', label: 'CAT/HC' },
  { id: 'issue', label: 'Issue (Synopsis)', minWidth: '220px' },
  { id: 'fileNo', label: 'File No.' },
  { id: 'replyFiled', label: 'Reply Filed' },
  { id: 'doh', label: 'DOH' },
  { id: 'nextHearing', label: 'Next Hearing' },
  { id: 'status', label: 'Status' },
  { id: 'linkFileNo', label: 'Link File No.' },
  { id: 'courtLink', label: 'Updates Link', minWidth: '150px' }
];

export default function CaseList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Columns Drag & Drop state
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('case_list_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedIds = parsed.map(c => c.id);
        const allExist = DEFAULT_COLUMNS.every(c => savedIds.includes(c.id));
        if (allExist && parsed.length === DEFAULT_COLUMNS.length) {
          return parsed;
        }
      } catch (e) {
        console.error("Error loading saved columns:", e);
      }
    }
    return DEFAULT_COLUMNS;
  });

  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  const handleDragStart = (e, columnId) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedColumnId !== columnId && dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragEnd = () => {
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      setDragOverColumnId(null);
      return;
    }

    const draggedIdx = columns.findIndex(c => c.id === draggedColumnId);
    const targetIdx = columns.findIndex(c => c.id === targetColumnId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const newColumns = [...columns];
      const [draggedCol] = newColumns.splice(draggedIdx, 1);
      newColumns.splice(targetIdx, 0, draggedCol);
      setColumns(newColumns);
      localStorage.setItem('case_list_columns', JSON.stringify(newColumns));
    }

    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
    localStorage.removeItem('case_list_columns');
  };

  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [searchParams] = useSearchParams();
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'All');
  const [selectedForum, setSelectedForum] = useState(searchParams.get('forum') || 'All');
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || 'All');
  const [selectedRailway, setSelectedRailway] = useState(searchParams.get('railway') || 'All');

  // Sort state
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await api.getCases();
      setCases(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load cases. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    if (!status) return 'pending';
    const s = status.toLowerCase();
    if (s.includes('disposed')) return 'disposed';
    if (s.includes('sine die') || s.includes('sinedie')) return 'sinedie';
    if (s.includes('urgent') || s.includes('deadline')) return 'urgent';
    return 'pending';
  };

  // Filter unique lists
  const uniqueForums = ['All', ...new Set(cases.map(c => c.forum).filter(Boolean))];
  const uniqueYears = ['All', ...new Set(cases.map(c => c.case_year).filter(Boolean))].sort((a, b) => b - a);
  const uniqueRailways = ['All', ...new Set(cases.map(c => c.railway).filter(Boolean))];

  const filteredCases = cases.filter(c => {
    const q = searchText.trim().toLowerCase();
    let matchesSearch = q === '';
    if (q !== '') {
      const haystack = [
        c.case_ref_no, c.applicant, c.respondent, c.synopsis, c.file_no,
        c.employee_designation, c.forum, c.railway, c.present_status,
        c.case_number, c.case_year, c.advocate_name, c.nodal_officer_name,
        c.link_file_no, c.original_oa_no,
      ].filter(Boolean).join(' ').toLowerCase();
      matchesSearch = haystack.includes(q);
    }

    // 2. Status
    let matchesStatus = true;
    if (selectedStatus !== 'All') {
      const sClass = getStatusClass(c.present_status);
      const selClass = selectedStatus.toLowerCase();
      if (selClass === 'disposed') matchesStatus = sClass === 'disposed';
      else if (selClass === 'sine die') matchesStatus = sClass === 'sinedie';
      else if (selClass === 'urgent') matchesStatus = sClass === 'urgent';
      else if (selClass === 'pending') matchesStatus = sClass === 'pending';
      else matchesStatus = c.present_status === selectedStatus;
    }

    // 3. Forum
    const matchesForum = selectedForum === 'All' || c.forum === selectedForum;

    // 4. Year
    const matchesYear = selectedYear === 'All' || String(c.case_year) === String(selectedYear);

    // 5. Railway
    const matchesRailway = selectedRailway === 'All' || c.railway === selectedRailway;

    return matchesSearch && matchesStatus && matchesForum && matchesYear && matchesRailway;
  });

  // Sort
  const colToField = { year: 'case_year', caseNumber: 'case_number', caseType: 'case_type', railway: 'railway', forum: 'forum', status: 'present_status', doh: 'next_hearing_date', nextHearing: 'next_hearing_date', replyFiled: 'date_filing_reply', fileNo: 'file_no', designation: 'employee_designation', name: 'applicant', issue: 'synopsis', courtLink: 'court_link', linkFileNo: 'link_file_no' };
  const sortedCases = sortCol ? [...filteredCases].sort((a, b) => {
    const field = colToField[sortCol] || sortCol;
    const va = a[field] || '', vb = b[field] || '';
    if (field === 'next_hearing_date' || field === 'date_filing_reply') {
      return sortAsc ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
    }
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }) : filteredCases;

  // Pagination Logic
  const totalFiltered = sortedCases.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedStatus, selectedForum, selectedYear, selectedRailway]);

  useEffect(() => {
    const status = searchParams.get('status');
    const forum = searchParams.get('forum');
    const year = searchParams.get('year');
    const railway = searchParams.get('railway');
    if (status) setSelectedStatus(status);
    if (forum) setSelectedForum(forum);
    if (year) setSelectedYear(year);
    if (railway) setSelectedRailway(railway);
  }, [searchParams]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedCases.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div>
      <div className="section-header-goi" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h2 className="goi-title-main">मामला विवरण तालिका / Case Details spreadsheet grid</h2>
          <p className="goi-subtitle-main">Full 14-column spreadsheet grid matching active Railway legal files.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/cases/new')}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '0.25rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          नया मामला दर्ज करें / Add Case
        </button>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      {/* Search & Filters */}
      <div className="controls-panel" style={{ background: '#fff', border: '1px solid #d1d5db' }}>
        <div className="search-input-wrapper">
          <svg className="search-icon-svg" width="18" height="18" fill="none" stroke="#4b5563" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            className="search-input"
            style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
            placeholder="Search by case ref, name, designation, issue details, file number..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label" style={{ color: '#374151' }}>Status:</label>
            <select className="select-input" style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Disposed">Disposed</option>
              <option value="Urgent">Urgent</option>
              <option value="Sine Die">Sine Die</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" style={{ color: '#374151' }}>Forum (CAT/HC):</label>
            <select className="select-input" style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }} value={selectedForum} onChange={(e) => setSelectedForum(e.target.value)}>
              {uniqueForums.map(f => (
                <option key={f} value={f}>{f === 'All' ? 'All Forums' : f}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" style={{ color: '#374151' }}>Year:</label>
            <select className="select-input" style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              {uniqueYears.map(y => (
                <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" style={{ color: '#374151' }}>Railway:</label>
            <select className="select-input" style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }} value={selectedRailway} onChange={(e) => setSelectedRailway(e.target.value)}>
              {uniqueRailways.map(r => (
                <option key={r} value={r}>{r === 'All' ? 'All Railways' : r}</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}>{totalFiltered} matches</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.4rem 0.8rem' }}
              onClick={() => {
                setSearchText('');
                setSelectedStatus('All');
                setSelectedForum('All');
                setSelectedYear('All');
                setSelectedRailway('All');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Search Results Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          {(searchText.trim() || selectedStatus !== 'All' || selectedForum !== 'All' || selectedYear !== 'All' || selectedRailway !== 'All') ? (
            <>Showing <span style={{ color: '#0f2c59' }}>{filteredCases.length}</span> of {cases.length} cases
            {searchText.trim() && <span style={{ color: '#6b7280' }}> matching "{searchText.trim()}"</span>}
            </>
          ) : (
            <>Showing all <span style={{ color: '#0f2c59' }}>{cases.length}</span> cases</>
          )}
        </span>
        {(searchText.trim() || selectedStatus !== 'All' || selectedForum !== 'All' || selectedYear !== 'All' || selectedRailway !== 'All') && (
          <button
            onClick={() => { setSearchText(''); setSelectedStatus('All'); setSelectedForum('All'); setSelectedYear('All'); setSelectedRailway('All'); setCurrentPage(1); }}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Spreadsheet grid */}
      <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', padding: '1rem' }}>
        {loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p style={{ color: '#4b5563' }}>Loading cases spreadsheet...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="empty-state">
            <h3 style={{ color: '#0f2c59' }}>No cases found matching filters</h3>
            <p style={{ color: '#6b7280' }}>Modify search keywords or clear filters to retrieve records.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <span style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                💡 <strong>Tip:</strong> Drag & drop column headers to rearrange columns to your preference.
              </span>
              <button 
                onClick={resetColumns} 
                className="reset-layout-btn"
                title="Reset column order to default layout"
              >
                Reset Column Order
              </button>
            </div>
            <div className="cases-table-container" style={{ border: '1px solid #d1d5db' }}>
              <table className="cases-table">
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {columns.map(col => (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`draggable-th ${draggedColumnId === col.id ? 'dragging' : ''} ${dragOverColumnId === col.id ? 'drag-over' : ''}`}
                        style={{
                          color: '#4b5563', cursor: 'pointer',
                          padding: col.id === 'sno' ? '0.75rem 0.5rem' : '0.75rem 1rem',
                          minWidth: col.minWidth || 'auto',
                          textAlign: col.id === 'sno' ? 'center' : 'left'
                        }}
                        title="Click to sort · Drag to reorder"
                        onClick={() => {
                          if (sortCol === col.id) setSortAsc(!sortAsc);
                          else { setSortCol(col.id); setSortAsc(true); }
                        }}
                      >
                        <span className="drag-handle-dots">⋮⋮</span>
                        {col.label}{sortCol === col.id ? (sortAsc ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((c, idx) => {
                    const serialNumber = indexOfFirstItem + idx + 1;
                    return (
                      <tr key={c.id}>
                        {columns.map(col => {
                          switch (col.id) {
                            case 'sno':
                              return (
                                <td key="sno" style={{ fontWeight: 'bold', color: '#6b7280', padding: '1rem 0.5rem', textAlign: 'center' }}>
                                  {serialNumber}
                                </td>
                              );
                            case 'railway':
                              return (
                                <td key="railway" style={{ fontWeight: 600, color: '#374151' }}>{c.railway || '-'}</td>
                              );
                            case 'name':
                              return (
                                <td key="name">
                                  <span 
                                    className="case-ref-link" 
                                    style={{ color: '#1e3a8a', cursor: 'pointer', fontWeight: 700 }}
                                    onClick={() => navigate(`/cases/${c.id}`)}
                                  >
                                    {c.applicant || 'Petitioner'}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', margin: '0.15rem 0' }}>Vs.</span>
                                  <span style={{ fontSize: '0.85rem', color: '#4b5563', display: 'block' }}>{c.respondent || 'UOI & Ors.'}</span>
                                </td>
                              );
                            case 'designation':
                              return (
                                <td key="designation" style={{ fontSize: '0.85rem', color: '#4b5563' }}>{c.employee_designation || '-'}</td>
                              );
                            case 'caseType':
                              return (
                                <td key="caseType" style={{ fontWeight: 600, color: '#111827' }}>{c.case_type || '-'}</td>
                              );
                            case 'caseNumber':
                              return (
                                <td key="caseNumber" style={{ fontWeight: 600, color: '#111827' }}>{c.case_number || '-'}</td>
                              );
                            case 'year':
                              return (
                                <td key="year">{c.case_year || '-'}</td>
                              );
                            case 'forum':
                              return (
                                <td key="forum" style={{ fontWeight: 600 }}>{c.forum || '-'}</td>
                              );
                            case 'issue':
                              return (
                                <td key="issue" style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.4' }}>
                                  <div style={{
                                    maxHeight: '4.5em',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical'
                                  }} title={c.synopsis}>
                                    {c.synopsis || '-'}
                                  </div>
                                </td>
                              );
                            case 'fileNo':
                              return (
                                <td key="fileNo" style={{ fontSize: '0.8rem', color: '#374151' }}>{c.file_no || '-'}</td>
                              );
                            case 'replyFiled':
                              return (
                                <td key="replyFiled" style={{ fontSize: '0.85rem' }}>
                                  {c.date_filing_reply ? (
                                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                                      {new Date(c.date_filing_reply).toLocaleDateString()}
                                    </span>
                                  ) : c.last_date_reply ? (
                                    <span style={{ color: '#f59e0b', fontWeight: 500 }}>
                                      Due: {new Date(c.last_date_reply).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>Pending</span>
                                  )}
                                </td>
                              );
                            case 'doh':
                              return (
                                <td key="doh" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                  {c.next_hearing_date ? (
                                    new Date(c.next_hearing_date).toLocaleDateString()
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>-</span>
                                  )}
                                </td>
                              );
                            case 'nextHearing':
                              const nextDate = c.next_hearing_date ? new Date(c.next_hearing_date) : null;
                              const today = new Date(); today.setHours(0,0,0,0);
                              let urgency = 'none', urgencyColor = '#9ca3af';
                              if (nextDate && getStatusClass(c.present_status) !== 'disposed') {
                                const daysLeft = Math.ceil((nextDate - today) / 86400000);
                                if (daysLeft < 0) { urgency = 'overdue'; urgencyColor = '#DC2626'; }
                                else if (daysLeft <= 3) { urgency = 'critical'; urgencyColor = '#DC2626'; }
                                else if (daysLeft <= 7) { urgency = 'soon'; urgencyColor = '#D97706'; }
                                else { urgency = 'upcoming'; urgencyColor = '#059669'; }
                              }
                              return (
                                <td key="nextHearing" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    {urgency !== 'none' && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: urgencyColor, flexShrink: 0 }} title={urgency} />}
                                    <span style={{ color: urgencyColor === '#9ca3af' ? '#9ca3af' : urgencyColor }}>
                                      {c.next_hearing_date ? nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                    </span>
                                  </div>
                                </td>
                              );
                            case 'status':
                              return (
                                <td key="status">
                                  <span className={`status-tag ${getStatusClass(c.present_status)}`} style={{ boxShadow: 'none' }}>
                                    {c.present_status || 'Pending'}
                                  </span>
                                </td>
                              );
                            case 'linkFileNo':
                              return (
                                <td key="linkFileNo" style={{ fontSize: '0.8rem', color: '#4b5563' }}>{c.link_file_no || '-'}</td>
                              );
                            case 'courtLink':
                              return (
                                <td key="courtLink" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                                  {c.court_link ? (
                                    <a 
                                      href={c.court_link} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#166534', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                                      title="Open court updates link"
                                    >
                                      <span>🔗 Link</span>
                                    </a>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>-</span>
                                  )}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="list-footer" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
              <div style={{ color: '#4b5563' }}>
                Showing <strong>{indexOfFirstItem + 1}</strong> to <strong>{Math.min(indexOfLastItem, totalFiltered)}</strong> of <strong>{totalFiltered}</strong> case files
              </div>
              <div className="pagination-controls">
                <button 
                  className="btn btn-secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', fontWeight: 600, color: '#111827' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ padding: '0.4rem 0.8rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
