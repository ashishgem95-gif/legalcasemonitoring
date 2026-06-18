import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import CaseCard from './CaseCard';
import { format, addDays, startOfDay, isBefore, isAfter, isToday, isTomorrow, differenceInDays } from 'date-fns';

const COLUMNS = [
  { id: 'awaitingOrders', label: 'Awaiting Orders', tone: 'danger', filter: (c) => Boolean(c.has_pending_order_upload) },
  { id: 'today', label: 'Today', filter: (c, today) => c.next_hearing_date && isToday(new Date(c.next_hearing_date)) },
  { id: 'tomorrow', label: 'Tomorrow', filter: (c, today) => c.next_hearing_date && isTomorrow(new Date(c.next_hearing_date)) },
  { id: 'thisWeek', label: 'This Week', filter: (c, today) => {
    if (!c.next_hearing_date) return false;
    const d = new Date(c.next_hearing_date);
    const diff = differenceInDays(d, today);
    return diff > 1 && diff <= 7;
  }},
  { id: 'nextWeek', label: 'Next Week', filter: (c, today) => {
    if (!c.next_hearing_date) return false;
    const d = new Date(c.next_hearing_date);
    const diff = differenceInDays(d, today);
    return diff > 7 && diff <= 14;
  }},
  { id: 'thisMonth', label: 'This Month', filter: (c, today) => {
    if (!c.next_hearing_date) return false;
    const d = new Date(c.next_hearing_date);
    const diff = differenceInDays(d, today);
    return diff > 14 && diff <= 30;
  }},
];

export default function KanbanTab({ refreshKey }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [forumFilter, setForumFilter] = useState('All');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    let active = true;
    fetchCases(active);
    return () => { active = false; };
  }, [refreshKey]);

  const fetchCases = async (active) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      if (!active) return;
      const localToday = startOfDay(new Date());
      const filteredData = (data || []).filter(c => {
        if (c.has_pending_order_upload) return true;
        if (!c.next_hearing_date) return false;
        const d = new Date(c.next_hearing_date);
        const diff = differenceInDays(d, localToday);
        return diff >= 0 && diff <= 30;
      });
      setCases(filteredData);
    } catch (err) {
      console.error('Failed to load cases:', err);
      if (active) setError('Failed to load Kanban board. Please try refreshing.');
    } finally {
      if (active) setLoading(false);
    }
  };

  const today = startOfDay(new Date());
  const uniqueForums = ['All', ...new Set(cases.map(c => c.forum).filter(Boolean))];
  const uniqueStatuses = ['All', ...new Set(cases.map(c => c.present_status || 'Pending').filter(Boolean))];

  let filtered = cases;
  if (statusFilter !== 'All') {
    filtered = filtered.filter(c => (c.present_status || 'Pending') === statusFilter);
  }
  if (forumFilter !== 'All') {
    filtered = filtered.filter(c => c.forum === forumFilter);
  }
  if (searchText.trim()) {
    const q = searchText.trim().toLowerCase();
    filtered = filtered.filter(c => {
      const haystack = [c.case_ref_no, c.applicant, c.respondent, c.forum, c.railway, c.file_no].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  return (
    <div>
      <div className="filters-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {uniqueStatuses.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={forumFilter} onChange={e => setForumFilter(e.target.value)}>
          <option value="All">All Forums</option>
          {uniqueForums.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search by ref, applicant, file no..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Showing {filtered.length} of {cases.length} cases
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : error ? (
        <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--red)', textAlign: 'center', padding: '2.5rem', color: 'var(--red)' }}>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => fetchCases(true)}>Retry</button>
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const columnCases = filtered.filter(c => col.filter(c, today));
            return (
              <div key={col.id} className={`kanban-column ${col.tone ? `tone-${col.tone}` : ''}`}>
                <div className={`kanban-column-header ${col.tone ? `tone-${col.tone}` : ''}`}>
                  <span>{col.label}</span>
                  <span className="kanban-count">{columnCases.length}</span>
                </div>
                <div className="kanban-column-body">
                  {columnCases.map(c => (
                    <CaseCard key={c.id} caseItem={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
