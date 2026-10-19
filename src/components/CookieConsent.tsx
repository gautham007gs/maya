"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Cookie, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  COOKIE_CONSENT_KEY,
  hasConsentDecision,
  saveConsent,
  clearConsent,
  type ConsentChoice,
} from '@/lib/consent';

interface CookieConsentProps {
  className?: string;
}

export const CookieConsent: React.FC<CookieConsentProps> = ({ className: _className }) => {
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);
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

  // The primary consent decision is intentionally the first focus target.
  // This improves keyboard access and makes the clear affirmative action easy
  // to find without auto-submitting anything for the visitor.
  useEffect(() => {
    if (!show || !visible) return;
    const timer = window.setTimeout(() => acceptButtonRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [show, visible]);

  const applyChoice = useCallback((choice: ConsentChoice) => {
    saveConsent(choice);
    setShowSettings(false);
    setVisible(false);
    setTimeout(() => setShow(false), 350);
    window.dispatchEvent(new CustomEvent('consentchange', { detail: { choice } }));
  }, []);

  const openSettings = useCallback(() => {
    clearConsent();
    setShow(true);
    setShowSettings(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const handler = () => openSettings();
    window.addEventListener('open-consent-settings', handler);
    return () => window.removeEventListener('open-consent-settings', handler);
  }, [openSettings]);

  if (!show) {
    return null;
  }

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
      <div className="max-w-4xl mx-auto pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
          
          {/* Text & Icon */}
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="shrink-0 p-2 bg-green-100 dark:bg-green-900/40 rounded-xl">
              <Cookie className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                {showSettings
                  ? 'We use cookies to improve chat experience, personalization, and deliver relevant features. Essential cookies remain active.'
                  : (t.cookieNotice || 'We use cookies to improve your conversation experience, analyze performance, and serve relevant content.')}{' '}
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
            </div>
          </div>

          {/* Action Buttons: Left = Decline, Right = Prominent Accept */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors mr-auto sm:mr-0"
              title="Cookie settings"
              aria-label="Cookie settings"
            >
              <Settings size={16} />
            </button>

            <Button
              onClick={() => applyChoice('rejected')}
              size="sm"
              variant="ghost"
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 h-8 px-3 font-normal"
              aria-label="Decline non-essential cookies"
            >
              Decline
            </Button>

            <Button
              ref={acceptButtonRef}
              onClick={() => applyChoice('accepted')}
              size="lg"
              className="bg-[#25d366] hover:bg-[#20bd5a] text-white text-sm sm:text-base font-bold min-h-12 px-7 sm:px-9 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 focus-visible:ring-4 focus-visible:ring-[#25d366]/40 focus-visible:outline-none"
              aria-label="Accept all cookies"
            >
              {t.accept || 'Accept All'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export { COOKIE_CONSENT_KEY };
export default CookieConsent;
