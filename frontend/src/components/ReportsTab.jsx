import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';

const PRESET_LABELS = {
  summary: 'Summary',
  fullDetail: 'Full detail',
  disciplinary: 'Disciplinary track',
};

export default function ReportsTab() {
  const [catalog, setCatalog] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState(null);

  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    case_type: 'all',
    forum: 'all',
    dateField: '',
    fromDate: '',
    toDate: '',
  });
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cat, opt] = await Promise.all([
          api.getReportColumnCatalog(),
          api.getReportFilterOptions(),
        ]);
        if (!active) return;
        setCatalog(cat);
        setOptions(opt);
        if (cat?.presets?.summary) setSelectedCols(cat.presets.summary);
        const groups = [...new Set((cat?.columns || []).map(c => c.group))];
        setExpandedGroups(Object.fromEntries(groups.map(g => [g, g === 'Core Case Info'])));
        if (opt?.scope) {
          setSelectedZones([opt.scope]);
        }
      } catch (err) {
        console.error('Report setup failed:', err);
        if (active) setError('Failed to load report configuration. Please refresh.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const groupedColumns = useMemo(() => {
    if (!catalog) return [];
    const groups = {};
    catalog.columns.forEach(c => {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c);
    });
    return Object.entries(groups).map(([group, cols]) => ({ group, cols }));
  }, [catalog]);

  const allZonesSelected = useMemo(() => {
    if (!options?.zones?.length) return false;
    return selectedZones.length === options.zones.length;
  }, [options, selectedZones]);

  const toggleZone = useCallback((zone) => {
    setSelectedZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );
  }, []);

  const selectAllZones = useCallback(() => {
    if (!options?.zones) return;
    setSelectedZones(options.zones.map(z => z.zone));
  }, [options]);

  const clearZones = useCallback(() => setSelectedZones([]), []);

  const toggleCol = useCallback((col) => {
    setSelectedCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }, []);

  const toggleGroup = useCallback((group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const setGroupAll = useCallback((group, cols, checked) => {
    const keys = cols.map(c => c.col);
    setSelectedCols(prev => {
      const without = prev.filter(c => !keys.includes(c));
      return checked ? [...without, ...keys] : without;
    });
  }, []);

  const applyPreset = useCallback((presetKey) => {
    const preset = catalog?.presets?.[presetKey];
    if (preset) setSelectedCols(preset);
  }, [catalog]);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedZones.length && !options?.scope) {
      setGenMsg({ type: 'error', text: 'Select at least one zone.' });
      return;
    }
    if (!selectedCols.length) {
      setGenMsg({ type: 'error', text: 'Select at least one column.' });
      return;
    }
    setGenerating(true);
    setGenMsg(null);
    try {
      const result = await api.generateZoneReport({
        zones: options?.scope ? [] : selectedZones,
        columns: selectedCols,
        filters,
      });
      setGenMsg({ type: 'success', text: `Downloaded ${result.filename}` });
    } catch (err) {
      console.error('Report generation failed:', err);
      setGenMsg({ type: 'error', text: err.message || 'Failed to generate report.' });
    } finally {
      setGenerating(false);
    }
  }, [selectedZones, selectedCols, filters, options]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  if (error && !catalog) {
    return (
      <div className="glass-panel" style={{ background: 'var(--card-bg)', border: '1px solid var(--red)', textAlign: 'center', padding: '3rem', color: 'var(--red)' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h2 className="reports-title">Generate Zone Report</h2>
          <p className="reports-subtitle">
            Pick zones, choose columns, apply filters, then download as Excel (.xlsx).
          </p>
        </div>
      </div>

      <section className="report-section">
        <div className="report-section-head">
          <h3>1. Select Zones</h3>
          {options?.scope ? (
            <span className="report-scope-badge">Scoped to {options.scope}</span>
          ) : (
            <div className="report-bulk-actions">
              <button type="button" className="report-link-btn" onClick={selectAllZones} disabled={allZonesSelected}>
                Select all
              </button>
              <button type="button" className="report-link-btn" onClick={clearZones} disabled={!selectedZones.length}>
                Clear
              </button>
              <span className="report-count-pill">{selectedZones.length} selected</span>
            </div>
          )}
        </div>
        <div className="zone-chips">
          {options?.zones?.map(z => {
            const checked = selectedZones.includes(z.zone);
            const disabled = !!options?.scope;
            return (
              <label key={z.zone} className={`zone-chip ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => !disabled && toggleZone(z.zone)}
                />
                <span className="zone-chip-name">{z.zone}</span>
                <span className="zone-chip-count">{z.count}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <h3>2. Filters <span className="report-optional">(optional)</span></h3>
        </div>
        <div className="report-filters-grid">
          <div className="filter-field">
            <label>Status</label>
            <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending only</option>
              <option value="disposed">Disposed only</option>
              {options?.statuses?.filter(s => !['Pending', 'Disposed'].includes(s.value)).map(s => (
                <option key={s.value} value={s.value}>{s.value} ({s.count})</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Case Type</label>
            <select value={filters.case_type} onChange={e => updateFilter('case_type', e.target.value)}>
              <option value="all">All types</option>
              {options?.caseTypes?.map(t => (
                <option key={t.value} value={t.value}>{t.value} ({t.count})</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Forum</label>
            <select value={filters.forum} onChange={e => updateFilter('forum', e.target.value)}>
              <option value="all">All forums</option>
              {options?.forums?.map(f => (
                <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Date field</label>
            <select value={filters.dateField} onChange={e => updateFilter('dateField', e.target.value)}>
              <option value="">No date filter</option>
              <option value="created_at">Created at</option>
              <option value="disposal_date">Disposal date</option>
              <option value="next_hearing">Next hearing</option>
            </select>
          </div>
          <div className="filter-field">
            <label>From date</label>
            <input type="date" value={filters.fromDate} disabled={!filters.dateField}
              onChange={e => updateFilter('fromDate', e.target.value)} />
          </div>
          <div className="filter-field">
            <label>To date</label>
            <input type="date" value={filters.toDate} disabled={!filters.dateField}
              onChange={e => updateFilter('toDate', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <h3>3. Choose Columns</h3>
          <div className="report-bulk-actions">
            <span className="report-preset-label">Preset:</span>
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="report-preset-btn"
                onClick={() => applyPreset(key)}
              >
                {label}
              </button>
            ))}
            <span className="report-count-pill">{selectedCols.length} columns</span>
          </div>
        </div>

        <div className="column-groups">
          {groupedColumns.map(({ group, cols }) => {
            const checkedInGroup = cols.filter(c => selectedCols.includes(c.col)).length;
            const allChecked = checkedInGroup === cols.length;
            const expanded = expandedGroups[group];
            return (
              <div key={group} className="column-group">
                <div className="column-group-head" onClick={() => toggleGroup(group)}>
                  <span className="column-group-toggle">{expanded ? '▾' : '▸'}</span>
                  <label className="column-group-label" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = checkedInGroup > 0 && !allChecked; }}
                      onChange={e => setGroupAll(group, cols, e.target.checked)}
                    />
                    <span className="column-group-name">{group}</span>
                    <span className="column-group-count">{checkedInGroup}/{cols.length}</span>
                  </label>
                </div>
                {expanded && (
                  <div className="column-group-body">
                    {cols.map(c => (
                      <label key={c.col} className={`column-chip ${selectedCols.includes(c.col) ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedCols.includes(c.col)}
                          onChange={() => toggleCol(c.col)}
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="report-actions">
        <button
          type="button"
          className="btn btn-primary report-generate-btn"
          disabled={generating || (!selectedZones.length && !options?.scope) || !selectedCols.length}
          onClick={handleGenerate}
        >
          {generating ? 'Generating…' : '⬇ Generate Excel'}
        </button>
        {genMsg && (
          <span className={`report-gen-msg ${genMsg.type}`}>{genMsg.text}</span>
        )}
      </div>
    </div>
  );
}
