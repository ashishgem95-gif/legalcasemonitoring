import React from 'react';

function Stat({ label, value, sub }) {
  return (
    <div className="insight-stat">
      <div className="insight-stat-value">{value}</div>
      <div className="insight-stat-label">{label}</div>
      {sub && <div className="insight-stat-sub">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, total, color = 'var(--accent-color)' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="insight-bar-row">
      <div className="insight-bar-label" title={label}>{label}</div>
      <div className="insight-bar-track">
        <div className="insight-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="insight-bar-value">{value}</div>
    </div>
  );
}

export default function InsightsStrip({ insights }) {
  if (!insights) return null;

  const {
    advocateStats = [],
    nodalStats = [],
    forumPending = [],
    agingRepliesCount = 0,
    avgDisposalDays = null,
  } = insights;

  const maxAdvocateTotal = Math.max(1, ...advocateStats.map(a => a.total));
  const maxNodalPending = Math.max(1, ...nodalStats.map(n => n.pending));
  const maxForumPending = Math.max(1, ...forumPending.map(f => f.pending));
  const topAdvocate = advocateStats[0];
  const topForum = forumPending[0];
  const topNodal = nodalStats[0];

  return (
    <div className="insights-strip">
      <h3 className="insights-strip-title">Actionable Insights</h3>

      <div className="insights-top-stats">
        <Stat
          label="Avg. Disposal Time"
          value={avgDisposalDays != null ? `${avgDisposalDays} days` : '—'}
          sub="Across disposed cases"
        />
        <Stat
          label="Replies Overdue"
          value={agingRepliesCount}
          sub="Awaiting reply filing"
        />
        <Stat
          label="Top Forum (Pending)"
          value={topForum ? topForum.forum : '—'}
          sub={topForum ? `${topForum.pending} pending cases` : ''}
        />
        <Stat
          label="Top Advocate"
          value={topAdvocate ? topAdvocate.name : '—'}
          sub={topAdvocate ? `${topAdvocate.total} cases · ${topAdvocate.disposed} disposed` : ''}
        />
      </div>

      <div className="insights-grid">
        <div className="insight-block">
          <h4>Forum Workload <span className="insight-block-meta">pending cases</span></h4>
          {forumPending.length === 0 ? (
            <div className="insight-empty">No pending cases</div>
          ) : (
            forumPending.slice(0, 6).map(f => (
              <BarRow
                key={f.forum}
                label={f.forum}
                value={f.pending}
                total={maxForumPending}
                color="var(--accent-color)"
              />
            ))
          )}
        </div>

        <div className="insight-block">
          <h4>Advocate Caseload <span className="insight-block-meta">total / disposed</span></h4>
          {advocateStats.length === 0 ? (
            <div className="insight-empty">No advocates assigned</div>
          ) : (
            advocateStats.slice(0, 6).map(a => (
              <BarRow
                key={a.name}
                label={a.name}
                value={a.total}
                total={maxAdvocateTotal}
                color="var(--accent-hover)"
              />
            ))
          )}
        </div>

        <div className="insight-block">
          <h4>Nodal Officers <span className="insight-block-meta">pending</span></h4>
          {nodalStats.length === 0 ? (
            <div className="insight-empty">No nodal officers</div>
          ) : (
            nodalStats.slice(0, 6).map(n => (
              <BarRow
                key={n.name}
                label={n.name}
                value={n.pending}
                total={maxNodalPending}
                color="var(--saffron)"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}