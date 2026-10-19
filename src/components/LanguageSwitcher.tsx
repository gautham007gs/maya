'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import {
  getLanguageName,
  SUPPORTED_LANGS,
  type SupportedLang,
} from '@/lib/translations';

interface LanguageSwitcherProps {
  compact?: boolean;
}

/**
 * A real user preference control, not a browser-translation prompt.
 * Browser/device detection is used by LanguageProvider on first visit; this
 * control lets the user override it and keeps the choice across page loads.
 */
export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { lang, t, setLang } = useLanguage();

  return (
    <label className={compact ? 'block' : 'flex items-center gap-2'}>
      {!compact && <span className="text-xs text-gray-500" aria-hidden="true">🌐</span>}
      <span className="sr-only">{t.language}</span>
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as SupportedLang)}
        aria-label={`${t.language}: ${getLanguageName(lang)}`}
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
      >
        {SUPPORTED_LANGS.map((option) => (
          <option key={option} value={option}>
            {getLanguageName(option)}
          </option>
        ))}
      </select>
    </label>
  );
}