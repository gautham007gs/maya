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

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[10002] p-3 sm:p-5 pointer-events-none",
        "transform transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      )}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent banner"
    >
      <div className="max-h-[85vh] max-w-4xl mx-auto pointer-events-auto overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 p-2 bg-green-100 dark:bg-green-900/40 rounded-xl">
              <Cookie className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                Necessary storage keeps the site working. This free service is supported by ads. If you allow
                advertising, Adsterra may use third-party cookies and pseudonymous device data to serve and measure
                ads. We do not send chat messages to ad partners. You can accept all optional categories or manage
                them individually. Ads do not load until you make a choice.
              </p>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
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
                className="mt-2 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-green-800 hover:text-green-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 dark:text-green-300 dark:hover:text-green-200"
                aria-expanded={showSettings}
              >
                <Settings size={14} aria-hidden="true" />
                {showSettings ? 'Hide preferences' : 'Manage preferences'}
              </button>
            </div>
          </div>

          {showSettings && (
            <fieldset className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Optional categories
              </legend>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Adsterra may set cookies when advertising is enabled. Turning this off prevents Adsterra ad scripts
                from loading. Necessary storage is always on.
              </p>
              <label className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">
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
                  className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900"
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

          <div className={showSettings ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : "grid grid-cols-2 gap-2"}>
            {showSettings ? (
              <Button type="button" variant="outline" className={choiceButtonClass} onClick={saveCustomChoices}>
                Save choices
              </Button>
            ) : null}
            {!showSettings && (
              <Button
                type="button"
                variant="outline"
                className={choiceButtonClass}
                onClick={openSettings}
                aria-label="Manage cookie preferences"
              >
                Manage preferences
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className={choiceButtonClass}
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
