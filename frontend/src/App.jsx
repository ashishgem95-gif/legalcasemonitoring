import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Home from './components/Home';
import CaseList from './components/CaseList';
import CaseDetail from './components/CaseDetail';
import CaseForm from './components/CaseForm';
import Reminders from './components/Reminders';
import Citations from './components/Citations';
import FileRegistryApp from './components/FileRegistryApp';
import Login from './components/Login';
import AiDraftReply from './components/AiDraftReply';
import FileActivityAlerts from './components/FileActivityAlerts';
import api from './utils/api';


function GearSettings() {
  const [open, setOpen] = React.useState(false);
  const [provider, setProvider] = React.useState(() => localStorage.getItem('ccms_provider') || 'gemini');
  const [model, setModel] = React.useState(() => localStorage.getItem('ccms_model') || '');
  const [apiKey, setApiKey] = React.useState(() => localStorage.getItem('ccms_apikey') || '');

  const save = (p, m, k) => {
    localStorage.setItem('ccms_provider', p);
    localStorage.setItem('ccms_model', m);
    localStorage.setItem('ccms_apikey', k);
    setProvider(p); setModel(m); setApiKey(k);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        title="AI Model Settings">
        <svg width="18" height="18" fill="none" stroke="#4b5563" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '300px', zIndex: 500, background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', padding: '1rem' }}>
          <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
            <strong style={{ fontSize: '0.82rem' }}>AI Model Settings</strong>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>&times;</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="form-group">
              <label className="form-label">Provider</label>
              <select className="select-input" value={provider} onChange={e => save(e.target.value, model, apiKey)}>
                <option value="gemini">Gemini (Google)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input className="form-control" placeholder="e.g. gemini-1.5-flash, gpt-4o, deepseek-chat" value={model} onChange={e => save(provider, e.target.value, apiKey)} />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input className="form-control" type="password" placeholder="sk-..." value={apiKey} onChange={e => save(provider, model, e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DarkToggle() {
  const [dark, setDark] = React.useState(() => localStorage.getItem('theme') === 'dark');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <button onClick={() => setDark(!dark)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '5px', padding: '0.2rem 0.35rem', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, marginRight: '0.5rem' }} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

function Header({ user, onLogout }) {
  const location = useLocation();
  const isAdmin = user && (user.id === 'admin' || (user.role && user.role.includes('Super Admin')));

  return (
    <header className="app-header">
      {/* Saffron, White, Green Tri-color Stripe */}
      <div className="national-tricolor-stripe"></div>
      
      <div className="header-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="header-logo-section">
          {/* Ashoka Emblem Placeholder Box */}
          <div className="national-emblem-box">
            <svg width="28" height="42" viewBox="0 0 24 36" fill="currentColor">
              <path d="M12 2a4 4 0 00-4 4c0 3.3 2.7 4 4 6 1.3-2 4-2.7 4-6a4 4 0 00-4-4zm0 13c-2.2 0-4 1.8-4 4v7c0 .5.5 1 1 1h6c.5 0 1-.5 1-1v-7c0-2.2-1.8-4-4-4z" />
            </svg>
          </div>
          <div className="header-titles">
            <span className="gov-title">भारत सरकार | रेल मंत्रालय</span>
            <span className="gov-title-en">GOVERNMENT OF INDIA | MINISTRY OF RAILWAYS</span>
            <span className="portal-title">न्यायालयीन मामला निगरानी प्रणाली</span>
            <span className="portal-title-en">Court Case Monitoring System</span>
          </div>
        </div>

        {/* Right side: Settings + User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <GearSettings />
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
              <span style={{ fontWeight: 800, color: '#0f2c59', fontSize: '0.825rem' }}>{user.name}</span>
              <span style={{ fontSize: '0.7rem', color: user.railwayScope === 'All' ? '#1e3a8a' : '#b45309', fontWeight: 700 }}>
                {user.role} ({user.railwayScope === 'All' ? 'Global Access' : `${user.railwayScope} Zone Only`})
              </span>
            </div>
            <button 
              onClick={onLogout} 
              style={{
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                color: '#ef4444',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className="logout-btn"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
              title="Sign out of portal"
            >
              Logout
            </button>
          </div>
        )}
        </div>
      </div>

      <div className="header-nav-bar">
        <div className="header-nav-content">
          <nav className="app-nav">
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              मुख्य पृष्ठ / Home
            </Link>
            <Link 
              to="/cases" 
              className={`nav-link ${location.pathname.startsWith('/cases') && location.pathname !== '/cases/new' ? 'active' : ''}`}
            >
              मामला विवरण / Case Details Grid
            </Link>
            <Link 
              to="/reminders" 
              className={`nav-link ${location.pathname === '/reminders' ? 'active' : ''}`}
            >
              अनुस्मारक / Deadlines & Reminders
            </Link>
            {isAdmin && (
              <Link
                to="/citations"
                className={`nav-link ${location.pathname === '/citations' ? 'active' : ''}`}
              >
                कानूनी उद्धरण / Legal Citations
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/ai-draft"
                className={`nav-link ${location.pathname === '/ai-draft' ? 'active' : ''}`}
              >
                ✨ AI Draft
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/file-registry"
                className={`nav-link ${location.pathname.startsWith('/file-registry') ? 'active' : ''}`}
              >
                फाइल संचलन पंजी / File Registry
              </Link>
            )}
          </nav>
          
          <div className="nav-actions">
            <DarkToggle />
            <Link to="/cases/new" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '0.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              नया मामला जोड़ें / Add Case
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = React.useState(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });

  const isAdmin = user && (user.id === 'admin' || (user.role && user.role.includes('Super Admin')));

  const handleLogout = () => {
    api.logout();
  };

  if (!user) {
    return (
      <div className="app-container" style={{ background: '#f1f5f9' }}>
        {/* Saffron, White, Green Tri-color Stripe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '6px', width: '100%', position: 'fixed', top: 0, left: 0, zIndex: 1000 }}>
          <div style={{ background: '#ff9933' }}></div>
          <div style={{ background: '#ffffff' }}></div>
          <div style={{ background: '#128807' }}></div>
        </div>
        <main className="main-content" style={{ marginTop: '6px' }}>
          <Login onLogin={(u) => setUser(u)} />
        </main>
        <footer className="goi-footer">
          <div className="footer-content">
            <p>© 2026 Ministry of Railways (Railway Board), Government of India. All Rights Reserved.</p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Designed for legal monitoring & automated case order auditing in compliance with Rule 56(j) and UPSC Advice.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container">
        <FileActivityAlerts user={user} />
        <Header user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/new" element={<CaseForm />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/cases/:id/edit" element={<CaseForm />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/citations" element={isAdmin ? <Citations /> : <Navigate to="/" replace />} />
            <Route path="/ai-draft" element={isAdmin ? <AiDraftReply /> : <Navigate to="/" replace />} />
            <Route path="/file-registry/*" element={isAdmin ? <FileRegistryApp /> : <Navigate to="/" replace />} />
            <Route path="*" element={<div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <h2 style={{ color: '#0f2c59', fontFamily: 'Outfit' }}>404 - Page Not Found</h2>
              <p style={{ color: '#6b7280' }}>The page you are looking for does not exist.</p>
              <button onClick={() => window.history.back()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#0f2c59', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Go Back</button>
            </div>} />
          </Routes>
        </main>
        
        <footer className="goi-footer">
          <div className="footer-content">
            <p>© 2026 Ministry of Railways (Railway Board), Government of India. All Rights Reserved.</p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Designed for legal monitoring & automated case order auditing in compliance with Rule 56(j) and UPSC Advice.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
