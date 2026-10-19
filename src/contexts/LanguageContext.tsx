"use client";

import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  SupportedLang, UIStrings, LANG_COOKIE, getTranslations, persistLang,
  isSupportedLang, getTextDirection,
} from '@/lib/translations';

interface LanguageContextValue {
  lang: SupportedLang;
  t: UIStrings;
  dir: 'ltr' | 'rtl';
  setLang: (l: SupportedLang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: getTranslations('en'),
  dir: 'ltr',
  setLang: () => {},
});

/**
 * Single source of truth for the active UI language, kept in lockstep across
 * three places that all need to agree or the UI ends up showing more than
 * one language at once:
 *   1. The server render (middleware negotiates cookie/Accept-Language →
 *      RootLayout passes it in as `initialLang`).
 *   2. This client state (`lang`, used to pick `t`).
 *   3. `<html lang>`/`dir` (accessibility + typography, e.g. future RTL langs).
 *
 * `persistLang` always writes the cookie AND localStorage together, so those
 * two never disagree going forward. The only case this provider has to
 * reconcile on mount is a *pre-existing* localStorage value from a previous
 * session where the cookie didn't make the round trip (cleared cookies,
 * cookie blocked, etc.) — in that case localStorage wins, because it reflects
 * an explicit past choice rather than a guess.
 */
export function LanguageProvider({
  children,
  initialLang = 'en',
}: {
  children: React.ReactNode;
  initialLang?: SupportedLang;
}) {
  const [lang, setLangState] = useState<SupportedLang>(initialLang);
  const router = useRouter();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_COOKIE);
    } catch {
      // Private browsing may block localStorage; the server-negotiated
      // value from RootLayout is already correct, so there's nothing to do.
      return;
    }

    if (stored && isSupportedLang(stored) && stored !== initialLang) {
      // A previously-saved choice exists but didn't reach the server as a
      // cookie this time (e.g. cookie cleared, third-party cookie block).
      // Adopt it client-side and re-write the cookie so future server
      // renders match without needing this fallback again.
      setLangState(stored);
      persistLang(stored);
    }

    // A language selected in another tab should apply here too. The storage
    // event fires only in *other* tabs, so the local setLang path below
    // still handles same-tab updates.
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LANG_COOKIE || !event.newValue) return;
      if (!isSupportedLang(event.newValue)) return;
      setLangState(event.newValue);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
    // Only ever needs to run once per mount — re-running on `lang` changes
    // would re-read localStorage and could stomp a same-tab setLang() call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang>/dir in sync with whatever language is actually active,
  // regardless of which path set `lang` (initial render, storage sync, or
  // an explicit setLang call below).
  //
  // RTL note: dir is derived from the CURRENT documentElement.lang, not from
  // the UI language alone. Geo landing pages like /sa server-render
  // <html lang="ar-SA" dir="rtl"> — deriving from the live attribute keeps
  // that RTL direction after hydration instead of silently flipping it back
  // to ltr when the UI language defaults to 'en'.
  useEffect(() => {
    const effective = document.documentElement.lang || lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = getTextDirection(
      getTextDirection(lang) === 'ltr' && effective !== lang ? effective : lang,
    );
  }, [lang]);

  const setLang = useCallback((l: SupportedLang) => {
    setLangState(l);
    persistLang(l);
    // Re-run server components (footer, metadata, anything reading the
    // negotiated x-ui-lang header) against the new cookie value, without a
    // full page reload — client component state (open chat, scroll, etc.)
    // is preserved.
    router.refresh();
  }, [router]);

  const t = useMemo(() => getTranslations(lang), [lang]);
  const dir = useMemo(() => getTextDirection(lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t, dir, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
