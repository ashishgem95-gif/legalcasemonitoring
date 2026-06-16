import React, { useState, useEffect } from 'react';
import ChartPanel from './ChartPanel';
import api from '../utils/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts';

const COLORS = ['#0f2c59', '#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'];

export default function AnalyticsTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [refreshKey, range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const result = await api.getAnalyticsCharts(range);
      setData(result);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No analytics data available</div>;
  }

  const renderCustomPieLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

  return (
    <div>
      <div className="filters-bar">
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Date Range:</label>
        <select value={range} onChange={e => setRange(parseInt(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      <div className="analytics-grid">
        <ChartPanel title="Case Status Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.statusDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                nameKey="status"
                label={renderCustomPieLabel}
              >
                {data.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Hearings by Week">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.hearingsPerWeek.slice(-8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Disposals Trend (12 months)" fullWidth>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.disposalsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Cases by Railway" fullWidth>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.casesByRailway} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="railway" type="category" tick={{ fontSize: 10 }} width={60} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f2c59" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}
