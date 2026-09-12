'use client';

import { useState, useRef, useEffect } from 'react';
import { EllipsisVertical, Info, Star, Settings, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function HomepageDropdown() {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="hover:bg-white/10 rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
        onClick={() => setShowDropdown(prev => !prev)}
        aria-label={t.settings}
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        <EllipsisVertical size={20} className="text-white" />
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          role="menu"
        >
          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
            <Info size={16} />
              {t.newGroup}
          </button>
          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
            <Star size={16} />
              {t.starredMessages}
          </button>
          <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]" role="menuitem">
            <Settings size={16} />
              {t.settings}
          </button>
          <a
            href="/blog"
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 min-h-[48px]"
            role="menuitem"
          >
            <Zap size={16} />
              {t.blog}
          </a>
          <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100 mt-1">
            <span>{t.enhancedConversations}</span>
          </div>
          <div className="border-t border-gray-100 px-4 py-2">
            <LanguageSwitcher compact />
          </div>
        </div>
      )}
    </div>
  );
}
