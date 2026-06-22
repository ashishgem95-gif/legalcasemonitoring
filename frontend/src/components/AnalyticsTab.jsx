import { useState, useEffect, useMemo } from 'react';
import ChartPanel from './ChartPanel';
import KpiCard from './KpiCard';
import AttentionList from './AttentionList';
import api from '../utils/api';
import { useTheme } from '../utils/ThemeContext';
import { differenceInDays, startOfDay, format } from 'date-fns';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

const STATUS_COLORS_LIGHT = {
  Disposed: '#10b981',
  Pending: '#0f2c59',
  'Pending Reply': '#d97706',
  'Reply Filed': '#0f2c59',
  Closed: '#6b7280',
  Withdrawn: '#6b7280',
};

const STATUS_COLORS_DARK = {
  Disposed: '#34D399',
  Pending: '#3B82F6',
  'Pending Reply': '#FBBF24',
  'Reply Filed': '#3B82F6',
  Closed: '#64748B',
  Withdrawn: '#64748B',
};

const FALLBACK_LIGHT = ['#0f2c59', '#1e40af', '#0f2c59', '#1e40af', '#1e40af', '#d97706', '#ef4444'];
const FALLBACK_DARK = ['#3B82F6', '#60A5FA', '#3B82F6', '#60A5FA', '#60A5FA', '#FBBF24', '#F87171'];

const ATTENTION_TABS = [
  { key: 'overdue', label: 'Overdue Hearings', icon: '⚠' },
  { key: 'upcoming', label: 'Upcoming (7 days)', icon: '◴' },
  { key: 'replies', label: 'Overdue Replies', icon: '✎' },
];

export default function AnalyticsTab({ refreshKey }) {
  const { isDark } = useTheme();
  const statusColors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const colorForStatus = (status, idx) => statusColors[status] || fallback[idx % fallback.length];
  const axisColor = isDark ? '#94A3B8' : '#4b5563';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const cursorFill = isDark ? '#273449' : '#f9fafb';
  const secondaryBar = isDark ? '#60A5FA' : '#1e40af';
  const orangeBar = isDark ? '#FBBF24' : '#ff9933';
  const greenStroke = isDark ? '#34D399' : '#10b981';
  const areaGradient = isDark ? '#34D399' : '#059669';

  const [charts, setCharts] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [insights, setInsights] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRange] = useState(30);
  const [attnTab, setAttnTab] = useState('overdue');
  const [breakdown, setBreakdown] = useState('forum');

  const fetchAll = async (active) => {
    setLoading(true);
    setError(null);
    try {
      const [c, d, i, allCases] = await Promise.all([
        api.getAnalyticsCharts(range),
        api.getAnalyticsDashboard(),
        api.getAnalyticsInsights(),
        api.getCases().catch(() => []),
      ]);
      if (!active) return;
      setCharts(c);
      setDashboard(d);
      setInsights(i);
      setCases(allCases || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load analytics:', err);
      if (active) setError('Failed to load analytics data. Please try refreshing.');
    } finally {
      if (active) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchAll(active);
    return () => { active = false; };
  }, [refreshKey, range]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const overdueCases = useMemo(() => {
    return cases
      .filter(c => c.next_hearing_date && c.present_status !== 'Disposed')
      .map(c => {
        const d = new Date(c.next_hearing_date);
        const days = differenceInDays(today, d);
        return days > 0 ? { ...c, days_overdue: days } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 8);
  }, [cases, today]);

  const upcomingSoon = useMemo(() => {
    return cases
      .filter(c => c.next_hearing_date && c.present_status !== 'Disposed')
      .map(c => {
        const d = new Date(c.next_hearing_date);
        const days = differenceInDays(d, today);
        return days >= 0 && days <= 7 ? { ...c, days_until: days, date: c.next_hearing_date } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.days_until - b.days_until)
      .slice(0, 8);
  }, [cases, today]);

  const overdueReplies = useMemo(() => {
    return (insights?.agingReplies || []).slice(0, 8);
  }, [insights]);

  const ageData = useMemo(() => {
    if (!dashboard?.ageDistribution) return [];
    const order = ['30d', '90d', '180d', '1yr', '1yr+'];
    const labels = { '30d': '< 30d', '90d': '30-90d', '180d': '90-180d', '1yr': '180-365d', '1yr+': '> 1 year' };
    return order
      .map(k => ({
        bucket: labels[k],
        count: dashboard.ageDistribution.find(a => a.age_bucket === k)?.count || 0,
      }))
      .filter(b => b.count > 0);
  }, [dashboard]);

  const disposalRate = useMemo(() => {
    if (!dashboard) return 0;
    const t = dashboard.total || 0;
    return t > 0 ? Math.round((dashboard.disposed / t) * 100) : 0;
  }, [dashboard]);

  const disposalTrendDir = useMemo(() => {
    const arr = charts?.disposalsTrend || [];
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1].count;
    const prev = arr[arr.length - 2].count;
    if (prev === 0 && last === 0) return null;
    if (prev === 0) return 'up';
    const pct = ((last - prev) / prev) * 100;
    if (pct > 5) return 'up';
    if (pct < -5) return 'down';
    return 'flat';
  }, [charts]);

  const breakdownData = useMemo(() => {
    const opts = {
      forum: { data: (dashboard?.byForum || []).slice(0, 8), key: 'forum', label: 'Forum' },
      type: { data: (dashboard?.byType || []).slice(0, 8), key: 'case_type', label: 'Case Type' },
      railway: { data: (charts?.casesByRailway || []).slice(0, 8), key: 'railway', label: 'Railway' },
    };
    return opts[breakdown];
  }, [breakdown, dashboard, charts]);

  const summary = useMemo(() => {
    if (!dashboard) return null;
    const total = dashboard.total || 0;
    const active = dashboard.active || 0;
    const disposed = dashboard.disposed || 0;
    const overdue = overdueCases.length;
    const replies = insights?.agingRepliesCount || 0;
    const upcoming = dashboard.upcomingHearings || 0;
    const topForum = insights?.forumPending?.[0];
    const avgDays = insights?.avgDisposalDays;

    const parts = [];
    parts.push(
      <span key="s1">
        You have <b>{total}</b> cases — <b>{active}</b> active and <b>{disposed}</b> disposed
        {disposalRate > 0 ? <> ({disposalRate}% disposal rate)</> : null}.
      </span>
    );

    const urgent = [];
    if (overdue > 0) urgent.push(<b key="o">{overdue} hearings are overdue</b>);
    if (replies > 0) urgent.push(<b key="r">{replies} {replies === 1 ? 'reply needs filing' : 'replies need filing'}</b>);
    if (urgent.length > 0) {
      parts.push(<span key="s2"> {urgent.reduce((acc, el, i) => i === 0 ? [el] : [...acc, ' and ', el], [])}. These need immediate attention.</span>);
    } else if (upcoming > 0) {
      parts.push(<span key="s2"> No overdue items — <b>{upcoming}</b> {upcoming === 1 ? 'hearing is' : 'hearings are'} coming up this week.</span>);
    } else {
      parts.push(<span key="s2"> No overdue or upcoming hearings — everything is on track.</span>);
    }

    if (topForum && topForum.pending > 0) {
      parts.push(
        <span key="s3"> Heaviest pending workload is at <b>{topForum.forum}</b> ({topForum.pending} pending).</span>
      );
    }
    if (avgDays != null && avgDays > 0) {
      parts.push(
        <span key="s4"> On average, disposed cases took <b>{avgDays} days</b> to resolve.</span>
      );
    }
    if (disposalTrendDir === 'up') {
      parts.push(<span key="s5"> Disposals are trending <b style={{ color: 'var(--status-disposed)' }}>up</b> over the last year.</span>);
    } else if (disposalTrendDir === 'down') {
      parts.push(<span key="s5"> Disposals are trending <b style={{ color: 'var(--red)' }}>down</b> over the last year.</span>);
    }

    return parts;
  }, [dashboard, insights, overdueCases.length, disposalRate, disposalTrendDir]);

  const attnCounts = useMemo(() => ({
    overdue: overdueCases.length,
    upcoming: upcomingSoon.length,
    replies: overdueReplies.length,
  }), [overdueCases.length, upcomingSoon.length, overdueReplies.length]);

  const activeAttnItems = useMemo(() => {
    if (attnTab === 'overdue') return { items: overdueCases, kind: 'overdue', empty: 'No overdue hearings 🎉' };
    if (attnTab === 'upcoming') return { items: upcomingSoon, kind: 'upcoming', empty: 'Nothing in the next 7 days' };
    return { items: overdueReplies, kind: 'replies', empty: 'No overdue replies 🎉' };
  }, [attnTab, overdueCases, upcomingSoon, overdueReplies]);

  if (loading && !charts) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  if (error && !charts) {
    return (
      <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--red)', textAlign: 'center', padding: '3rem', color: 'var(--red)' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => fetchAll(true)}>Retry</button>
      </div>
    );
  }

  const statusData = charts?.statusDistribution || [];
  const disposalData = charts?.disposalsTrend || [];
  const totalCases = dashboard?.total || 0;
  const urgentTotal = attnCounts.overdue + attnCounts.replies;

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Analytics & Insights</h2>
          {lastUpdated && (
            <span className="analytics-updated">
              Last updated · {format(lastUpdated, 'dd MMM, HH:mm')}
            </span>
          )}
        </div>
        <div className="analytics-controls">
          <label className="analytics-label">Date Range</label>
          <select value={range} onChange={e => setRange(parseInt(e.target.value))} className="analytics-select">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
          <button type="button" className="analytics-refresh" onClick={fetchAll}>
            ⟳ Refresh
          </button>
        </div>
      </div>

      {summary && (
        <div className="analytics-summary">
          <span className="analytics-summary-icon">💡</span>
          <p className="analytics-summary-text">{summary}</p>
        </div>
      )}

      <div className="kpi-row kpi-row-4">
        <KpiCard
          label="Total Cases"
          value={totalCases}
          sub={dashboard ? `${dashboard.active || 0} active · ${dashboard.disposed || 0} disposed` : ''}
          tone="navy"
          icon="⚖"
          loading={loading}
        />
        <KpiCard
          label="Active (Pending)"
          value={dashboard?.active ?? '—'}
          sub={`${attnCounts.overdue} overdue hearings`}
          tone={attnCounts.overdue > 0 ? 'warning' : 'navy'}
          icon="◷"
          loading={loading}
        />
        <KpiCard
          label="Disposed"
          value={dashboard?.disposed ?? '—'}
          sub={`${disposalRate}% disposal rate`}
          tone="success"
          icon="✓"
          loading={loading}
        />
        <KpiCard
          label="Upcoming Hearings"
          value={dashboard?.upcomingHearings ?? '—'}
          sub="Next 7 days"
          tone="info"
          icon="▦"
          loading={loading}
        />
      </div>

      <div className="attention-tabbed">
        <div className="attention-tabs">
          {ATTENTION_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`attention-tab ${attnTab === t.key ? 'active' : ''}`}
              onClick={() => setAttnTab(t.key)}
            >
              <span className="attention-tab-icon">{t.icon}</span>
              <span className="attention-tab-label">{t.label}</span>
              {attnCounts[t.key] > 0 && (
                <span className={`attention-tab-badge ${t.key === 'overdue' || t.key === 'replies' ? 'urgent' : ''}`}>
                  {attnCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <AttentionList
          title=""
          items={activeAttnItems.items}
          emptyText={activeAttnItems.empty}
          kind={activeAttnItems.kind}
        />
      </div>

      <div className="analytics-row two-col">
        <ChartPanel title="Case Status" subtitle={`${totalCases} total cases`}>
          {statusData.length === 0 ? (
            <EmptyChart text="No status data" />
          ) : (
            <div className="status-donut-wrap">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`s-${index}`} fill={colorForStatus(entry.status, index)} />
                    ))}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="status-donut-center">
                <div className="status-donut-total">{totalCases}</div>
                <div className="status-donut-label">Total</div>
              </div>
              <ul className="status-legend">
                {statusData.map((entry, idx) => (
                  <li key={`l-${idx}`}>
                    <span className="legend-dot" style={{ background: colorForStatus(entry.status, idx) }} />
                    <span className="legend-name">{entry.status}</span>
                    <span className="legend-count">{entry.count}</span>
                    <span className="legend-pct">{totalCases ? Math.round((entry.count / totalCases) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Case Age" subtitle="How old are your cases?">
          {ageData.length === 0 ? (
            <EmptyChart text="No age data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={orangeBar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>

      <div className="analytics-row two-col">
        <ChartPanel title="Disposals Trend" subtitle="Resolved cases · last 12 months">
          {disposalData.length === 0 ? (
            <EmptyChart text="No disposals recorded in the last 12 months" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={disposalData}>
                <defs>
                  <linearGradient id="disposalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={areaGradient} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={areaGradient} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke={greenStroke} strokeWidth={2} fill="url(#disposalFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel
          title={`Cases by ${breakdownData.label}`}
          subtitle="Top 8 categories"
          action={
            <div className="breakdown-toggle">
              {['forum', 'type', 'railway'].map(b => (
                <button
                  key={b}
                  type="button"
                  className={`breakdown-toggle-btn ${breakdown === b ? 'active' : ''}`}
                  onClick={() => setBreakdown(b)}
                >
                  {b === 'forum' ? 'Forum' : b === 'type' ? 'Type' : 'Railway'}
                </button>
              ))}
            </div>
          }
        >
          {breakdownData.data.length === 0 ? (
            <EmptyChart text={`No ${breakdownData.label.toLowerCase()} data`} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdownData.data} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <YAxis dataKey={breakdownData.key} type="category" tick={{ fontSize: 10, fill: axisColor }} width={90} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={secondaryBar} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return <div className="chart-empty">{text}</div>;
}

function StatusTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{p.name}</div>
      <div className="chart-tooltip-value">{p.value} cases</div>
    </div>
  );
}
