// Enhanced Cookie Management for AI Girlfriend Experience
export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  personalization: boolean;
  aiLearning: boolean; // AI behavior learning
  intimacyLevel: boolean; // Intimate conversation tracking
}

export interface UserBehaviorCookies {
  // Anonymized user preferences
  preferredChatStyle: 'casual' | 'romantic' | 'flirty' | 'supportive';
  conversationTopics: string[];
  activeHours: string; // When user is most active
  responseSpeedPreference: 'instant' | 'natural' | 'slow';

  // Relationship progression
  relationshipStage: 'new' | 'getting_to_know' | 'close' | 'intimate';
  trustLevel: number; // 1-10 scale

  // AI learning data (anonymized)
  favoriteGreetings: string[];
  preferredEmojis: string[];
  communicationStyle: string;
}

import { getConsentFromStorage } from '@/lib/consent';

export class CookieManager {

  // Cookie categories with expiry times
  private static readonly COOKIE_CONFIG = {
    necessary: { expiry: 365, sameSite: 'Lax' as const, secure: false },
    analytics: { expiry: 90, sameSite: 'Lax' as const, secure: false },
    personalization: { expiry: 180, sameSite: 'Lax' as const, secure: false },
    aiLearning: { expiry: 365, sameSite: 'Lax' as const, secure: false },
    intimacyLevel: { expiry: 30, sameSite: 'Strict' as const, secure: true }
  };

  // Set cookie with proper configuration
  static setCookie(name: string, value: string, category: keyof typeof this.COOKIE_CONFIG): void {
    if (typeof window === 'undefined') return;

    const config = this.COOKIE_CONFIG[category];
    const date = new Date();
    date.setTime(date.getTime() + (config.expiry * 24 * 60 * 60 * 1000));

    let cookieString = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/`;

    if (config.sameSite) {
      cookieString += `; SameSite=${config.sameSite}`;
    }

    // Enforce Secure in production or whenever the page is being served over HTTPS.
    // This avoids accidentally setting non-Secure cookies for categories that
    // were previously flagged as secure=false in the static config.
    const secureFlag = Boolean(config.secure) || (typeof window !== 'undefined' && window.location.protocol === 'https:') || process.env.NODE_ENV === 'production';
    if (secureFlag) {
      cookieString += `; Secure`;
    }

    document.cookie = cookieString;

    console.log(`Cookie set: ${name} (${category}) - expires in ${config.expiry} days`);
  }

  // Get cookie value
  static getCookie(name: string): string | null {
    if (typeof window === 'undefined') return null;

    const nameEQ = name + "=";
    const ca = document.cookie.split(';');

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  }

  // Enhanced AI-specific cookie management
  static setAIPreference(key: keyof UserBehaviorCookies, value: any): void {
    const preferences = this.getConsentPreferences();

    if (preferences?.aiLearning) {
      this.setCookie(`ai_${key}`, JSON.stringify(value), 'aiLearning');

      // Auto-update AI personality based on preferences
      this.updateAIPersonalityProfile(key, value);
    }
  }

  // Dynamic AI personality adjustment
  static updateAIPersonalityProfile(key: keyof UserBehaviorCookies, value: any): void {
    const currentProfile = this.getCookie('ai_personality_profile');
    let profile = currentProfile ? JSON.parse(currentProfile) : {
      flirtiness: 0.3,
      supportiveness: 0.7,
      playfulness: 0.5,
      intellectualness: 0.4,
      emotionalDepth: 0.6
    };

    // Adjust personality based on user preferences
    switch (key) {
      case 'preferredChatStyle':
        if (value === 'romantic') {
          profile.flirtiness = Math.min(1, profile.flirtiness + 0.1);
          profile.emotionalDepth = Math.min(1, profile.emotionalDepth + 0.1);
        } else if (value === 'playful') {
          profile.playfulness = Math.min(1, profile.playfulness + 0.1);
        } else if (value === 'supportive') {
          profile.supportiveness = Math.min(1, profile.supportiveness + 0.1);
        }
        break;

      case 'conversationTopics':
        if (Array.isArray(value)) {
          // Increase intellectualness if discussing complex topics
          const complexTopics = ['psychology', 'philosophy', 'science', 'technology'];
          if (value.some(topic => complexTopics.includes(topic))) {
            profile.intellectualness = Math.min(1, profile.intellectualness + 0.05);
          }
        }
        break;

      case 'relationshipStage':
        if (value === 'intimate') {
          profile.emotionalDepth = Math.min(1, profile.emotionalDepth + 0.2);
          profile.flirtiness = Math.min(1, profile.flirtiness + 0.15);
        }
        break;
    }

    this.setCookie('ai_personality_profile', JSON.stringify(profile), 'aiLearning');
  }

  // Get AI personality for response generation
  static getAIPersonalityProfile(): any {
    const profile = this.getCookie('ai_personality_profile');
    return profile ? JSON.parse(profile) : {
      flirtiness: 0.3,
      supportiveness: 0.7,
      playfulness: 0.5,
      intellectualness: 0.4,
      emotionalDepth: 0.6,
      comfortLevel: 0.3, // How comfortable she is with user
      trustScore: 0.5, // Trust built over time
    };
  }

  static getAIPreference(key: keyof UserBehaviorCookies): any {
    const cookieValue = this.getCookie(`ai_${key}`);
    return cookieValue ? JSON.parse(cookieValue) : null;
  }

  // Relationship progression tracking
  static updateRelationshipStage(stage: UserBehaviorCookies['relationshipStage']): void {
    const preferences = this.getConsentPreferences();

    if (preferences?.personalization) {
      this.setCookie('relationship_stage', stage, 'personalization');

      // Update AI behavior based on relationship stage
      this.setCookie('ai_intimacy_allowed',
        stage === 'close' || stage === 'intimate' ? 'true' : 'false',
        'intimacyLevel'
      );
    }
  }

  // Get consent preferences from the unified consent module.
  static getConsentPreferences(): CookiePreferences | null {
    if (typeof window === 'undefined') return null;
    const stored = getConsentFromStorage();
    if (!stored) return null;
    return {
      necessary: true,
      analytics: stored.analytics,
      personalization: stored.personalization,
      aiLearning: stored.aiLearning,
      intimacyLevel: stored.intimacyLevel,
    };
  }

  // Chat behavior optimization
  static updateChatPreferences(messageCount: number, responseTime: number): void {
    const preferences = this.getConsentPreferences();

    if (preferences?.personalization) {
      // Track optimal response timing
      const avgResponseTime = this.getCookie('avg_response_time') || '2000';
      const newAvg = (parseInt(avgResponseTime) + responseTime) / 2;

      this.setCookie('avg_response_time', newAvg.toString(), 'personalization');

      // Update chat style preference based on message patterns
      if (messageCount > 10) {
        const currentStyle = this.getCookie('chat_style') || 'casual';
        this.setCookie('chat_style', currentStyle, 'personalization');
      }
    }
  }

  // Track user value metrics
  static trackUserValueMetrics(messageCount: number, sessionDuration: number, imagesSent: number): void {
    const preferences = this.getConsentPreferences();
    if (!preferences?.analytics) return;

    const today = new Date().toDateString();
    const lastDate = this.getCookie('metrics_last_date');

    let dailyMessages = parseInt(this.getCookie('daily_message_count') || '0');
    let totalImages = parseInt(this.getCookie('total_images_sent') || '0');
    let avgSession = parseFloat(this.getCookie('avg_session_duration') || '0');

    if (lastDate !== today) {
      dailyMessages = 0;
      this.setCookie('metrics_last_date', today, 'analytics');
    }

    dailyMessages += messageCount;
    totalImages += imagesSent;
    avgSession = (avgSession + sessionDuration) / 2;

    this.setCookie('daily_message_count', dailyMessages.toString(), 'analytics');
    this.setCookie('total_images_sent', totalImages.toString(), 'analytics');
    this.setCookie('avg_session_duration', avgSession.toString(), 'analytics');

    // Calculate user value score (0-100)
    let valueScore = 0;
    if (dailyMessages > 50) valueScore += 30;
    else if (dailyMessages > 20) valueScore += 20;
    else if (dailyMessages > 10) valueScore += 10;

    if (totalImages > 10) valueScore += 25;
    else if (totalImages > 5) valueScore += 15;

    if (avgSession > 1800) valueScore += 25; // 30+ min sessions
    else if (avgSession > 900) valueScore += 15; // 15+ min sessions

    // Return user frequency
    const daysActive = parseInt(this.getCookie('days_active') || '1');
    if (daysActive > 7) valueScore += 20;
    else if (daysActive > 3) valueScore += 10;

    this.setCookie('user_value_score', valueScore.toString(), 'analytics');
  }

  // Clean expired cookies and optimize performance
  static cleanupExpiredCookies(): void {
    const allCookies = document.cookie.split(';');

    allCookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name.startsWith('kruthika_expired_')) {
        this.deleteCookie(name);
      }
    });

    // Cleanup old analytics data older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const oldInteractions = this.getCookie('interaction_timestamps');
    if (oldInteractions) {
      try {
        const timestamps = JSON.parse(oldInteractions);
        const filtered = timestamps.filter((ts: number) => ts > thirtyDaysAgo);
        this.setCookie('interaction_timestamps', JSON.stringify(filtered), 'analytics');
      } catch (e) {
        this.deleteCookie('interaction_timestamps');
      }
    }
  }

  // SEO and conversion tracking
  static trackSEOMetrics(pageType: string, source?: string): void {
    const preferences = this.getConsentPreferences();
    if (!preferences?.analytics) return;

    const currentPages = this.getCookie('visited_pages') || '[]';
    let pages = JSON.parse(currentPages);

    pages.push({
      page: pageType,
      timestamp: Date.now(),
      source: source || 'direct',
      referrer: document.referrer
    });

    // Keep last 50 page visits
    pages = pages.slice(-50);

    this.setCookie('visited_pages', JSON.stringify(pages), 'analytics');

    // Track conversion funnel
    this.updateConversionFunnel(pageType);
  }

  static updateConversionFunnel(pageType: string): void {
    const funnel = this.getCookie('conversion_funnel') || '{}';
    let funnelData = JSON.parse(funnel);

    if (!funnelData.steps) funnelData.steps = {};

    // Track key conversion points
    const conversionSteps = {
      'landing': 'visited_landing',
      'chat_started': 'started_chat',
      'message_sent': 'sent_message',
      'image_shared': 'shared_image',
      'long_session': 'had_long_session' // 15+ minutes
    };

    if (conversionSteps[pageType as keyof typeof conversionSteps]) {
      funnelData.steps[conversionSteps[pageType as keyof typeof conversionSteps]] = Date.now();
    }

    // Check for long session
    const sessionStart = this.getCookie('session_start');
    if (sessionStart && Date.now() - parseInt(sessionStart) > 900000) { // 15 minutes
      funnelData.steps.had_long_session = Date.now();
    }

    this.setCookie('conversion_funnel', JSON.stringify(funnelData), 'analytics');
  }

  private static deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

// Usage examples for AI girlfriend app
export const AIGirlfriendCookies = {
  // Initialize user relationship
  initializeNewUser(): void {
    CookieManager.setAIPreference('relationshipStage', 'new');
    CookieManager.setAIPreference('trustLevel', 1);
    CookieManager.setAIPreference('preferredChatStyle', 'casual');
  },

  // Update based on conversation analysis
  updateFromConversation(messageLength: number, topics: string[], sentiment: string): void {
    // Update conversation topics
    const existingTopics = CookieManager.getAIPreference('conversationTopics') || [];
    const updatedTopics = [...new Set([...existingTopics, ...topics])].slice(-10); // Keep last 10 topics

    CookieManager.setAIPreference('conversationTopics', updatedTopics);

    // Update chat style based on message length and sentiment
    if (messageLength > 50 && sentiment === 'romantic') {
      CookieManager.setAIPreference('preferredChatStyle', 'romantic');
    }
  },

  // Get personalized AI behavior
  getPersonalizedBehavior(): Partial<UserBehaviorCookies> {
    return {
      preferredChatStyle: CookieManager.getAIPreference('preferredChatStyle'),
      relationshipStage: CookieManager.getAIPreference('relationshipStage'),
      trustLevel: CookieManager.getAIPreference('trustLevel'),
      conversationTopics: CookieManager.getAIPreference('conversationTopics'),
      responseSpeedPreference: CookieManager.getAIPreference('responseSpeedPreference')
    };
  }
};

console.log('Cookie Manager: AI girlfriend cookie system loaded');