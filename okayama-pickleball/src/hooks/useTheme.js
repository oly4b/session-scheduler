import { useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'momodinks_theme';

// Reads persisted manual theme choice; returns null if unset or blocked in private mode.
function readStoredTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

// Reads the current OS/browser color-scheme preference.
function detectSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Manages active color theme (`'light' | 'dark'`), defaulting to the
 * device/browser `prefers-color-scheme` and tracking OS changes until the user
 * manually toggles it (persisted in `localStorage`).
 */
export function useTheme() {
  const [theme, setThemeState] = useState(
    () => readStoredTheme() || detectSystemTheme()
  );
  const [hasManualTheme, setHasManualTheme] = useState(() =>
    Boolean(readStoredTheme())
  );

  const isDark = theme === 'dark';

  const setTheme = useCallback((nextTheme) => {
    setHasManualTheme(true);
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures in private browsing modes.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  useEffect(() => {
    if (hasManualTheme || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setThemeState(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [hasManualTheme]);

  return { theme, isDark, setTheme, toggleTheme };
}
