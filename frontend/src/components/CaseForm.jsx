import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import AiSettingsPanel from './AiSettingsPanel';

export default function CaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const [userScope, setUserScope] = useState(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return (user && user.railwayScope) ? user.railwayScope : 'All';
      }
    } catch (e) {
      console.error(e);
    }
    return 'All';
  });

  // Set default railway from logged-in user if in create mode
  useEffect(() => {
    if (!isEditMode && userScope !== 'All') {
      setFormData(prev => ({
        ...prev,
        railway: userScope
      }));
    }
  }, [isEditMode, userScope]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  // Ingestion states
  const [ingestionText, setIngestionText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [extractedYaml, setExtractedYaml] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [formData, setFormData] = useState({
    case_type: '',
    case_number: '',
    case_year: '',
    forum: '',
    case_ref_no: '',
    railway: '',
    employee_designation: '',
    applicant: '',
    respondent: 'Union of India (UOI) & Ors.',
    file_no: '',
    link_file_no: '',
    present_status: 'Pending',
    last_date_reply: '',
    date_filing_reply: '',
    last_date_appeal_implementation: '',
    nodal_officer_name: '',
    nodal_officer_contact: '',
    advocate_name: '',
    advocate_contact: '',
    synopsis: '',
    original_oa_no: '',
    original_oa_forum: '',
    original_oa_date_disposal: '',
    original_oa_status: '',
    court_link: ''
  });

  // Fetch case data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      fetchCaseDetails();
    }
  }, [id]);

  const fetchCaseDetails = async () => {
    try {
      setFetching(true);
      const data = await api.getCaseById(id);
      
      const formatDate = (dStr) => {
        if (!dStr) return '';
        return dStr.split('T')[0];
      };

      // Authorization Check
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.railwayScope && user.railwayScope !== 'All' && data.railway !== user.railwayScope) {
          throw new Error('Unauthorized Access: You do not have permission to edit cases outside your assigned railway zone.');
        }
      }

      setFormData({
        case_type: data.case_type || '',
        case_number: data.case_number || '',
        case_year: data.case_year || '',
        forum: data.forum || '',
        case_ref_no: data.case_ref_no || '',
        railway: data.railway || '',
        employee_designation: data.employee_designation || '',
        applicant: data.applicant || '',
        respondent: data.respondent || 'Union of India (UOI) & Ors.',
        file_no: data.file_no || '',
        link_file_no: data.link_file_no || '',
        present_status: data.present_status || 'Pending',
        last_date_reply: formatDate(data.last_date_reply),
        date_filing_reply: formatDate(data.date_filing_reply),
        last_date_appeal_implementation: formatDate(data.last_date_appeal_implementation),
        nodal_officer_name: data.nodal_officer_name || '',
        nodal_officer_contact: data.nodal_officer_contact || '',
        advocate_name: data.advocate_name || '',
        advocate_contact: data.advocate_contact || '',
        synopsis: data.synopsis || '',
        original_oa_no: data.original_oa_no || '',
        original_oa_forum: data.original_oa_forum || '',
        original_oa_date_disposal: formatDate(data.original_oa_date_disposal),
        original_oa_status: data.original_oa_status || '',
        court_link: data.court_link || ''
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch case details for editing.');
    } finally {
      setFetching(false);
    }
  };

  // Auto-generate reference number if not in edit mode
  useEffect(() => {
    if (!isEditMode && formData.case_type && formData.case_number) {
      let ref = `${formData.case_type}/${formData.case_number}`;
      if (formData.case_year) {
        ref += `/${formData.case_year}`;
      }
      if (formData.forum) {
        ref += ` (${formData.forum})`;
      }
      setFormData(prev => ({ ...prev, case_ref_no: ref }));
    }
  }, [formData.case_type, formData.case_number, formData.case_year, formData.forum, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // AI Parser caller
  const handleIngest = async () => {
    if (!ingestionText.trim()) return;
    try {
      setParsing(true);
      setError(null);
      const response = await api.parseCaseFile(ingestionText);
      setExtractedYaml(response.yaml);
    } catch (err) {
      console.error(err);
      setError('AI Case File extraction failed: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // PDF Ingestion handler
  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a valid PDF file. / कृपया एक मान्य पीडीएफ फाइल चुनें।');
      return;
    }
    
    try {
      setParsing(true);
      setError(null);
      setSelectedFile(file);
      
      const response = await api.parseCaseFilePdf(file);
      setExtractedYaml(response.yaml);
      
      if (response.text) {
        setIngestionText(response.text);
      } else {
        setIngestionText(`[Successfully parsed text from PDF: ${file.name}]`);
      }
    } catch (err) {
      console.error(err);
      setError('AI PDF Case Ingestion failed: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handlePdfUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handlePdfUpload(file);
    }
  };

  // Parser helper to convert YAML to JSON
  const loadYamlIntoForm = () => {
    if (!extractedYaml.trim()) return;
    try {
      const lines = extractedYaml.split('\n');
      const parsed = {};
      lines.forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          let val = line.substring(colonIndex + 1).trim();
          
          // Remove wrapping quotes
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.substring(1, val.length - 1);
          }
          
          parsed[key] = val;
        }
      });

      setFormData(prev => ({
        ...prev,
        case_type: parsed.case_type || prev.case_type,
        case_number: parsed.case_number || prev.case_number,
        case_year: parsed.case_year || prev.case_year,
        forum: parsed.forum || prev.forum,
        railway: parsed.railway || prev.railway,
        employee_designation: parsed.employee_designation || prev.employee_designation,
        applicant: parsed.applicant || prev.applicant,
        respondent: parsed.respondent || prev.respondent,
        file_no: parsed.file_no || prev.file_no,
        link_file_no: parsed.link_file_no || prev.link_file_no,
        present_status: parsed.present_status || prev.present_status,
        synopsis: parsed.synopsis || prev.synopsis,
        original_oa_no: parsed.original_oa_no || prev.original_oa_no,
        original_oa_forum: parsed.original_oa_forum || prev.original_oa_forum,
        original_oa_date_disposal: parsed.original_oa_date_disposal || prev.original_oa_date_disposal,
        original_oa_status: parsed.original_oa_status || prev.original_oa_status,
        court_link: parsed.court_link || prev.court_link
      }));
      
      // Clear ingestion pane
      setIngestionText('');
      setExtractedYaml('');
    } catch (err) {
      console.error(err);
      setError('Failed to parse YAML text. Please check format rules.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.case_ref_no) {
      setError('Case Reference Number is required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dataToSubmit = { ...formData };
      
      if (isEditMode) {
        await api.updateCase(id, dataToSubmit);
        navigate(`/cases/${id}`);
      } else {
        const newCase = await api.createCase(dataToSubmit);
        navigate(`/cases/${newCase.id}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save case. Please check for unique constraints.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p style={{ color: '#4b5563' }}>Retrieving case details...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link to={isEditMode ? `/cases/${id}` : '/cases'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#1e3a8a', fontWeight: 600 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to {isEditMode ? 'Case Profile' : 'Spreadsheet Grid'}
        </Link>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f2c59', fontFamily: 'Outfit' }}>
          {isEditMode ? 'मामला प्रोफाइल संपादित करें / Edit Case Profile' : 'नया मामला दर्ज करें / Register New Case'}
        </h1>
        <p style={{ color: '#4b5563', marginTop: '0.25rem' }}>
          Fill out core case attributes, target milestone timelines, and officer directories manually, or use the single-window AI uploader.
        </p>
      </div>

      {error && (
        <div className="alert-banner error">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          {error}
        </div>
      )}

      {/* Single Window Ingestion: ONLY in Add Mode */}
      {!isEditMode && (
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #ff9933', paddingBottom: '0.5rem', marginBottom: '1.25rem', fontFamily: 'Outfit', fontWeight: 700 }}>
            एकल खिड़की एआई मामला प्रविष्टि / AI Single Window Case Ingestion
          </h3>
          <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Upload a PDF case file or paste the raw text of the petition, court order, or case details below. The AI will extract relevant case details, generate the structured **YAML configuration**, and auto-fill the form inputs.
          </p>

          <AiSettingsPanel />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Left Column: PDF Drop Zone */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ color: '#0f2c59', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                PDF File Uploader / पीडीएफ फाइल अपलोडर
              </label>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragOver ? '2px dashed #ff9933' : '2px dashed #0f2c59',
                  backgroundColor: isDragOver ? '#fffaf5' : '#f9fafb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '150px'
                }}
                onClick={() => document.getElementById('pdf-file-input').click()}
              >
                <input 
                  id="pdf-file-input"
                  type="file" 
                  accept=".pdf" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                  disabled={parsing}
                />
                <svg width="40" height="40" fill="none" stroke={isDragOver ? '#ff9933' : '#0f2c59'} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '0.5rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#1f2937', fontWeight: 600 }}>
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'Drag & Drop PDF here, or click to browse'}
                </p>
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  Supported format: PDF only. Max size 10MB.
                </span>
              </div>
            </div>

            {/* Right Column: Paste Raw Text Area */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ color: '#0f2c59', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                Or Paste Raw Text / या मूल पाठ पेस्ट करें
              </label>
              <textarea
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827', flex: 1, minHeight: '150px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }}
                placeholder="Paste raw petition text, legal notices, or daily order transcript here..."
                value={ingestionText}
                onChange={(e) => setIngestionText(e.target.value)}
                disabled={parsing}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ background: '#0f2c59', color: '#fff', borderColor: 'transparent' }}
              onClick={handleIngest}
              disabled={parsing || !ingestionText.trim()}
            >
              {parsing ? 'AI Extracting Details...' : 'Analyze & Extract Details'}
            </button>
            {parsing && <div className="spinner-small"></div>}
          </div>

            {extractedYaml && (
              <div style={{ marginTop: '1rem', animation: 'modalScaleUp 0.3s ease' }}>
                <label className="form-label" style={{ color: '#0f2c59' }}>Generated YAML Configuration (Editable)</label>
                <textarea
                  className="form-control"
                  style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.85rem', 
                    background: '#f3f4f6', 
                    borderColor: '#9ca3af', 
                    color: '#1f2937', 
                    minHeight: '220px',
                    lineHeight: '1.4'
                  }}
                  value={extractedYaml}
                  onChange={(e) => setExtractedYaml(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: '1rem', background: '#ff9933', boxShadow: 'none' }}
                  onClick={loadYamlIntoForm}
                >
                  Auto-fill Case Form Inputs
                </button>
              </div>
            )}
        </div>
      )}

      {/* Manual Input Form */}
      <form onSubmit={handleSubmit} className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        
        {/* Section 1: Core Case Info */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            1. मामला संदर्भ विवरण / Core Case Identity
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Case Type (e.g. OA, MA, WP, CA)</label>
              <input
                type="text"
                name="case_type"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. OA"
                value={formData.case_type}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Case Number</label>
              <input
                type="text"
                name="case_number"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. 521"
                value={formData.case_number}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Case Year</label>
              <input
                type="number"
                name="case_year"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. 2024"
                value={formData.case_year}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Forum (e.g. CAT/PATNA, HC/MUMBAI)</label>
              <input
                type="text"
                name="forum"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. CAT/PATNA"
                value={formData.forum}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label" style={{ color: '#4b5563' }}>Case Reference Number (Unique Key)</label>
              <input
                type="text"
                name="case_ref_no"
                className="form-control"
                style={{ background: '#f3f4f6', borderColor: '#9ca3af', color: '#111827', fontWeight: 600 }}
                placeholder="Auto-generated or custom key..."
                value={formData.case_ref_no}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Railway Zone / Division</label>
              <input
                type="text"
                name="railway"
                className="form-control"
                style={{ 
                  background: userScope !== 'All' ? '#f3f4f6' : '#f9fafb', 
                  borderColor: userScope !== 'All' ? '#cbd5e1' : '#d1d5db', 
                  color: userScope !== 'All' ? '#64748b' : '#111827',
                  fontWeight: userScope !== 'All' ? 600 : 'normal'
                }}
                placeholder="e.g. CR"
                value={formData.railway}
                onChange={handleChange}
                disabled={userScope !== 'All'}
              />
              {userScope !== 'All' && (
                <small style={{ color: '#b45309', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.2rem' }}>
                  🔒 Locked to your assigned railway zone ({userScope}).
                </small>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Employee Designation</label>
              <input
                type="text"
                name="employee_designation"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. Trackman, SSE"
                value={formData.employee_designation}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 1.5: Original Tribunal Reference (OA details) */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            1.5. मूल न्यायाधिकरण संदर्भ (यदि लागू हो) / Original Tribunal Reference (OA Details)
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Original OA / Case Number</label>
              <input
                type="text"
                name="original_oa_no"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. OA 241/2021"
                value={formData.original_oa_no}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Original Tribunal Forum</label>
              <input
                type="text"
                name="original_oa_forum"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. CAT/PATNA"
                value={formData.original_oa_forum}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Date of Disposal by Tribunal</label>
              <input
                type="date"
                name="original_oa_date_disposal"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                value={formData.original_oa_date_disposal}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Tribunal Outcome / Status</label>
              <input
                type="text"
                name="original_oa_status"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. Allowed / Dismissed"
                value={formData.original_oa_status}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Litigant Parties */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            2. पक्षकार विवरण / Litigant Parties
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Applicant / Petitioner Name</label>
              <input
                type="text"
                name="applicant"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. Rajesh Kumar"
                value={formData.applicant}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Respondent Name</label>
              <input
                type="text"
                name="respondent"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. UOI & Ors."
                value={formData.respondent}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 3: File No, Status and Target Milestones */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            3. नस्ती स्थिति एवं मील के पत्थर / File Status & Target Milestones
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>File Number</label>
              <input
                type="text"
                name="file_no"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. E/Legal/2024/09"
                value={formData.file_no}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Link File Number</label>
              <input
                type="text"
                name="link_file_no"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. L/412"
                value={formData.link_file_no}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Present Status</label>
              <select
                name="present_status"
                className="select-input"
                style={{ width: '100%', height: '42px', background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                value={formData.present_status}
                onChange={handleChange}
              >
                <option value="Pending">Pending</option>
                <option value="Disposed">Disposed</option>
                <option value="Sine Die">Sine Die</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Actual Date of Filing Reply</label>
              <input
                type="date"
                name="date_filing_reply"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                value={formData.date_filing_reply}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Target Deadline for Reply</label>
              <input
                type="date"
                name="last_date_reply"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                value={formData.last_date_reply}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Appeal / Compliance Target Date</label>
              <input
                type="date"
                name="last_date_appeal_implementation"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                value={formData.last_date_appeal_implementation}
                onChange={handleChange}
              />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label" style={{ color: '#4b5563' }}>Court Updates Source Link (URL for Scraping daily updates)</label>
              <input
                type="url"
                name="court_link"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. https://court-portal.gov.in/case-status/..."
                value={formData.court_link}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Contact Directory */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            4. संपर्क निर्देशिका / Contacts Directory
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Nodal Officer Name</label>
              <input
                type="text"
                name="nodal_officer_name"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. Ramesh Chandra"
                value={formData.nodal_officer_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Nodal Officer Contact No.</label>
              <input
                type="text"
                name="nodal_officer_contact"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. +91 9988776655"
                value={formData.nodal_officer_contact}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Engaged Advocate Name</label>
              <input
                type="text"
                name="advocate_name"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. Ms. Archana Sinha"
                value={formData.advocate_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: '#4b5563' }}>Advocate Contact No.</label>
              <input
                type="text"
                name="advocate_contact"
                className="form-control"
                style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827' }}
                placeholder="e.g. +91 9431102233"
                value={formData.advocate_contact}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 5: Synopsis details */}
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #003366', paddingBottom: '0.5rem' }}>
            5. विवाद का विवरण / Legal Issue Details
          </h3>
          <div className="form-group">
            <label className="form-label" style={{ color: '#4b5563' }}>Synopsis / Main Issue Description</label>
            <textarea
              name="synopsis"
              className="form-control"
              style={{ background: '#f9fafb', borderColor: '#d1d5db', color: '#111827', minHeight: '120px' }}
              placeholder="Provide a description of the key points, dispute details, prayers, or claims in this legal case..."
              value={formData.synopsis}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ borderColor: '#d1d5db', color: '#374151' }}
            onClick={() => navigate(isEditMode ? `/cases/${id}` : '/cases')}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ minWidth: '120px' }}
          >
            {loading ? 'Saving...' : isEditMode ? 'Update Profile' : 'Register Case'}
          </button>
        </div>

      </form>
    </div>
  );
}
