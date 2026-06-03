import React from 'react';

export default function HearingTimeline({ hearings = [] }) {
  if (hearings.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb' }}>
        <p style={{ color: '#6b7280' }}>No hearing logs recorded for this case yet.</p>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      {hearings.map((h) => (
        <div key={h.id} className="timeline-node">
          {/* Glowing node point */}
          <div className="timeline-marker" style={{ border: '2px solid #0f2c59', boxShadow: '0 0 8px rgba(15, 44, 89, 0.2)' }}>
            <div className="timeline-marker-inner" style={{ background: '#0f2c59' }}></div>
          </div>

          {/* Two-pane split card layout */}
          <div className="timeline-split-card" style={{ border: '1px solid #d1d5db', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            
            {/* Left Pane: Date and Summary */}
            <div className="timeline-pane-left" style={{ background: '#f9fafb', borderRight: '1px solid #d1d5db', padding: '1.25rem' }}>
              <div className="timeline-date" style={{ color: '#0f2c59', fontSize: '1rem', fontWeight: 700, fontFamily: 'Outfit' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: '#0f2c59' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {new Date(h.hearing_date).toLocaleDateString(undefined, { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#ff9933', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                  एआई सारांश / AI Automated Summary
                </span>
                <p className="summary-text" style={{ color: '#111827', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.5 }}>
                  {h.order_summary || 'No automated summary generated.'}
                </p>
              </div>
            </div>

            {/* Right Pane: Scrollable Raw Text */}
            <div className="timeline-pane-right" style={{ background: '#f3f4f6', padding: '1.25rem' }}>
              <h4 className="raw-order-title" style={{ color: '#4b5563', borderBottom: '1px solid #d1d5db', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                न्यायालय आदेश मूल पाठ / Raw Court Order Text
              </h4>
              <pre className="raw-order-text" style={{ color: '#374151', fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {h.order_raw_text || 'No raw order text recorded for this hearing.'}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
