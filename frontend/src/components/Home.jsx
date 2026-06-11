import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

export default function Home() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [liveTime, setLiveTime] = useState(new Date());

  // Alerts & Crawling states
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [toasts, setToasts] = useState([]);
  const initialAlertIds = useRef(null);

  useEffect(() => {
    fetchCases();
    fetchAlerts(true); // Establish initial baseline of existing alerts
    triggerDueCasesCheck();
    const interval = setInterval(() => {
      setLiveTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const addToast = (alert) => {
    const id = alert.id;
    setToasts(prev => {
      if (prev.some(t => t.id === id)) return prev;
      const newToast = {
        id,
        case_ref_no: alert.case_ref_no,
        message: alert.message,
        created_at: alert.created_at
      };
      return [...prev, newToast];
    });

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const triggerDueCasesCheck = async () => {
    try {
      setScanning(true);
      setScanStatus('Checking past-due court cases...');
      await api.checkDueCases();
      setTimeout(async () => {
        await fetchAlerts();
        await fetchCases();
        setScanStatus('');
      }, 5000);
    } catch (err) {
      console.error('Error on auto due cases check:', err);
      setScanStatus('');
    } finally {
      setScanning(false);
    }
  };

  const handleCheckDueCases = async () => {
    try {
      setScanning(true);
      setScanStatus('Initiating check for past-due court cases...');
      await api.checkDueCases();
      setScanStatus('Sync running in background...');
      setTimeout(async () => {
        await fetchAlerts();
        await fetchCases();
        setScanStatus('Due cases synchronization complete!');
        setTimeout(() => setScanStatus(''), 4000);
      }, 5000);
    } catch (err) {
      console.error(err);
      setScanStatus('Check failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const fetchCases = async () => {
    try {
      const data = await api.getCases();
      setCases(data);
    } catch (err) {
      console.error('Error loading cases for home:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async (isFirstLoad = false) => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
      
      if (isFirstLoad) {
        initialAlertIds.current = new Set(data.map(a => a.id));
      } else if (initialAlertIds.current) {
        const newAlerts = data.filter(a => !initialAlertIds.current.has(a.id));
        newAlerts.forEach(a => {
          addToast(a);
          initialAlertIds.current.add(a.id);
        });
      } else {
        initialAlertIds.current = new Set(data.map(a => a.id));
      }
    } catch (err) {
      console.error('Error loading alerts for home:', err);
    }
  };

  const handleCheckAllCases = async () => {
    try {
      setScanning(true);
      setScanStatus('Checking all court links for updates...');
      const res = await api.triggerCrawl();
      setScanStatus(`Scanned cases! Found ${res.alertsCreated} updates.`);
      await fetchAlerts();
      await fetchCases();
      setTimeout(() => setScanStatus(''), 6000);
    } catch (err) {
      console.error(err);
      setScanStatus('Check failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDismissAlert = async (e, alertId) => {
    e.stopPropagation();
    try {
      await api.markAlertAsRead(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error(err);
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

  // Metrics
  const totalCases = cases.length;
  const pendingReplies = cases.filter(c => c.last_date_reply && !c.date_filing_reply).length;
  const disposedCases = cases.filter(c => getStatusClass(c.present_status) === 'disposed').length;
  const activeCases = totalCases - disposedCases;
  const upcomingHearings = cases.filter(c => {
    if (!c.next_hearing_date) return false;
    if (getStatusClass(c.present_status) === 'disposed') return false;
    const hearingDate = parseLocalDate(c.next_hearing_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return hearingDate >= today;
  }).length;

  const getCourtWebsite = (forum) => {
    if (!forum) return { name: 'Court Portal', url: 'https://www.india.gov.in/topics/law-justice' };
    const f = forum.toUpperCase();
    if (f.startsWith('CAT')) {
      return { name: 'CAT (Central Administrative Tribunal)', url: 'https://cat.gov.in/' };
    }
    if (f.startsWith('HC/DELHI') || f.includes('DELHI')) {
      return { name: 'Delhi High Court', url: 'https://delhihighcourt.nic.in/' };
    }
    if (f.startsWith('HC/PATNA') || f.includes('PATNA')) {
      return { name: 'Patna High Court', url: 'http://patnahighcourt.gov.in/' };
    }
    if (f.startsWith('HC/ALLAHABAD') || f.includes('ALLAHABAD') || f.includes('ALD')) {
      return { name: 'Allahabad High Court', url: 'http://www.allahabadhighcourt.in/' };
    }
    if (f.startsWith('HC/CALCUTTA') || f.includes('CALCUTTA') || f.includes('KOLKATA')) {
      return { name: 'Calcutta High Court', url: 'https://www.calcuttahighcourt.gov.in/' };
    }
    if (f.startsWith('HC/BOMBAY') || f.includes('BOMBAY') || f.includes('MUMBAI')) {
      return { name: 'Bombay High Court', url: 'https://bombayhighcourt.nic.in/' };
    }
    if (f.startsWith('HC/MADRAS') || f.includes('MADRAS') || f.includes('CHENNAI')) {
      return { name: 'Madras High Court', url: 'https://www.hcmadras.tn.gov.in/' };
    }
    if (f.startsWith('HC') || f.includes('HIGH COURT')) {
      return { name: 'High Court Portal', url: 'https://mphc.gov.in/' };
    }
    if (f.startsWith('SC') || f.includes('SUPREME COURT')) {
      return { name: 'Supreme Court of India', url: 'https://www.sci.gov.in/' };
    }
    return { name: `${forum} Website`, url: 'https://www.google.com/search?q=' + encodeURIComponent(forum + ' official website court causelist') };
  };

  const getListedCases = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCases = [];
    const thisWeekCases = [];

    cases.forEach(c => {
      if (!c.next_hearing_date) return;
      if (getStatusClass(c.present_status) === 'disposed') return;
      const hDate = parseLocalDate(c.next_hearing_date);
      if (!hDate) return;

      const diffDays = Math.round((hDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        todayCases.push(c);
      } else if (diffDays > 0 && diffDays <= 7) {
        thisWeekCases.push(c);
      }
    });

    todayCases.sort((a, b) => new Date(a.next_hearing_date) - new Date(b.next_hearing_date));
    thisWeekCases.sort((a, b) => new Date(a.next_hearing_date) - new Date(b.next_hearing_date));

    return { todayCases, thisWeekCases };
  };

  const { todayCases, thisWeekCases } = getListedCases();

  const formatDateTime = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="home-dashboard">
      {/* Live Time Display on Top Right */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '1rem',
        marginTop: '-1rem'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: '24px',
          padding: '0.5rem 1.25rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#0f2c59',
          fontFamily: 'Outfit'
        }}>
          <span className="live-pulse-dot" style={{ 
            display: 'inline-block', 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: '#ff9933',
            boxShadow: '0 0 8px #ff9933'
          }}></span>
          <span>{formatDateTime(liveTime)}</span>
        </div>
      </div>

      {/* Banner */}
      <div className="goi-banner" style={{
        background: 'linear-gradient(135deg, #0f2c59 0%, #1e3a8a 100%)',
        padding: '2.5rem 3rem',
        borderRadius: '16px',
        color: '#fff',
        marginBottom: '2.5rem',
        boxShadow: '0 4px 20px rgba(15, 44, 89, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Tri-color Accent Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(to right, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #128807 66.6%)'
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.25rem', fontFamily: 'Outfit', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              न्यायालयीन मामला निगरानी प्रणाली
            </h1>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 500, margin: '0.25rem 0 1rem 0', opacity: 0.9 }}>
              Court Case Monitoring System
            </h2>
            <p style={{ color: '#93c5fd', fontSize: '1.05rem', maxWidth: '750px', margin: 0, lineHeight: 1.5 }}>
              Official administrative portal of the Ministry of Railways, Government of India, for auditing case replies, tracking chronological hearing timeline summaries, and maintaining judicial precedents.
            </p>
          </div>
          <div style={{ opacity: 0.15 }}>
            {/* emblem watermark placeholder */}
            <svg width="150" height="150" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm0-4h-2V7h2v8z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Judicial Updates & Alerts Panel */}
      <div className="glass-panel" style={{
        background: '#ffffff',
        border: '1px solid #d1d5db',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: alerts.length > 0 ? '#ef4444' : '#10b981',
              boxShadow: alerts.length > 0 ? '0 0 8px #ef4444' : '0 0 8px #10b981'
            }}></span>
            <h3 style={{ fontSize: '1.1rem', color: '#0f2c59', margin: 0, fontWeight: 700, fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              🔔 न्यायिक अपडेट और अलर्ट / Judicial Updates & Alerts
              {alerts.length > 0 && (
                <>
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '12px', fontWeight: 600 }}>
                    {alerts.length} new
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try { await api.dismissAllAlerts(); setAlerts([]); } catch {}
                    }}
                    style={{
                      background: 'none', border: '1px solid #d1d5db', borderRadius: '4px',
                      padding: '0.15rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer',
                      color: '#6b7280', fontWeight: 600, marginLeft: '0.5rem'
                    }}
                  >Dismiss all</button>
                </>
              )}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {scanStatus && <span style={{ fontSize: '0.8rem', color: '#4b5563', fontStyle: 'italic', fontWeight: 500 }}>{scanStatus}</span>}
            <button 
              className="btn btn-secondary" 
              onClick={handleCheckDueCases}
              disabled={scanning}
              style={{
                background: 'linear-gradient(135deg, #ff9933 0%, #d97706 100%)',
                borderColor: 'transparent',
                color: '#fff',
                boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                marginRight: '0.5rem'
              }}
            >
              {scanning ? (
                <>
                  <div className="spinner-small" style={{ marginRight: '0.35rem', display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spinner 0.6s linear infinite' }}></div>
                  Syncing...
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '0.2rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                  </svg>
                  Sync Due Cases
                </>
              )}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCheckAllCases}
              disabled={scanning}
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0f2c59 100%)',
                borderColor: 'transparent',
                boxShadow: '0 2px 4px rgba(15, 44, 89, 0.2)',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              {scanning ? (
                <>
                  <div className="spinner-small" style={{ marginRight: '0.35rem', display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spinner 0.6s linear infinite' }}></div>
                  Scanning...
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '0.2rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                  </svg>
                  Check All Cases
                </>
              )}
            </button>
          </div>
        </div>

        {alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            {alerts.map(a => (
              <div 
                key={a.id} 
                onClick={() => navigate(`/cases/${a.case_id}`)}
                style={{
                  background: '#fffaf5',
                  borderLeft: '4px solid #ff9933',
                  borderTop: '1px solid #ffeada',
                  borderRight: '1px solid #ffeada',
                  borderBottom: '1px solid #ffeada',
                  borderRadius: '0 8px 8px 0',
                  padding: '0.85rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fff5eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fffaf5'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700 }}>
                    Case Reference: {a.case_ref_no}
                  </span>
                  <span style={{ fontSize: '0.825rem', color: '#4b5563', lineHeight: '1.4' }}>
                    {a.message}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                    Detected on {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <button 
                  onClick={(e) => handleDismissAlert(e, a.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    padding: '0.25rem 0.5rem',
                    marginLeft: '1.5rem',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>✅</span>
            <span>All case updates pages are currently synchronized. No new order or updates detected.</span>
          </div>
        )}
      </div>

      {/* KPI Section */}
      <div className="kpi-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="kpi-card" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <span className="kpi-label" style={{ color: '#4b5563' }}>Total Seeded Cases</span>
          <span className="kpi-value" style={{ color: '#0f2c59' }}>{loading ? '...' : totalCases}</span>
        </div>
        <div className="kpi-card" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <span className="kpi-label" style={{ color: '#374151' }}>Active Litigations</span>
          <span className="kpi-value" style={{ color: '#1e40af' }}>{loading ? '...' : activeCases}</span>
        </div>
        <div className="kpi-card" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <span className="kpi-label" style={{ color: '#b45309' }}>Pending Replies</span>
          <span className="kpi-value" style={{ color: '#d97706' }}>{loading ? '...' : pendingReplies}</span>
        </div>
        <div className="kpi-card" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate('/cases?status=Disposed')}>
          <span className="kpi-label" style={{ color: '#0369a1' }}>Upcoming Hearings</span>
          <span className="kpi-value" style={{ color: '#0284c7' }}>{loading ? '...' : upcomingHearings}</span>
        </div>
        <div className="kpi-card" style={{ background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', cursor: 'pointer' }} onClick={() => navigate('/cases?status=Disposed')}>
          <span className="kpi-label" style={{ color: '#059669' }}>Cases Disposed</span>
          <span className="kpi-value" style={{ color: '#059669' }}>{loading ? '...' : disposedCases}</span>
        </div>
      </div>

      {/* Layout Split: Notices vs. Quick Navigation */}
      <div className="case-details-layout" style={{ gap: '2rem' }}>
        {/* Listed Hearings Board */}
        <div>
          <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #0f2c59', paddingBottom: '0.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              दैनिक एवं साप्ताहिक सुनवाई सूची / Listed Hearings (Today & This Week)
            </h3>
            
            {loading ? (
              <div className="spinner-container" style={{ padding: '2rem 0' }}>
                <div className="spinner"></div>
                <p style={{ color: '#4b5563' }}>Loading scheduled hearings...</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #d1d5db', marginBottom: '1.25rem' }}>
                  <button 
                    style={{
                      padding: '0.6rem 1.25rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'today' ? '3px solid #ff9933' : '3px solid transparent',
                      color: activeTab === 'today' ? '#0f2c59' : '#6b7280',
                      cursor: 'pointer',
                      fontFamily: 'Outfit',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onClick={() => setActiveTab('today')}
                  >
                    Listed Today ({todayCases.length})
                  </button>
                  <button 
                    style={{
                      padding: '0.6rem 1.25rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'week' ? '3px solid #ff9933' : '3px solid transparent',
                      color: activeTab === 'week' ? '#0f2c59' : '#6b7280',
                      cursor: 'pointer',
                      fontFamily: 'Outfit',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onClick={() => setActiveTab('week')}
                  >
                    Listed This Week ({thisWeekCases.length})
                  </button>
                </div>

                {/* Tab content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeTab === 'today' ? (
                    todayCases.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 0.75rem auto', color: '#9ca3af' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>No hearings listed for today</h4>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#6b7280' }}>Check the weekly listings tab to monitor upcoming cases.</p>
                      </div>
                    ) : (
                      todayCases.map(c => {
                        const courtInfo = getCourtWebsite(c.forum);
                        return (
                          <div key={c.id} style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                <span 
                                  style={{ 
                                    fontFamily: 'Outfit', 
                                    fontWeight: 700, 
                                    color: '#0f2c59', 
                                    cursor: 'pointer',
                                    fontSize: '1rem' 
                                  }}
                                  className="case-ref-link"
                                  onClick={() => navigate(`/cases/${c.id}`)}
                                >
                                  {c.case_ref_no}
                                </span>
                                <span className="status-tag sinedie" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', boxShadow: 'none' }}>
                                  {c.forum}
                                </span>
                              </div>
                              
                              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                                <strong style={{ color: '#1f2937' }}>Petitioner:</strong> {c.applicant} Vs. {c.respondent}
                              </div>
                              
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Hearing Date: <strong style={{ color: '#d97706' }}>TODAY</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <a 
                                href={courtInfo.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.4rem 0.6rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  color: '#1e3a8a',
                                  fontWeight: 600
                                }}
                              >
                                <span>Court Website</span>
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>

                              <button 
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                                onClick={() => navigate(`/cases/${c.id}`)}
                              >
                                Open Case
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    thisWeekCases.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                        <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: '0 auto 0.75rem auto', color: '#9ca3af' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>No hearings listed for this week</h4>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#6b7280' }}>All compliance milestones and hearings are currently up to date.</p>
                      </div>
                    ) : (
                      thisWeekCases.map(c => {
                        const courtInfo = getCourtWebsite(c.forum);
                        return (
                          <div key={c.id} style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                <span 
                                  style={{ 
                                    fontFamily: 'Outfit', 
                                    fontWeight: 700, 
                                    color: '#0f2c59', 
                                    cursor: 'pointer',
                                    fontSize: '1rem' 
                                  }}
                                  className="case-ref-link"
                                  onClick={() => navigate(`/cases/${c.id}`)}
                                >
                                  {c.case_ref_no}
                                </span>
                                <span className="status-tag sinedie" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', boxShadow: 'none' }}>
                                  {c.forum}
                                </span>
                              </div>
                              
                              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                                <strong style={{ color: '#1f2937' }}>Petitioner:</strong> {c.applicant} Vs. {c.respondent}
                              </div>
                              
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Hearing Date: <strong style={{ color: '#0284c7' }}>{new Date(c.next_hearing_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <a 
                                href={courtInfo.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.4rem 0.6rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  color: '#1e3a8a',
                                  fontWeight: 600
                                }}
                              >
                                <span>Court Website</span>
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>

                              <button 
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                                onClick={() => navigate(`/cases/${c.id}`)}
                              >
                                Open Case
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#0f2c59', borderBottom: '2px solid #0f2c59', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
            त्वरित संपर्क / Quick Portal Actions
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <button className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'flex-start', padding: '1rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} onClick={() => navigate('/cases')}>
              <span style={{ background: '#003366', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', marginRight: '0.75rem', fontWeight: 700 }}>1</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block' }}>Search Case Details Grid</strong>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Audit seeded cases in a 14-column spreadsheet grid</span>
              </div>
            </button>

            <button className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'flex-start', padding: '1rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} onClick={() => navigate('/cases/new')}>
              <span style={{ background: '#ff9933', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', marginRight: '0.75rem', fontWeight: 700 }}>2</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block' }}>AI-Powered Case Ingestion</strong>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Input case files to extract YAML and auto-populate forms</span>
              </div>
            </button>

            <button className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'flex-start', padding: '1rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} onClick={() => navigate('/reminders')}>
              <span style={{ background: '#10b981', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', marginRight: '0.75rem', fontWeight: 700 }}>3</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block' }}>Upcoming Target Deadlines</strong>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Review critical dates, hearings, and compliance targets</span>
              </div>
            </button>

            <button className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'flex-start', padding: '1rem', border: '1px solid #d1d5db', background: '#f9fafb', color: '#111827' }} onClick={() => navigate('/citations')}>
              <span style={{ background: '#06b6d4', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', marginRight: '0.75rem', fontWeight: 700 }}>4</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block' }}>Research Judicial Citations</strong>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Search and citation guidelines for Rule 56(j) and UPSC Advice</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      {/* Chrome-style stacked notifications popups container */}
      <div className="toast-container" style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse', // Stack new ones on top
        gap: '0.75rem',
        maxWidth: '380px',
        width: '100%',
        pointerEvents: 'none'
      }}>
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(120%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes fadeOutRight {
            from {
              transform: scale(1);
              opacity: 1;
            }
            to {
              transform: scale(0.9);
              opacity: 0;
            }
          }
          .chrome-toast-card {
            animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {toasts.map(toast => (
           <div key={toast.id} className="chrome-toast-card" style={{
             background: '#ffffff',
             border: '1px solid #d1d5db',
             borderLeft: '4px solid #ff9933',
             borderRadius: '8px',
             boxShadow: '0 10px 30px rgba(15, 44, 89, 0.12)',
             padding: '1rem 1.25rem',
             width: '350px',
             display: 'flex',
             flexDirection: 'column',
             gap: '0.25rem',
             pointerEvents: 'auto',
             position: 'relative',
             fontFamily: 'Outfit',
             transition: 'all 0.2s ease-in-out'
           }}>
             {/* Tricolor top border decoration */}
             <div style={{
               position: 'absolute',
               top: 0,
               left: 0,
               right: 0,
               height: '3px',
               background: 'linear-gradient(to right, #ff9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #128807 66.6%)',
               borderRadius: '8px 8px 0 0'
             }}></div>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '4px' }}>
               <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b45309', letterSpacing: '0.02em' }}>
                 📢 प्रणाली अद्यतन / SYSTEM UPDATE
               </span>
               <button 
                 onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                 style={{
                   background: 'none',
                   border: 'none',
                   color: '#9ca3af',
                   cursor: 'pointer',
                   fontSize: '1.2rem',
                   fontWeight: 'bold',
                   padding: 0,
                   lineHeight: 1,
                   marginTop: '-4px'
                 }}
                 onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                 onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
               >
                 &times;
               </button>
             </div>
             
             <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f2c59', marginTop: '0.1rem' }}>
               Case Reference: {toast.case_ref_no}
             </div>
             
             <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#4b5563', lineHeight: '1.4' }}>
               {toast.message}
             </p>
             
             <span style={{ fontSize: '0.65rem', color: '#9ca3af', alignSelf: 'flex-end', marginTop: '4px' }}>
               {new Date(toast.created_at || Date.now()).toLocaleTimeString()}
             </span>
           </div>
         ))}
      </div>
    </div>
  );
}
