import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Reminders() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('All');

  useEffect(() => { fetchCases(); }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await api.getCases();
      setCases(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const getGroupedReminders = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const groups = {};
    const q = searchText.trim().toLowerCase();

    cases.forEach(c => {
      if (c.next_hearing_date) {
        if (q) {
          const haystack = [c.case_ref_no, c.applicant, c.respondent, c.forum, c.railway, c.file_no, c.link_file_no, c.nodal_officer_name, c.advocate_name].filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return;
        }
        const hDate = parseLocalDate(c.next_hearing_date);
        if (!hDate) return;
        const diffDays = Math.round((hDate - today) / 86400000);
        if (diffDays < -30) return;

        const urgency = diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : diffDays <= 3 ? 'critical' : diffDays <= 7 ? 'soon' : 'upcoming';
        if (urgencyFilter !== 'All' && urgency !== urgencyFilter) return;

        const dateKey = c.next_hearing_date;
        if (!groups[dateKey]) {
          groups[dateKey] = {
            date: dateKey,
            label: diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays < 0 ? `${Math.abs(diffDays)}d overdue` : `In ${diffDays} days`,
            urgency,
            cases: []
          };
        }
        groups[dateKey].cases.push({
          id: c.id, case_ref_no: c.case_ref_no, applicant: c.applicant,
          respondent: c.respondent, forum: c.forum, daysLeft: diffDays,
        });
      }
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  };

  const groups = getGroupedReminders();
  const urgencyColors = { overdue: '#DC2626', today: '#DC2626', critical: '#D97706', soon: '#F59E0B', upcoming: '#059669' };
  const urgencyBg = { overdue: '#FEF2F2', today: '#FEF2F2', critical: '#FFF7ED', soon: '#FFFBEB', upcoming: '#ECFDF5' };

  return (
    <div>
      <div className="section-header-goi" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="goi-title-main">महत्वपूर्ण अनुस्मारक / Deadlines & Reminders</h2>
          <p className="goi-subtitle-main">Cases grouped by hearing date — click any case to view details</p>
        </div>
      </div>

      {!loading && groups.length > 0 && (
        <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search reminders by case ref, applicant, file no, advocate..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', background: '#f9fafb' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Urgency:</span>
              {['All', 'overdue', 'today', 'critical', 'soon', 'upcoming'].map(u => (
                <button
                  key={u}
                  onClick={() => setUrgencyFilter(u)}
                  style={{
                    padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: 700,
                    background: urgencyFilter === u ? '#0f2c59' : '#fff',
                    color: urgencyFilter === u ? '#fff' : '#374151',
                    border: '1px solid ' + (urgencyFilter === u ? '#0f2c59' : '#d1d5db'),
                    borderRadius: '14px', cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
            {(searchText.trim() || urgencyFilter !== 'All') && (
              <button
                onClick={() => { setSearchText(''); setUrgencyFilter('All'); }}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
            {(() => {
              const totalCases = groups.reduce((sum, g) => sum + g.cases.length, 0);
              return (
                <>Showing <strong style={{ color: '#0f2c59' }}>{totalCases}</strong> case{totalCases !== 1 ? 's' : ''} across <strong style={{ color: '#0f2c59' }}>{groups.length}</strong> date{groups.length !== 1 ? 's' : ''}</>
              );
            })()}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : groups.length === 0 ? (
        <div className="empty">
          <h3>{searchText.trim() || urgencyFilter !== 'All' ? 'No reminders match your filters' : 'No upcoming hearings'}</h3>
          <p>{searchText.trim() || urgencyFilter !== 'All' ? 'Try clearing filters or adjusting your search.' : 'All cases are up to date.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {groups.map(g => (
            <div key={g.date} className="card" style={{ padding: '0.75rem 1rem', borderLeft: `4px solid ${urgencyColors[g.urgency]}` }}>
              <div className="flex-between mb-2" style={{ borderBottom: `1px solid ${urgencyBg[g.urgency]}`, paddingBottom: '0.4rem' }}>
                <strong style={{ color: urgencyColors[g.urgency], fontSize: '0.85rem' }}>
                  📅 {new Date(g.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/\//g, '-')}
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: urgencyBg[g.urgency], color: urgencyColors[g.urgency], padding: '0.1rem 0.4rem', borderRadius: '3px', fontWeight: 700 }}>
                    {g.label.toUpperCase()}
                  </span>
                </strong>
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{g.cases.length} case{g.cases.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {g.cases.map(c => (
                  <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0.5rem', fontSize: '0.78rem', cursor: 'pointer', borderRadius: '4px', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span className="case-link" style={{ fontWeight: 700, minWidth: '200px' }}>
                      {c.case_ref_no}
                    </span>
                    <span style={{ color: '#4b5563', flex: 1 }}>
                      {c.applicant?.substring(0, 40) || 'Unknown'}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{c.forum}</span>
                    {c.daysLeft < 0 && <span className="tag urgent">Overdue</span>}
                    {c.daysLeft === 0 && <span className="tag urgent">Today</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
