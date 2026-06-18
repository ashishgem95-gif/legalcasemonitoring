import React, { useState, useEffect, useMemo } from 'react';
import ChartPanel from './ChartPanel';
import KpiCard from './KpiCard';
import AttentionList from './AttentionList';
import InsightsStrip from './InsightsStrip';
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

export default function AnalyticsTab({ refreshKey }) {
  const { isDark } = useTheme();
  const statusColors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const colorForStatus = (status, idx) => statusColors[status] || fallback[idx % fallback.length];
  const axisColor = isDark ? '#94A3B8' : '#4b5563';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const cursorFill = isDark ? '#273449' : '#f9fafb';
  const primaryBar = isDark ? '#3B82F6' : '#0f2c59';
  const secondaryBar = isDark ? '#60A5FA' : '#1e40af';
  const orangeBar = isDark ? '#FBBF24' : '#ff9933';
  const blueBar = isDark ? '#60A5FA' : '#0f2c59';
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

  useEffect(() => {
    let active = true;
    fetchAll(active);
    return () => { active = false; };
  }, [refreshKey, range]);

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

  const hearingsByDow = useMemo(() => {
    const buckets = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    cases.forEach(c => {
      if (!c.next_hearing_date) return;
      try {
        const d = new Date(c.next_hearing_date);
        counts[d.getDay()] += 1;
      } catch {}
    });
    return buckets.map((day, i) => ({ day, count: counts[i] }));
  }, [cases]);

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

  const totalTrend = useMemo(() => {
    if (!dashboard?.monthlyTrend) return null;
    const arr = dashboard.monthlyTrend;
    if (arr.length < 2) return null;
    const last = arr[arr.length - 1].count;
    const prev = arr[arr.length - 2].count;
    if (prev === 0) return null;
    return Math.round(((last - prev) / prev) * 100);
  }, [dashboard]);

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
  const hearingsData = (charts?.hearingsPerWeek || []).slice(-8);
  const disposalData = charts?.disposalsTrend || [];
  const railwayData = (charts?.casesByRailway || []).slice(0, 8);
  const forumData = (dashboard?.byForum || []).slice(0, 8);
  const typeData = (dashboard?.byType || []).slice(0, 8);
  const totalCases = dashboard?.total || 0;

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

      <div className="kpi-row">
        <KpiCard
          label="Total Cases"
          value={totalCases}
          sub={dashboard ? `${dashboard.active || 0} active · ${dashboard.disposed || 0} disposed` : ''}
          trend={totalTrend}
          tone="navy"
          icon="⚖"
          loading={loading}
        />
        <KpiCard
          label="Active (Pending)"
          value={dashboard?.active ?? '—'}
          sub={`${overdueCases.length} overdue hearings`}
          tone={overdueCases.length > 0 ? 'warning' : 'navy'}
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
        <KpiCard
          label="Pending Replies"
          value={dashboard?.pendingReplies ?? '—'}
          sub={insights?.agingRepliesCount ? `${insights.agingRepliesCount} overdue filings` : 'On track'}
          tone={insights?.agingRepliesCount > 0 ? 'danger' : 'success'}
          icon="✎"
          loading={loading}
        />
      </div>

      <div className="analytics-row two-col">
        <AttentionList
          title="Overdue Hearings"
          items={overdueCases}
          emptyText="No overdue hearings 🎉"
          kind="overdue"
        />
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
      </div>

      <div className="analytics-row three-col">
        <ChartPanel title="Hearings by Week" subtitle="Last 8 weeks">
          {hearingsData.length === 0 ? (
            <EmptyChart text="No hearings recorded in range" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hearingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={primaryBar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Hearings by Day of Week" subtitle="All upcoming">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hearingsByDow}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
              <Tooltip cursor={{ fill: cursorFill }} />
              <Bar dataKey="count" fill={orangeBar} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <AttentionList
          title="Upcoming This Week"
          items={upcomingSoon}
          emptyText="Nothing in the next 7 days"
          kind="upcoming"
        />
      </div>

      <div className="analytics-row two-col">
        <ChartPanel title="Disposals Trend" subtitle="Last 12 months">
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

        <ChartPanel title="Cases by Case Type" subtitle="Top categories">
          {typeData.length === 0 ? (
            <EmptyChart text="No case type data" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <YAxis dataKey="case_type" type="category" tick={{ fontSize: 11, fill: axisColor }} width={90} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={secondaryBar} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>

      <div className="analytics-row three-col">
        <ChartPanel title="Cases by Forum" subtitle="Top 8">
          {forumData.length === 0 ? (
            <EmptyChart text="No forum data" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={forumData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <YAxis dataKey="forum" type="category" tick={{ fontSize: 10, fill: axisColor }} width={80} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={primaryBar} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Cases by Railway" subtitle="Top 8">
          {railwayData.length === 0 ? (
            <EmptyChart text="No railway data" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={railwayData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} allowDecimals={false} />
                <YAxis dataKey="railway" type="category" tick={{ fontSize: 10, fill: axisColor }} width={80} />
                <Tooltip cursor={{ fill: cursorFill }} />
                <Bar dataKey="count" fill={blueBar} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Case Age Distribution" subtitle="From created_at">
          {ageData.length === 0 ? (
            <EmptyChart text="No age data" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
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

      {overdueReplies.length > 0 && (
        <div className="analytics-row">
          <AttentionList
            title="Replies Awaiting Filing (Overdue)"
            items={overdueReplies}
            emptyText="No overdue replies"
            kind="replies"
          />
        </div>
      )}

      <InsightsStrip insights={insights} />
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