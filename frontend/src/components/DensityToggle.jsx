import React, { useState, useEffect } from 'react';

export default function DensityToggle() {
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('ccms_density') || 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    try {
      localStorage.setItem('ccms_density', density);
    } catch {}
  }, [density]);

  const toggle = () => {
    setDensity((prev) => (prev === 'compact' ? 'comfortable' : 'compact'));
  };

  const isCompact = density === 'compact';

  return (
    <button
      onClick={toggle}
      className="header-icon-btn dark-toggle-btn"
      aria-label={isCompact ? 'Switch to comfortable density' : 'Switch to compact density'}
      title={isCompact ? 'Comfortable' : 'Compact'}
    >
      <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{isCompact ? '\u25A2' : '\u25A3'}</span>
    </button>
  );
}
