import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function FileActivityAlerts({ user }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.id === 'admin' || (user.role && user.role.includes('Super Admin'));
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const data = await api.getFileActivity();
        setAlerts(data || []);
        if (data && data.length > 0) {
          setShowModal(true);
        }
      } catch (err) {
        console.error('File activity check failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleMarkSeen = async () => {
    try {
      await api.markAlertsSeen();
      setShowModal(false);
    } catch (err) {
      console.error('Mark seen failed:', err);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  const handleCaseClick = (caseId) => {
    setShowModal(false);
    if (caseId) navigate(`/cases/${caseId}`);
  };

  if (loading || !showModal || alerts.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <span>📁 Recent File Activity ({alerts.length} new)</span>
          <button className="modal-close-btn" onClick={handleDismiss}>&times;</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
            Files added or deleted by users since you last reviewed.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Case</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>File</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>By</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={`${a.action}-${a.id}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {a.action === 'UPLOAD' ? (
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>+ ADDED</span>
                    ) : (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>- DELETED</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {a.case_id ? (
                      <button
                        onClick={() => handleCaseClick(a.case_id)}
                        style={{ background: 'none', border: 'none', color: '#0f2c59', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}
                      >
                        {a.case_ref_no || `Case #${a.case_id}`}
                      </button>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#374151' }}>{a.original_name || '—'}</td>
                  <td style={{ padding: '0.5rem', color: '#6b7280' }}>{a.uploaded_by || '—'}</td>
                  <td style={{ padding: '0.5rem', color: '#6b7280' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button
            onClick={handleDismiss}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Dismiss (will reappear next login)
          </button>
          <button
            onClick={handleMarkSeen}
            style={{ padding: '0.5rem 1rem', background: '#0f2c59', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Mark as Reviewed
          </button>
        </div>
      </div>
    </div>
  );
}
