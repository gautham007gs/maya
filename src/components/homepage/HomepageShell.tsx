'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquarePlus, Camera, Search } from 'lucide-react';
import HomepageDropdown from '@/components/homepage/HomepageDropdown';
import HomepageChatItemMeta from '@/components/homepage/HomepageChatItemMeta';
import DirectLinkPlacement from '@/components/ads/DirectLinkPlacement';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteImages } from '@/contexts/SiteImageContext';
import {
  HomepageBetweenChatAd,
  HomepageGlobalAds,
  HomepageFooterAd,
} from '@/components/homepage/HomepageAdSlots';

const PROFILE_NAME = 'Kruthika';
const PROFILE_AVATAR = '/kruthika-avatar.svg';

export default function HomepageShell() {
  const { t } = useLanguage();
  const siteImages = useSiteImages();

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full max-w-3xl mx-auto bg-background md:shadow-2xl overflow-hidden">
      <header className="bg-[#25d366] shadow-sm sticky top-0 z-10 flex-shrink-0">
        <div className="px-4 py-3 sm:px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.aiGirlfriend ? `${t.aiGirlfriend} — Free AI Chat` : 'Free AI Companion Chat — No Sign Up'}
          </h1>
          <nav className="flex items-center space-x-3" aria-label={t.chats}>
            <button
              className="hover:bg-white/10 rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label={t.openCamera}
              type="button"
            >
              <Camera size={20} className="text-white" />
            </button>
            <button
              className="hover:bg-white/10 rounded-full p-2 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label={t.searchChats}
              type="button"
            >
              <Search size={20} className="text-white" />
            </button>
            <HomepageDropdown />
          </nav>
        </div>

        <div className="flex bg-[#25d366]">
          <div className="flex-1">
            <button
              className="w-full py-3 px-4 text-center font-bold border-b-[3px] border-white text-white min-h-[48px]"
              aria-label={t.viewChats}
              aria-current="page"
              type="button"
            >
              {t.chatsTab}
            </button>
          </div>
          <div className="flex-1">
            <a
              href="/status"
              className="block w-full py-3 px-4 text-center font-medium border-b-[3px] border-[#25d366] hover:border-white/50 text-white/90 hover:text-white min-h-[48px]"
              aria-label={t.viewStatusUpdates}
            >
              {t.statusTab}
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 pb-24" style={{ minHeight: 0, contain: 'layout style paint' }}>
        <div className="bg-white" style={{ contain: 'layout paint' }}>
          <a
            href="/maya-chat"
            className="block"
          >
            <div className="flex items-center p-3 sm:p-4 bg-transparent hover:bg-secondary/50 cursor-pointer transition-colors">
              <div className="relative rounded-full mr-4 shrink-0 border-2 border-[#25d366] p-0.5">
                <Avatar
                  className="h-12 w-12 sm:h-14 sm:w-14"
                  style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', aspectRatio: '1/1', contain: 'strict' }}
                >
                  <AvatarImage
                    src={siteImages.homepageAvatarUrl || PROFILE_AVATAR}
                    alt={`${PROFILE_NAME} — AI girlfriend avatar`}
                    width={48}
                    height={48}
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                    style={{ width: '48px', height: '48px', aspectRatio: '1/1' }}
                  />
                  <AvatarFallback>K</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-grow overflow-hidden min-w-0">
                <h2 className="font-semibold text-base sm:text-md truncate text-foreground">{PROFILE_NAME}</h2>
                <p className="text-sm sm:text-base text-muted-foreground truncate">{t.livingMyBestLife}</p>
                <div className="flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <span className="text-xs sm:text-sm text-green-700 font-medium">{t.online}</span>
                </div>
              </div>
              <HomepageChatItemMeta />
            </div>
          </a>
        </div>

        <HomepageBetweenChatAd />

        <div
          className="flex flex-col items-center justify-center px-8 py-12 text-center bg-white mt-4 mx-4 rounded-lg shadow-sm"
          style={{ minHeight: '280px', contain: 'layout' }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3" style={{ contain: 'layout paint' }}>
              {t.chatWithKruthika}
            </h2>
            <p className="text-xs text-gray-500" style={{ contain: 'layout paint' }}>
              {t.smartConversations}
            </p>
          </div>

          <div className="flex flex-col space-y-3 w-full max-w-sm">
            <a
              href="/maya-chat"
              className="w-full bg-[#25d366] hover:bg-[#20bd5a] text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 min-h-[48px] shadow-sm hover:shadow"
              aria-label={t.startChatting}
            >
              <MessageSquarePlus size={20} className="text-white" />
              <span>{t.startChatting}</span>
            </a>

            <div className="flex space-x-3">
              <a
                href="/status"
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 min-h-[48px]"
                aria-label={t.viewStatusUpdates}
              >
                <span aria-hidden="true">👁️</span>
                <span>{t.viewStatus}</span>
              </a>
              <a
                href="/blog"
                className="bg-purple-700 hover:bg-purple-800 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center min-w-[48px] min-h-[48px] text-sm"
                aria-label={t.blog}
              >
                {t.blog}
              </a>
            </div>
          </div>
        </div>
        <DirectLinkPlacement placement="homepage" />
      </main>

      <HomepageGlobalAds />
      <HomepageFooterAd />

      <a
        href="/maya-chat"
        aria-label={`${t.newChat} — ${PROFILE_NAME}`}
        className="fixed bottom-20 right-6 sm:bottom-24 sm:right-8 lg:bottom-24 lg:right-10 z-30 bg-[#25d366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#25d366] focus:ring-offset-2 min-w-[56px] min-h-[56px] flex items-center justify-center"
      >
        <MessageSquarePlus size={24} className="text-white" />
      </a>
    </div>
  );
}
