import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Citations() {
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newCitation, setNewCitation] = useState({
    category: '56j',
    title: '',
    description: '',
    where_to_cite: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // PDF upload + AI auto-fill state
  const [pdfFile, setPdfFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    fetchCitations();
  }, []);

  const fetchCitations = async () => {
    try {
      setLoading(true);
      const data = await api.getCitations();
      setCitations(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch legal citations.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCitation(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (citation) => {
    setNewCitation({
      category: citation.category,
      title: citation.title,
      description: citation.description || '',
      where_to_cite: citation.where_to_cite || ''
    });
    setEditingId(citation.id);
    setIsEditMode(true);
    setShowAddForm(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("Are you sure you want to delete this judicial precedent citation? / क्या आप वाकई इस कानूनी संदर्भ को हटाना चाहते हैं?")) {
      try {
        await api.deleteCitation(id);
        setCitations(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error(err);
        alert('Failed to delete citation.');
      }
    }
  };

  const resetForm = () => {
    setNewCitation({
      category: '56j',
      title: '',
      description: '',
      where_to_cite: ''
    });
    setIsEditMode(false);
    setEditingId(null);
    setShowAddForm(false);
    setPdfFile(null);
    setIsAnalyzing(false);
    setAiError(null);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const result = await api.parseCitationPdf(file);
      if (result.error) {
        setAiError(result.error);
      } else {
        setNewCitation(prev => ({
          ...prev,
          category: result.category || prev.category,
          title: result.title || prev.title,
          description: result.description || prev.description,
          where_to_cite: result.where_to_cite || prev.where_to_cite,
        }));
      }
    } catch (err) {
      setAiError(err.message || 'Failed to analyze PDF. Please enter details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newCitation.title.trim()) return;

    try {
      setSubmitting(true);
      if (isEditMode) {
        const updated = await api.updateCitation(editingId, newCitation);
        // Map over state to replace the updated citation
        setCitations(prev => prev.map(c => c.id === editingId ? { ...c, ...updated } : c));
      } else {
        const added = await api.createCitation(newCitation);
        setCitations(prev => [added, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert(isEditMode ? 'Failed to update citation.' : 'Failed to save citation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter logic
  const filteredCitations = citations.filter(c => {
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesSearch = searchText === '' ||
      (c.title && c.title.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.description && c.description.toLowerCase().includes(searchText.toLowerCase())) ||
      (c.where_to_cite && c.where_to_cite.toLowerCase().includes(searchText.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="citations-page">
      <div className="section-header-goi" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 className="goi-title-main">कानूनी उद्धरण पुस्तकालय / Legal Citations Library</h2>
          <p className="goi-subtitle-main">Browse, search, and manage judicial precedents regarding Rule 56(j) and UPSC Advice.</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setIsEditMode(false);
          setNewCitation({
            category: '56j',
            title: '',
            description: '',
            where_to_cite: ''
          });
          setShowAddForm(true);
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Citation
        </button>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      {/* Filter and Search controls */}
      <div className="controls-panel" style={{ background: '#fff', border: '1px solid #d1d5db' }}>
        <div className="filters-row" style={{ width: '100%' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon-svg" width="18" height="18" fill="none" stroke="#4b5563" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              className="search-input"
              style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
              placeholder="Search citations by title, ruling, keywords, or applications..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" style={{ color: '#374151' }}>Category:</label>
            <select
              className="select-input"
              style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Precedents</option>
              <option value="56j">Rule 56(j) / Compulsory Retirement</option>
              <option value="upsc_advice">UPSC Advice directory nature</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Citations */}
      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p style={{ color: '#4b5563' }}>Loading citations...</p>
        </div>
      ) : filteredCitations.length === 0 ? (
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #e5e7eb', textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>No legal citations found matching the criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {filteredCitations.map((c) => (
            <div key={c.id} className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className={`status-tag ${c.category === '56j' ? 'disposed' : 'sinedie'}`} style={{ boxShadow: 'none' }}>
                  {c.category === '56j' ? 'Rule 56(j)' : 'UPSC Advice'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  <button 
                    onClick={() => handleEditClick(c)}
                    style={{ background: 'none', border: 'none', color: '#0f2c59', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: 0 }}
                    title="Edit Precedent / संपादित करें"
                  >
                    ✎ Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(c.id)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: 0 }}
                    title="Delete Precedent / हटाएं"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
              <h3 style={{ fontSize: '1.2rem', color: '#0f2c59', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Outfit' }}>
                {c.title}
              </h3>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Ruling / Summary:</strong>
                <p style={{ color: '#4b5563', fontSize: '0.925rem', lineHeight: '1.5' }}>{c.description}</p>
              </div>
              {c.where_to_cite && (
                <div style={{ background: '#f3f4f6', borderLeft: '3px solid #003366', padding: '0.75rem 1rem', borderRadius: '0 8px 8px 0' }}>
                  <strong style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e3a8a', display: 'block', marginBottom: '0.2rem' }}>Where to Cite / Application:</strong>
                  <p style={{ color: '#374151', fontSize: '0.875rem', italic: 'true' }}>{c.where_to_cite}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Citation Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: '#fff', border: '1px solid #9ca3af', maxWidth: '580px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ color: '#0f2c59', fontWeight: 700 }}>
                {isEditMode ? 'संपादित करें / Edit Judicial Precedent' : 'नया संदर्भ जोड़ें / Add Judicial Precedent'}
              </h3>
              <button className="modal-close-btn" onClick={resetForm}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* PDF Upload Section */}
                <div className="citation-pdf-section">
                  <label className="citation-pdf-label">
                    <svg width="18" height="18" fill="none" stroke="#4b5563" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                    <span>Upload Judgment PDF for AI Auto-Fill</span>
                    <span className="citation-pdf-hint">PDF should be text-searchable</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    style={{ display: 'none' }}
                    id="citation-pdf-input"
                  />
                  <label htmlFor="citation-pdf-input" className="citation-pdf-drop">
                    {isAnalyzing ? (
                      <div className="citation-analyzing">
                        <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                        <span>Analyzing PDF with AI...</span>
                      </div>
                    ) : pdfFile ? (
                      <div className="citation-pdf-loaded">
                        <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        <span>{pdfFile.name}</span>
                        <button
                          type="button"
                          className="citation-pdf-change"
                          onClick={(e) => {
                            e.preventDefault();
                            setPdfFile(null);
                            setAiError(null);
                            document.getElementById('citation-pdf-input').value = '';
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="citation-pdf-placeholder">
                        <svg width="28" height="28" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                        <span>Click to upload judgment PDF</span>
                        <span className="citation-pdf-or">or fill manually below</span>
                      </div>
                    )}
                  </label>
                  {aiError && (
                    <div className="citation-ai-error">
                      <svg width="14" height="14" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {aiError}
                    </div>
                  )}
                  {!aiError && !isAnalyzing && pdfFile && (
                    <div className="citation-ai-success">
                      <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      AI analysis complete — review below
                    </div>
                  )}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.5rem 0 1rem 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#4b5563' }}>Category</label>
                    <select
                      className="form-control"
                      name="category"
                      style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                      value={newCitation.category}
                      onChange={handleInputChange}
                    >
                      <option value="56j">Rule 56(j) / Compulsory Retirement</option>
                      <option value="upsc_advice">UPSC Advice</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#4b5563' }}>Title (e.g. Case Name & Citation)</label>
                    <input
                      type="text"
                      className="form-control"
                      name="title"
                      style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                      placeholder="Union of India Vs. Dulal Dutt (1993) 2 SCC 179"
                      value={newCitation.title}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#4b5563' }}>Ruling Description / Key Holding</label>
                    <textarea
                      className="form-control"
                      name="description"
                      rows="4"
                      style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                      placeholder="Explain the legal holding of the court in this case..."
                      value={newCitation.description}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#4b5563' }}>Where to Cite / Application Guidance</label>
                    <textarea
                      className="form-control"
                      name="where_to_cite"
                      rows="3"
                      style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                      placeholder="Provide guidelines on which cases or response pleadings this citation should be applied to..."
                      value={newCitation.where_to_cite}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : isEditMode ? 'Update Precedent' : 'Add Precedent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
