import React from 'react';

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'navy',
  trend,
  onClick,
  loading,
}) {
  const toneClass = `kpi-card tone-${tone}`;

  const content = (
    <>
      <div className="kpi-card-head">
        <span className="kpi-card-label">{label}</span>
        {icon && <span className="kpi-card-icon" aria-hidden>{icon}</span>}
      </div>
      {loading ? (
        <div className="kpi-card-skeleton" />
      ) : (
        <div className="kpi-card-value">{value}</div>
      )}
      {(sub || trend) && (
        <div className="kpi-card-foot">
          {trend != null && (
            <span className={`kpi-trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'}`}>
              {trend > 0 ? '▲' : trend < 0 ? '▼' : '■'} {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="kpi-card-sub">{sub}</span>}
        </div>
      )}
    </>
  );

  return onClick ? (
    <button type="button" className={toneClass} onClick={onClick} style={{ textAlign: 'left' }}>
      {content}
    </button>
  ) : (
    <div className={toneClass}>{content}</div>
  );
}