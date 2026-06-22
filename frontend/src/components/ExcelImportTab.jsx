import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { format } from 'date-fns';

export default function ExcelImportTab() {
  const [fileInfo, setFileInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, hist] = await Promise.all([
        api.getExcelFileInfo(),
        api.getExcelImportHistory(20),
      ]);
      setFileInfo(info);
      setHistory(hist || []);
    } catch (err) {
      console.error('Excel import data load failed:', err);
      setError('Failed to load import data. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await api.checkExcelImport();
      setImportResult(result);
      if (!result.error) {
        await loadData();
      }
    } catch (err) {
      setError(err.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }, [loadData]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  return (
    <div className="excel-import-page">
      <div className="excel-import-header">
        <div>
          <h2 className="excel-import-title">Excel Import</h2>
          <p className="excel-import-subtitle">
            The intern fills the Excel, you save it to the designated folder. The system reads it on startup and when you click below.
          </p>
        </div>
      </div>

      <section className="excel-file-info">
        <div className="excel-file-info-left">
          <span className="excel-file-icon">📊</span>
          <div>
            {fileInfo?.found ? (
              <>
                <div className="excel-file-name">{fileInfo.fileName}</div>
                <div className="excel-file-meta">
                  {fileInfo.size ? `${(fileInfo.size / 1024).toFixed(0)} KB` : ''} ·{' '}
                  {fileInfo.modifiedAt ? format(new Date(fileInfo.modifiedAt), 'dd MMM yyyy, HH:mm') : ''}
                </div>
              </>
            ) : (
              <>
                <div className="excel-file-name not-found">No Excel file found</div>
                <div className="excel-file-meta">Place the .xlsx file at: {fileInfo?.path || 'root/'}</div>
              </>
            )}
          </div>
        </div>
        <div className="excel-file-info-right">
          <span className="excel-file-path-label">File location:</span>
          <code className="excel-file-path">{fileInfo?.path || '—'}</code>
        </div>
      </section>

      <div className="excel-import-actions">
        <button
          type="button"
          className="btn btn-primary excel-import-btn"
          disabled={importing || !fileInfo?.found}
          onClick={handleImport}
        >
          {importing ? (
            <><span className="sync-spinner" /> Importing from Excel…</>
          ) : (
            '📥 Check Excel Now'
          )}
        </button>
        {error && <span className="excel-import-error">{error}</span>}
      </div>

      {importResult && !importResult.error && (
        <section className="excel-result-panel">
          <h3>Latest Import Result</h3>
          <div className="excel-result-stats">
            <div className="excel-result-stat new">
              <div className="excel-result-stat-value">{importResult.newCases}</div>
              <div className="excel-result-stat-label">New cases</div>
            </div>
            <div className="excel-result-stat updated">
              <div className="excel-result-stat-value">{importResult.updatedCases}</div>
              <div className="excel-result-stat-label">Updated</div>
            </div>
            <div className="excel-result-stat skipped">
              <div className="excel-result-stat-value">{importResult.skippedCases}</div>
              <div className="excel-result-stat-label">Skipped</div>
            </div>
            <div className="excel-result-stat errors">
              <div className="excel-result-stat-value">{importResult.errors}</div>
              <div className="excel-result-stat-label">Errors</div>
            </div>
            <div className="excel-result-stat total">
              <div className="excel-result-stat-value">{importResult.totalRows}</div>
              <div className="excel-result-stat-label">Rows read</div>
            </div>
            {importResult.syncQueued > 0 && (
              <div className="excel-result-stat sync">
                <div className="excel-result-stat-value">{importResult.syncQueued}</div>
                <div className="excel-result-stat-label">Court sync queued</div>
              </div>
            )}
          </div>

          {importResult.details && importResult.details.length > 0 && (
            <div className="excel-result-details">
              <h4>Row-by-row breakdown</h4>
              <div className="excel-result-table-wrap">
                <table className="excel-result-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Case Ref No</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.details.slice(0, 50).map((d, i) => (
                      <tr key={i} className={`excel-detail-row ${d.action}`}>
                        <td>{d.row || '—'}</td>
                        <td className="excel-detail-ref">{d.caseRefNo || '—'}</td>
                        <td>
                          <span className={`excel-action-badge ${d.action}`}>{d.action}</span>
                        </td>
                        <td className="excel-detail-msg">{d.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importResult.details.length > 50 && (
                <p className="excel-details-more">Showing first 50 of {importResult.details.length} rows</p>
              )}
            </div>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="excel-history-panel">
          <h3>Import History</h3>
          <div className="excel-history-list">
            {history.map((h) => (
              <div
                key={h.id}
                className={`excel-history-item ${expandedId === h.id ? 'expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
              >
                <div className="excel-history-item-head">
                  <span className="excel-history-date">
                    {format(new Date(h.imported_at), 'dd MMM yyyy, HH:mm')}
                  </span>
                  <span className="excel-history-trigger">{h.triggered_by}</span>
                  <div className="excel-history-badges">
                    {h.new_cases > 0 && <span className="excel-badge new">{h.new_cases} new</span>}
                    {h.updated_cases > 0 && <span className="excel-badge updated">{h.updated_cases} updated</span>}
                    {h.skipped_cases > 0 && <span className="excel-badge skipped">{h.skipped_cases} skipped</span>}
                    {h.errors > 0 && <span className="excel-badge errors">{h.errors} errors</span>}
                    {h.new_cases === 0 && h.updated_cases === 0 && h.errors === 0 && (
                      <span className="excel-badge clean">No changes</span>
                    )}
                  </div>
                  <span className="excel-history-expand">{expandedId === h.id ? '▾' : '▸'}</span>
                </div>
                {expandedId === h.id && h.details && h.details.length > 0 && (
                  <div className="excel-history-details">
                    <table className="excel-result-table">
                      <thead>
                        <tr><th>Row</th><th>Case Ref No</th><th>Action</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {h.details.slice(0, 30).map((d, i) => (
                          <tr key={i} className={`excel-detail-row ${d.action}`}>
                            <td>{d.row || '—'}</td>
                            <td className="excel-detail-ref">{d.caseRefNo || '—'}</td>
                            <td><span className={`excel-action-badge ${d.action}`}>{d.action}</span></td>
                            <td className="excel-detail-msg">{d.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
