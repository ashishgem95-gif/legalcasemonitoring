import React, { useState } from 'react';
import api from '../utils/api';
import AiSettingsPanel from './AiSettingsPanel';

export default function AddHearingModal({ caseId, onClose, onHearingAdded }) {
  const [hearingDate, setHearingDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderRawText, setOrderRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [extracting, setExtracting] = useState(false);

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setExtracting(true);
      setError(null);
      
      const response = await api.extractPdfText(file);
      if (response && response.text) {
        setOrderRawText(response.text);
      } else {
        throw new Error('No text returned from the PDF.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to extract text from PDF. The PDF might be scanned or blank.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hearingDate) {
      setError('Hearing Date is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const newHearing = await api.addHearingToCase(caseId, {
        hearing_date: hearingDate,
        order_raw_text: orderRawText
      });

      onHearingAdded(newHearing);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit hearing record.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Record New Hearing Log</h2>
          <button className="modal-close-btn" onClick={onClose} disabled={submitting}>&times;</button>
        </div>

        {submitting ? (
          <div className="modal-body" style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner-container">
              <div className="spinner"></div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1rem' }}>AI Automated Summarization In Progress</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', maxWidth: '380px' }}>
                Analyzing court order text and extracting key directions, next dates, and legal milestones. Please wait...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {error && (
                <div className="alert-banner error" style={{ padding: '0.75rem 1rem', marginBottom: 0 }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  {error}
                </div>
              )}

              <AiSettingsPanel />

              <div className="form-group">
                <label className="form-label">Hearing Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={hearingDate}
                  onChange={(e) => setHearingDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Upload PDF Court Order</span>
                  {extracting && <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>⚡ Extracting text...</span>}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept=".pdf"
                    className="form-control"
                    onChange={handlePdfUpload}
                    disabled={extracting || submitting}
                    style={{ padding: '0.375rem 0.75rem' }}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Directly upload the PDF file to automatically extract the raw court order text.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Raw Court Order Text (Paste from PDF/Website)</label>
                <textarea
                  className="form-control"
                  placeholder="Paste the raw text of the daily court order or judgment here. The AI backend will automatically process and summarize this text..."
                  value={orderRawText}
                  onChange={(e) => setOrderRawText(e.target.value)}
                  style={{ minHeight: '160px' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose} 
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting}
              >
                Submit & Summarize
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
