import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import HomeExcelWidget from './HomeExcelWidget';
import HomeCalendar from './HomeCalendar';
import './HomePage.css';

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; } catch (e) { return {}; }
  });
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isAdmin = user.id === 'admin' || (user.role && user.role.includes('Super Admin'));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [d, c] = await Promise.all([
          api.getAnalyticsDashboard().catch(() => null),
          api.getCases().catch(() => []),
        ]);
        if (!mounted) return;
        setStats(d);
        setCases(Array.isArray(c) ? c : []);
        setLastUpdated(new Date());
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => todayISO(), [today]);

  const todaysHearings = useMemo(() => {
    return cases
      .filter(c => c.next_hearing_date && c.next_hearing_date.startsWith(todayStr))
      .sort((a, b) => (a.next_hearing_date < b.next_hearing_date ? -1 : 1))
      .slice(0, 5);
  }, [cases, todayStr]);

  const statCards = useMemo(() => {
    const s = stats || {};
    return [
      {
        key: 'total',
        icon: '📁',
        value: s.total,
        labelHi: 'कुल मामले',
        labelEn: 'Total Cases',
        to: '/cases',
        tone: 'navy',
      },
      {
        key: 'active',
        icon: '⚖️',
        value: s.active,
        labelHi: 'सक्रिय मामले',
        labelEn: 'Active Cases',
        to: '/cases?status=active',
        tone: 'blue',
      },
      {
        key: 'replies',
        icon: '✉️',
        value: s.pendingReplies,
        labelHi: 'लंबित उत्तर',
        labelEn: 'Pending Replies',
        tone: (s.pendingReplies || 0) > 0 ? 'amber' : 'green',
      },
      {
        key: 'hearings',
        icon: '📅',
        value: s.upcomingHearings,
        labelHi: 'आगामी सुनवाई',
        labelEn: 'Upcoming Hearings',
        to: '/analysis',
        tone: 'saffron',
      },
    ];
  }, [stats]);

  const quickLinks = useMemo(() => {
    const all = [
      {
        to: '/cases',
        icon: '📋',
        titleHi: 'मामला विवरण',
        titleEn: 'Case Details Grid',
        desc: `View all ${stats?.total ?? ''} cases across ${user.railwayScope === 'All' ? 'all zones' : user.railwayScope || 'your zone'}.`,
        visible: true,
      },
      {
        to: '/analysis',
        icon: '📊',
        titleHi: 'विश्लेषण',
        titleEn: 'Analysis',
        desc: 'Kanban board, hearing calendar, and analytics charts.',
        visible: true,
      },
      {
        to: '/citations',
        icon: '📜',
        titleHi: 'कानूनी उद्धरण',
        titleEn: 'Legal Citations',
        desc: 'Searchable library of judgments and case-law.',
        visible: isAdmin,
      },
      {
        to: '/ai-draft',
        icon: '✨',
        titleHi: 'AI मसौदा',
        titleEn: 'AI Draft',
        desc: 'Generate draft replies with AI assistance.',
        visible: isAdmin,
      },
      {
        to: '/file-registry',
        icon: '📂',
        titleHi: 'फाइल संचलन पंजी',
        titleEn: 'File Registry',
        desc: 'Physical file movements and current holder.',
        visible: isAdmin,
      },
    ];
    return all.filter(l => l.visible);
  }, [isAdmin, stats, user]);

  return (
    <div className="homepage">
      <section className="homepage-welcome">
        <div className="homepage-welcome-stripe" aria-hidden="true"></div>
        <div className="homepage-welcome-inner">
          <div className="homepage-welcome-text">
            <div className="homepage-greeting">
              <span className="homepage-greeting-icon">🙏</span>
              <span>नमस्ते / Welcome,</span>
              <strong>{user.name || 'User'}</strong>
            </div>
            <div className="homepage-role">
              {user.role || 'User'}
              {user.railwayScope && (
                <span className={`homepage-scope ${user.railwayScope === 'All' ? 'scope-all' : 'scope-zone'}`}>
                  · {user.railwayScope === 'All' ? 'Global Access' : `${user.railwayScope} Zone`}
                </span>
              )}
            </div>
            <div className="homepage-date">{formatDate(today)}</div>
          </div>
          <div className="homepage-welcome-actions">
            <button
              type="button"
              className="homepage-cta"
              onClick={() => navigate('/cases/new')}
              title="Add a new case to the registry"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              नया मामला जोड़ें / Add Case
            </button>
          </div>
        </div>
      </section>

      <section className="homepage-stats">
        {statCards.map(card => (
          <button
            key={card.key}
            type="button"
            className={`homepage-stat homepage-stat-${card.tone} ${loading ? 'is-loading' : ''}`}
            onClick={card.to ? () => navigate(card.to) : undefined}
            title={card.to ? `Go to ${card.labelEn}` : card.labelEn}
            style={card.to ? undefined : { cursor: 'default' }}
          >
            <span className="homepage-stat-icon" aria-hidden="true">{card.icon}</span>
            <span className="homepage-stat-body">
              <span className="homepage-stat-value">
                {loading ? '—' : (card.value ?? 0)}
              </span>
              <span className="homepage-stat-label">
                <span className="homepage-stat-label-hi">{card.labelHi}</span>
                <span className="homepage-stat-label-en">{card.labelEn}</span>
              </span>
            </span>
          </button>
        ))}
      </section>

      <section className="homepage-links-section">
        <div className="homepage-section-header">
          <h2 className="homepage-section-title">त्वरित पहुँच / Quick Links</h2>
          <p className="homepage-section-subtitle">Jump directly to any module in the system.</p>
        </div>
        <div className="homepage-links-grid">
          {quickLinks.map(link => (
            <button
              key={link.to}
              type="button"
              className="homepage-link-tile"
              onClick={() => navigate(link.to)}
            >
              <span className="homepage-link-icon" aria-hidden="true">{link.icon}</span>
              <span className="homepage-link-text">
                <span className="homepage-link-title-hi">{link.titleHi}</span>
                <span className="homepage-link-title-en">{link.titleEn}</span>
                <span className="homepage-link-desc">{link.desc}</span>
              </span>
              <span className="homepage-link-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      {todaysHearings.length > 0 && (
        <section className="homepage-today">
          <div className="homepage-section-header">
            <h2 className="homepage-section-title">आज की सुनवाई / Today's Hearings</h2>
            <p className="homepage-section-subtitle">
              {todaysHearings.length} hearing{todaysHearings.length === 1 ? '' : 's'} scheduled for {formatDateShort(today)}.
            </p>
          </div>
          <ul className="homepage-today-list">
            {todaysHearings.map(c => (
              <li
                key={c.id}
                className="homepage-today-item"
                onClick={() => navigate(`/cases/${c.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/cases/${c.id}`); }}
              >
                <div className="homepage-today-main">
                  <div className="homepage-today-ref">{c.case_ref_no || `Case #${c.id}`}</div>
                  <div className="homepage-today-meta">
                    {c.applicant && c.respondent
                      ? `${c.applicant} vs ${c.respondent}`
                      : c.synopsis || 'Parties not on record'}
                  </div>
                </div>
                <div className="homepage-today-side">
                  <span className="homepage-today-forum">{c.forum || 'Forum unknown'}</span>
                  <span className="homepage-today-arrow" aria-hidden="true">→</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bottom row: Excel import (left) + Hearing calendar (right) */}
      <section className="homepage-bottom-row">
        <div className="homepage-bottom-col">
          <HomeExcelWidget />
        </div>
        <div className="homepage-bottom-col">
          <HomeCalendar cases={cases} />
        </div>
      </section>

      <section className="homepage-footer-info">
        <div className="homepage-footer-row">
          <span>
            Ministry of Railways · Railway Board · Legal Cell
          </span>
          {lastUpdated && (
            <span className="homepage-footer-muted">
              Last updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
