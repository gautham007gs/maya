"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Cookie, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  COOKIE_CONSENT_KEY,
  getConsentFromStorage,
  hasConsentDecision,
  saveConsent,
  type ConsentSelection,
} from '@/lib/consent';

interface CookieConsentProps {
  className?: string;
}

export const CookieConsent: React.FC<CookieConsentProps> = ({ className: _className }) => {
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentSelection>({
    analytics: false,
    advertising: false,
    personalization: false,
    aiLearning: false,
    intimacyLevel: false,
  });
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasConsentDecision()) {
        setShow(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const applyChoice = useCallback((choice: 'accepted' | 'rejected') => {
    saveConsent(choice);
    setShowSettings(false);
    setVisible(false);
    setTimeout(() => setShow(false), 350);
    window.dispatchEvent(new CustomEvent('consentchange', { detail: { choice } }));
  }, []);

  const openSettings = useCallback(() => {
    const current = getConsentFromStorage();
    setPreferences({
      analytics: current?.analytics === true,
      advertising: current?.advertising === true,
      personalization: current?.personalization === true,
      aiLearning: current?.aiLearning === true,
      intimacyLevel: current?.intimacyLevel === true,
    });
    setShow(true);
    setShowSettings(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const toggleSettings = useCallback(() => {
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    openSettings();
  }, [openSettings, showSettings]);

  const saveCustomChoices = useCallback(() => {
    saveConsent('custom', preferences);
    setShowSettings(false);
    setVisible(false);
    setTimeout(() => setShow(false), 350);
    window.dispatchEvent(new CustomEvent('consentchange', { detail: { choice: 'custom' } }));
  }, [preferences]);

  useEffect(() => {
    const handler = () => openSettings();
    window.addEventListener('open-consent-settings', handler);
    return () => window.removeEventListener('open-consent-settings', handler);
  }, [openSettings]);

  if (!show) {
    return null;
  }

  const choiceButtonClass =
    "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-green-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";
  const acceptButtonClass =
    "min-h-12 w-full rounded-xl border border-green-700 bg-green-600 px-4 text-sm font-bold text-white shadow-md shadow-green-900/20 hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 dark:border-green-500 dark:bg-green-600 dark:hover:bg-green-500 sm:min-h-13 sm:text-base";

  return (
    <div
      className={cn(
        "fixed bottom-2 left-2 right-2 z-[10002] pointer-events-none sm:bottom-4 sm:left-4 sm:right-4",
        "transform transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent banner"
    >
      <div className="max-h-[70vh] w-full max-w-2xl mx-auto pointer-events-auto overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 rounded-lg bg-green-100 p-1.5 dark:bg-green-900/40 sm:p-2">
              <Cookie className="h-4 w-4 text-green-700 dark:text-green-400 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] leading-[1.45] text-gray-700 dark:text-gray-300 sm:text-xs sm:leading-relaxed">
                Necessary storage keeps the site working. This free service is supported by ads. If you allow
                advertising, Adsterra may use third-party cookies and pseudonymous device data to serve and measure
                ads. We do not send chat messages to ad partners. You can accept all optional categories or manage
                them individually. Ads do not load until you make a choice.
              </p>
              <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400 sm:mt-2 sm:text-xs">
                <Link
                  href="/legal/privacy"
                  className="text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline font-medium inline-block"
                >
                  {t.privacyPolicy || 'Privacy Policy'}
                </Link>
                {' & '}
                <Link
                  href="/legal/cookie-policy"
                  className="text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 underline font-medium inline-block"
                >
                  Cookie Policy
                </Link>
              </p>
              <button
                type="button"
                onClick={toggleSettings}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md text-[11px] font-semibold text-green-800 underline underline-offset-2 hover:text-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 dark:text-green-300 dark:hover:text-green-200 sm:mt-2 sm:text-xs"
                aria-expanded={showSettings}
              >
                <Settings size={14} aria-hidden="true" />
                {showSettings ? 'Hide preferences' : 'Manage preferences'}
              </button>
            </div>
          </div>

          {showSettings && (
            <fieldset className="grid gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-700 dark:bg-slate-800/60 sm:gap-2 sm:p-3">
              <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Optional categories
              </legend>
              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xs">
                Adsterra may set cookies when advertising is enabled. Turning this off prevents Adsterra ad scripts
                from loading. Necessary storage is always on.
              </p>
                <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-slate-900 sm:px-3 sm:py-2 sm:text-sm">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">Necessary</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Security and core site functions</span>
                </span>
                <input type="checkbox" checked disabled aria-label="Necessary cookies are always active" className="h-4 w-4 accent-green-700" />
              </label>
              {([
                ['advertising', 'Advertising (Adsterra)', 'Third-party ad delivery and measurement'],
                ['analytics', 'Analytics', 'First-party site performance measurement'],
                ['personalization', 'Personalization', 'Remember optional experience preferences'],
                ['aiLearning', 'AI learning', 'Use optional preferences to adapt chat behavior'],
                ['intimacyLevel', 'Relationship preferences', 'Remember optional relationship-stage settings'],
              ] as const).map(([key, label, description]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-slate-900 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <span>
                    <span className="block font-medium text-slate-800 dark:text-slate-100">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={(event) => setPreferences(current => ({ ...current, [key]: event.target.checked }))}
                    aria-label={`${label} ${preferences[key] ? 'enabled' : 'disabled'}`}
                    className="h-4 w-4 shrink-0 accent-green-700 focus-visible:ring-2 focus-visible:ring-green-700"
                  />
                </label>
              ))}
            </fieldset>
          )}

          <div className={showSettings ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : "grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2"}>
            {showSettings ? (
              <Button type="button" variant="outline" className={choiceButtonClass} onClick={saveCustomChoices}>
                Save choices
              </Button>
            ) : null}
            {!showSettings && (
              <Button
                type="button"
                variant="outline"
                className={cn(choiceButtonClass, "min-h-10 px-2 text-xs sm:min-h-11 sm:px-4 sm:text-sm")}
                onClick={openSettings}
                aria-label="Manage cookie preferences"
              >
                Manage preferences
              </Button>
            )}
            <Button
              type="button"
              className={acceptButtonClass}
              onClick={() => applyChoice('accepted')}
              aria-label="Accept all optional cookies"
            >
              {t.accept || 'Accept all'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export { COOKIE_CONSENT_KEY };
export default CookieConsent;
