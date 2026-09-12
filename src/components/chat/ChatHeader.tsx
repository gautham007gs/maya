"use client";

import { ArrowLeft, EllipsisVertical, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from '../ui/button';
import { defaultAIProfile } from '@/config/ai';
import { useAdSettings } from '@/contexts/AdSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface ChatHeaderProps {
  aiName: string;
  aiAvatarUrl: string; 
  onlineStatus: string;
  onAvatarClick: () => void;
  onCallClick: () => void; 
  onVideoClick: () => void; 
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  aiName,
  aiAvatarUrl, 
  onlineStatus,
  onAvatarClick,
  onCallClick,
  onVideoClick,
}) => {
  useAdSettings();
  const { t } = useLanguage();

  let avatarUrlToUse = aiAvatarUrl; 
  if (!avatarUrlToUse || typeof avatarUrlToUse !== 'string' || avatarUrlToUse.trim() === '' || (!avatarUrlToUse.startsWith('http') && !avatarUrlToUse.startsWith('data:'))) {
    avatarUrlToUse = defaultAIProfile.avatarUrl;
  }

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`ChatHeader - AvatarImage load error for ${aiName}. URL: ${avatarUrlToUse}`, e);
  };

  // Hard navigation back — forces a full page reload (MPA behaviour)
  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <header className="flex items-center px-3 py-2 bg-white dark:bg-[#202c33] border-b border-[#e9edef] shadow-sm" style={{ minHeight: '60px', maxHeight: '60px' }}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => navigateTo('/')} 
        className="text-[#3b4a54] hover:bg-[#f0f2f5] mr-1 rounded-full transition-colors active:bg-[#d9dfe3]" 
        style={{ width: '40px', height: '40px', flexShrink: 0 }}
        aria-label={t.exitChat}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <button 
        onClick={onAvatarClick} 
        className="flex items-center focus:outline-none rounded-full mr-2.5 transition-opacity active:opacity-70"
        style={{ width: '42px', height: '42px', flexShrink: 0 }}
        key={`avatar-header-wrapper-${aiName}-${avatarUrlToUse || 'default_wrapper_key_ch'}`}
        aria-label={`${t.viewContact}: ${aiName}`}
      >
        <Avatar 
            className="h-[42px] w-[42px] cursor-pointer ring-0" 
            key={`avatar-comp-header-${aiName}-${avatarUrlToUse || 'default_avatar_comp_key_ch'}`}
            style={{ width: '42px', height: '42px', flexShrink: 0 }}
        >
          <AvatarImage 
            src={avatarUrlToUse || undefined} 
            alt={`${aiName} - profile picture`} 
            key={`chat-header-avatar-img-${aiName}-${avatarUrlToUse || 'no_avatar_fallback_img_ch'}`}
            onError={handleAvatarError}
            width={42}
            height={42}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{ width: '42px', height: '42px', objectFit: 'cover', aspectRatio: '1/1' }}
          />
          <AvatarFallback style={{ width: '42px', height: '42px' }}>{(aiName || "K").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </button>
      <div
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAvatarClick(); } }}
          className="flex-grow cursor-pointer min-w-0 focus-visible:outline-none"
          onClick={onAvatarClick}
        >
        <div className="font-semibold text-[16px] text-[#111b21] dark:text-white leading-tight truncate">{aiName}</div>
        <p className="text-[12.5px] text-[#667781] dark:text-[#8696a0] leading-tight truncate">{onlineStatus}</p>
      </div>

      <Button 
        variant="ghost" 
        size="icon" 
        className="text-[#3b4a54] dark:text-[#aebac1] hover:bg-[#f0f2f5] rounded-full transition-colors active:bg-[#d9dfe3] ml-1" 
        aria-label={t.videoCall} 
        onClick={onVideoClick}
        style={{ width: '40px', height: '40px', flexShrink: 0 }}
      >
        <Video className="h-[22px] w-[22px]" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-[#3b4a54] dark:text-[#aebac1] hover:bg-[#f0f2f5] rounded-full transition-colors active:bg-[#d9dfe3]" 
        aria-label={t.voiceCall} 
        onClick={onCallClick}
        style={{ width: '40px', height: '40px', flexShrink: 0 }}
      >
        <Phone className="h-[22px] w-[22px]" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-[#3b4a54] dark:text-[#aebac1] hover:bg-[#f0f2f5] rounded-full transition-colors active:bg-[#d9dfe3]" 
            aria-label={t.settings}
            style={{ width: '40px', height: '40px', flexShrink: 0 }}
          >
            <EllipsisVertical className="h-[20px] w-[20px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAvatarClick}>
            <span>{t.viewContact}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => alert("Media, links, and docs: Non-functional placeholder")}>
            <span>{t.mediaLinksAndDocs}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => alert("Search: Non-functional placeholder")}>
            <span>{t.search}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => alert("Mute notifications: Non-functional placeholder")}>
            <span>{t.muteNotifications}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Hard navigations — MPA full page reload */}
          <DropdownMenuItem onClick={() => navigateTo('/legal/terms')}>
            <span>{t.termsOfService}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigateTo('/legal/privacy')}>
            <span>{t.privacyPolicy}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.dispatchEvent(new Event('open-consent-settings'))}>
            <span>{t.privacySettings}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigateTo('/')}>
            <span>{t.exitChat}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <LanguageSwitcher compact />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default ChatHeader;
