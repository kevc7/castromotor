"use client";
import React, { useEffect, useState } from 'react';

function applyTheme(t: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  // Persist
  try { localStorage.setItem('theme', t); } catch {}
}

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    // Initialize from storage or prefers-color-scheme
    try {
      const stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        applyTheme(stored);
        return;
      }
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const initial = prefersLight ? 'light' : 'dark';
      setTheme(initial);
      applyTheme(initial);
    } catch {
      applyTheme('dark');
    }
  }, []);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  };

  return (
    <div className="theme-toggle-btn">
      <button aria-label="Cambiar tema" onClick={toggle} className="theme-toggle group">
        <span className="theme-toggle__thumb" />
        {/* Icons */}
        <svg className="theme-toggle__icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2m-3.07-7.07-1.42 1.42M6.35 17.65l-1.42 1.42" />
        </svg>
        <svg className="theme-toggle__icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 12 17a7 7 0 0 0 9-4.21Z" />
        </svg>
      </button>
    </div>
  );
};
