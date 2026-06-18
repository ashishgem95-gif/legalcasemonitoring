import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { differenceInDays, isBefore, isToday, isAfter, startOfDay } from 'date-fns';
import StatusChip from './StatusChip';
import CopyLinkButton from './CopyLinkButton';
import CasePreview from './CasePreview';
import { useHoverPreview } from '../utils/useHoverPreview';

function getDaysClass(dateStr) {
  if (!dateStr) return 'upcoming';
  const today = startOfDay(new Date());
  const d = new Date(dateStr);
  if (isBefore(d, today)) return 'overdue';
  if (isToday(d)) return 'today';
  const days = differenceInDays(d, today);
  if (days <= 3) return 'soon';
  return 'upcoming';
}

function getDaysLabel(dateStr) {
  if (!dateStr) return '';
  const today = startOfDay(new Date());
  const d = new Date(dateStr);
  if (isBefore(d, today)) {
    const days = Math.abs(differenceInDays(d, today));
    return `${days}d overdue`;
  }
  if (isToday(d)) return 'Today';
  const days = differenceInDays(d, today);
  if (days === 1) return 'Tomorrow';
  return `in ${days}d`;
}

export default function CaseCard({ caseItem }) {
  const navigate = useNavigate();
  const [resyncing, setResyncing] = React.useState(false);
  const { visible, position, pinned, triggerProps, previewProps } = useHoverPreview();

  const isAdmin = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id === 'admin' || (user.role && user.role.includes('Super Admin'));
    } catch { return false; }
  })();

  const handleReSync = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Re-sync case ${caseItem.case_ref_no} from CAT?`)) return;
    setResyncing(true);
    try { await api.resyncCase(caseItem.id); } catch (err) { alert('Failed: ' + err.message); }
    setResyncing(false);
  };

  return (
    <div
      className="case-card"
      onClick={() => navigate(`/cases/${caseItem.id}`)}
      onMouseEnter={triggerProps.onMouseEnter}
      onMouseLeave={triggerProps.onMouseLeave}
    >
      <div className="case-card-ref" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
        <span>{caseItem.case_ref_no}</span>
        <CopyLinkButton caseId={caseItem.id} size="xs" />
      </div>
      <div className="case-card-parties">
        {caseItem.applicant?.substring(0, 40) || 'N/A'}
      </div>
      <div className="case-card-meta">
        <span className="case-card-forum">{caseItem.forum || 'N/A'}</span>
        {caseItem.present_status && (
          <StatusChip status={caseItem.present_status} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }} />
        )}
        <span className={`case-card-days ${getDaysClass(caseItem.next_hearing_date)}`}>
          {getDaysLabel(caseItem.next_hearing_date)}
        </span>
        {isAdmin && (
          <button
            onClick={handleReSync}
            disabled={resyncing}
            style={{
              fontSize: '0.6rem', padding: '0.15rem 0.3rem', background: 'none',
              border: '1px solid var(--border-color)', borderRadius: '3px', cursor: 'pointer',
              color: resyncing ? 'var(--text-muted)' : 'var(--accent-color)', fontWeight: 600,
              marginLeft: 'auto'
            }}
            title="Re-sync from CAT"
          >
            {resyncing ? '\u27F3' : '\u{1F504}'}
          </button>
        )}
      </div>
      <CasePreview caseItem={caseItem} visible={visible} position={position} pinned={pinned} previewProps={previewProps} />
    </div>
  );
}
