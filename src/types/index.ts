export type MessageStatus = 'sent' | 'delivered' | 'read';
export type MessageReaction = 'heart' | 'thumbs_up' | 'laugh' | 'angry' | 'sad' | 'wow';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  status: MessageStatus;
  userImageUrl?: string;
  aiImageUrl?: string;
  audioUrl?: string;
  isNativeAd?: boolean;
  nativeAdCode?: string;
  nativeAdFallbackCode?: string; // alternate network's code, used if the primary returns zero-fill
  nativeAdId?: string;
  deliveredAt?: Date;
  readAt?: Date;
  isLiked?: boolean;
  reaction?: MessageReaction;
  isViewOnce?: boolean;
  isViewed?: boolean;
  isVoiceNote?: boolean;
  voiceNoteDuration?: number; // seconds, e.g. 14
  isMilestone?: boolean;    // milestone celebration
}

export interface EmotionalStateOutput {
  response: string;
  newMood: string;
  newIgnoreUntil?: number; // For client to update localStorage
}

export interface AIProfile {
  name: string;
  avatarUrl: string;
  status: string; // Main status line for ChatHeader
  statusStoryText?: string; // Text for the Status Page story
  statusStoryImageUrl?: string; // Image URL for the Status Page story (legacy, use statusStoryMediaUrl)
  statusStoryMediaUrl?: string; // Media URL for story (images, videos, audio)
  statusStoryMediaType?: 'image' | 'video' | 'audio'; // Type of story media
  statusStoryHasUpdate?: boolean; // Ring indicator for new story on Status Page
}

export interface AvatarOption {
  id: string;
  url: string;
  imageDescription: string;
}

export interface AdminStatusDisplay {
  id: string;
  name: string;
  avatarUrl: string;
  statusText: string;
  statusImageUrl?: string;
  hasUpdate: boolean;
}

export interface ManagedContactStatus {
  id: string;
  name: string;
  avatarUrl: string;
  statusText: string;
  hasUpdate: boolean;
  dataImageDescription?: string;
  statusImageUrl?: string;
}

export interface AdSettings {
  /** Emergency remote kill switch — when true, no ads load regardless of cache. */
  adsKillSwitch?: boolean;

  adsEnabledGlobally: boolean;

  // ── Adsterra formats (matching Adsterra dashboard ad unit types) ─────────
  /** Popunder — new tab on first click (skip Instagram IAB) */
  adsterraPopunderCode: string;
  adsterraPopunderEnabled: boolean;
  /** Direct Link / Smartlink — pay-per-click URL */
  adsterraDirectLink: string;
  adsterraDirectLinkEnabled: boolean;
  /** Native Banner — looks like content, highest CTR */
  adsterraNativeBannerCode: string;
  adsterraNativeBannerEnabled: boolean;
  /** Social Bar — sticky notification-style floating bar */
  adsterraSocialBarCode: string;
  adsterraSocialBarEnabled: boolean;
  /** Banner 468×60 — classic leaderboard */
  adsterraBanner468x60Code: string;
  adsterraBanner468x60Enabled: boolean;
  /** Banner 160×300 — half-page small */
  adsterraBanner160x300Code: string;
  adsterraBanner160x300Enabled: boolean;
  /** Banner 320×50 — mobile leaderboard, homepage footer / chat input */
  adsterraBanner320x50Code: string;
  adsterraBanner320x50Enabled: boolean;
  /** Banner 300×250 — medium rectangle, highest eCPM across all devices */
  adsterraBanner300x250Code: string;
  adsterraBanner300x250Enabled: boolean;
  /** Banner 160×600 — wide skyscraper, desktop sidebar */
  adsterraBanner160x600Code: string;
  adsterraBanner160x600Enabled: boolean;
  /** Banner 728×90 — leaderboard, desktop header/footer */
  adsterraBanner728x90Code: string;
  adsterraBanner728x90Enabled: boolean;

  // ── Direct link frequency caps ──────────────────────────
  maxDirectLinkAdsPerDay: number;
  maxDirectLinkAdsPerSession: number;
  directLinkMessageInterval: number;
  directLinkInactivityMinutes: number;

  // ── Per-placement toggles (admin granular control) ───────
  placementHomepageFooterEnabled: boolean;
  placementHomepageBetweenChatsEnabled: boolean;
  placementChatTopBannerEnabled: boolean;
  placementChatInputBannerEnabled: boolean;
  placementStatusBannerEnabled: boolean;
  placementBlogEnabled: boolean;

  // ── Social Bar (Interstitial-only) — one instance per page, each with its own on/off ─
  placementHomepageSocialBarEnabled: boolean;
  placementChatSocialBarEnabled: boolean;
  placementStatusSocialBarEnabled: boolean;
  placementBlogSocialBarEnabled: boolean;

  // ── Fixed desktop skyscraper rail (160×600), ≥1200px viewports only ──
  placementDesktopRailEnabled: boolean;

  instagramDetectionEnabled: boolean;
}

export interface AIMediaAsset {
  id: string;
  type: 'image' | 'audio' | 'video';
  url: string; // Full public URL for uploaded files or external URLs
  description?: string; // Optional description for admin reference
  storagePath?: string; // Path in Supabase Storage (for uploaded files)
  storageBucket?: string; // Bucket name in Supabase Storage (for uploaded files)
  uploadedAt?: string; // Timestamp when file was uploaded
}
export interface AIMediaAssetsConfig {
  assets: AIMediaAsset[];
}

/** Public, brand-level image assignments managed in Admin → Site Images. */
export interface SiteImageConfig {
  homepageAvatarUrl: string;
  organizationLogoUrl: string;
  defaultOgImageUrl: string;
  blogFallbackImageUrl: string;
}

// Key for storing AdSettings in Supabase app_configurations table
export const AD_SETTINGS_CONFIG_KEY = 'ad_settings_kruthika_chat_v1';
// Key for storing AIProfile in Supabase app_configurations table
export const AI_PROFILE_CONFIG_KEY = 'ai_profile_kruthika_chat_v1';
// Key for storing Admin's own status in Supabase app_configurations table
export const ADMIN_OWN_STATUS_CONFIG_KEY = 'admin_own_status_config_v1';
// Key for storing Managed Demo Contacts in Supabase app_configurations table
export const MANAGED_DEMO_CONTACTS_CONFIG_KEY = 'managed_demo_contacts_config_v1';
// Key for storing AI's sharable media assets in Supabase app_configurations table
export const AI_MEDIA_ASSETS_CONFIG_KEY = 'ai_media_assets_config_v1';
export const SITE_IMAGE_CONFIG_KEY = 'site_image_config_v1';
