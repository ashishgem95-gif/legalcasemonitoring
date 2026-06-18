import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const bg = isDark ? '#0f172a' : '#f8fafc';
      const cardBg = isDark ? '#1e293b' : '#ffffff';
      const text = isDark ? '#e2e8f0' : '#0f172a';
      const muted = isDark ? '#94a3b8' : '#64748b';
      const accent = isDark ? '#60a5fa' : '#0f2c59';

      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: bg,
          color: text,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: cardBg,
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }} aria-hidden>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', color: muted, fontSize: '14px', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering this page. Reloading usually fixes it.
              If the problem persists, contact the administrator.
            </p>
            {this.state.error && this.state.error.message && (
              <pre style={{
                margin: '0 0 20px',
                padding: '12px',
                background: isDark ? '#0f172a' : '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                color: muted,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '120px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: accent,
                color: isDark ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
