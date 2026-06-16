import React from 'react';

export default function ChartPanel({ title, children, fullWidth }) {
  return (
    <div className={`chart-panel ${fullWidth ? 'chart-full' : ''}`}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
