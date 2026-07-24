import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function HomeCalendar({ cases = [] }) {
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = useMemo(() => new Date(), []);
  const todayStr = todayISO();

  const withHearings = useMemo(
    () => cases.filter((c) => c.next_hearing_date),
    [cases]
  );

  const hearingsByDate = useMemo(() => {
    const map = {};
    for (const c of withHearings) {
      const d = c.next_hearing_date;
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  }, [withHearings]);

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const monthIndex = base.getMonth();

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso, hearings: hearingsByDate[iso] || [] });
  }

  const prevMonth = () => setMonthOffset((o) => o - 1);
  const nextMonth = () => setMonthOffset((o) => o + 1);
  const goToday = () => setMonthOffset(0);

  const selectedList = selectedDate ? hearingsByDate[selectedDate] || [] : [];
  const selectedLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="home-calendar-widget">
      <div className="home-calendar-head">
        <h3 className="home-calendar-title">📅 Hearing Calendar</h3>
        <button
          type="button"
          className="home-calendar-today-btn"
          onClick={goToday}
          title="Jump to today"
        >
          Today
        </button>
      </div>

      <div className="home-calendar-nav">
        <button type="button" className="home-calendar-nav-btn" onClick={prevMonth}>
          ◀
        </button>
        <span className="home-calendar-month-label">
          {MONTHS[monthIndex]} {year}
        </span>
        <button type="button" className="home-calendar-nav-btn" onClick={nextMonth}>
          ▶
        </button>
      </div>

      <div className="home-calendar-grid">
        {DAYS.map((d) => (
          <span key={d} className="home-calendar-day-header">
            {d}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell ? (
            <button
              key={i}
              type="button"
              className={`home-calendar-day ${cell.iso === todayStr ? 'is-today' : ''} ${
                cell.hearings.length > 0 ? 'has-hearings' : ''
              } ${cell.iso === selectedDate ? 'is-selected' : ''}`}
              onClick={() =>
                setSelectedDate(
                  cell.iso === selectedDate ? null : cell.iso
                )
              }
              title={
                cell.hearings.length > 0
                  ? `${cell.hearings.length} hearing(s)`
                  : undefined
              }
            >
              <span className="home-calendar-day-num">{cell.day}</span>
              {cell.hearings.length > 0 && (
                <span className="home-calendar-day-dot" />
              )}
            </button>
          ) : (
            <span key={i} className="home-calendar-day empty" />
          )
        )}
      </div>

      {selectedList.length > 0 && (
        <div className="home-calendar-list">
          <div className="home-calendar-list-head">{selectedLabel}</div>
          {selectedList.map((c) => (
            <div
              key={c.id}
              className="home-calendar-list-item"
              onClick={() => navigate(`/cases/${c.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/cases/${c.id}`);
              }}
            >
              <div className="home-calendar-list-ref">
                {c.case_ref_no || `#${c.id}`}
              </div>
              <div className="home-calendar-list-meta">
                {c.applicant?.substring(0, 30)} vs{' '}
                {c.respondent?.substring(0, 30)}
              </div>
              <div className="home-calendar-list-forum">{c.forum}</div>
            </div>
          ))}
        </div>
      )}

      {selectedDate && selectedList.length === 0 && (
        <div className="home-calendar-empty">No hearings on this day</div>
      )}

      {withHearings.length > 0 && (
        <button
          type="button"
          className="home-calendar-full-link"
          onClick={() => navigate('/analysis')}
        >
          Full calendar view →
        </button>
      )}
    </div>
  );
}
