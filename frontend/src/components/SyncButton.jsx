import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

const SYNC_LABELS = {
  full: 'Full Sync (CAT + HC)',
  smart: 'CAT Smart Sync',
  hc: 'HC/SC Sync',
};

export default function SyncButton({ onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const pollRef = useRef(null);

  const pollStatus = useCallback(async () => {
    try {
      const status = await api.getSyncStatus();
      if (!status.running && syncing) {
        setSyncing(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (status.summary) {
          if (status.summary.error) {
            setSyncMessage({ type: 'error', text: `Sync failed: ${status.summary.error}` });
          } else if (status.summary.cat || status.summary.hc) {
            const parts = [];
            if (status.summary.cat) {
              const c = status.summary.cat;
              parts.push(`CAT: ${c.updated} updated, ${c.unchanged} unchanged, ${c.errors} errors`);
            }
            if (status.summary.hc) {
              const h = status.summary.hc;
              parts.push(`HC: ${h.updated} updated, ${h.captcha} need manual, ${h.errors} errors`);
            }
            setSyncMessage({ type: 'success', text: parts.join(' · ') });
          }
          if (onSyncComplete) onSyncComplete();
        }
      } else if (status.running) {
        const phase = status.progress?.phase;
        if (phase === 'cat') {
          setSyncMessage({ type: 'info', text: 'Phase 1: Syncing CAT cases...' });
        } else if (phase === 'hc') {
          setSyncMessage({ type: 'info', text: 'Phase 2: Scraping HC/SC cases with Playwright...' });
        }
      }
    } catch (err) {
      console.error('Sync status poll failed:', err);
    }
  }, [syncing, onSyncComplete]);

  const startSync = useCallback(async (type) => {
    setShowDropdown(false);
    if (syncing) return;

    setSyncing(true);
    setSyncMessage({ type: 'info', text: `Starting ${SYNC_LABELS[type]}...` });

    try {
      if (type === 'full') {
        await api.fullSync();
      } else if (type === 'smart') {
        await api.smartSync();
      } else if (type === 'hc') {
        await api.hcSync();
      }

      pollRef.current = setInterval(pollStatus, 3000);
      setTimeout(() => {
        if (pollRef.current) {
          pollStatus();
        }
      }, 2000);
    } catch (err) {
      setSyncing(false);
      setSyncMessage({ type: 'error', text: err.message || 'Failed to start sync.' });
    }
  }, [syncing, pollStatus]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (syncMessage) {
      const t = setTimeout(() => setSyncMessage(null), 15000);
      return () => clearTimeout(t);
    }
  }, [syncMessage]);

  return (
    <div className="sync-button-wrap">
      <div className="sync-dropdown-container">
        <button
          type="button"
          className="dashboard-refresh sync-trigger-btn"
          disabled={syncing}
          onClick={() => setShowDropdown(s => !s)}
        >
          {syncing ? (
            <>
              <span className="sync-spinner" />
              Syncing...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />
              </svg>
              Sync from Courts
            </>
          )}
        </button>
        {showDropdown && !syncing && (
          <div className="sync-dropdown">
            <button type="button" className="sync-option" onClick={() => startSync('full')}>
              <span className="sync-option-icon">🔄</span>
              <div className="sync-option-text">
                <div className="sync-option-label">Full Sync</div>
                <div className="sync-option-desc">CAT + HC/SC — comprehensive</div>
              </div>
            </button>
            <button type="button" className="sync-option" onClick={() => startSync('smart')}>
              <span className="sync-option-icon">📋</span>
              <div className="sync-option-text">
                <div className="sync-option-label">CAT Smart Sync</div>
                <div className="sync-option-desc">Fast — CAT cases only</div>
              </div>
            </button>
            <button type="button" className="sync-option" onClick={() => startSync('hc')}>
              <span className="sync-option-icon">⚖</span>
              <div className="sync-option-text">
                <div className="sync-option-label">HC/SC Sync</div>
                <div className="sync-option-desc">Playwright — High Court + Supreme</div>
              </div>
            </button>
          </div>
        )}
      </div>
      {syncMessage && (
        <div className={`sync-message ${syncMessage.type}`}>
          {syncMessage.text}
        </div>
      )}
    </div>
  );
}
