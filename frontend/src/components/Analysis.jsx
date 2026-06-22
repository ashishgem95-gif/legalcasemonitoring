import { useState } from 'react';
import KanbanTab from './KanbanTab';
import CalendarTab from './CalendarTab';
import AnalyticsTab from './AnalyticsTab';
import ReportsTab from './ReportsTab';
import SyncButton from './SyncButton';
import ExcelImportTab from './ExcelImportTab';
import './Dashboard.css';

export default function Analysis() {
  const [activeTab, setActiveTab] = useState('kanban');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const tabs = [
    { id: 'kanban', label: '📋 Kanban' },
    { id: 'calendar', label: '📅 Calendar' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'reports', label: '📄 Reports' },
    { id: 'excel', label: '📥 Excel Import' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`dashboard-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="dashboard-refresh" onClick={handleRefresh}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
          </svg>
          Refresh
        </button>
        <SyncButton onSyncComplete={handleRefresh} />
      </div>

      {activeTab === 'kanban' && <KanbanTab refreshKey={refreshKey} />}
      {activeTab === 'calendar' && <CalendarTab refreshKey={refreshKey} />}
      {activeTab === 'analytics' && <AnalyticsTab refreshKey={refreshKey} />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'excel' && <ExcelImportTab />}
    </div>
  );
}
