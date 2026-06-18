import React from 'react';

export function getStatusClass(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s.includes('disposed')) return 'disposed';
  if (s.includes('sine die') || s.includes('sinedie')) return 'sinedie';
  if (s.includes('urgent') || s.includes('deadline')) return 'urgent';
  return 'pending';
}

const STATUS_ICONS = {
  disposed: '\u2713',
  pending: '\u25F7',
  sinedie: '\u23F8',
  urgent: '\u26A0',
};

export default function StatusChip({ status, style }) {
  const className = getStatusClass(status);
  const icon = STATUS_ICONS[className] || '';
  return (
    <span className={`status-tag ${className}`} style={style}>
      {icon && <span style={{ marginRight: '0.3rem', fontSize: '0.8em' }}>{icon}</span>}
      {status || 'Pending'}
    </span>
  );
}
