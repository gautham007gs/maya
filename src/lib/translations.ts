// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// UI Translations â browser/device language detection
// Supported: English, Hindi, Kannada, Tamil, Telugu, Malayalam,
//            Bengali, Gujarati, Marathi, Punjabi
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type SupportedLang =
  | 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ml'
  | 'bn' | 'gu' | 'mr' | 'pa';

export const SUPPORTED_LANGS: SupportedLang[] = [
  'en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'gu', 'mr', 'pa',
];

export const LANGUAGE_NAMES: Record<SupportedLang, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ml: 'മലയാളം',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
  mr: 'मराठी',
  pa: 'ਪੰਜਾਬੀ',
};

export interface UIStrings {
  // Accessibility labels / app shell
  language: string;
  country: string;
  openCamera: string;
  searchChats: string;
  viewChats: string;
  viewStatusUpdates: string;
  chatWithProfile: string;
  newChat: string;
  aiGirlfriend: string;
  livingMyBestLife: string;
  online: string;
  openEmojiPicker: string;
  closeEmojiPicker: string;
  messagePlaceholder: string;
  uploadImage: string;
  sendMessage: string;
  sendingMessage: string;
  openMicrophone: string;

  // Header / tabs
  chats: string;
  status: string;
  chatsTab: string;   // uppercase tab label
  statusTab: string;  // uppercase tab label
  recentUpdates: string;

  // Dropdown menu (home page + AppHeader)
  blog: string;
  newGroup: string;
  starredMessages: string;
  settings: string;
  enhancedConversations: string;

  // Legal
  privacyPolicy: string;
  privacySettings: string;
  termsOfService: string;

  // Welcome section
  chatWithKruthika: string;
  smartConversations: string;
  startChatting: string;
  viewStatus: string;

  // Chat header dropdown
  viewContact: string;
  mediaLinksAndDocs: string;
  search: string;
  muteNotifications: string;
  exitChat: string;

  // Cookie banner
  cookieNotice: string;
  accept: string;

  // Network / offline
  youAreOffline: string;
  backOnline: string;
  messageSaved: string;
  sendWhenBack: string;
  queuedMessages: string;
  sendingQueued: string;

  // Site footer (server-rendered — see SiteFooter.tsx)
  footerTagline: string;
  footerChatHeading: string;
  footerHome: string;
  footerFaq: string;
  footerAboutUs: string;
  footerContact: string;
  footerBlogHeading: string;
  footerAllArticles: string;
  footerOurAuthors: string;
  footerEditorialPolicy: string;
  footerLegalHeading: string;
  footerCookiePolicy: string;
  footerAccessibility: string;
  footerAlsoAvailableIn: string;
  footerCopyright: string; // {year} placeholder
  footerDisclaimer: string;

  // Notification permission banner (default copy — admin CMS can override
  // per-deployment, but always in one language; these defaults are what
  // actually renders for the vast majority of visitors)
  notifBannerTitle: string;
  notifBannerSubtitle: string;
  notifBannerAllow: string;
  notifBannerLater: string;
  notifBannerEnabling: string;

  // Instagram in-app-browser prompt. {browser} and {menu} are replaced at
  // render time (e.g. "Safari" / "··· button").
  instaBrowserHint: string;

  // Chat header action buttons
  videoCall: string;
  voiceCall: string;

  // Chat page toasts (rare-path errors/feedback shown via the toast system)
  toastLoadingErrorTitle: string;
  toastLoadingErrorDesc: string;
  toastPleaseWaitTitle: string;
  toastLoadingSettingsDesc: string;
  toastDailyLimitTitle: string;
  toastDailyLimitDesc: string; // {limit} placeholder
  toastCallFeatureTitle: string;
  toastCallFeatureDesc: string;
  toastQuickReplyTitle: string;
  toastQuickReplyDesc: string; // {reply} and {original} placeholders
  toastLikedTitle: string;
  toastLikedDesc: string;
}

const translations: Record<SupportedLang, UIStrings> = {
  en: {
    language: 'Language',
    country: 'Country',
    openCamera: 'Open camera',
    searchChats: 'Search chats',
    viewChats: 'View chats',
    viewStatusUpdates: 'View status updates',
    chatWithProfile: 'Chat with {name} — your free AI girlfriend',
    newChat: 'New chat',
    aiGirlfriend: 'AI Companion',
    livingMyBestLife: 'Living my best life! Let’s chat!',
    online: 'Online',
    openEmojiPicker: 'Open emoji picker',
    closeEmojiPicker: 'Close emoji picker',
    messagePlaceholder: 'Message',
    uploadImage: 'Attach image to message',
    sendMessage: 'Send message',
    sendingMessage: 'Sending message',
    openMicrophone: 'Open microphone input',
    chats: 'Chats',
    status: 'Status',
    chatsTab: 'CHATS',
    statusTab: 'STATUS',
    recentUpdates: 'Recent Updates',
    blog: 'Blog',
    newGroup: 'New group',
    starredMessages: 'Starred messages',
    settings: 'Settings',
    enhancedConversations: 'Enhanced conversations',
    privacyPolicy: 'Privacy Policy',
    privacySettings: 'Privacy settings',
    termsOfService: 'Terms of Service',
    chatWithKruthika: 'Chat with Kruthika',
    smartConversations: 'Smart conversations',
    startChatting: 'Start Chatting',
    viewStatus: 'View Status',
    viewContact: 'View Contact',
    mediaLinksAndDocs: 'Media, links, and docs',
    search: 'Search',
    muteNotifications: 'Mute notifications',
    exitChat: 'Exit Chat',
    cookieNotice: 'We use cookies to make your experience better.',
    accept: 'Accept all',
    youAreOffline: 'You are offline',
    backOnline: 'You are back online!',
    messageSaved: 'Message saved — will be sent when back online',
    sendWhenBack: 'Send when online',
    queuedMessages: 'Queued',
    sendingQueued: 'Sending queued messages…',
    footerTagline: 'Free AI girlfriend platform. Emotional support & companionship, 24/7 — no sign-up required.',
    footerChatHeading: 'Chat',
    footerHome: 'Home',
    footerFaq: 'FAQ',
    footerAboutUs: 'About Us',
    footerContact: 'Contact',
    footerBlogHeading: 'Blog',
    footerAllArticles: 'All Articles',
    footerOurAuthors: 'Our Authors',
    footerEditorialPolicy: 'Editorial Policy',
    footerLegalHeading: 'Legal',
    footerCookiePolicy: 'Cookie Policy',
    footerAccessibility: 'Accessibility',
    footerAlsoAvailableIn: 'Also available in',
    footerCopyright: '© {year} Kruthika.fun. All rights reserved. Built with ♥ for companionship & emotional support.',
    footerDisclaimer: 'Kruthika is an AI companion and is not a substitute for professional mental health care. If you are in crisis, call 988 (USA), 116 123 (UK/Samaritans), or your local emergency services.',
    notifBannerTitle: 'Kruthika wants to message you 💕',
    notifBannerSubtitle: 'Get notified when she sends photos, voice messages & more. Don\'t miss a thing!',
    notifBannerAllow: '🔔 Allow',
    notifBannerLater: 'Later',
    notifBannerEnabling: 'Enabling…',
    instaBrowserHint: 'Better in {browser} — tap {menu} → "Open in {browser}"',
    videoCall: 'Video call',
    voiceCall: 'Call',
    toastLoadingErrorTitle: 'Loading Error',
    toastLoadingErrorDesc: 'Couldn\'t load previous chat data. Starting fresh!',
    toastPleaseWaitTitle: 'Please wait',
    toastLoadingSettingsDesc: 'Loading essential settings...',
    toastDailyLimitTitle: 'Daily Image Limit Reached',
    toastDailyLimitDesc: 'You can only send {limit} images per day. Your message text (if any) has been sent. Please try sending images again tomorrow.',
    toastCallFeatureTitle: 'Call Feature',
    toastCallFeatureDesc: 'Calls are simulated.',
    toastQuickReplyTitle: 'Quick Reply Sent',
    toastQuickReplyDesc: 'Replied "{reply}" to {original}...',
    toastLikedTitle: '❤️ Liked',
    toastLikedDesc: 'You liked this message',
  },

  hi: {
    language: 'भाषा',
    country: 'देश',
    openCamera: 'कैमरा खोलें',
    searchChats: 'चैट खोजें',
    viewChats: 'चैट देखें',
    viewStatusUpdates: 'स्टेटस अपडेट देखें',
    chatWithProfile: '{name} से चैट करें — आपकी मुफ्त AI गर्लफ्रेंड',
    newChat: 'नई चैट',
    aiGirlfriend: 'AI साथी',
    livingMyBestLife: 'अपनी ज़िंदगी का आनंद ले रही हूँ! चलिए बात करते हैं!',
    online: 'ऑनलाइन',
    openEmojiPicker: 'इमोजी पिकर खोलें',
    closeEmojiPicker: 'इमोजी पिकर बंद करें',
    messagePlaceholder: 'संदेश',
    uploadImage: 'संदेश में तस्वीर जोड़ें',
    sendMessage: 'संदेश भेजें',
    sendingMessage: 'संदेश भेजा जा रहा है',
    openMicrophone: 'माइक्रोफ़ोन इनपुट खोलें',
    chats: 'चैट्स',
    status: 'स्टेटस',
    chatsTab: 'चैट्स',
    statusTab: 'स्टेटस',
    recentUpdates: 'हाल के अपडेट',
    blog: 'ब्लॉग',
    newGroup: 'नया ग्रुप',
    starredMessages: 'स्टार किए गए संदेश',
    settings: 'सेटिंग्स',
    enhancedConversations: 'बेहतर बातचीत',
    privacyPolicy: 'गोपनीयता नीति',
    privacySettings: 'गोपनीयता सेटिंग्स',
    termsOfService: 'सेवा की शर्तें',
    chatWithKruthika: 'Kruthika से बात करें',
    smartConversations: 'स्मार्ट बातचीत',
    startChatting: 'चैट शुरू करें',
    viewStatus: 'स्टेटस देखें',
    viewContact: 'प्रोफाइल देखें',
    mediaLinksAndDocs: 'मीडिया और डॉक्स',
    search: 'खोजें',
    muteNotifications: 'नोटिफिकेशन बंद करें',
    exitChat: 'चैट से बाहर',
    cookieNotice: 'Kruthika को आपको याद रखने के लिए हम कुकीज़ उपयोग करते हैं।',
    accept: 'स्वीकार करें',
    youAreOffline: 'आप ऑफलाइन हैं',
    backOnline: 'आप वापस ऑनलाइन हैं!',
    messageSaved: 'संदेश सहेजा गया — वापस आने पर भेजा जाएगा',
    sendWhenBack: 'ऑनलाइन होने पर भेजें',
    queuedMessages: 'प्रतीक्षारत',
    sendingQueued: 'सहेजे गए संदेश भेजे जा रहे हैं…',
    footerTagline: 'मुफ्त AI गर्लफ्रेंड प्लेटफ़ॉर्म। भावनात्मक सहयोग और साथ, 24/7 — साइन-अप की ज़रूरत नहीं।',
    footerChatHeading: 'चैट',
    footerHome: 'होम',
    footerFaq: 'सामान्य प्रश्न',
    footerAboutUs: 'हमारे बारे में',
    footerContact: 'संपर्क करें',
    footerBlogHeading: 'ब्लॉग',
    footerAllArticles: 'सभी लेख',
    footerOurAuthors: 'हमारे लेखक',
    footerEditorialPolicy: 'संपादकीय नीति',
    footerLegalHeading: 'कानूनी',
    footerCookiePolicy: 'कुकी नीति',
    footerAccessibility: 'सुगम्यता',
    footerAlsoAvailableIn: 'यहाँ भी उपलब्ध है',
    footerCopyright: '© {year} Kruthika.fun. सर्वाधिकार सुरक्षित। साथ और भावनात्मक सहयोग के लिए ♥ से बनाया गया।',
    footerDisclaimer: 'Kruthika एक AI साथी है और यह पेशेवर मानसिक स्वास्थ्य देखभाल का विकल्प नहीं है। यदि आप संकट में हैं, तो 988 (USA), 116 123 (UK/Samaritans), या अपनी स्थानीय आपातकालीन सेवा पर कॉल करें।',
    notifBannerTitle: 'Kruthika आपको मैसेज करना चाहती है 💕',
    notifBannerSubtitle: 'जब वो फ़ोटो, वॉइस मैसेज और भी बहुत कुछ भेजे तो जानिए। कुछ भी मिस न करें!',
    notifBannerAllow: '🔔 अनुमति दें',
    notifBannerLater: 'बाद में',
    notifBannerEnabling: 'चालू किया जा रहा है…',
    instaBrowserHint: '{browser} में बेहतर अनुभव — {menu} पर टैप करें → "{browser} में खोलें"',
    videoCall: 'वीडियो कॉल',
    voiceCall: 'कॉल',
    toastLoadingErrorTitle: 'लोड करने में त्रुटि',
    toastLoadingErrorDesc: 'पिछला चैट डेटा लोड नहीं हो सका। नई शुरुआत!',
    toastPleaseWaitTitle: 'कृपया प्रतीक्षा करें',
    toastLoadingSettingsDesc: 'ज़रूरी सेटिंग्स लोड हो रही हैं...',
    toastDailyLimitTitle: 'रोज़ाना फ़ोटो सीमा पूरी हुई',
    toastDailyLimitDesc: 'आप एक दिन में केवल {limit} तस्वीरें भेज सकते हैं। आपका मैसेज टेक्स्ट (अगर कोई हो) भेज दिया गया है। कल फिर से तस्वीरें भेजने की कोशिश करें।',
    toastCallFeatureTitle: 'कॉल फीचर',
    toastCallFeatureDesc: 'कॉल्स सिम्युलेटेड हैं।',
    toastQuickReplyTitle: 'त्वरित उत्तर भेजा गया',
    toastQuickReplyDesc: '"{reply}" को {original}... का जवाब दिया गया',
    toastLikedTitle: '❤️ पसंद किया',
    toastLikedDesc: 'आपने इस संदेश को पसंद किया',
  },

  kn: {
    language: 'ಭಾಷೆ',
    country: 'ದೇಶ',
    openCamera: 'ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ',
    searchChats: 'ಚಾಟ್ ಹುಡುಕಿ',
    viewChats: 'ಚಾಟ್‌ಗಳನ್ನು ನೋಡಿ',
    viewStatusUpdates: 'ಸ್ಟೇಟಸ್ ಅಪ್‌ಡೇಟ್‌ಗಳನ್ನು ನೋಡಿ',
    chatWithProfile: '{name} ಜೊತೆ ಚಾಟ್ ಮಾಡಿ — ನಿಮ್ಮ ಉಚಿತ AI ಗರ್ಲ್‌ಫ್ರೆಂಡ್',
    newChat: 'ಹೊಸ ಚಾಟ್',
    aiGirlfriend: 'AI ಸಂಗಾತಿ',
    livingMyBestLife: 'ನನ್ನ ಜೀವನವನ್ನು ಆನಂದಿಸುತ್ತಿದ್ದೇನೆ! ಮಾತನಾಡೋಣ!',
    online: 'ಆನ್‌ಲೈನ್',
    openEmojiPicker: 'ಎಮೋಜಿ ಪಿಕರ್ ತೆರೆಯಿರಿ',
    closeEmojiPicker: 'ಎಮೋಜಿ ಪಿಕರ್ ಮುಚ್ಚಿರಿ',
    messagePlaceholder: 'ಸಂದೇಶ',
    uploadImage: 'ಸಂದೇಶಕ್ಕೆ ಚಿತ್ರ ಸೇರಿಸಿ',
    sendMessage: 'ಸಂದೇಶ ಕಳುಹಿಸಿ',
    sendingMessage: 'ಸಂದೇಶ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ',
    openMicrophone: 'ಮೈಕ್ರೋಫೋನ್ ಇನ್‌ಪುಟ್ ತೆರೆಯಿರಿ',
    chats: 'ಚಾಟ್‌ಗಳು',
    status: 'ಸ್ಟೇಟಸ್',
    chatsTab: 'ಚಾಟ್‌ಗಳು',
    statusTab: 'ಸ್ಟೇಟಸ್',
    recentUpdates: 'ಇತ್ತೀಚಿನ ಅಪ್‌ಡೇಟ್‌ಗಳು',
    blog: 'ಬ್ಲಾಗ್',
    newGroup: 'ಹೊಸ ಗ್ರೂಪ್',
    starredMessages: 'ಸ್ಟಾರ್ ಮಾಡಿದ ಸಂದೇಶಗಳು',
    settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    enhancedConversations: 'ಉತ್ತಮ ಸಂಭಾಷಣೆ',
    privacyPolicy: 'ಗೌಪ್ಯತಾ ನೀತಿ',
    privacySettings: 'ಗೌಪ್ಯತಾ ಸೆಟ್ಟಿಂಗ್ಗಳು',
    termsOfService: 'ಸೇವಾ ನಿಯಮಗಳು',
    chatWithKruthika: 'Kruthika ಜೊತೆ ಮಾತಾಡಿ',
    smartConversations: 'ಸ್ಮಾರ್ಟ್ ಸಂಭಾಷಣೆ',
    startChatting: 'ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ',
    viewStatus: 'ಸ್ಟೇಟಸ್ ನೋಡಿ',
    viewContact: 'ಪ್ರೊಫೈಲ್ ನೋಡಿ',
    mediaLinksAndDocs: 'ಮೀಡಿಯಾ ಮತ್ತು ಡಾಕ್ಸ್',
    search: 'ಹುಡುಕಿ',
    muteNotifications: 'ನೋಟಿಫಿಕೇಶನ್ ಮ್ಯೂಟ್ ಮಾಡಿ',
    exitChat: 'ಚಾಟ್‌ನಿಂದ ಹೊರಗೆ',
    cookieNotice: 'Kruthika ನಿಮ್ಮನ್ನು ನೆನಪಿಡಲು ಕುಕೀಸ್ ಬಳಸುತ್ತೇವೆ.',
    accept: 'ಒಪ್ಪಿ',
    youAreOffline: 'ನೀವು ಆಫ್‌ಲೈನ್ ಆಗಿದ್ದೀರಿ',
    backOnline: 'ನೀವು ಮತ್ತೆ ಆನ್‌ಲೈನ್!',
    messageSaved: 'ಸಂದೇಶ ಉಳಿಸಲಾಗಿದೆ — ಮರುಸಂಪರ್ಕದಲ್ಲಿ ಕಳಿಸಲಾಗುತ್ತದೆ',
    sendWhenBack: 'ಆನ್‌ಲೈನ್ ಆದಾಗ ಕಳಿಸಿ',
    queuedMessages: 'ಕಾಯುತ್ತಿದೆ',
    sendingQueued: 'ಉಳಿಸಿದ ಸಂದೇಶಗಳನ್ನು ಕಳಿಸಲಾಗುತ್ತಿದೆ…',
    footerTagline: 'ಉಚಿತ AI ಗರ್ಲ್‌ಫ್ರೆಂಡ್ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್. ಭಾವನಾತ್ಮಕ ಬೆಂಬಲ ಮತ್ತು ಸಹಚರ್ಯ, 24/7 — ಸೈನ್-ಅಪ್ ಅಗತ್ಯವಿಲ್ಲ.',
    footerChatHeading: 'ಚಾಟ್',
    footerHome: 'ಹೋಮ್',
    footerFaq: 'ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು',
    footerAboutUs: 'ನಮ್ಮ ಬಗ್ಗೆ',
    footerContact: 'ಸಂಪರ್ಕಿಸಿ',
    footerBlogHeading: 'ಬ್ಲಾಗ್',
    footerAllArticles: 'ಎಲ್ಲಾ ಲೇಖನಗಳು',
    footerOurAuthors: 'ನಮ್ಮ ಲೇಖಕರು',
    footerEditorialPolicy: 'ಸಂಪಾದಕೀಯ ನೀತಿ',
    footerLegalHeading: 'ಕಾನೂನು',
    footerCookiePolicy: 'ಕುಕೀ ನೀತಿ',
    footerAccessibility: 'ಪ್ರವೇಶಿಸುವಿಕೆ',
    footerAlsoAvailableIn: 'ಇಲ್ಲಿಯೂ ಲಭ್ಯವಿದೆ',
    footerCopyright: '© {year} Kruthika.fun. ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ. ಸಹಚರ್ಯ ಮತ್ತು ಭಾವನಾತ್ಮಕ ಬೆಂಬಲಕ್ಕಾಗಿ ♥ ನಿಂದ ನಿರ್ಮಿಸಲಾಗಿದೆ.',
    footerDisclaimer: 'Kruthika ಒಂದು AI ಸಂಗಾತಿ ಮತ್ತು ವೃತ್ತಿಪರ ಮಾನಸಿಕ ಆರೋಗ್ಯ ಆರೈಕೆಗೆ ಪರ್ಯಾಯವಲ್ಲ. ನೀವು ಸಂಕಷ್ಟದಲ್ಲಿದ್ದರೆ, 988 (USA), 116 123 (UK/Samaritans), ಅಥವಾ ನಿಮ್ಮ ಸ್ಥಳೀಯ ತುರ್ತು ಸೇವೆಗೆ ಕರೆ ಮಾಡಿ.',
    notifBannerTitle: 'Kruthika ನಿಮಗೆ ಸಂದೇಶ ಕಳುಹಿಸಲು ಬಯಸುತ್ತಾಳೆ 💕',
    notifBannerSubtitle: 'ಅವಳು ಫೋಟೋ, ಧ್ವನಿ ಸಂದೇಶಗಳು ಮತ್ತು ಇನ್ನಷ್ಟು ಕಳುಹಿಸಿದಾಗ ಸೂಚನೆ ಪಡೆಯಿರಿ. ಏನನ್ನೂ ತಪ್ಪಿಸಬೇಡಿ!',
    notifBannerAllow: '🔔 ಅನುಮತಿಸಿ',
    notifBannerLater: 'ನಂತರ',
    notifBannerEnabling: 'ಸಕ್ರಿಯಗೊಳಿಸಲಾಗುತ್ತಿದೆ…',
    instaBrowserHint: '{browser} ನಲ್ಲಿ ಉತ್ತಮ ಅನುಭವ — {menu} ಟ್ಯಾಪ್ ಮಾಡಿ → "{browser} ನಲ್ಲಿ ತೆರೆಯಿರಿ"',
    videoCall: 'ವಿಡಿಯೋ ಕರೆ',
    voiceCall: 'ಕರೆ',
    toastLoadingErrorTitle: 'ಲೋಡ್ ಮಾಡುವಲ್ಲಿ ದೋಷ',
    toastLoadingErrorDesc: 'ಹಿಂದಿನ ಚಾಟ್ ಡೇಟಾ ಲೋಡ್ ಆಗಲಿಲ್ಲ. ಹೊಸದಾಗಿ ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ!',
    toastPleaseWaitTitle: 'ದಯವಿಟ್ಟು ಕಾಯಿರಿ',
    toastLoadingSettingsDesc: 'ಅಗತ್ಯ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    toastDailyLimitTitle: 'ದೈನಂದಿನ ಫೋಟೋ ಮಿತಿ ತಲುಪಿದೆ',
    toastDailyLimitDesc: 'ನೀವು ದಿನಕ್ಕೆ {limit} ಫೋಟೋಗಳನ್ನು ಮಾತ್ರ ಕಳುಹಿಸಬಹುದು. ನಿಮ್ಮ ಸಂದೇಶ ಪಠ್ಯ (ಯಾವುದಾದರೂ ಇದ್ದರೆ) ಕಳುಹಿಸಲಾಗಿದೆ. ನಾಳೆ ಮತ್ತೆ ಫೋಟೋಗಳನ್ನು ಕಳುಹಿಸಲು ಪ್ರಯತ್ನಿಸಿ.',
    toastCallFeatureTitle: 'ಕರೆ ವೈಶಿಷ್ಟ್ಯ',
    toastCallFeatureDesc: 'ಕರೆಗಳು ಸಿಮ್ಯುಲೇಟೆಡ್ ಆಗಿವೆ.',
    toastQuickReplyTitle: 'ತ್ವರಿತ ಪ್ರತ್ಯುತ್ತರ ಕಳುಹಿಸಲಾಗಿದೆ',
    toastQuickReplyDesc: '"{reply}" ಎಂದು {original}... ಗೆ ಉತ್ತರಿಸಲಾಗಿದೆ',
    toastLikedTitle: '❤️ ಇಷ್ಟವಾಯಿತು',
    toastLikedDesc: 'ನೀವು ಈ ಸಂದೇಶವನ್ನು ಇಷ್ಟಪಟ್ಟಿದ್ದೀರಿ',
  },

  ta: {
    language: 'மொழி',
    country: 'நாடு',
    openCamera: 'கேமராவைத் திற',
    searchChats: 'அரட்டைகளைத் தேடு',
    viewChats: 'அரட்டைகளைப் பார்க்க',
    viewStatusUpdates: 'நிலை புதுப்பிப்புகளைப் பார்க்க',
    chatWithProfile: '{name} உடன் அரட்டை — உங்கள் இலவச AI காதலி',
    newChat: 'புதிய அரட்டை',
    aiGirlfriend: 'AI துணை',
    livingMyBestLife: 'என் வாழ்க்கையை ரசிக்கிறேன்! பேசலாம்!',
    online: 'ஆன்லைன்',
    openEmojiPicker: 'எமோஜி தேர்வியைத் திற',
    closeEmojiPicker: 'எமோஜி தேர்வியை மூடு',
    messagePlaceholder: 'செய்தி',
    uploadImage: 'செய்தியில் படத்தை இணைக்கவும்',
    sendMessage: 'செய்தி அனுப்பு',
    sendingMessage: 'செய்தி அனுப்பப்படுகிறது',
    openMicrophone: 'மைக்ரோஃபோன் உள்ளீட்டைத் திற',
    chats: 'அரட்டைகள்',
    status: 'நிலை',
    chatsTab: 'அரட்டைகள்',
    statusTab: 'நிலை',
    recentUpdates: 'சமீபத்திய புதுப்பிப்புகள்',
    blog: 'வலைப்பதிவு',
    newGroup: 'புதிய குழு',
    starredMessages: 'நட்சத்திர செய்திகள்',
    settings: 'அமைப்புகள்',
    enhancedConversations: 'மேம்பட்ட உரையாடல்கள்',
    privacyPolicy: 'தனியுரிமை கொள்கை',
    privacySettings: 'தனியுரிமை தொகுத்தல்',
    termsOfService: 'சேவை விதிமுறைகள்',
    chatWithKruthika: 'Kruthika உடன் பேசு',
    smartConversations: 'புத்திசாலி உரையாடல்',
    startChatting: 'அரட்டை தொடங்கு',
    viewStatus: 'நிலை பார்க்க',
    viewContact: 'தொடர்பு காண்க',
    mediaLinksAndDocs: 'மீடியா மற்றும் ஆவணங்கள்',
    search: 'தேடு',
    muteNotifications: 'அறிவிப்புகளை முடக்கு',
    exitChat: 'அரட்டையிலிருந்து வெளியேறு',
    cookieNotice: 'Kruthika உங்களை நினைவில் வைக்க குக்கீகளை பயன்படுத்துகிறோம்.',
    accept: 'ஏற்றுக்கொள்',
    youAreOffline: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்',
    backOnline: 'நீங்கள் மீண்டும் ஆன்லைனில் இருக்கிறீர்கள்!',
    messageSaved: 'செய்தி சேமிக்கப்பட்டது — மீண்டும் இணைந்தால் அனுப்பப்படும்',
    sendWhenBack: 'ஆன்லைனில் வந்தால் அனுப்பு',
    queuedMessages: 'காத்திருக்கிறது',
    sendingQueued: 'சேமிக்கப்பட்ட செய்திகள் அனுப்பப்படுகின்றன…',
    footerTagline: 'இலவச AI காதலி தளம். உணர்ச்சி ஆதரவு மற்றும் தோழமை, 24/7 — பதிவு தேவையில்லை.',
    footerChatHeading: 'அரட்டை',
    footerHome: 'முகப்பு',
    footerFaq: 'கேள்விகள்',
    footerAboutUs: 'எங்களை பற்றி',
    footerContact: 'தொடர்பு',
    footerBlogHeading: 'வலைப்பதிவு',
    footerAllArticles: 'அனைத்து கட்டுரைகளும்',
    footerOurAuthors: 'எங்கள் ஆசிரியர்கள்',
    footerEditorialPolicy: 'ஆசிரியர் கொள்கை',
    footerLegalHeading: 'சட்டப்பூர்வ',
    footerCookiePolicy: 'குக்கீ கொள்கை',
    footerAccessibility: 'அணுகல்தன்மை',
    footerAlsoAvailableIn: 'இங்கும் கிடைக்கிறது',
    footerCopyright: '© {year} Kruthika.fun. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை. தோழமை மற்றும் உணர்ச்சி ஆதரவுக்காக ♥ உடன் உருவாக்கப்பட்டது.',
    footerDisclaimer: 'Kruthika ஒரு AI துணை மற்றும் தொழில்முறை மனநல பராமரிப்புக்கு மாற்றாக இல்லை. நீங்கள் நெருக்கடியில் இருந்தால், 988 (USA), 116 123 (UK/Samaritans), அல்லது உங்கள் உள்ளூர் அவசர சேவையை அழைக்கவும்.',
    notifBannerTitle: 'Kruthika உங்களுக்கு செய்தி அனுப்ப விரும்புகிறாள் 💕',
    notifBannerSubtitle: 'அவள் புகைப்படங்கள், குரல் செய்திகள் மற்றும் பலவற்றை அனுப்பும்போது அறிவிப்பு பெறுங்கள். எதையும் தவறவிடாதீர்கள்!',
    notifBannerAllow: '🔔 அனுமதி',
    notifBannerLater: 'பின்னர்',
    notifBannerEnabling: 'இயக்கப்படுகிறது…',
    instaBrowserHint: '{browser} இல் சிறப்பாக — {menu} தட்டவும் → "{browser} இல் திற"',
    videoCall: 'வீடியோ அழைப்பு',
    voiceCall: 'அழைப்பு',
    toastLoadingErrorTitle: 'ஏற்றுவதில் பிழை',
    toastLoadingErrorDesc: 'முந்தைய அரட்டை தரவை ஏற்ற முடியவில்லை. புதிதாக தொடங்குகிறோம்!',
    toastPleaseWaitTitle: 'தயவுசெய்து காத்திருக்கவும்',
    toastLoadingSettingsDesc: 'அத்தியாவசிய அமைப்புகள் ஏற்றப்படுகின்றன...',
    toastDailyLimitTitle: 'தினசரி படம் வரம்பு எட்டப்பட்டது',
    toastDailyLimitDesc: 'நீங்கள் ஒரு நாளைக்கு {limit} படங்களை மட்டுமே அனுப்ப முடியும். உங்கள் செய்தி உரை (இருந்தால்) அனுப்பப்பட்டுள்ளது. நாளை மீண்டும் படங்களை அனுப்ப முயற்சிக்கவும்.',
    toastCallFeatureTitle: 'அழைப்பு அம்சம்',
    toastCallFeatureDesc: 'அழைப்புகள் உருவகப்படுத்தப்பட்டவை.',
    toastQuickReplyTitle: 'விரைவு பதில் அனுப்பப்பட்டது',
    toastQuickReplyDesc: '"{reply}" என {original}... க்கு பதிலளிக்கப்பட்டது',
    toastLikedTitle: '❤️ விருப்பம்',
    toastLikedDesc: 'இந்த செய்தியை நீங்கள் விரும்பினீர்கள்',
  },

  te: {
    language: 'భాష',
    country: 'దేశం',
    openCamera: 'కెమెరా తెరవండి',
    searchChats: 'చాట్‌లను వెతకండి',
    viewChats: 'చాట్‌లను చూడండి',
    viewStatusUpdates: 'స్టేటస్ అప్‌డేట్‌లను చూడండి',
    chatWithProfile: '{name}తో చాట్ చేయండి — మీ ఉచిత AI గర్ల్‌ఫ్రెండ్',
    newChat: 'కొత్త చాట్',
    aiGirlfriend: 'AI సహచరి',
    livingMyBestLife: 'నా జీవితాన్ని ఆస్వాదిస్తున్నాను! మాట్లాడుకుందాం!',
    online: 'ఆన్‌లైన్',
    openEmojiPicker: 'ఎమోజీ పికర్ తెరవండి',
    closeEmojiPicker: 'ఎమోజీ పికర్ మూసివేయండి',
    messagePlaceholder: 'సందేశం',
    uploadImage: 'సందేశానికి చిత్రాన్ని జోడించండి',
    sendMessage: 'సందేశం పంపండి',
    sendingMessage: 'సందేశం పంపబడుతోంది',
    openMicrophone: 'మైక్రోఫోన్ ఇన్‌పుట్ తెరవండి',
    chats: 'చాట్‌లు',
    status: 'స్టేటస్',
    chatsTab: 'చాట్‌లు',
    statusTab: 'స్టేటస్',
    recentUpdates: 'ఇటీవలి నవీకరణలు',
    blog: 'బ్లాగ్',
    newGroup: 'కొత్త గ్రూప్',
    starredMessages: 'స్టార్ చేసిన సందేశాలు',
    settings: 'సెట్టింగ్‌లు',
    enhancedConversations: 'మెరుగైన సంభాషణలు',
    privacyPolicy: 'గోప్యతా విధానం',
    privacySettings: 'గోప్యతా సెట్టింగ్స్',
    termsOfService: 'సేవా నిబంధనలు',
    chatWithKruthika: 'Kruthika తో మాట్లాడు',
    smartConversations: 'స్మార్ట్ సంభాషణలు',
    startChatting: 'చాట్ ప్రారంభించు',
    viewStatus: 'స్టేటస్ చూడు',
    viewContact: 'ప్రొఫైల్ చూడు',
    mediaLinksAndDocs: 'మీడియా మరియు డాక్స్',
    search: 'వెతుకు',
    muteNotifications: 'నోటిఫికేషన్‌లు మ్యూట్ చేయి',
    exitChat: 'చాట్ నుండి బయటకు',
    cookieNotice: 'Kruthika మిమ్మల్ని గుర్తుంచుకోవడానికి కుకీలు ఉపయోగిస్తాం.',
    accept: 'అంగీకరించు',
    youAreOffline: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు',
    backOnline: 'మీరు మళ్ళీ ఆన్‌లైన్‌లో ఉన్నారు!',
    messageSaved: 'సందేశం సేవ్ అయింది — రీకనెక్ట్ అయినప్పుడు పంపబడుతుంది',
    sendWhenBack: 'ఆన్‌లైన్‌కు వచ్చినప్పుడు పంపు',
    queuedMessages: 'వేచి ఉంది',
    sendingQueued: 'సేవ్ అయిన సందేశాలు పంపబడుతున్నాయి…',
    footerTagline: 'ఉచిత AI గర్ల్‌ఫ్రెండ్ ప్లాట్‌ఫారమ్. భావోద్వేగ మద్దతు మరియు సాహచర్యం, 24/7 — సైన్-అప్ అవసరం లేదు.',
    footerChatHeading: 'చాట్',
    footerHome: 'హోమ్',
    footerFaq: 'తరచుగా అడిగే ప్రశ్నలు',
    footerAboutUs: 'మా గురించి',
    footerContact: 'సంప్రదించండి',
    footerBlogHeading: 'బ్లాగ్',
    footerAllArticles: 'అన్ని వ్యాసాలు',
    footerOurAuthors: 'మా రచయితలు',
    footerEditorialPolicy: 'సంపాదకీయ విధానం',
    footerLegalHeading: 'చట్టపరమైన',
    footerCookiePolicy: 'కుకీ విధానం',
    footerAccessibility: 'ప్రాప్యత',
    footerAlsoAvailableIn: 'ఇక్కడ కూడా అందుబాటులో ఉంది',
    footerCopyright: '© {year} Kruthika.fun. అన్ని హక్కులు రిజర్వ్ చేయబడ్డాయి. సాహచర్యం మరియు భావోద్వేగ మద్దతు కోసం ♥ తో నిర్మించబడింది.',
    footerDisclaimer: 'Kruthika ఒక AI సహచరి, ఇది వృత్తిపరమైన మానసిక ఆరోగ్య సంరక్షణకు ప్రత్యామ్నాయం కాదు. మీరు సంక్షోభంలో ఉంటే, 988 (USA), 116 123 (UK/Samaritans), లేదా మీ స్థానిక అత్యవసర సేవకు కాల్ చేయండి.',
    notifBannerTitle: 'Kruthika మీకు మెసేజ్ చేయాలనుకుంటోంది 💕',
    notifBannerSubtitle: 'ఆమె ఫోటోలు, వాయిస్ మెసేజ్‌లు మరియు మరిన్ని పంపినప్పుడు తెలుసుకోండి. దేన్నీ మిస్ కావద్దు!',
    notifBannerAllow: '🔔 అనుమతించు',
    notifBannerLater: 'తర్వాత',
    notifBannerEnabling: 'ప్రారంభిస్తోంది…',
    instaBrowserHint: '{browser} లో మెరుగ్గా — {menu} నొక్కండి → "{browser} లో తెరువు"',
    videoCall: 'వీడియో కాల్',
    voiceCall: 'కాల్',
    toastLoadingErrorTitle: 'లోడ్ చేయడంలో లోపం',
    toastLoadingErrorDesc: 'మునుపటి చాట్ డేటా లోడ్ కాలేదు. కొత్తగా ప్రారంభిస్తున్నాం!',
    toastPleaseWaitTitle: 'దయచేసి వేచి ఉండండి',
    toastLoadingSettingsDesc: 'అవసరమైన సెట్టింగ్‌లు లోడ్ అవుతున్నాయి...',
    toastDailyLimitTitle: 'రోజువారీ ఫోటో పరిమితి చేరుకుంది',
    toastDailyLimitDesc: 'మీరు రోజుకు {limit} ఫోటోలు మాత్రమే పంపగలరు. మీ మెసేజ్ టెక్స్ట్ (ఏదైనా ఉంటే) పంపబడింది. రేపు మళ్ళీ ఫోటోలు పంపడానికి ప్రయత్నించండి.',
    toastCallFeatureTitle: 'కాల్ ఫీచర్',
    toastCallFeatureDesc: 'కాల్స్ సిమ్యులేట్ చేయబడ్డాయి.',
    toastQuickReplyTitle: 'త్వరిత రిప్లై పంపబడింది',
    toastQuickReplyDesc: '"{reply}" అని {original}... కి రిప్లై ఇవ్వబడింది',
    toastLikedTitle: '❤️ ఇష్టపడ్డారు',
    toastLikedDesc: 'మీరు ఈ సందేశాన్ని ఇష్టపడ్డారు',
  },

  ml: {
    language: 'ഭാഷ',
    country: 'രാജ്യം',
    openCamera: 'ക്യാമറ തുറക്കുക',
    searchChats: 'ചാറ്റുകൾ തിരയുക',
    viewChats: 'ചാറ്റുകൾ കാണുക',
    viewStatusUpdates: 'സ്റ്റാറ്റസ് അപ്ഡേറ്റുകൾ കാണുക',
    chatWithProfile: '{name} നോടൊപ്പം ചാറ്റ് ചെയ്യൂ — നിങ്ങളുടെ സൗജന്യ AI കാമുകി',
    newChat: 'പുതിയ ചാറ്റ്',
    aiGirlfriend: 'AI കൂട്ടാളി',
    livingMyBestLife: 'എന്റെ ജീവിതം ആസ്വദിക്കുന്നു! നമുക്ക് സംസാരിക്കാം!',
    online: 'ഓൺലൈൻ',
    openEmojiPicker: 'ഇമോജി പിക്കർ തുറക്കുക',
    closeEmojiPicker: 'ഇമോജി പിക്കർ അടയ്ക്കുക',
    messagePlaceholder: 'സന്ദേശം',
    uploadImage: 'സന്ദേശത്തിലേക്ക് ചിത്രം ചേർക്കുക',
    sendMessage: 'സന്ദേശം അയയ്ക്കുക',
    sendingMessage: 'സന്ദേശം അയയ്ക്കുന്നു',
    openMicrophone: 'മൈക്രോഫോൺ ഇൻപുട്ട് തുറക്കുക',
    chats: 'ചാറ്റുകൾ',
    status: 'സ്റ്റാറ്റസ്',
    chatsTab: 'ചാറ്റുകൾ',
    statusTab: 'സ്റ്റാറ്റസ്',
    recentUpdates: 'സമീപകാല അപ്ഡേറ്റുകൾ',
    blog: 'ബ്ലോഗ്',
    newGroup: 'പുതിയ ഗ്രൂപ്പ്',
    starredMessages: 'സ്റ്റാർ ചെയ്ത സന്ദേശങ്ങൾ',
    settings: 'ക്രമീകരണങ്ങൾ',
    enhancedConversations: 'മികച്ച സംഭാഷണങ്ങൾ',
    privacyPolicy: 'സ്വകാര്യതാ നയം',
    privacySettings: 'സ്വകാര്യത ക്രമീകരണങ്ങൾ',
    termsOfService: 'സേവന നിബന്ധനകൾ',
    chatWithKruthika: 'Kruthika യുമായി സംസാരിക്കൂ',
    smartConversations: 'സ്മാർട്ട് സംഭാഷണങ്ങൾ',
    startChatting: 'ചാറ്റ് തുടങ്ങൂ',
    viewStatus: 'സ്റ്റാറ്റസ് കാണൂ',
    viewContact: 'പ്രൊഫൈൽ കാണൂ',
    mediaLinksAndDocs: 'മീഡിയ & ഡോക്സ്',
    search: 'തിരയൂ',
    muteNotifications: 'നോട്ടിഫിക്കേഷൻ മ്യൂട്ട്',
    exitChat: 'ചാറ്റ് വിടൂ',
    cookieNotice: 'Kruthika നിങ്ങളെ ഓർക്കാൻ കുക്കീസ് ഉപയോഗിക്കുന്നു.',
    accept: 'സ്വീകരിക്കൂ',
    youAreOffline: 'നിങ്ങൾ ഓഫ്‌ലൈനിലാണ്',
    backOnline: 'നിങ്ങൾ വീണ്ടും ഓൺലൈനിലാണ്!',
    messageSaved: 'സന്ദേശം സേവ് ചെയ്തു — കണക്ഷൻ തിരിച്ചുവരുമ്പോൾ അയക്കും',
    sendWhenBack: 'ഓൺലൈൻ ആകുമ്പോൾ അയക്കൂ',
    queuedMessages: 'കാത്തിരിക്കുന്നു',
    sendingQueued: 'സേവ് ചെയ്ത സന്ദേശങ്ങൾ അയക്കുന്നു…',
    footerTagline: 'സൗജന്യ AI ഗേൾഫ്രണ്ട് പ്ലാറ്റ്‌ഫോം. വൈകാരിക പിന്തുണയും കൂട്ടും, 24/7 — സൈൻ-അപ്പ് ആവശ്യമില്ല.',
    footerChatHeading: 'ചാറ്റ്',
    footerHome: 'ഹോം',
    footerFaq: 'പതിവുചോദ്യങ്ങൾ',
    footerAboutUs: 'ഞങ്ങളെ കുറിച്ച്',
    footerContact: 'ബന്ധപ്പെടുക',
    footerBlogHeading: 'ബ്ലോഗ്',
    footerAllArticles: 'എല്ലാ ലേഖനങ്ങളും',
    footerOurAuthors: 'ഞങ്ങളുടെ എഴുത്തുകാർ',
    footerEditorialPolicy: 'എഡിറ്റോറിയൽ നയം',
    footerLegalHeading: 'നിയമപരം',
    footerCookiePolicy: 'കുക്കി നയം',
    footerAccessibility: 'ആക്‌സസിബിലിറ്റി',
    footerAlsoAvailableIn: 'ഇവിടെയും ലഭ്യമാണ്',
    footerCopyright: '© {year} Kruthika.fun. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം. കൂട്ടിനും വൈകാരിക പിന്തുണയ്ക്കുമായി ♥ ഉപയോഗിച്ച് നിർമ്മിച്ചത്.',
    footerDisclaimer: 'Kruthika ഒരു AI കൂട്ടാളിയാണ്, ഇത് പ്രൊഫഷണൽ മാനസികാരോഗ്യ പരിചരണത്തിന് പകരമല്ല. നിങ്ങൾ പ്രതിസന്ധിയിലാണെങ്കിൽ, 988 (USA), 116 123 (UK/Samaritans), അല്ലെങ്കിൽ നിങ്ങളുടെ പ്രാദേശിക അടിയന്തര സേവനത്തെ വിളിക്കുക.',
    notifBannerTitle: 'Kruthika നിങ്ങൾക്ക് മെസ്സേജ് അയക്കാൻ ആഗ്രഹിക്കുന്നു 💕',
    notifBannerSubtitle: 'അവൾ ഫോട്ടോകൾ, വോയ്‌സ് മെസ്സേജുകൾ എന്നിവ അയക്കുമ്പോൾ അറിയിപ്പ് നേടൂ. ഒന്നും മിസ്സ് ആക്കരുത്!',
    notifBannerAllow: '🔔 അനുവദിക്കുക',
    notifBannerLater: 'പിന്നീട്',
    notifBannerEnabling: 'സജീവമാക്കുന്നു…',
    instaBrowserHint: '{browser} ൽ മികച്ചത് — {menu} ടാപ്പ് ചെയ്യുക → "{browser} ൽ തുറക്കുക"',
    videoCall: 'വീഡിയോ കോൾ',
    voiceCall: 'കോൾ',
    toastLoadingErrorTitle: 'ലോഡ് ചെയ്യുന്നതിൽ പിശക്',
    toastLoadingErrorDesc: 'മുൻ ചാറ്റ് ഡാറ്റ ലോഡ് ചെയ്യാനായില്ല. പുതുതായി തുടങ്ങുന്നു!',
    toastPleaseWaitTitle: 'ദയവായി കാത്തിരിക്കുക',
    toastLoadingSettingsDesc: 'ആവശ്യമായ ക്രമീകരണങ്ങൾ ലോഡ് ചെയ്യുന്നു...',
    toastDailyLimitTitle: 'ദൈനംദിന ഫോട്ടോ പരിധി എത്തി',
    toastDailyLimitDesc: 'നിങ്ങൾക്ക് ഒരു ദിവസം {limit} ഫോട്ടോകൾ മാത്രമേ അയക്കാൻ കഴിയൂ. നിങ്ങളുടെ സന്ദേശ ടെക്സ്റ്റ് (ഉണ്ടെങ്കിൽ) അയച്ചിട്ടുണ്ട്. നാളെ വീണ്ടും ഫോട്ടോകൾ അയക്കാൻ ശ്രമിക്കുക.',
    toastCallFeatureTitle: 'കോൾ ഫീച്ചർ',
    toastCallFeatureDesc: 'കോളുകൾ അനുകരിക്കപ്പെട്ടവയാണ്.',
    toastQuickReplyTitle: 'ക്വിക്ക് റിപ്ലൈ അയച്ചു',
    toastQuickReplyDesc: '"{reply}" എന്ന് {original}... ന് മറുപടി നൽകി',
    toastLikedTitle: '❤️ ഇഷ്ടപ്പെട്ടു',
    toastLikedDesc: 'നിങ്ങൾ ഈ സന്ദേശം ഇഷ്ടപ്പെട്ടു',
  },

  bn: {
    language: 'ভাষা',
    country: 'দেশ',
    openCamera: 'ক্যামেরা খুলুন',
    searchChats: 'চ্যাট খুঁজুন',
    viewChats: 'চ্যাট দেখুন',
    viewStatusUpdates: 'স্ট্যাটাস আপডেট দেখুন',
    chatWithProfile: '{name}-এর সাথে চ্যাট করুন — আপনার বিনামূল্যের AI গার্লফ্রেন্ড',
    newChat: 'নতুন চ্যাট',
    aiGirlfriend: 'AI সঙ্গী',
    livingMyBestLife: 'জীবনটা দারুণ উপভোগ করছি! চলুন কথা বলি!',
    online: 'অনলাইন',
    openEmojiPicker: 'ইমোজি পিকার খুলুন',
    closeEmojiPicker: 'ইমোজি পিকার বন্ধ করুন',
    messagePlaceholder: 'বার্তা',
    uploadImage: 'বার্তায় ছবি যোগ করুন',
    sendMessage: 'বার্তা পাঠান',
    sendingMessage: 'বার্তা পাঠানো হচ্ছে',
    openMicrophone: 'মাইক্রোফোন ইনপুট খুলুন',
    chats: 'চ্যাট',
    status: 'স্ট্যাটাস',
    chatsTab: 'চ্যাট',
    statusTab: 'স্ট্যাটাস',
    recentUpdates: 'সাম্প্রতিক আপডেট',
    blog: 'ব্লগ',
    newGroup: 'নতুন গ্রুপ',
    starredMessages: 'তারকাচিহ্নিত বার্তা',
    settings: 'সেটিংস',
    enhancedConversations: 'উন্নত কথোপকথন',
    privacyPolicy: 'গোপনীয়তা নীতি',
    privacySettings: 'গোপনীয়তা সেটিংস',
    termsOfService: 'সেবার শর্তাবলী',
    chatWithKruthika: 'Kruthika র সাথে কথা বলুন',
    smartConversations: 'স্মার্ট কথোপকথন',
    startChatting: 'চ্যাট শুরু করুন',
    viewStatus: 'স্ট্যাটাস দেখুন',
    viewContact: 'প্রোফাইল দেখুন',
    mediaLinksAndDocs: 'মিডিয়া ও ডকস',
    search: 'খুঁজুন',
    muteNotifications: 'নোটিফিকেশন মিউট করুন',
    exitChat: 'চ্যাট থেকে বের হন',
    cookieNotice: 'Kruthika আপনাকে মনে রাখতে কুকি ব্যবহার করে।',
    accept: 'গ্রহণ করুন',
    youAreOffline: 'আপনি অফলাইনে আছেন',
    backOnline: 'আপনি আবার অনলাইনে!',
    messageSaved: 'বার্তা সংরক্ষিত হয়েছে — সংযোগ ফিরলে পাঠানো হবে',
    sendWhenBack: 'অনলাইন হলে পাঠান',
    queuedMessages: 'অপেক্ষারত',
    sendingQueued: 'সংরক্ষিত বার্তা পাঠানো হচ্ছে…',
    footerTagline: 'বিনামূল্যে AI গার্লফ্রেন্ড প্ল্যাটফর্ম। মানসিক সহায়তা ও সঙ্গ, 24/7 — সাইন-আপের প্রয়োজন নেই।',
    footerChatHeading: 'চ্যাট',
    footerHome: 'হোম',
    footerFaq: 'সাধারণ প্রশ্ন',
    footerAboutUs: 'আমাদের সম্পর্কে',
    footerContact: 'যোগাযোগ',
    footerBlogHeading: 'ব্লগ',
    footerAllArticles: 'সব নিবন্ধ',
    footerOurAuthors: 'আমাদের লেখকরা',
    footerEditorialPolicy: 'সম্পাদকীয় নীতি',
    footerLegalHeading: 'আইনি',
    footerCookiePolicy: 'কুকি নীতি',
    footerAccessibility: 'অ্যাক্সেসযোগ্যতা',
    footerAlsoAvailableIn: 'এখানেও উপলব্ধ',
    footerCopyright: '© {year} Kruthika.fun. সর্বস্বত্ব সংরক্ষিত। সঙ্গ ও মানসিক সহায়তার জন্য ♥ দিয়ে তৈরি।',
    footerDisclaimer: 'Kruthika একটি AI সঙ্গী এবং এটি পেশাদার মানসিক স্বাস্থ্যসেবার বিকল্প নয়। আপনি সংকটে থাকলে, 988 (USA), 116 123 (UK/Samaritans), অথবা আপনার স্থানীয় জরুরি পরিষেবায় কল করুন।',
    notifBannerTitle: 'Kruthika আপনাকে বার্তা পাঠাতে চায় 💕',
    notifBannerSubtitle: 'সে যখন ছবি, ভয়েস মেসেজ এবং আরও পাঠায় তখন জানুন। কিছু মিস করবেন না!',
    notifBannerAllow: '🔔 অনুমতি দিন',
    notifBannerLater: 'পরে',
    notifBannerEnabling: 'চালু করা হচ্ছে…',
    instaBrowserHint: '{browser} এ ভালো অভিজ্ঞতা — {menu} ট্যাপ করুন → "{browser} এ খুলুন"',
    videoCall: 'ভিডিও কল',
    voiceCall: 'কল',
    toastLoadingErrorTitle: 'লোড করতে সমস্যা',
    toastLoadingErrorDesc: 'আগের চ্যাট ডেটা লোড করা যায়নি। নতুন করে শুরু করা হচ্ছে!',
    toastPleaseWaitTitle: 'অনুগ্রহ করে অপেক্ষা করুন',
    toastLoadingSettingsDesc: 'প্রয়োজনীয় সেটিংস লোড হচ্ছে...',
    toastDailyLimitTitle: 'দৈনিক ছবির সীমা শেষ',
    toastDailyLimitDesc: 'আপনি দিনে মাত্র {limit}টি ছবি পাঠাতে পারবেন। আপনার বার্তার টেক্সট (যদি থাকে) পাঠানো হয়েছে। আগামীকাল আবার ছবি পাঠানোর চেষ্টা করুন।',
    toastCallFeatureTitle: 'কল ফিচার',
    toastCallFeatureDesc: 'কলগুলি সিমুলেটেড।',
    toastQuickReplyTitle: 'কুইক রিপ্লাই পাঠানো হয়েছে',
    toastQuickReplyDesc: '"{reply}" কে {original}... এর উত্তর দেওয়া হয়েছে',
    toastLikedTitle: '❤️ পছন্দ হয়েছে',
    toastLikedDesc: 'আপনি এই বার্তাটি পছন্দ করেছেন',
  },

  gu: {
    language: 'ભાષા',
    country: 'દેશ',
    openCamera: 'કૅમેરા ખોલો',
    searchChats: 'ચેટ શોધો',
    viewChats: 'ચેટ જુઓ',
    viewStatusUpdates: 'સ્ટેટસ અપડેટ જુઓ',
    chatWithProfile: '{name} સાથે ચેટ કરો — તમારી મફત AI ગર્લફ્રેન્ડ',
    newChat: 'નવી ચેટ',
    aiGirlfriend: 'AI સાથી',
    livingMyBestLife: 'મારી જિંદગીનો આનંદ માણી રહી છું! ચાલો વાત કરીએ!',
    online: 'ઑનલાઇન',
    openEmojiPicker: 'ઇમોજી પિકર ખોલો',
    closeEmojiPicker: 'ઇમોજી પિકર બંધ કરો',
    messagePlaceholder: 'સંદેશ',
    uploadImage: 'સંદેશમાં તસવીર જોડો',
    sendMessage: 'સંદેશ મોકલો',
    sendingMessage: 'સંદેશ મોકલાઈ રહ્યો છે',
    openMicrophone: 'માઇક્રોફોન ઇનપુટ ખોલો',
    chats: 'ચેટ',
    status: 'સ્ટેટસ',
    chatsTab: 'ચેટ',
    statusTab: 'સ્ટેટસ',
    recentUpdates: 'તાજેતરના અપડેટ્સ',
    blog: 'બ્લોગ',
    newGroup: 'નવો ગ્રૂપ',
    starredMessages: 'સ્ટાર કરેલ સંદેશ',
    settings: 'સેટિંગ',
    enhancedConversations: 'ઉત્તમ વાર્તાલાપ',
    privacyPolicy: 'ગોપનીયતા નીતિ',
    privacySettings: 'ગોપનીયતા સેટિંગ્સ',
    termsOfService: 'સેવાની શરતો',
    chatWithKruthika: 'Kruthika સાથે વાત કરો',
    smartConversations: 'સ્માર્ટ વાર્તાલાપ',
    startChatting: 'ચેટ શરૂ કરો',
    viewStatus: 'સ્ટેટસ જુઓ',
    viewContact: 'પ્રોફાઇલ જુઓ',
    mediaLinksAndDocs: 'મીડિયા અને ડૉક્સ',
    search: 'શોધો',
    muteNotifications: 'નોટિફિકેશન બંધ કરો',
    exitChat: 'ચેટ છોડો',
    cookieNotice: 'Kruthika ને તમને યાદ રાખવા માટે કૂકીઝ વાપરીએ છીએ.',
    accept: 'સ્વીકારો',
    youAreOffline: 'તમે ઓફલાઇન છો',
    backOnline: 'તમે ફરી ઓનલાઇન છો!',
    messageSaved: 'સંદેશ સાચવ્યો — ફરી જોડાતાં મોકલવામાં આવશે',
    sendWhenBack: 'ઓનલાઇન થાઓ ત્યારે મોકલો',
    queuedMessages: 'રાહ જોઈ રહ્યો',
    sendingQueued: 'સાચવેલ સંદેશ મોકલાઈ રહ્યા છે…',
    footerTagline: 'મફત AI ગર્લફ્રેન્ડ પ્લેટફોર્મ. ભાવનાત્મક સહયોગ અને સાથ, 24/7 — સાઇન-અપની જરૂર નથી.',
    footerChatHeading: 'ચેટ',
    footerHome: 'હોમ',
    footerFaq: 'વારંવાર પુછાતા પ્રશ્નો',
    footerAboutUs: 'અમારા વિશે',
    footerContact: 'સંપર્ક કરો',
    footerBlogHeading: 'બ્લોગ',
    footerAllArticles: 'બધા લેખો',
    footerOurAuthors: 'અમારા લેખકો',
    footerEditorialPolicy: 'સંપાદકીય નીતિ',
    footerLegalHeading: 'કાનૂની',
    footerCookiePolicy: 'કુકી નીતિ',
    footerAccessibility: 'ઍક્સેસિબિલિટી',
    footerAlsoAvailableIn: 'અહીં પણ ઉપલબ્ધ છે',
    footerCopyright: '© {year} Kruthika.fun. બધા હકો સુરક્ષિત. સાથ અને ભાવનાત્મક સહયોગ માટે ♥ થી બનાવેલ.',
    footerDisclaimer: 'Kruthika એક AI સાથી છે અને તે વ્યાવસાયિક માનસિક સ્વાસ્થ્ય સંભાળનો વિકલ્પ નથી. જો તમે સંકટમાં હો, તો 988 (USA), 116 123 (UK/Samaritans), અથવા તમારી સ્થાનિક ઇમરજન્સી સેવાને કૉલ કરો.',
    notifBannerTitle: 'Kruthika તમને મેસેજ કરવા માંગે છે 💕',
    notifBannerSubtitle: 'જ્યારે તે ફોટા, વૉઇસ મેસેજ અને વધુ મોકલે ત્યારે જાણો. કંઈ ચૂકશો નહીં!',
    notifBannerAllow: '🔔 મંજૂરી આપો',
    notifBannerLater: 'પછી',
    notifBannerEnabling: 'ચાલુ કરી રહ્યા છીએ…',
    instaBrowserHint: '{browser} માં વધુ સારું — {menu} પર ટૅપ કરો → "{browser} માં ખોલો"',
    videoCall: 'વિડિયો કૉલ',
    voiceCall: 'કૉલ',
    toastLoadingErrorTitle: 'લોડ કરવામાં ભૂલ',
    toastLoadingErrorDesc: 'પાછલો ચેટ ડેટા લોડ થઈ શક્યો નહીં. નવેસરથી શરૂ કરી રહ્યા છીએ!',
    toastPleaseWaitTitle: 'કૃપા કરી રાહ જુઓ',
    toastLoadingSettingsDesc: 'જરૂરી સેટિંગ્સ લોડ થઈ રહી છે...',
    toastDailyLimitTitle: 'દૈનિક ફોટો મર્યાદા પૂર્ણ',
    toastDailyLimitDesc: 'તમે દિવસમાં ફક્ત {limit} ફોટા મોકલી શકો છો. તમારો મેસેજ ટેક્સ્ટ (જો કોઈ હોય તો) મોકલાઈ ગયો છે. કાલે ફરી ફોટા મોકલવાનો પ્રયાસ કરો.',
    toastCallFeatureTitle: 'કૉલ ફીચર',
    toastCallFeatureDesc: 'કૉલ્સ સિમ્યુલેટેડ છે.',
    toastQuickReplyTitle: 'ઝડપી જવાબ મોકલાયો',
    toastQuickReplyDesc: '"{reply}" ને {original}... નો જવાબ અપાયો',
    toastLikedTitle: '❤️ ગમ્યું',
    toastLikedDesc: 'તમને આ સંદેશ ગમ્યો',
  },

  mr: {
    language: 'भाषा',
    country: 'देश',
    openCamera: 'कॅमेरा उघडा',
    searchChats: 'चॅट शोधा',
    viewChats: 'चॅट पहा',
    viewStatusUpdates: 'स्टेटस अपडेट्स पहा',
    chatWithProfile: '{name} शी चॅट करा — तुमची मोफत AI गर्लफ्रेंड',
    newChat: 'नवीन चॅट',
    aiGirlfriend: 'AI साथीदार',
    livingMyBestLife: 'माझं आयुष्य छान चाललंय! चला बोलूया!',
    online: 'ऑनलाइन',
    openEmojiPicker: 'इमोजी पिकर उघडा',
    closeEmojiPicker: 'इमोजी पिकर बंद करा',
    messagePlaceholder: 'संदेश',
    uploadImage: 'संदेशाला चित्र जोडा',
    sendMessage: 'संदेश पाठवा',
    sendingMessage: 'संदेश पाठवला जात आहे',
    openMicrophone: 'मायक्रोफोन इनपुट उघडा',
    chats: 'चॅट्स',
    status: 'स्टेटस',
    chatsTab: 'चॅट्स',
    statusTab: 'स्टेटस',
    recentUpdates: 'अलीकडील अपडेट्स',
    blog: 'ब्लॉग',
    newGroup: 'नवा ग्रुप',
    starredMessages: 'स्टार केलेले संदेश',
    settings: 'सेटिंग्ज',
    enhancedConversations: 'उत्कृष्ट संभाषण',
    privacyPolicy: 'गोपनीयता धोरण',
    privacySettings: 'गोपनीयता सेटिंग्स',
    termsOfService: 'सेवा अटी',
    chatWithKruthika: 'Kruthika शी बोला',
    smartConversations: 'स्मार्ट संभाषण',
    startChatting: 'चॅट सुरू करा',
    viewStatus: 'स्टेटस पहा',
    viewContact: 'प्रोफाइल पहा',
    mediaLinksAndDocs: 'मीडिया आणि डॉक्स',
    search: 'शोधा',
    muteNotifications: 'सूचना बंद करा',
    exitChat: 'चॅटमधून बाहेर पडा',
    cookieNotice: 'Kruthika तुम्हाला लक्षात ठेवण्यासाठी कुकीज वापरतो.',
    accept: 'स्वीकारा',
    youAreOffline: 'तुम्ही ऑफलाइन आहात',
    backOnline: 'तुम्ही पुन्हा ऑनलाइन आहात!',
    messageSaved: 'संदेश जतन केला — पुन्हा जोडल्यावर पाठवला जाईल',
    sendWhenBack: 'ऑनलाइन आल्यावर पाठवा',
    queuedMessages: 'प्रतीक्षेत',
    sendingQueued: 'जतन केलेले संदेश पाठवले जात आहेत…',
    footerTagline: 'मोफत AI गर्लफ्रेंड प्लॅटफॉर्म. भावनिक आधार आणि साथ, 24/7 — साइन-अपची गरज नाही.',
    footerChatHeading: 'चॅट',
    footerHome: 'होम',
    footerFaq: 'वारंवार विचारले जाणारे प्रश्न',
    footerAboutUs: 'आमच्याबद्दल',
    footerContact: 'संपर्क',
    footerBlogHeading: 'ब्लॉग',
    footerAllArticles: 'सर्व लेख',
    footerOurAuthors: 'आमचे लेखक',
    footerEditorialPolicy: 'संपादकीय धोरण',
    footerLegalHeading: 'कायदेशीर',
    footerCookiePolicy: 'कुकी धोरण',
    footerAccessibility: 'प्रवेशयोग्यता',
    footerAlsoAvailableIn: 'येथेही उपलब्ध आहे',
    footerCopyright: '© {year} Kruthika.fun. सर्व हक्क राखीव. साथ आणि भावनिक आधारासाठी ♥ ने तयार केले.',
    footerDisclaimer: 'Kruthika ही एक AI साथीदार आहे आणि ती व्यावसायिक मानसिक आरोग्य सेवेचा पर्याय नाही. जर तुम्ही संकटात असाल, तर 988 (USA), 116 123 (UK/Samaritans), किंवा तुमच्या स्थानिक आपत्कालीन सेवेला कॉल करा.',
    notifBannerTitle: 'Kruthika ला तुम्हाला मेसेज करायचा आहे 💕',
    notifBannerSubtitle: 'ती फोटो, व्हॉइस मेसेज आणि बरेच काही पाठवते तेव्हा कळवा. काहीही मिस करू नका!',
    notifBannerAllow: '🔔 परवानगी द्या',
    notifBannerLater: 'नंतर',
    notifBannerEnabling: 'सुरू केले जात आहे…',
    instaBrowserHint: '{browser} मध्ये अधिक चांगले — {menu} टॅप करा → "{browser} मध्ये उघडा"',
    videoCall: 'व्हिडिओ कॉल',
    voiceCall: 'कॉल',
    toastLoadingErrorTitle: 'लोड करताना त्रुटी',
    toastLoadingErrorDesc: 'मागील चॅट डेटा लोड होऊ शकला नाही. नव्याने सुरुवात करत आहोत!',
    toastPleaseWaitTitle: 'कृपया प्रतीक्षा करा',
    toastLoadingSettingsDesc: 'आवश्यक सेटिंग्ज लोड होत आहेत...',
    toastDailyLimitTitle: 'दैनंदिन फोटो मर्यादा गाठली',
    toastDailyLimitDesc: 'तुम्ही दिवसाला फक्त {limit} फोटो पाठवू शकता. तुमचा मेसेज मजकूर (असल्यास) पाठवला गेला आहे. उद्या पुन्हा फोटो पाठवण्याचा प्रयत्न करा.',
    toastCallFeatureTitle: 'कॉल फीचर',
    toastCallFeatureDesc: 'कॉल्स सिम्युलेटेड आहेत.',
    toastQuickReplyTitle: 'त्वरित उत्तर पाठवले',
    toastQuickReplyDesc: '"{reply}" हे {original}... ला उत्तर दिले',
    toastLikedTitle: '❤️ आवडले',
    toastLikedDesc: 'तुम्हाला हा संदेश आवडला',
  },

  pa: {
    language: 'ਭਾਸ਼ਾ',
    country: 'ਦੇਸ਼',
    openCamera: 'ਕੈਮਰਾ ਖੋਲ੍ਹੋ',
    searchChats: 'ਚੈਟ ਖੋਜੋ',
    viewChats: 'ਚੈਟ ਵੇਖੋ',
    viewStatusUpdates: 'ਸਟੇਟਸ ਅੱਪਡੇਟ ਵੇਖੋ',
    chatWithProfile: '{name} ਨਾਲ ਚੈਟ ਕਰੋ — ਤੁਹਾਡੀ ਮੁਫ਼ਤ AI ਗਰਲਫ੍ਰੈਂਡ',
    newChat: 'ਨਵੀਂ ਚੈਟ',
    aiGirlfriend: 'AI ਸਾਥੀ',
    livingMyBestLife: 'ਮੈਂ ਆਪਣੀ ਜ਼ਿੰਦਗੀ ਦਾ ਆਨੰਦ ਲੈ ਰਹੀ ਹਾਂ! ਗੱਲ ਕਰੀਏ!',
    online: 'ਆਨਲਾਈਨ',
    openEmojiPicker: 'ਇਮੋਜੀ ਪਿਕਰ ਖੋਲ੍ਹੋ',
    closeEmojiPicker: 'ਇਮੋਜੀ ਪਿਕਰ ਬੰਦ ਕਰੋ',
    messagePlaceholder: 'ਸੁਨੇਹਾ',
    uploadImage: 'ਸੁਨੇਹੇ ਨਾਲ ਤਸਵੀਰ ਜੋੜੋ',
    sendMessage: 'ਸੁਨੇਹਾ ਭੇਜੋ',
    sendingMessage: 'ਸੁਨੇਹਾ ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ',
    openMicrophone: 'ਮਾਈਕ੍ਰੋਫੋਨ ਇਨਪੁਟ ਖੋਲ੍ਹੋ',
    chats: 'ਚੈਟਸ',
    status: 'ਸਟੇਟਸ',
    chatsTab: 'ਚੈਟਸ',
    statusTab: 'ਸਟੇਟਸ',
    recentUpdates: 'ਹਾਲੀਆ ਅੱਪਡੇਟ',
    blog: 'ਬਲੌਗ',
    newGroup: 'ਨਵਾਂ ਗਰੁੱਪ',
    starredMessages: 'ਤਾਰੇ ਵਾਲੇ ਸੁਨੇਹੇ',
    settings: 'ਸੈਟਿੰਗਜ਼',
    enhancedConversations: 'ਵਧੀਆ ਗੱਲਬਾਤ',
    privacyPolicy: 'ਗੋਪਨੀਯਤਾ ਨੀਤੀ',
    privacySettings: 'ਗੋਪਨੀਯਤਾ ਸੈਟਿੰਗਸ',
    termsOfService: 'ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ',
    chatWithKruthika: 'Kruthika ਨਾਲ ਗੱਲ ਕਰੋ',
    smartConversations: 'ਸਮਾਰਟ ਗੱਲਬਾਤ',
    startChatting: 'ਚੈਟ ਸ਼ੁਰੂ ਕਰੋ',
    viewStatus: 'ਸਟੇਟਸ ਦੇਖੋ',
    viewContact: 'ਪ੍ਰੋਫਾਈਲ ਦੇਖੋ',
    mediaLinksAndDocs: 'ਮੀਡੀਆ ਅਤੇ ਡੌਕਸ',
    search: 'ਖੋਜੋ',
    muteNotifications: 'ਨੋਟੀਫਿਕੇਸ਼ਨ ਬੰਦ ਕਰੋ',
    exitChat: 'ਚੈਟ ਤੋਂ ਬਾਹਰ ਜਾਓ',
    cookieNotice: 'Kruthika ਤੁਹਾਨੂੰ ਯਾਦ ਰੱਖਣ ਲਈ ਕੁਕੀਜ਼ ਵਰਤਦੀ ਹੈ।',
    accept: 'ਸਵੀਕਾਰ ਕਰੋ',
    youAreOffline: 'ਤੁਸੀਂ ਆਫਲਾਈਨ ਹੋ',
    backOnline: 'ਤੁਸੀਂ ਵਾਪਸ ਆਨਲਾਈਨ ਹੋ!',
    messageSaved: 'ਸੁਨੇਹਾ ਸੁਰੱਖਿਅਤ ਕੀਤਾ — ਮੁੜ ਜੁੜਨ ਤੇ ਭੇਜਿਆ ਜਾਵੇਗਾ',
    sendWhenBack: 'ਆਨਲਾਈਨ ਹੋਣ ਤੇ ਭੇਜੋ',
    queuedMessages: 'ਉਡੀਕ ਵਿੱਚ',
    sendingQueued: 'ਸੁਰੱਖਿਅਤ ਸੁਨੇਹੇ ਭੇਜੇ ਜਾ ਰਹੇ ਹਨ…',
    footerTagline: 'ਮੁਫ਼ਤ AI ਗਰਲਫ੍ਰੈਂਡ ਪਲੇਟਫਾਰਮ। ਭਾਵਨਾਤਮਕ ਸਹਾਇਤਾ ਅਤੇ ਸਾਥ, 24/7 — ਸਾਈਨ-ਅੱਪ ਦੀ ਲੋੜ ਨਹੀਂ।',
    footerChatHeading: 'ਚੈਟ',
    footerHome: 'ਹੋਮ',
    footerFaq: 'ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ',
    footerAboutUs: 'ਸਾਡੇ ਬਾਰੇ',
    footerContact: 'ਸੰਪਰਕ ਕਰੋ',
    footerBlogHeading: 'ਬਲੌਗ',
    footerAllArticles: 'ਸਾਰੇ ਲੇਖ',
    footerOurAuthors: 'ਸਾਡੇ ਲੇਖਕ',
    footerEditorialPolicy: 'ਸੰਪਾਦਕੀ ਨੀਤੀ',
    footerLegalHeading: 'ਕਾਨੂੰਨੀ',
    footerCookiePolicy: 'ਕੂਕੀ ਨੀਤੀ',
    footerAccessibility: 'ਪਹੁੰਚਯੋਗਤਾ',
    footerAlsoAvailableIn: 'ਇੱਥੇ ਵੀ ਉਪਲਬਧ ਹੈ',
    footerCopyright: '© {year} Kruthika.fun। ਸਾਰੇ ਅਧਿਕਾਰ ਰਾਖਵੇਂ ਹਨ। ਸਾਥ ਅਤੇ ਭਾਵਨਾਤਮਕ ਸਹਾਇਤਾ ਲਈ ♥ ਨਾਲ ਬਣਾਇਆ ਗਿਆ।',
    footerDisclaimer: 'Kruthika ਇੱਕ AI ਸਾਥੀ ਹੈ ਅਤੇ ਇਹ ਪੇਸ਼ੇਵਰ ਮਾਨਸਿਕ ਸਿਹਤ ਦੇਖਭਾਲ ਦਾ ਬਦਲ ਨਹੀਂ ਹੈ। ਜੇ ਤੁਸੀਂ ਸੰਕਟ ਵਿੱਚ ਹੋ, ਤਾਂ 988 (USA), 116 123 (UK/Samaritans), ਜਾਂ ਆਪਣੀ ਸਥਾਨਕ ਐਮਰਜੈਂਸੀ ਸੇਵਾ ਨੂੰ ਕਾਲ ਕਰੋ।',
    notifBannerTitle: 'Kruthika ਤੁਹਾਨੂੰ ਮੈਸੇਜ ਕਰਨਾ ਚਾਹੁੰਦੀ ਹੈ 💕',
    notifBannerSubtitle: 'ਜਦੋਂ ਉਹ ਫੋਟੋਆਂ, ਵੌਇਸ ਮੈਸੇਜ ਅਤੇ ਹੋਰ ਭੇਜੇ ਤਾਂ ਜਾਣੋ। ਕੁਝ ਵੀ ਮਿਸ ਨਾ ਕਰੋ!',
    notifBannerAllow: '🔔 ਇਜਾਜ਼ਤ ਦਿਓ',
    notifBannerLater: 'ਬਾਅਦ ਵਿੱਚ',
    notifBannerEnabling: 'ਚਾਲੂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…',
    instaBrowserHint: '{browser} ਵਿੱਚ ਬਿਹਤਰ — {menu} ਟੈਪ ਕਰੋ → "{browser} ਵਿੱਚ ਖੋਲ੍ਹੋ"',
    videoCall: 'ਵੀਡੀਓ ਕਾਲ',
    voiceCall: 'ਕਾਲ',
    toastLoadingErrorTitle: 'ਲੋਡ ਕਰਨ ਵਿੱਚ ਗਲਤੀ',
    toastLoadingErrorDesc: 'ਪਿਛਲਾ ਚੈਟ ਡੇਟਾ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਨਵੇਂ ਸਿਰੇ ਤੋਂ ਸ਼ੁਰੂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ!',
    toastPleaseWaitTitle: 'ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ',
    toastLoadingSettingsDesc: 'ਜ਼ਰੂਰੀ ਸੈਟਿੰਗਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...',
    toastDailyLimitTitle: 'ਰੋਜ਼ਾਨਾ ਫੋਟੋ ਸੀਮਾ ਪੂਰੀ ਹੋਈ',
    toastDailyLimitDesc: 'ਤੁਸੀਂ ਇੱਕ ਦਿਨ ਵਿੱਚ ਸਿਰਫ਼ {limit} ਫੋਟੋਆਂ ਭੇਜ ਸਕਦੇ ਹੋ। ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਟੈਕਸਟ (ਜੇ ਕੋਈ ਹੈ) ਭੇਜ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਕੱਲ੍ਹ ਦੁਬਾਰਾ ਫੋਟੋਆਂ ਭੇਜਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    toastCallFeatureTitle: 'ਕਾਲ ਫੀਚਰ',
    toastCallFeatureDesc: 'ਕਾਲਾਂ ਸਿਮੂਲੇਟਿਡ ਹਨ।',
    toastQuickReplyTitle: 'ਤੁਰੰਤ ਜਵਾਬ ਭੇਜਿਆ ਗਿਆ',
    toastQuickReplyDesc: '"{reply}" ਨੂੰ {original}... ਦਾ ਜਵਾਬ ਦਿੱਤਾ ਗਿਆ',
    toastLikedTitle: '❤️ ਪਸੰਦ ਕੀਤਾ',
    toastLikedDesc: 'ਤੁਸੀਂ ਇਸ ਸੁਨੇਹੇ ਨੂੰ ਪਸੰਦ ਕੀਤਾ',
  },
};

// Browser language code â SupportedLang
// Handles e.g. "hi-IN", "kn", "ta-LK", "en-US", "en-GB", etc.
const LANG_MAP: Record<string, SupportedLang> = {
  hi: 'hi', // Hindi
  kn: 'kn', // Kannada
  ta: 'ta', // Tamil
  te: 'te', // Telugu
  ml: 'ml', // Malayalam
  bn: 'bn', // Bengali
  gu: 'gu', // Gujarati
  mr: 'mr', // Marathi
  pa: 'pa', // Punjabi
  // Regional variants â map to the same
  'hi-in': 'hi', 'kn-in': 'kn', 'ta-in': 'ta', 'ta-lk': 'ta',
  'te-in': 'te', 'ml-in': 'ml', 'bn-in': 'bn', 'bn-bd': 'bn',
  'gu-in': 'gu', 'mr-in': 'mr', 'pa-in': 'pa', 'pa-pk': 'pa',
};

const LS_KEY = 'kruthika_ui_lang';
export const LANG_COOKIE = 'kruthika_ui_lang';
const SUPPORTED_LANG_SET = new Set<SupportedLang>(SUPPORTED_LANGS);

export function isSupportedLang(value: string): value is SupportedLang {
  return SUPPORTED_LANG_SET.has(value as SupportedLang);
}

function normalizeLanguageTag(raw: string): SupportedLang | null {
  const normalized = raw.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  return LANG_MAP[normalized] ?? LANG_MAP[normalized.split('-')[0]] ?? null;
}

export function detectBrowserLang(): SupportedLang {
  if (typeof window !== 'undefined') {
    try {
      // An explicit selection always wins over browser negotiation.
      const stored = localStorage.getItem(LS_KEY);
      if (stored && SUPPORTED_LANG_SET.has(stored as SupportedLang)) {
        return stored as SupportedLang;
      }
    } catch { /* private browsing */ }
  }

  // navigator.languages is ordered by user preference. The primary language
  // alone is not enough: many browsers report a regional fallback after it.
  const langs: string[] = typeof navigator !== 'undefined'
    ? [...(navigator.languages || []), navigator.language, (navigator as Navigator & { userLanguage?: string }).userLanguage]
      .filter((value): value is string => Boolean(value))
    : [];

  for (const raw of langs) {
    const detected = normalizeLanguageTag(raw);
    if (detected) return detected;
  }

  return 'en';
}

export function persistLang(lang: SupportedLang) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY, lang);
      document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
  }
}

export function getTranslations(lang: SupportedLang): UIStrings {
  return translations[lang] ?? translations.en;
}

// All ten supported UI languages are LTR today. This stays a function (not a
// hardcoded 'ltr' scattered across components) so that if an RTL language
// (e.g. Urdu, Arabic) is ever added to SUPPORTED_LANGS, direction handling —
// <html dir>, icon mirroring, sidebar/nav layout — updates from one place.
const RTL_LANGS = new Set<SupportedLang>([]);

// RTL script bases, matched against ANY language/locale tag (not just the ten
// SupportedLang UI languages). This is what lets geo landing pages like /sa
// (locale 'ar-SA') render with dir="rtl" even though the in-app UI language
// selector itself doesn't offer Arabic yet.
const RTL_SCRIPT_BASES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi']);

/**
 * Accepts either a bare language code ('en') or a full BCP-47 locale
 * ('ar-SA', 'en-IN') and returns the correct text direction.
 */
export function getTextDirection(langOrLocale: SupportedLang | string): 'ltr' | 'rtl' {
  const base = String(langOrLocale || '').toLowerCase().split('-')[0];
  if (RTL_LANGS.has(base as SupportedLang)) return 'rtl';
  return RTL_SCRIPT_BASES.has(base) ? 'rtl' : 'ltr';
}

export function getLanguageName(lang: SupportedLang): string {
  return LANGUAGE_NAMES[lang] ?? LANGUAGE_NAMES.en;
}

export { translations, LS_KEY };
