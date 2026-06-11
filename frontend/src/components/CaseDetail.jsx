import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import HearingTimeline from './HearingTimeline';
import AddHearingModal from './AddHearingModal';

const PROGRESSION_STAGES = [
  { id: 'charge_sheet_issued', label: 'Charge Sheet Issued', color: '#8b5cf6', shortLabel: 'Charge' },
  { id: 'reply_to_charges', label: 'Reply to Charges', color: '#8b5cf6', shortLabel: 'Reply' },
  { id: 'inquiry_commenced', label: 'Inquiry Commenced', color: '#10b981', shortLabel: 'Inquiry' },
  { id: 'io_report_submitted', label: 'IO Report Submitted', color: '#10b981', shortLabel: 'IO Report' },
  { id: 'da_notice', label: 'DA Notice (2nd Show Cause)', color: '#f59e0b', shortLabel: 'DA Notice' },
  { id: 'reply_to_da_notice', label: 'Reply to DA Notice', color: '#f59e0b', shortLabel: 'Reply DA' },
  { id: 'da_penalty_order', label: 'DA Penalty Order', color: '#ef4444', shortLabel: 'Penalty' },
  { id: 'upsc_advice', label: 'UPSC Advice', color: '#ef4444', shortLabel: 'UPSC' },
  { id: 'appeal_oa_filed', label: 'Appeal / OA Filed', color: '#3b82f6', shortLabel: 'Appeal/OA' },
  { id: 'counter_affidavit_filed', label: 'Counter Affidavit Filed', color: '#3b82f6', shortLabel: 'Counter' },
  { id: 'cat_court_order', label: 'CAT / Court Order', color: '#6366f1', shortLabel: 'Order' },
  { id: 'writ_petition_filed', label: 'Writ Petition Filed', color: '#6366f1', shortLabel: 'Writ' }
];

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseObj, setCaseObj] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [affidavits, setAffidavits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [pleadings, setPleadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Progression Tracker States
  const [isProgressionOpen, setIsProgressionOpen] = useState(true);
  const [progressData, setProgressData] = useState({});
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState(null);
  const [progressSuccess, setProgressSuccess] = useState(false);

  // Original Tribunal Progression (OA Details) Edit States
  const [isEditTribunalOpen, setIsEditTribunalOpen] = useState(false);
  const [tribunalData, setTribunalData] = useState({
    original_oa_no: '',
    original_oa_forum: '',
    original_oa_date_disposal: '',
    original_oa_status: ''
  });
  const [tribunalSaving, setTribunalSaving] = useState(false);
  const [tribunalError, setTribunalError] = useState(null);

  const handleOpenEditTribunal = () => {
    setTribunalData({
      original_oa_no: caseObj?.original_oa_no || '',
      original_oa_forum: caseObj?.original_oa_forum || '',
      original_oa_date_disposal: caseObj?.original_oa_date_disposal ? caseObj.original_oa_date_disposal.split('T')[0] : '',
      original_oa_status: caseObj?.original_oa_status || ''
    });
    setTribunalError(null);
    setIsEditTribunalOpen(true);
  };

  const handleSaveTribunal = async (e) => {
    e.preventDefault();
    try {
      setTribunalSaving(true);
      setTribunalError(null);
      const payload = {
        ...caseObj,
        ...tribunalData
      };
      await api.updateCase(id, payload);
      setIsEditTribunalOpen(false);
      await fetchCaseData();
    } catch (err) {
      console.error(err);
      setTribunalError(err.message || 'Failed to update tribunal details.');
    } finally {
      setTribunalSaving(false);
    }
  };

  const [isAddHearingOpen, setIsAddHearingOpen] = useState(false);
  const [hearingSortAsc, setHearingSortAsc] = useState(false);
  const [isAddAffidavitOpen, setIsAddAffidavitOpen] = useState(false);
  const [affidavitSubmitting, setAffidavitSubmitting] = useState(false);
  const [affidavitError, setAffidavitError] = useState(null);
  const [newAffidavit, setNewAffidavit] = useState({
    filing_date: new Date().toISOString().split('T')[0],
    filed_by: 'Respondent',
    affidavit_type: '',
    notes: ''
  });
  const [affidavitExtracting, setAffidavitExtracting] = useState(false);

  const handlePdfUploadForAffidavit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setAffidavitExtracting(true);
      setAffidavitError(null);
      
      const response = await api.extractPdfText(file);
      if (response && response.text) {
        setNewAffidavit(prev => ({ 
          ...prev, 
          notes: response.text.substring(0, 1000) 
        }));
      } else {
        throw new Error('No text returned from the PDF.');
      }
    } catch (err) {
      console.error(err);
      setAffidavitError(err.message || 'Failed to extract text from PDF. The PDF might be scanned or blank.');
    } finally {
      setAffidavitExtracting(false);
    }
  };

  useEffect(() => {
    fetchCaseData();
  }, [id]);

  const fetchCaseData = async () => {
    try {
      setLoading(true);
      const caseData = await api.getCaseById(id);

      // Authorization Check
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.railwayScope && user.railwayScope !== 'All' && caseData.railway !== user.railwayScope) {
          throw new Error('Unauthorized Access: You do not have permission to view cases outside your assigned railway zone.');
        }
      }

      setCaseObj(caseData);
      
      // Populate progression local states
      const progress = {};
      PROGRESSION_STAGES.forEach(s => {
        progress[`${s.id}_date`] = caseData[`${s.id}_date`] ? caseData[`${s.id}_date`].split('T')[0] : '';
        progress[`${s.id}_notes`] = caseData[`${s.id}_notes`] || '';
      });
      setProgressData(progress);
      
      const hearingData = await api.getHearingsForCase(id);
      setHearings(hearingData);

      const affidavitsData = await api.getAffidavitsForCase(id);
      setAffidavits(affidavitsData);

      const docsData = await api.getDocumentsForCase(id);
      setDocuments(docsData || []);

      const pleadingsData = await api.getPleadingsForCase(id);
      setPleadings(pleadingsData || []);

      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch case details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProgression = async () => {
    try {
      setProgressSaving(true);
      setProgressError(null);
      setProgressSuccess(false);

      const payload = {
        ...caseObj,
        ...progressData
      };

      await api.updateCase(id, payload);
      setProgressSuccess(true);
      setTimeout(() => setProgressSuccess(false), 5000);
      await fetchCaseData();
    } catch (err) {
      console.error(err);
      setProgressError(err.message || 'Failed to save progress details.');
    } finally {
      setProgressSaving(false);
    }
  };

  const getTimelineSteps = () => {
    const steps = [];
    PROGRESSION_STAGES.forEach(s => {
      const dateVal = progressData[`${s.id}_date`];
      if (dateVal) {
        steps.push({
          id: s.id,
          label: s.shortLabel,
          fullLabel: s.label,
          date: new Date(dateVal),
          dateString: dateVal,
          color: s.color,
          notes: progressData[`${s.id}_notes`]
        });
      }
    });

    // Sort chronologically
    steps.sort((a, b) => a.date - b.date);
    return steps;
  };

  const formatTimelineDate = (dateObj) => {
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  };

  const handleAddAffidavit = async (e) => {
    e.preventDefault();
    if (!newAffidavit.filing_date || !newAffidavit.affidavit_type) {
      setAffidavitError('Filing date and affidavit type are required.');
      return;
    }

    try {
      setAffidavitSubmitting(true);
      setAffidavitError(null);
      const added = await api.addAffidavitToCase(id, newAffidavit);
      setAffidavits(prev => [added, ...prev]);
      setNewAffidavit({
        filing_date: new Date().toISOString().split('T')[0],
        filed_by: 'Respondent',
        affidavit_type: '',
        notes: ''
      });
      setIsAddAffidavitOpen(false);
    } catch (err) {
      console.error(err);
      setAffidavitError(err.message || 'Failed to record affidavit.');
    } finally {
      setAffidavitSubmitting(false);
    }
  };

  const handleDeleteAffidavit = async (affId) => {
    if (window.confirm('Are you sure you want to delete this affidavit record? / क्या आप वाकई इस शपथ पत्र रिकॉर्ड को हटाना चाहते हैं?')) {
      try {
        await api.deleteAffidavit(affId);
        setAffidavits(prev => prev.filter(a => a.id !== affId));
      } catch (err) {
        console.error(err);
        alert('Failed to delete affidavit: ' + err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you absolutely sure you want to delete this case? This will permanently delete the case and all its associated hearing records.')) {
      try {
        await api.deleteCase(id);
        navigate('/cases');
      } catch (err) {
        console.error(err);
        alert('Failed to delete case: ' + err.message);
      }
    }
  };

  const handleHearingAdded = (newHearing) => {
    setHearings(prev => [newHearing, ...prev]);
    fetchCaseData();
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <p style={{ color: '#4b5563' }}>Loading case profile...</p>
      </div>
    );
  }

  if (error || !caseObj) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', background: '#fff', border: '1px solid #d1d5db' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontFamily: 'Outfit' }}>Error Loading Case</h2>
        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>{error || 'Case not found in the database.'}</p>
        <Link to="/cases" className="btn btn-secondary">Back to Spreadsheet Grid</Link>
      </div>
    );
  }

  const getStatusClass = (status) => {
    if (!status) return 'pending';
    const s = status.toLowerCase();
    if (s.includes('disposed')) return 'disposed';
    if (s.includes('sine die') || s.includes('sinedie')) return 'sinedie';
    if (s.includes('urgent') || s.includes('deadline')) return 'urgent';
    return 'pending';
  };

  const isHcorSc = caseObj.forum && (caseObj.forum.toUpperCase().includes('HC') || caseObj.forum.toUpperCase().includes('SC'));

  return (
    <div>
      {/* Detail Header & Action Buttons */}
      <div className="detail-header" style={{ marginBottom: '2rem' }}>
        <div className="detail-title-area">
          <Link to="/cases" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#1e3a8a', fontWeight: 600 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            मामला सूची पर वापस जाएं / Back to Spreadsheet Grid
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f2c59', margin: 0 }}>
              {caseObj.case_ref_no}{caseObj.applicant && ` - ${caseObj.applicant}`}
            </h1>
            <span className={`status-tag ${getStatusClass(caseObj.present_status)}`} style={{ boxShadow: 'none' }}>
              {caseObj.present_status || 'Pending'}
            </span>
          </div>
          <p style={{ color: '#4b5563', marginTop: '0.25rem' }}>
            {caseObj.case_type || 'General'} Case • Forum: <strong style={{ color: '#111827' }}>{caseObj.forum || 'N/A'}</strong>
          </p>
          {caseObj.present_status === 'Disposed' && caseObj.disposal_date ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: '#ECFDF5', border: '1px solid #A7F3D0',
              borderRadius: '6px', padding: '0.4rem 0.75rem', marginTop: '0.5rem'
            }}>
              <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#065F46' }}>
                Disposed on {new Date(caseObj.disposal_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          ) : caseObj.next_hearing_date && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: caseObj.next_hearing_date < new Date().toISOString().split('T')[0] ? '#FEF2F2' : '#FFF7ED',
              border: `1px solid ${caseObj.next_hearing_date < new Date().toISOString().split('T')[0] ? '#FECACA' : '#FED7AA'}`,
              borderRadius: '6px', padding: '0.4rem 0.75rem', marginTop: '0.5rem'
            }}>
              <svg width="14" height="14" fill="none" stroke={caseObj.next_hearing_date < new Date().toISOString().split('T')[0] ? '#DC2626' : '#D97706'} strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1A1A1A' }}>
                Next Hearing: {new Date(caseObj.next_hearing_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {caseObj.next_hearing_date < new Date().toISOString().split('T')[0] && (
                <span style={{ background: '#DC2626', color: '#fff', fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700 }}>OVERDUE</span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" style={{ borderColor: '#d1d5db', color: '#374151' }} onClick={() => navigate(`/cases/${caseObj.id}/edit`)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit Case
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete Case
          </button>
        </div>
      </div>

      <div className="case-details-layout">
        {/* Left Side: Metadata and Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Metadata Grid */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '2px solid #0f2c59', paddingBottom: '0.5rem', color: '#0f2c59' }}>
              मामला विवरण / Case Metadata
            </h2>
            <div className="metadata-grid">
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>Railway Zone/Division</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.railway || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>Employee Designation</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.employee_designation || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>Case Year</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.case_year || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>Case Number</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.case_number || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>File Number</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.file_no || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
                <span className="metadata-label" style={{ color: '#4b5563' }}>Linked File Number</span>
                <span className="metadata-value" style={{ color: '#111827' }}>{caseObj.link_file_no || 'N/A'}</span>
              </div>
              <div className="metadata-item" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', gridColumn: 'span 2' }}>
                <span className="metadata-label" style={{ color: '#15803d', fontWeight: 600 }}>Court Dates Source Link</span>
                <span className="metadata-value">
                  {caseObj.court_link ? (
                    <a 
                      href={caseObj.court_link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ color: '#166534', fontWeight: 700, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', wordBreak: 'break-all' }}
                    >
                      {caseObj.court_link}
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>Not Provided</span>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <span className="metadata-label" style={{ display: 'block', marginBottom: '0.5rem', color: '#4b5563' }}>विवाद का संक्षिप्त विवरण / Issue Synopsis</span>
              <div style={{ 
                background: '#f9fafb', 
                padding: '1.25rem', 
                borderRadius: '10px', 
                border: '1px solid #e5e7eb', 
                lineHeight: '1.6',
                color: '#374151',
                fontSize: '0.95rem',
                whiteSpace: 'pre-wrap'
              }}>
                {caseObj.synopsis || 'No synopsis described for this case.'}
              </div>
            </div>
          </div>


          {/* Original Tribunal Progression Details */}
          {(caseObj.original_oa_no || isHcorSc) && (
            <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #ff9933', paddingBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f2c59', margin: 0 }}>
                  मूल अधिकरण संदर्भ विवरण / Original Tribunal Progression (OA Details)
                </h2>
                <button 
                  className="btn btn-secondary" 
                  style={{ background: '#ff9933', color: '#fff', borderColor: 'transparent', padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} 
                  onClick={handleOpenEditTribunal}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Details
                </button>
              </div>
              <div className="metadata-grid">
                <div className="metadata-item" style={{ background: '#fffaf5', borderColor: '#ffe9db' }}>
                  <span className="metadata-label" style={{ color: '#b45309' }}>Original Case No. (OA)</span>
                  <span className="metadata-value" style={{ color: '#78350f', fontWeight: 700 }}>{caseObj.original_oa_no || 'Not Recorded'}</span>
                </div>
                <div className="metadata-item" style={{ background: '#fffaf5', borderColor: '#ffe9db' }}>
                  <span className="metadata-label" style={{ color: '#b45309' }}>Original Forum / Tribunal</span>
                  <span className="metadata-value" style={{ color: '#78350f' }}>{caseObj.original_oa_forum || 'Not Recorded'}</span>
                </div>
                <div className="metadata-item" style={{ background: '#fffaf5', borderColor: '#ffe9db' }}>
                  <span className="metadata-label" style={{ color: '#b45309' }}>Date of Disposal by Tribunal</span>
                  <span className="metadata-value" style={{ color: '#78350f' }}>
                    {caseObj.original_oa_date_disposal ? new Date(caseObj.original_oa_date_disposal).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="metadata-item" style={{ background: '#fffaf5', borderColor: '#ffe9db' }}>
                  <span className="metadata-label" style={{ color: '#b45309' }}>Tribunal Outcome / Status</span>
                  <span className="metadata-value" style={{ color: '#78350f', fontWeight: 600 }}>{caseObj.original_oa_status || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Court Orders & Documents Section */}
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #0f2c59', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f2c59', margin: 0 }}>
                न्यायालय आदेश एवं दस्तावेज / Court Orders & Documents
              </h2>
              {caseObj.court_link && (
                <a href={caseObj.court_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', background: '#ff9933', borderColor: '#ff9933', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: 700 }}>
                  View on Court Website ↗
                </a>
              )}
            </div>

            {documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: '0.5rem', color: '#9ca3af' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  No court orders synced yet. Run the batch sync or upload documents manually.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {documents.map((doc, idx) => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '0.65rem 1rem', transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        background: '#ff9933', color: '#fff', width: '32px', height: '32px',
                        borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8rem', fontWeight: 700, flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                          {doc.original_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {doc.mime_type} {doc.file_size ? `· ${(doc.file_size / 1024).toFixed(1)} KB` : ''} · {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <a href={doc.storage_path} target="_blank" rel="noopener noreferrer"
                        style={{
                          background: '#D97706', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                          cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                        }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {doc.mime_type === 'application/pdf' ? 'Open PDF' : 'Open Case Page'}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage-wise Affidavits Section */}
          {isHcorSc && (
            <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #0f2c59', paddingBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f2c59', margin: 0 }}>
                  शपथ पत्र बुरादा लॉग / Stage-wise Affidavits Log
                </h2>
                <button className="btn btn-secondary" style={{ background: '#0f2c59', color: '#fff', borderColor: 'transparent', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setIsAddAffidavitOpen(true)}>
                  + Record Affidavit
                </button>
              </div>

              {affidavits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  No affidavits recorded yet. Click "Record Affidavit" to log petitioner or respondent filings.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Petitioner Filings (Left Column) */}
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '0.75rem' }}>
                    <h4 style={{ color: '#1e3a8a', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
                      याचिकाकर्ता शपथ पत्र / Petitioner Filings
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {affidavits.filter(a => a.filed_by === 'Petitioner').map(a => (
                        <div key={a.id} style={{ background: '#f3f4f6', borderLeft: '3px solid #1e3a8a', padding: '0.5rem 0.75rem', borderRadius: '0 4px 4px 0', position: 'relative' }}>
                          <button 
                            onClick={() => handleDeleteAffidavit(a.id)}
                            style={{ position: 'absolute', right: '0.35rem', top: '0.35rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: 0 }}
                            title="Delete Record"
                          >
                            &times;
                          </button>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>{new Date(a.filing_date).toLocaleDateString()}</div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', marginTop: '0.15rem' }}>{a.affidavit_type}</div>
                          {a.notes && <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem', fontStyle: 'italic' }}>{a.notes}</div>}
                        </div>
                      ))}
                      {affidavits.filter(a => a.filed_by === 'Petitioner').length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No petitioner affidavits recorded.</span>
                      )}
                    </div>
                  </div>

                  {/* Respondent Filings (Right Column) */}
                  <div>
                    <h4 style={{ color: '#128807', borderBottom: '1px solid #a7f3d0', paddingBottom: '0.25rem', marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
                      उत्तरदाता (रेलवे) शपथ पत्र / Respondent (UOI) Filings
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {affidavits.filter(a => a.filed_by === 'Respondent').map(a => (
                        <div key={a.id} style={{ background: '#f0fdf4', borderLeft: '3px solid #128807', padding: '0.5rem 0.75rem', borderRadius: '0 4px 4px 0', position: 'relative' }}>
                          <button 
                            onClick={() => handleDeleteAffidavit(a.id)}
                            style={{ position: 'absolute', right: '0.35rem', top: '0.35rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', padding: 0 }}
                            title="Delete Record"
                          >
                            &times;
                          </button>
                          <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>{new Date(a.filing_date).toLocaleDateString()}</div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', marginTop: '0.15rem' }}>{a.affidavit_type}</div>
                          {a.notes && <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem', fontStyle: 'italic' }}>{a.notes}</div>}
                        </div>
                      ))}
                      {affidavits.filter(a => a.filed_by === 'Respondent').length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No respondent affidavits recorded.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Timeline + Pleadings side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1.5rem 0' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f2c59', display: 'block', marginBottom: '0.75rem' }}>Activity Timeline</strong>
              <div style={{ position: 'relative', paddingLeft: '1rem', fontSize: '0.78rem' }}>
                {[...(hearings || [])].sort((a,b) => new Date(b.hearing_date) - new Date(a.hearing_date)).slice(0, 8).map((h, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: '0.6rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '0.75rem' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: '5px', width: '9px', height: '9px', borderRadius: '50%', background: '#0f2c59' }} />
                    <span style={{ fontWeight: 600 }}>{new Date(h.hearing_date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}).replace(/\//g, '-')}</span>
                    <span style={{ color: '#4b5563', display: 'block', marginTop: '0.1rem' }}>{(h.order_summary || '').substring(0, 120)}</span>
                  </div>
                ))}
                {(!hearings || hearings.length === 0) && <span style={{ color: '#9ca3af' }}>No hearing records yet</span>}
              </div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f2c59', display: 'block', marginBottom: '0.75rem' }}>Pleadings Status</strong>
              {[
                { type: 'oa_copy', label: 'Petitioner Copy of OA', icon: '📄' },
                { type: 'our_reply', label: 'Our Reply / Counter', icon: '📝' },
                { type: 'rejoinder', label: 'Petitioner Rejoinder', icon: '📥' },
                { type: 'reply_to_rejoinder', label: 'Our Reply to Rejoinder', icon: '📤' },
              ].map(p => {
                const existing = pleadings.find(pl => pl.type === p.type);
                return (
                  <div key={p.type} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }}>
                    <span style={{ fontSize: '1rem' }}>{p.icon}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{p.label}</span>
                    {existing ? (
                      <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.78rem' }}>
                        ✓ {existing.filing_date ? new Date(existing.filing_date).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Filed'}
                      </span>
                    ) : (
                      <button className="btn btn-sm" style={{ fontSize: '0.7rem', background: '#FFF7ED', color: '#D97706', border: '1px solid #FED7AA' }}
                        onClick={async () => {
                          const dt = prompt('Filing date (DD-MM-YYYY):', new Date().toISOString().split('T')[0]);
                          if (dt) {
                            try { const added = await api.addPleading(caseObj.id, { type: p.type, filing_date: dt, document_url: '' }); setPleadings(prev => [...prev, added]); } catch(e) {}
                          }
                        }}>+ Add</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Section */}
          <div>
            <div className="timeline-section-header" style={{ borderBottom: '2px solid #0f2c59', marginTop: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f2c59', margin: 0 }}>सुनवाई इतिहास लॉग / Chronological Hearing Timeline</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setHearingSortAsc(!hearingSortAsc)}>
                  {hearingSortAsc ? '↑ Oldest First' : '↓ Newest First'}
                </button>
                <button className="btn btn-primary" onClick={() => setIsAddHearingOpen(true)}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Record New Hearing
                </button>
              </div>
            </div>

            <HearingTimeline hearings={
              hearingSortAsc
                ? [...hearings].sort((a, b) => new Date(a.hearing_date) - new Date(b.hearing_date))
                : [...hearings].sort((a, b) => new Date(b.hearing_date) - new Date(a.hearing_date))
            } />
          </div>
        </div>

        {/* Right Side: Milestones & Litigants & Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Target Milestones Panel */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: '#0f2c59', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              लक्ष्य मील के पत्थर / Milestones
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ borderLeft: '3px solid #003366', paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>Reply Statement Filing</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: caseObj.date_filing_reply ? '#10b981' : '#f59e0b', marginTop: '0.15rem' }}>
                  {caseObj.date_filing_reply ? `Filed: ${new Date(caseObj.date_filing_reply).toLocaleDateString()}` : 'Not Filed'}
                </div>
                {caseObj.last_date_reply && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                    Target Deadline: {new Date(caseObj.last_date_reply).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div style={{ borderLeft: '3px solid #ff9933', paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#4b5563', textTransform: 'uppercase', fontWeight: 600 }}>Appeal / Compliance Target</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', marginTop: '0.15rem' }}>
                  {caseObj.last_date_appeal_implementation ? (
                    new Date(caseObj.last_date_appeal_implementation).toLocaleDateString()
                  ) : (
                    <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>No Deadline Configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Party Names Panel */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: '#0f2c59', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              पक्षकार / Litigant Parties
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span className="metadata-label" style={{ color: '#6b7280' }}>Petitioner / Applicant</span>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem', color: '#1e3a8a' }}>
                  {caseObj.applicant || 'Unknown'}
                </p>
              </div>
              <div>
                <span className="metadata-label" style={{ color: '#6b7280' }}>Respondent</span>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem', color: '#111827' }}>
                  {caseObj.respondent || 'Union of India & Ors.'}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Directory Panel */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', color: '#0f2c59', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              अधिकारी निर्देशिका / Contact Directory
            </h3>

            <div className="contact-card" style={{ background: '#f9fafb', borderColor: '#e5e7eb' }}>
              <div className="contact-header" style={{ color: '#0f2c59', borderColor: '#e5e7eb' }}>Nodal Officer</div>
              <div className="contact-info">
                <div className="contact-row">
                  <span className="contact-label" style={{ color: '#4b5563' }}>Name:</span>
                  <span className="contact-val" style={{ color: '#111827' }}>{caseObj.nodal_officer_name || 'Not Assigned'}</span>
                </div>
                <div className="contact-row">
                  <span className="contact-label" style={{ color: '#4b5563' }}>Contact:</span>
                  <span className="contact-val" style={{ color: '#111827' }}>{caseObj.nodal_officer_contact || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="contact-card" style={{ background: '#f9fafb', borderColor: '#e5e7eb', marginBottom: 0 }}>
              <div className="contact-header" style={{ color: '#ff9933', borderColor: '#e5e7eb' }}>Engaged Advocate</div>
              <div className="contact-info">
                <div className="contact-row">
                  <span className="contact-label" style={{ color: '#4b5563' }}>Name:</span>
                  <span className="contact-val" style={{ color: '#111827' }}>{caseObj.advocate_name || 'Not Assigned'}</span>
                </div>
                <div className="contact-row">
                  <span className="contact-label" style={{ color: '#4b5563' }}>Contact:</span>
                  <span className="contact-val" style={{ color: '#111827' }}>{caseObj.advocate_contact || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Add Hearing Log Modal */}
      {isAddHearingOpen && (
        <AddHearingModal 
          caseId={caseObj.id} 
          onClose={() => setIsAddHearingOpen(false)} 
          onHearingAdded={handleHearingAdded}
        />
      )}

      {/* Record Affidavit Modal */}
      {isAddAffidavitOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: '#fff', border: '1px solid #d1d5db', maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ color: '#0f2c59', fontWeight: 700, margin: 0 }}>शपथ पत्र रिकॉर्ड करें / Record Affidavit Filing</h3>
              <button className="modal-close-btn" onClick={() => setIsAddAffidavitOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddAffidavit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {affidavitError && (
                  <div className="alert-banner error" style={{ padding: '0.75rem 1rem', marginBottom: 0 }}>
                    {affidavitError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Filing Date / दाखिल करने की तिथि</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newAffidavit.filing_date}
                    onChange={(e) => setNewAffidavit(prev => ({ ...prev, filing_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Filed By / किसके द्वारा दायर किया गया</label>
                  <select
                    className="select-input"
                    style={{ width: '100%', height: '40px', background: '#fff', borderColor: '#d1d5db', padding: '0.375rem 0.75rem' }}
                    value={newAffidavit.filed_by}
                    onChange={(e) => setNewAffidavit(prev => ({ ...prev, filed_by: e.target.value }))}
                    required
                  >
                    <option value="Respondent">Respondent (Railway/UOI)</option>
                    <option value="Petitioner">Petitioner (Employee)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Affidavit Type or Stage / शपथ पत्र का प्रकार</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Counter Affidavit, Rejoinder, Status Report"
                    value={newAffidavit.affidavit_type}
                    onChange={(e) => setNewAffidavit(prev => ({ ...prev, affidavit_type: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4b5563' }}>
                    <span>Upload PDF Affidavit Document</span>
                    {affidavitExtracting && <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>⚡ Extracting text...</span>}
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    className="form-control"
                    onChange={handlePdfUploadForAffidavit}
                    disabled={affidavitExtracting || affidavitSubmitting}
                    style={{ padding: '0.375rem 0.75rem' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Directly upload the PDF file to automatically populate notes & comments.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Notes & Comments / टिप्पणी (Optional)</label>
                  <textarea
                    className="form-control"
                    placeholder="Provide details about who filed it, major declarations, or references..."
                    value={newAffidavit.notes}
                    onChange={(e) => setNewAffidavit(prev => ({ ...prev, notes: e.target.value }))}
                    style={{ minHeight: '80px' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddAffidavitOpen(false)} disabled={affidavitSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={affidavitSubmitting}>
                  {affidavitSubmitting ? 'Recording...' : 'Record Filing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Original Tribunal Details Modal */}
      {isEditTribunalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: '#fff', border: '1px solid #d1d5db', maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ color: '#0f2c59', fontWeight: 700, margin: 0 }}>मूल अधिकरण संदर्भ विवरण संपादित करें / Edit Original Tribunal Details</h3>
              <button className="modal-close-btn" onClick={() => setIsEditTribunalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveTribunal}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {tribunalError && (
                  <div className="alert-banner error" style={{ padding: '0.75rem 1rem', marginBottom: 0 }}>
                    {tribunalError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Original Case No. (OA) / मूल मामला संख्या (ओए)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. OA 123/2024"
                    value={tribunalData.original_oa_no}
                    onChange={(e) => setTribunalData(prev => ({ ...prev, original_oa_no: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Original Forum / Tribunal / मूल फोरम / अधिकरण</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CAT Principal Bench Delhi"
                    value={tribunalData.original_oa_forum}
                    onChange={(e) => setTribunalData(prev => ({ ...prev, original_oa_forum: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Date of Disposal by Tribunal / अधिकरण द्वारा निपटान की तिथि</label>
                  <input
                    type="date"
                    className="form-control"
                    value={tribunalData.original_oa_date_disposal}
                    onChange={(e) => setTribunalData(prev => ({ ...prev, original_oa_date_disposal: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#4b5563' }}>Tribunal Outcome / Status / अधिकरण परिणाम / स्थिति</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Disposed - Allowed, Dismissed, Complied"
                    value={tribunalData.original_oa_status}
                    onChange={(e) => setTribunalData(prev => ({ ...prev, original_oa_status: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditTribunalOpen(false)} disabled={tribunalSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#ff9933', borderColor: '#ff9933' }} disabled={tribunalSaving}>
                  {tribunalSaving ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
