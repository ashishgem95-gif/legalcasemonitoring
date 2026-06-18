import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
      /* ignore storage errors */
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
