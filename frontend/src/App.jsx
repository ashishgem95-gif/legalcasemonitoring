import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './components/Home';
import CaseList from './components/CaseList';
import CaseDetail from './components/CaseDetail';
import CaseForm from './components/CaseForm';
import Reminders from './components/Reminders';
import Citations from './components/Citations';
import FileRegistryApp from './components/FileRegistryApp';
import Login from './components/Login';

function Header({ user, onLogout }) {
  const location = useLocation();
  
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

        {/* Display Active User Badge on top-right of top bar */}
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
            <Link 
              to="/citations" 
              className={`nav-link ${location.pathname === '/citations' ? 'active' : ''}`}
            >
              कानूनी उद्धरण / Legal Citations
            </Link>
            <Link 
              to="/file-registry" 
              className={`nav-link ${location.pathname.startsWith('/file-registry') ? 'active' : ''}`}
            >
              फाइल संचलन पंजी / File Registry
            </Link>
          </nav>
          
          <div className="nav-actions">
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

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
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
        <Header user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/new" element={<CaseForm />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/cases/:id/edit" element={<CaseForm />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/citations" element={<Citations />} />
            <Route path="/file-registry/*" element={<FileRegistryApp />} />
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
