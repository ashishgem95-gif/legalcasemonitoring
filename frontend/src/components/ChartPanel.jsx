import React from 'react';

export default function ChartPanel({ title, subtitle, children, fullWidth, action }) {
  return (
    <div className={`chart-panel ${fullWidth ? 'chart-full' : ''}`}>
      <div className="chart-panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="chart-panel-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="chart-panel-body">{children}</div>
    </div>
  );
}