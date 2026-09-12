'use client';

import { useState } from 'react';
import {
  COUNTRY_CONFIGS,
  COUNTRY_COOKIE,
  SUPPORTED_COUNTRIES,
  type CountryCode,
} from '@/lib/locales';
import { useLanguage } from '@/contexts/LanguageContext';

interface CountrySwitcherProps {
  compact?: boolean;
  initialCountry?: CountryCode;
}

export default function CountrySwitcher({
  compact = false,
  initialCountry = 'IN',
}: CountrySwitcherProps) {
  const { t } = useLanguage();
  const [country, setCountry] = useState<CountryCode>(initialCountry);

  function handleChange(next: CountryCode) {
    setCountry(next);
    document.cookie = `${COUNTRY_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    // Country routes are useful landing pages, but the preference also
    // applies to the current app page. Refresh lets middleware update lang,
    // metadata, and regional defaults without losing the current URL.
    window.location.reload();
  }

  return (
    <label className={compact ? 'block' : 'flex items-center gap-2'}>
      {!compact && <span className="text-xs text-gray-500" aria-hidden="true">📍</span>}
      <span className="sr-only">{t.country}</span>
      <select
        value={country}
        onChange={(event) => handleChange(event.target.value as CountryCode)}
        aria-label={`${t.country}: ${COUNTRY_CONFIGS[country].name}`}
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
      >
        {SUPPORTED_COUNTRIES.map((code) => {
          const option = COUNTRY_CONFIGS[code];
          return (
            <option key={code} value={code}>
              {option.flag} {option.name}
            </option>
          );
        })}
      </select>
    </label>
  );
}