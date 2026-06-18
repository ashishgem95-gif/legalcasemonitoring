import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const SEVERITY_COLORS = {
  urgent: 'var(--red)',
  warning: 'var(--status-pending)',
  info: 'var(--accent-color)',
};

const TYPE_ICONS = {
  court_update: '\u{1F4E8}',
  upcoming_hearing: '\u{1F4C5}',
  overdue_reply: '\u23F0',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleDismiss = async (e, notif) => {
    e.stopPropagation();
    if (!notif.dismissable) return;
    const alertId = notif.id.split(':')[1];
    try {
      await api.dismissNotification(alertId);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const handleDismissAll = async () => {
    try {
      await api.dismissAllNotifications();
      const dismissable = notifications.filter((n) => n.dismissable);
      setNotifications((prev) => prev.filter((n) => !n.dismissable));
      setUnreadCount((prev) => Math.max(0, prev - dismissable.length));
    } catch (err) {
      console.error('Failed to dismiss all:', err);
    }
  };

  const handleNotifClick = (notif) => {
    setOpen(false);
    navigate(`/cases/${notif.case_id}`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff < 0) return `${Math.abs(diff)}d ago`;
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const hasDismissable = notifications.some((n) => n.dismissable);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="header-icon-btn dark-toggle-btn"
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Notifications"
        style={{ position: 'relative' }}
      >
        <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{'\u{1F514}'}</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: 'var(--red)',
              color: '#fff',
              fontSize: '0.6rem',
              fontWeight: 700,
              borderRadius: '10px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxHeight: '500px',
            overflowY: 'auto',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1100,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Notifications
            </span>
            {hasDismissable && (
              <button
                type="button"
                onClick={handleDismissAll}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  color: 'var(--accent-color)',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                Dismiss all
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {'\u2713'} All caught up
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                style={{
                  padding: '0.65rem 1rem',
                  borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-hover-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>
                  {TYPE_ICONS[notif.type] || '\u{1F4E8}'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {notif.case_ref_no}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: SEVERITY_COLORS[notif.severity] || 'var(--text-secondary)',
                    marginTop: '0.15rem',
                  }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {formatDate(notif.date)}
                  </div>
                </div>
                {notif.dismissable && (
                  <button
                    type="button"
                    onClick={(e) => handleDismiss(e, notif)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      padding: '0.1rem',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
