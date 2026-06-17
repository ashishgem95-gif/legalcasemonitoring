import React from 'react';
import { format, parseISO, isValid } from 'date-fns';

function fmtDate(d) {
  if (!d) return '—';
  try {
    const parsed = typeof d === 'string' ? parseISO(d) : d;
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : '—';
  } catch {
    return '—';
  }
}

export default function AttentionList({ title, items, emptyText, onItemClick, kind = 'overdue' }) {
  return (
    <div className="attention-panel">
      <div className="attention-panel-head">
        <h3>{title}</h3>
        <span className="attention-count">{items.length}</span>
      </div>
      <div className="attention-panel-body">
        {items.length === 0 ? (
          <div className="attention-empty">{emptyText}</div>
        ) : (
          <ul className="attention-list">
            {items.map((it, idx) => (
              <li
                key={it.id ?? idx}
                className={`attention-item kind-${kind}`}
                onClick={onItemClick ? () => onItemClick(it) : undefined}
                style={onItemClick ? { cursor: 'pointer' } : undefined}
              >
                <div className="attention-item-main">
                  <div className="attention-item-ref">{it.case_ref_no}</div>
                  <div className="attention-item-meta">
                    {it.forum && <span className="attention-pill">{it.forum}</span>}
                    {it.railway && <span className="attention-pill muted">{it.railway}</span>}
                  </div>
                </div>
                <div className="attention-item-side">
                  {it.days_overdue != null && (
                    <span className="attention-days overdue">
                      {it.days_overdue}d overdue
                    </span>
                  )}
                  {it.days_until != null && it.days_until >= 0 && (
                    <span className={`attention-days ${it.days_until <= 3 ? 'soon' : 'upcoming'}`}>
                      in {it.days_until}d
                    </span>
                  )}
                  {it.date && (
                    <span className="attention-date">{fmtDate(it.date)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}