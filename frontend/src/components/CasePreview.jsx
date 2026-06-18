import React from 'react';
import StatusChip from './StatusChip';

export default function CasePreview({ caseItem, visible, position, pinned, previewProps }) {
  if (!visible || !caseItem) return null;

  const nextDate = caseItem.next_hearing_date ? new Date(caseItem.next_hearing_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let urgency = '';
  let urgencyColor = 'var(--text-muted)';
  if (nextDate) {
    const daysLeft = Math.ceil((nextDate - today) / 86400000);
    if (daysLeft < 0) { urgency = `${Math.abs(daysLeft)}d overdue`; urgencyColor = 'var(--red)'; }
    else if (daysLeft === 0) { urgency = 'Today'; urgencyColor = 'var(--red)'; }
    else if (daysLeft <= 7) { urgency = `in ${daysLeft}d`; urgencyColor = 'var(--status-pending)'; }
    else { urgency = `in ${daysLeft}d`; urgencyColor = 'var(--status-disposed)'; }
  }

  const synopsis = caseItem.synopsis || '';
  const truncatedSynopsis = synopsis.length > 180 ? synopsis.substring(0, 180) + '...' : synopsis;

  return (
    <div
      className="case-preview-popover"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        width: '340px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: '0.85rem 1rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        cursor: 'default',
      }}
      onMouseEnter={previewProps.onMouseEnter}
      onMouseLeave={previewProps.onMouseLeave}
    >
      {pinned && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); previewProps.onClose(); }}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--text-muted)',
            padding: '0.1rem 0.3rem',
            lineHeight: 1,
          }}
          aria-label="Close preview"
        >
          &times;
        </button>
      )}

      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-color)', marginBottom: '0.4rem', paddingRight: pinned ? '1.5rem' : 0 }}>
        {caseItem.case_ref_no}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <StatusChip status={caseItem.present_status} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }} />
        {urgency && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: urgencyColor }}>{urgency}</span>
        )}
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
        <strong>{caseItem.applicant || 'N/A'}</strong> vs <span>{caseItem.respondent || 'N/A'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 0.75rem', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
        <div><span style={{ color: 'var(--text-muted)' }}>Forum:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{caseItem.forum || '-'}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>Type:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{caseItem.case_type || '-'}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>Railway:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{caseItem.railway || '-'}</span></div>
        <div><span style={{ color: 'var(--text-muted)' }}>Year:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{caseItem.case_year || '-'}</span></div>
      </div>

      {truncatedSynopsis && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
          {truncatedSynopsis}
        </div>
      )}

      {pinned && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Click case to open full details
        </div>
      )}
    </div>
  );
}
