import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Reminders() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const data = await api.getCases();
      setCases(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch case reminders.');
    } finally {
      setLoading(false);
    }
  };

  const getRemindersList = () => {
    const reminders = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    const parseLocalDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length !== 3) return new Date(dateStr);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    };

    cases.forEach(c => {
      // 1. Reply Deadline Reminder
      if (c.last_date_reply && !c.date_filing_reply) {
        const deadline = parseLocalDate(c.last_date_reply);
        const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24));
        reminders.push({
          id: `${c.id}-reply`,
          caseId: c.id,
          case_ref_no: c.case_ref_no,
          applicant: c.applicant,
          forum: c.forum,
          type: 'Reply Deadline',
          date: c.last_date_reply,
          daysLeft: diffDays,
          status: diffDays < 0 ? 'Overdue' : diffDays <= 7 ? 'Urgent' : 'Pending',
          description: `Deadline to file reply is due. (Case: ${c.applicant} Vs. ${c.respondent})`
        });
      }

      // 2. Next Hearing Date Reminder
      if (c.next_hearing_date) {
        const hearing = parseLocalDate(c.next_hearing_date);
        const diffDays = Math.round((hearing - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= -1) { // Show hearings in the future or today/yesterday
          reminders.push({
            id: `${c.id}-hearing`,
            caseId: c.id,
            case_ref_no: c.case_ref_no,
            applicant: c.applicant,
            forum: c.forum,
            type: 'Next Hearing (DOH)',
            date: c.next_hearing_date,
            daysLeft: diffDays,
            status: diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays <= 5 ? 'Urgent' : 'Scheduled',
            description: `Hearing date in court. (Case: ${c.applicant} Vs. ${c.respondent})`
          });
        }
      }

      // 3. Appeal / Implementation Deadline Reminder
      if (c.last_date_appeal_implementation) {
        const deadline = parseLocalDate(c.last_date_appeal_implementation);
        const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24));
        reminders.push({
          id: `${c.id}-appeal`,
          caseId: c.id,
          case_ref_no: c.case_ref_no,
          applicant: c.applicant,
          forum: c.forum,
          type: 'Appeal/Compliance',
          date: c.last_date_appeal_implementation,
          daysLeft: diffDays,
          status: diffDays < 0 ? 'Overdue' : diffDays <= 15 ? 'Urgent' : 'Pending',
          description: `Deadline for filing appeal or implementing judgment directives.`
        });
      }
    });

    // Sort by chronological order (closest deadline first)
    return reminders.sort((a, b) => a.daysLeft - b.daysLeft);
  };

  const remindersList = getRemindersList();

  const getReminderBadgeClass = (status) => {
    switch (status) {
      case 'Overdue': return 'status-tag urgent';
      case 'Today': return 'status-tag urgent';
      case 'Tomorrow': return 'status-tag pending';
      case 'Urgent': return 'status-tag pending';
      case 'Scheduled': return 'status-tag sinedie';
      default: return 'status-tag sinedie';
    }
  };

  return (
    <div>
      <div className="section-header-goi" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 className="goi-title-main">महत्वपूर्ण अनुस्मारक / Critical Deadlines & Reminders</h2>
          <p className="goi-subtitle-main">Monitor upcoming reply timelines, judicial hearing dates, and compliance milestones.</p>
        </div>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      <div className="glass-panel" style={{ background: '#fff', border: '1px solid #d1d5db', padding: '1.5rem' }}>
        {loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p style={{ color: '#4b5563' }}>Loading reminders...</p>
          </div>
        ) : remindersList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <h3>No critical reminders recorded</h3>
            <p>All legal reply timelines, hearings, and compliance milestones are up to date.</p>
          </div>
        ) : (
          <div className="cases-table-container" style={{ border: '1px solid #d1d5db' }}>
            <table className="cases-table">
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ color: '#4b5563' }}>Case Reference / Petitioner</th>
                  <th style={{ color: '#4b5563' }}>Forum</th>
                  <th style={{ color: '#4b5563' }}>Reminder Type</th>
                  <th style={{ color: '#4b5563' }}>Target Date</th>
                  <th style={{ color: '#4b5563' }}>Proximity</th>
                  <th style={{ color: '#4b5563' }}>Status</th>
                  <th style={{ color: '#4b5563' }}>Details</th>
                  <th style={{ color: '#4b5563', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {remindersList.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="case-ref-link" onClick={() => navigate(`/cases/${r.caseId}`)} style={{ display: 'inline-block', marginBottom: r.applicant ? '0.25rem' : '0' }}>
                        {r.case_ref_no}
                      </span>
                      {r.applicant && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280',
                          lineHeight: '1.25'
                        }}>
                          Petitioner: <span style={{ color: '#374151', fontWeight: 600 }}>{r.applicant}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{r.forum || 'N/A'}</span>
                    </td>
                    <td>
                      <strong style={{ 
                        color: r.type.includes('Hearing') ? '#06b6d4' : r.type.includes('Reply') ? '#f59e0b' : '#ef4444',
                        fontSize: '0.85rem'
                      }}>
                        {r.type}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#111827' }}>
                        {new Date(r.date).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    </td>
                    <td>
                      {r.daysLeft < 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>
                          {-r.daysLeft} days overdue
                        </span>
                      ) : r.daysLeft === 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>
                          TODAY
                        </span>
                      ) : r.daysLeft === 1 ? (
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                          TOMORROW
                        </span>
                      ) : (
                        <span style={{ color: '#4b5563' }}>
                          In {r.daysLeft} days
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={getReminderBadgeClass(r.status)} style={{ boxShadow: 'none' }}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                        {r.description}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => navigate(`/cases/${r.caseId}`)}
                      >
                        Open Case
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
