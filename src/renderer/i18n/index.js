import { createI18n } from 'vue-i18n';
import en from './en.js';
import es from './es.js';

const STORAGE_KEY = 'gitnexus.locale';

function detectLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {}
  const browser = (typeof navigator !== 'undefined' && navigator.language) || 'es';
  return browser.startsWith('en') ? 'en' : 'es';
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, es },
  warnHtmlMessage: false
});

export function setLocale(locale) {
  if (locale !== 'en' && locale !== 'es') return;
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}
