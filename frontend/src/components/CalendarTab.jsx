import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import DayCell from './DayCell';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, format, isSameDay, isToday, isBefore, startOfDay
} from 'date-fns';

export default function CalendarTab({ refreshKey }) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedHearings, setSelectedHearings] = useState([]);
  const [forumFilter, setForumFilter] = useState('All');

  useEffect(() => {
    fetchCases();
  }, [refreshKey]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await api.getCases();
      setCases(data.filter(c => c.next_hearing_date));
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const uniqueForums = ['All', ...new Set(cases.map(c => c.forum).filter(Boolean))];

  let filtered = cases;
  if (forumFilter !== 'All') {
    filtered = filtered.filter(c => c.forum === forumFilter);
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = [];
  let d = calendarStart;
  while (d <= calendarEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const handleDayClick = (day) => {
    setSelectedDay(day);
    const dayCases = filtered.filter(c => {
      const hd = new Date(c.next_hearing_date);
      return isSameDay(hd, day);
    });
    setSelectedHearings(dayCases);
  };

  const handleResync = async (caseId) => {
    try { await api.resyncCase(caseId); } catch (err) { alert('Failed: ' + err.message); }
  };

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="filters-bar">
        <button
          onClick={() => setCurrentMonth(addDays(monthStart, -1))}
          style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >◀</button>
        <span style={{ fontWeight: 700, color: '#0f2c59', fontSize: '0.95rem', fontFamily: 'Outfit' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(addDays(monthEnd, 1))}
          style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >▶</button>
        <button
          onClick={() => setCurrentMonth(new Date())}
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >Today</button>
        <select value={forumFilter} onChange={e => setForumFilter(e.target.value)}>
          <option value="All">All Forums</option>
          {uniqueForums.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          {filtered.length} hearings
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : (
        <div className="calendar-grid">
          {dayHeaders.map(dh => (
            <div key={dh} className="calendar-header">{dh}</div>
          ))}
          {days.map(day => {
            const dayCases = filtered.filter(c => isSameDay(new Date(c.next_hearing_date), day));
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            return (
              <DayCell
                key={day.toISOString()}
                day={day}
                hearings={dayCases}
                isCurrentMonth={isCurrentMonth}
                onClick={handleDayClick}
              />
            );
          })}
        </div>
      )}

      {selectedDay && (
        <div className="side-panel-overlay" onClick={() => setSelectedDay(null)}>
          <div className="side-panel-header" onClick={e => e.stopPropagation()}>
            <strong>{format(selectedDay, 'EEEE, MMMM d, yyyy')}</strong>
            <button className="side-panel-close" onClick={() => setSelectedDay(null)}>&times;</button>
          </div>
          <div className="side-panel-body" onClick={e => e.stopPropagation()}>
            {selectedHearings.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No hearings on this day</p>
            ) : (
              selectedHearings.map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                    marginBottom: '0.5rem', cursor: 'pointer',
                  }}
                  onClick={() => { setSelectedDay(null); navigate(`/cases/${c.id}`); }}
                >
                  <div style={{ fontWeight: 700, color: '#0f2c59', fontSize: '0.85rem' }}>
                    {c.case_ref_no}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '0.2rem' }}>
                    {c.applicant?.substring(0, 50)} vs {c.respondent?.substring(0, 50)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', background: '#f3f4f6', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>{c.forum}</span>
                    <span style={{ fontSize: '0.7rem', color: '#374151' }}>{c.present_status || 'Pending'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResync(c.id); }}
                      style={{
                        marginLeft: 'auto', fontSize: '0.6rem', padding: '0.15rem 0.3rem',
                        background: '#fff', border: '1px solid #d1d5db', borderRadius: '3px',
                        cursor: 'pointer', color: '#0f2c59', fontWeight: 600,
                      }}
                    >🔄 Re-sync</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
