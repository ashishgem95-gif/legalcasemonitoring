import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export default function HomeExcelWidget() {
  const [fileInfo, setFileInfo] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [fileName, setFileName] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const info = await api.getHcExcelFileInfo();
      setFileInfo(info);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheck = useCallback(async () => {
    setImporting(true);
    setError(null);
    setFresh(false);
    try {
      const result = await api.checkHcExcelImport();
      setImportResult(result);
      setFresh(true);
      if (!result.error) load();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [load]);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImporting(true);
    setError(null);
    setFresh(false);
    try {
      const result = await api.uploadHcExcelAndImport(file);
      setImportResult(result);
      setFresh(true);
      if (!result.error) load();
    } catch (err) {
      setError(err.message || 'Upload+import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [load]);

  return (
    <div className="home-excel-widget">
      <div className="home-excel-head">
        <div>
          <h3 className="home-excel-title">⚖️ HC/SC Excel Update</h3>
          <span className="home-excel-sub">
            Only High Court and Supreme Court cases · hearing date &amp; status
          </span>
        </div>
        <span className="home-excel-badge">HC/SC</span>
      </div>

      <div className="home-excel-file">
        <span className="home-excel-file-icon">{fileName ? '📄' : fileInfo?.found ? '📄' : '❌'}</span>
        <div className="home-excel-file-text">
          <span className={`home-excel-file-name ${!fileInfo?.found && !fileName ? 'not-found' : ''}`}>
            {fileName || fileInfo?.fileName || 'No file selected'}
          </span>
          <span className="home-excel-file-meta">
            {fileName
              ? 'Uploaded in current session'
              : fileInfo?.found
                ? `${(fileInfo.size / 1024).toFixed(0)} KB · last modified ${fileInfo.modifiedAt ? new Date(fileInfo.modifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}`
                : `root/hc_legal_cases.xlsx`}
          </span>
        </div>
      </div>

      <div className="home-excel-desc">
        <strong>Expected columns:</strong> case_ref_no | hearing_date | status | notes
      </div>

      <div className="home-excel-actions">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <button
          type="button"
          className="home-excel-btn upload-btn"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? <>⏳ Uploading &amp; importing…</> : '📤 Upload &amp; Import Now'}
        </button>
        <button
          type="button"
          className="home-excel-btn check-btn"
          disabled={importing || !fileInfo?.found}
          onClick={handleCheck}
        >
          {importing ? <>⏳ Importing HC/SC updates…</> : '📥 Re-check Saved File'}
        </button>
      </div>

      {error && <div className="home-excel-error">{error}</div>}

      {importResult && !importResult.error && (
        <div className="home-excel-result">
          <div className="home-excel-result-stats">
            <span className="home-excel-stat updated">{importResult.updatedCases} updated</span>
            <span className="home-excel-stat skipped">{importResult.skippedCases} skipped</span>
            <span className={`home-excel-stat ${importResult.errors > 0 ? 'errors' : 'errors-zero'}`}>
              {importResult.errors} {importResult.errors === 1 ? 'error' : 'errors'}
            </span>
          </div>
          {fresh && (importResult.updatedCases > 0 || importResult.errors > 0) && (
            <button
              type="button"
              className="home-excel-history-link"
              onClick={() => setFresh(false)}
            >
              ← Dismiss
            </button>
          )}
          {fresh && importResult.updatedCases === 0 && importResult.errors === 0 && (
            <div className="home-excel-ok">✓ All HC/SC cases are up to date</div>
          )}
        </div>
      )}
    </div>
  );
}
