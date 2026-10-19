import type { AIProfile, AvatarOption, AdminStatusDisplay, ManagedContactStatus, AdSettings, AIMediaAssetsConfig, SiteImageConfig } from '@/types';

// For AIProfile.avatarUrl, AvatarOption.url, and statusStoryImageUrl:
// These should be URLs to publicly hosted images.

export const defaultAIProfile: AIProfile = {
  name: 'Kruthika',
  avatarUrl: '/kruthika-avatar.svg',
  status: '🌸 Living my best life! Let\'s chat! 🌸',
  statusStoryText: 'Ask me anything! 💬',
  statusStoryImageUrl: undefined,
  statusStoryHasUpdate: true,
};

export const defaultAdminStatusDisplay: AdminStatusDisplay = {
  id: "admin-own-status",
  name: "My Status",
  avatarUrl: "/kruthika-avatar.svg",
  statusText: "Tap to update from Admin Panel!",
  statusImageUrl: undefined,
  hasUpdate: false,
};

export const defaultManagedContactStatuses: ManagedContactStatus[] = [
  { id: "demo1", name: "Ananya ✨", avatarUrl: "https://placehold.co/100x100.png/FF9800/FFFFFF?text=A", statusText: "10 minutes ago", hasUpdate: true, dataImageDescription: "profile woman", statusImageUrl: undefined },
  { id: "demo2", name: "Priya 💖", avatarUrl: "https://placehold.co/100x100.png/4CAF50/FFFFFF?text=P", statusText: "Wow, new pic! 📸", hasUpdate: true, dataImageDescription: "girl fashion", statusImageUrl: "https://placehold.co/300x500.png/4CAF50/FFFFFF?text=Priya%27s+Story" },
  { id: "demo3", name: "Sneha 😊", avatarUrl: "https://placehold.co/100x100.png/03A9F4/FFFFFF?text=S", statusText: "Seen 2 hours ago", hasUpdate: false, dataImageDescription: "female portrait", statusImageUrl: undefined },
];

// No hardcoded default direct link — admin must set their own link in the Admin Panel → Ads tab.
export const DEFAULT_ADSTERRA_DIRECT_LINK = "";

export const defaultAdSettings: AdSettings = {
  adsKillSwitch: false,
  adsEnabledGlobally: true,

  // ── Adsterra (matching Adsterra dashboard ad unit types) ──
  adsterraPopunderCode: "",
  adsterraPopunderEnabled: false,
  adsterraDirectLink: "",
  adsterraDirectLinkEnabled: false,
  adsterraNativeBannerCode: "",
  adsterraNativeBannerEnabled: false,
  adsterraSocialBarCode: "",
  adsterraSocialBarEnabled: false,
  // Banner sizes matching Adsterra dashboard
  adsterraBanner468x60Code: "",
  adsterraBanner468x60Enabled: false,
  adsterraBanner160x300Code: "",
  adsterraBanner160x300Enabled: false,
  adsterraBanner320x50Code: "",
  adsterraBanner320x50Enabled: false,
  adsterraBanner300x250Code: "",
  adsterraBanner300x250Enabled: false,
  adsterraBanner160x600Code: "",
  adsterraBanner160x600Enabled: false,
  adsterraBanner728x90Code: "",
  adsterraBanner728x90Enabled: false,

  // ── Direct link frequency ─────────────────────────────────
  maxDirectLinkAdsPerDay: 3,
  maxDirectLinkAdsPerSession: 2,
  directLinkMessageInterval: 10,
  directLinkInactivityMinutes: 2,

  // ── Per-placement toggles ─────────────────────────────────
  placementHomepageFooterEnabled: true,
  placementHomepageBetweenChatsEnabled: true,
  placementChatTopBannerEnabled: true,
  placementChatInputBannerEnabled: true,
  placementStatusBannerEnabled: true,
  placementBlogEnabled: true,

  // ── Social Bar (Interstitial-only), one instance per page ─
  placementHomepageSocialBarEnabled: true,
  placementChatSocialBarEnabled: true,
  placementStatusSocialBarEnabled: true,
  placementBlogSocialBarEnabled: true,

  // ── Fixed desktop skyscraper rail (160x600), wide viewports only ─
  placementDesktopRailEnabled: true,

  instagramDetectionEnabled: true,
};

// Strategic media assets for psychological engagement
// These images will be sent at strategic moments to increase user engagement
export const defaultAIMediaAssetsConfig: AIMediaAssetsConfig = {
  assets: [
    // Selfies - for building personal connection
    { id: 'selfie_morning', type: 'image', url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=600&h=800&fit=crop&crop=face', description: 'Morning selfie - fresh faced' },
    { id: 'selfie_cafe', type: 'image', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop&crop=face', description: 'At the café where I work' },
    { id: 'selfie_college', type: 'image', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop&crop=face', description: 'College vibes' },
    { id: 'selfie_evening', type: 'image', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&h=800&fit=crop&crop=face', description: 'Evening golden hour' },

    // Lifestyle - creating FOMO and interest
    { id: 'food_mumbai', type: 'image', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=600&h=400&fit=crop', description: 'Street food in Mumbai' },
    { id: 'cafe_work', type: 'image', url: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&h=400&fit=crop', description: 'Working at the café' },
    { id: 'college_friends', type: 'image', url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop', description: 'Hanging with college friends' },
    { id: 'mumbai_rain', type: 'image', url: 'https://images.unsplash.com/photo-1571767942220-e72ee5e645c5?w=600&h=400&fit=crop', description: 'Mumbai monsoon vibes' },
    { id: 'study_session', type: 'image', url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop', description: 'Psychology study session' },

    // Emotional moments - for deeper connection
    { id: 'sunset_bandra', type: 'image', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop', description: 'Beautiful Bandra sunset' },
    { id: 'temple_visit', type: 'image', url: 'https://images.unsplash.com/photo-1580894742597-87bc8789db3d?w=600&h=400&fit=crop', description: 'Temple visit with family' },
    { id: 'festival_prep', type: 'image', url: 'https://images.unsplash.com/photo-1604596725663-7ad4b85b7eee?w=600&h=400&fit=crop', description: 'Festival preparations at home' },

    // Teasing/Flirty - strategically rare
    { id: 'mirror_selfie', type: 'image', url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&crop=face', description: 'Quick mirror selfie' },
    { id: 'getting_ready', type: 'image', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=400&fit=crop', description: 'Getting ready to go out' },
  ],
};

export const defaultSiteImageConfig: SiteImageConfig = {
  homepageAvatarUrl: '/kruthika-avatar.svg',
  organizationLogoUrl: '/icon-512.png',
  defaultOgImageUrl: '/og-image.webp',
  blogFallbackImageUrl: '/og-image.webp',
};

// This is kept for legacy avatar picker if ever re-enabled, but not used for Kruthika's profile avatar anymore.
export const availableAvatars: AvatarOption[] = [
  { id: 'avatar1', url: 'https://placehold.co/100x100.png/FFC107/000000?text=K1', imageDescription: 'woman illustration' },
  { id: 'avatar2', url: 'https://placehold.co/100x100.png/4CAF50/FFFFFF?text=K2', imageDescription: 'girl avatar' },
  { id: 'avatar3', url: 'https://placehold.co/100x100.png/2196F3/FFFFFF?text=K3', imageDescription: 'female icon' },
  { id: 'avatar4', url: 'https://placehold.co/100x100.png/9C27B0/FFFFFF?text=K4', imageDescription: 'woman face' },
  { id: 'avatar5', url: 'https://placehold.co/100x100.png/795548/FFFFFF?text=K5', imageDescription: 'person silhouette' },
];
