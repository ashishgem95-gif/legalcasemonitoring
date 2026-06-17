import React, { useState } from 'react';
import api from '../utils/api';

// Available demo accounts for quick login reference (passwords are server-side only)
const DEMO_USERS = [
  { id: 'admin',          name: 'Shri R. K. Singh',     label: 'Super Admin' },
  { id: 'nr_nodal',       name: 'Smt. Anjali Sharma',    label: 'Northern Railway (NR)' },
  { id: 'er_nodal',       name: 'Shri Manoj Mukherjee',  label: 'Eastern Railway (ER)' },
  { id: 'wr_nodal',       name: 'Shri Vikram Mehta',     label: 'Western Railway (WR)' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await api.login(email, password);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('ccms_token', response.token);
      onLogin(response.user);
    } catch (err) {
      setError(err.message || 'अमान्य क्रेडेंशियल! / Invalid Credentials! Please use correct email and password.');
    }
  };

  const handleQuickLogin = async (user) => {
    setError(null);
    try {
      // Quick-login uses user ID as both email and password for demo purposes
      const response = await api.login(user.id, 'password');
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('ccms_token', response.token);
      onLogin(response.user);
    } catch (err) {
      setError(err.message || 'Quick login failed. Try entering credentials manually.');
    }
  };


  return (
    <div className="login-page">
      <div className="login-card">
        {/* National Tricolor Stripe */}
        <div className="login-tricolor">
          <div className="login-tricolor-saffron"></div>
          <div className="login-tricolor-white"></div>
          <div className="login-tricolor-green"></div>
        </div>

        {/* Outer Grid Layout */}
        <div className="login-grid">

          {/* Left Side: Welcomes & System Details */}
          <div className="login-hero">
            <div>
              {/* Emblem Logo */}
              <div className="login-emblem-box">
                <svg width="32" height="42" viewBox="0 0 24 36" fill="#ff9933">
                  <path d="M12 2a4 4 0 00-4 4c0 3.3 2.7 4 4 6 1.3-2 4-2.7 4-6a4 4 0 00-4-4zm0 13c-2.2 0-4 1.8-4 4v7c0 .5.5 1 1 1h6c.5 0 1-.5 1-1v-7c0-2.2-1.8-4-4-4z" />
                </svg>
              </div>

              <span className="login-eyebrow">
                भारत सरकार | रेल मंत्रालय
              </span>
              <h1 className="login-h1">
                न्यायालयीन मामला निगरानी प्रणाली
              </h1>
              <p className="login-sub-text">
                Court Case Monitoring System (CCMS) for secure tracking of litigation, physical files, and automated order updates in absolute compliance with Rule 56(j) and UPSC Advice.
              </p>
            </div>

            <div className="login-status-row">
              <div className="login-status-dot"></div>
              <span className="login-status-text">
                Active database link: SQLite (legal_tracker.db)
              </span>
            </div>
          </div>

          {/* Right Side: Authentication Forms */}
          <div className="login-panel">
            <h2 className="login-h2">
              पोर्टल प्रवेश / Portal Login
            </h2>
            <p className="login-help">
              Sign in with your official ID credentials to access your designated case records.
            </p>

            {error && (
              <div className="alert-banner error" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '0.825rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Official Email or ID / आधिकारिक ईमेल या आईडी</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. admin or name@railways.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password / पासवर्ड</label>
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
                className="login-submit"
              >
                Sign In to System
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
