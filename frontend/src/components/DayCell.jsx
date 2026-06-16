import React from 'react';
import { isToday, isBefore, startOfDay, differenceInDays } from 'date-fns';

function getUrgency(dateStr) {
  if (!dateStr) return 'upcoming';
  const today = startOfDay(new Date());
  const d = new Date(dateStr);
  if (isBefore(d, today)) return 'overdue';
  if (isToday(d)) return 'today';
  const days = differenceInDays(d, today);
  if (days <= 3) return 'soon';
  return 'upcoming';
}

export default function DayCell({ day, hearings, isCurrentMonth, onClick }) {
  const today = isToday(day);
  const dotCount = hearings.length;
  const displayDots = hearings.slice(0, 5);
  const moreCount = Math.max(0, dotCount - 5);

  return (
    <div
      className={`calendar-day ${today ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
      onClick={() => onClick(day)}
    >
      <div className="calendar-day-num">{day.getDate()}</div>
      <div className="calendar-dots">
        {displayDots.map((h, i) => (
          <div key={i} className={`calendar-dot ${getUrgency(h.next_hearing_date)}`} title={h.case_ref_no} />
        ))}
        {moreCount > 0 && (
          <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>+{moreCount}</span>
        )}
      </div>
    </div>
  );
}
