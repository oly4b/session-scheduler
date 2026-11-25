import { useCallback, useEffect, useState } from 'react';
import { COPY } from './copy.js';

const LANG_STORAGE_KEY = 'momodinks_lang';

function readStoredLanguage() {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' || saved === 'ja' ? saved : null;
  } catch {
    return null;
  }
}

function detectBrowserLanguage(fallback = 'ja') {
  if (typeof navigator === 'undefined') return fallback;
  const locales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];

  for (const locale of locales) {
    const tag = String(locale || '').toLowerCase();
    if (tag.startsWith('en')) return 'en';
    if (tag.startsWith('ja')) return 'ja';
  }
  return fallback;
}

export function useLanguage() {
  const [lang, setLangState] = useState(
    () => readStoredLanguage() || detectBrowserLanguage('ja')
  );
  const [hasManualLang, setHasManualLang] = useState(() =>
    Boolean(readStoredLanguage())
  );

  const isJa = lang === 'ja';
  const t = COPY[lang];

  const setLang = useCallback((nextLang) => {
    setHasManualLang(true);
    setLangState(nextLang);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage failures in private browsing modes.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.appTitle;
  }, [lang, t.appTitle]);

  useEffect(() => {
    if (hasManualLang) return;
    const syncWithBrowser = () => setLangState(detectBrowserLanguage('ja'));
    window.addEventListener('languagechange', syncWithBrowser);
    return () => window.removeEventListener('languagechange', syncWithBrowser);
  }, [hasManualLang]);

  return { lang, isJa, t, setLang };
}
