import React, { useState } from 'react';

const MOCK_USERS = [
  {
    id: 'admin',
    name: 'Shri R. K. Singh',
    email: 'admin@railways.gov.in',
    password: 'admin',
    role: 'Super Admin / Central Legal Cell',
    railwayScope: 'All',
    desc: 'Complete global monitoring access to all cases across all 17 Zonal Railways and Divisions.'
  },
  {
    id: 'nr_nodal',
    name: 'Smt. Anjali Sharma',
    email: 'nr_nodal@railways.gov.in',
    password: 'password',
    role: 'Nodal Officer (Northern Railway - NR)',
    railwayScope: 'NR',
    desc: 'Restricted view. Only displays and manages cases originating from the Northern Railway Zone.'
  },
  {
    id: 'er_nodal',
    name: 'Shri Manoj Mukherjee',
    email: 'er_nodal@railways.gov.in',
    password: 'password',
    role: 'Nodal Officer (Eastern Railway - ER)',
    railwayScope: 'ER',
    desc: 'Restricted view. Only displays and manages cases originating from the Eastern Railway Zone.'
  },
  {
    id: 'wr_nodal',
    name: 'Shri Vikram Mehta',
    email: 'wr_nodal@railways.gov.in',
    password: 'password',
    role: 'Nodal Officer (Western Railway - WR)',
    railwayScope: 'WR',
    desc: 'Restricted view. Only displays and manages cases originating from the Western Railway Zone.'
  }
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Check credentials against mock users
    const matched = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );

    if (matched) {
      localStorage.setItem('user', JSON.stringify(matched));
      onLogin(matched);
    } else {
      setError('अमान्य क्रेडेंशियल! कृपया सही ईमेल और पासवर्ड दर्ज करें। / Invalid Credentials! Please use correct email and password.');
    }
  };

  const handleQuickLogin = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    onLogin(user);
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      backgroundImage: 'radial-gradient(at 50% 0%, rgba(245, 158, 11, 0.05) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.05) 0px, transparent 50%)',
    }}>
      {/* Saffron, White, Green Tri-color Stripe on top of landing card */}
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #d1d5db',
        boxShadow: '0 15px 35px rgba(15, 44, 89, 0.08)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* National Tricolor Stripe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '6px', width: '100%' }}>
          <div style={{ background: '#ff9933' }}></div>
          <div style={{ background: '#ffffff' }}></div>
          <div style={{ background: '#128807' }}></div>
        </div>

        {/* Outer Grid Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', minHeight: '520px' }}>
          
          {/* Left Side: Welcomes & System Details */}
          <div style={{
            background: 'linear-gradient(135deg, #0f2c59 0%, #1e3a8a 100%)',
            padding: '3rem',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}>
            <div>
              {/* Emblem Logo */}
              <div style={{
                background: 'rgba(255,255,255,0.08)',
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                border: '1px solid rgba(255,255,255,0.15)'
              }}>
                <svg width="32" height="42" viewBox="0 0 24 36" fill="#ff9933">
                  <path d="M12 2a4 4 0 00-4 4c0 3.3 2.7 4 4 6 1.3-2 4-2.7 4-6a4 4 0 00-4-4zm0 13c-2.2 0-4 1.8-4 4v7c0 .5.5 1 1 1h6c.5 0 1-.5 1-1v-7c0-2.2-1.8-4-4-4z" />
                </svg>
              </div>

              <span style={{
                textTransform: 'uppercase',
                fontSize: '0.8rem',
                letterSpacing: '0.1em',
                fontWeight: 600,
                color: '#ff9933',
                display: 'block',
                marginBottom: '0.5rem'
              }}>
                भारत सरकार | रेल मंत्रालय
              </span>
              <h1 style={{
                fontFamily: 'Outfit',
                fontSize: '2rem',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: '1.2',
                marginBottom: '1rem'
              }}>
                न्यायालयीन मामला निगरानी प्रणाली
              </h1>
              <p style={{
                fontSize: '1rem',
                color: '#93c5fd',
                lineHeight: '1.6',
                maxWidth: '420px',
                marginBottom: '2rem'
              }}>
                Court Case Monitoring System (CCMS) for secure tracking of litigation, physical files, and automated order updates in absolute compliance with Rule 56(j) and UPSC Advice.
              </p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  animation: 'pulse-glow 2s infinite ease-in-out'
                }}></div>
                <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 500 }}>
                  Active database link: SQLite (legal_tracker.db)
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Authentication Forms */}
          <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#ffffff' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#0f2c59',
              marginBottom: '0.25rem',
              fontFamily: 'Outfit'
            }}>
              पोर्टल प्रवेश / Portal Login
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
              Sign in with your official ID credentials to access your designated case records.
            </p>

            {error && (
              <div className="alert-banner error" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '0.825rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#4b5563' }}>Official Email / आधिकारिक ईमेल</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. name@railways.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#4b5563' }}>Password / पासवर्ड</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: '#0f2c59',
                  borderColor: '#0f2c59',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                Sign In to System
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Section: Quick Access Accounts Dashboard Board */}
        <div style={{
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          padding: '2rem 3rem'
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: '#0f2c59',
            marginBottom: '0.35rem',
            fontFamily: 'Outfit',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <svg width="18" height="18" fill="none" stroke="#ff9933" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            त्वरित लॉगिन बोर्ड / Quick Access Testing Board (Zonal Case Partitioning)
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Click on any profile badge below to instantly authenticate and test how the portal dynamically filters, compiles, and restricts cases matching the ID's designated Railway Zone.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem'
          }}>
            {MOCK_USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => handleQuickLogin(user)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  outline: 'none'
                }}
                className="quick-login-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ff9933';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: user.railwayScope === 'All' ? '#1e3a8a' : '#b45309',
                    background: user.railwayScope === 'All' ? '#eff6ff' : '#fffaf5',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${user.railwayScope === 'All' ? '#bfdbfe' : '#ffe9db'}`
                  }}>
                    {user.railwayScope === 'All' ? 'GLOBAL SCOPE' : `${user.railwayScope} ZONE`}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Click to Login →</span>
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f2c59' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 600, marginTop: '0.1rem' }}>{user.role}</div>
                </div>

                <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: '1.4', marginTop: '0.25rem', borderTop: '1px dashed #e5e7eb', paddingTop: '0.5rem' }}>
                  {user.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
