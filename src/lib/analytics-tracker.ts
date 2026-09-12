// Enhanced Analytics Tracking System for Kruthika.fun - Real Data Only
import { CookieManager } from './cookie-manager';

export interface AnalyticsEvent {
  eventType: 'message_sent' | 'session_start' | 'page_view' | 'ad_interaction' | 'user_action' | 'journey_step' | 'cookie_consent' | 'session_update' | 'session_message_increment' | 'user_analytics';
  eventData: {
    chatId?: string;
    messageId?: string;
    senderType?: 'user' | 'ai';
    content?: string;
    hasImage?: boolean;
    adType?: string;
    action?: string;
    page?: string;
    title?: string;
    referrer?: string;
    deviceType?: string;
    browser?: string;
    countryCode?: string;
    countryName?: string;
    timezone?: string;
    stepName?: string;
    stepOrder?: number;
    [key: string]: any;
  };
  userId?: string;
  sessionId?: string;
  timestamp: number;
}

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private sessionId: string;
  private userId: string;
  private sessionStartTime: number;
  private isTrackingEnabled: boolean = false;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private deviceInfo: any = {};

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.sessionStartTime = Date.now();
    this.initializeTracking();
    this.startEventQueue();
  }

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  private async initializeTracking(): Promise<void> {
    if (typeof window === 'undefined') return;

    const preferences = CookieManager.getConsentPreferences();
    this.isTrackingEnabled = preferences?.analytics || false;

    if (this.isTrackingEnabled) {
      await this.detectDeviceAndLocation();
      await this.trackSessionStart();
      this.setupRealTimeTracking();
    }
  }

  private async detectDeviceAndLocation(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Device detection
      const userAgent = navigator.userAgent;
      let deviceType = 'desktop';

      if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
        deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
      }

      const browser = this.getBrowserName(userAgent);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language;
      const screenResolution = `${screen.width}x${screen.height}`;

      this.deviceInfo = {
        deviceType,
        browser,
        timezone,
        language,
        screenResolution,
        userAgent
      };

      // Get location data from IP — try multiple free CORS-enabled APIs in sequence
      try {
        let locationDetected = false;

        // Primary: ipwho.is — free, no key, reliable CORS headers
        try {
          const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
          if (r.ok) {
            const d = await r.json();
            if (d.success && d.country_code) {
              this.deviceInfo.countryCode = d.country_code;
              this.deviceInfo.countryName = d.country;
              this.deviceInfo.city = d.city;
              locationDetected = true;
            }
          }
        } catch {}

        // Fallback 1: api.country.is — minimal payload, just country
        if (!locationDetected) {
          try {
            const r = await fetch('https://api.country.is/', { signal: AbortSignal.timeout(4000) });
            if (r.ok) {
              const d = await r.json();
              if (d.country) {
                this.deviceInfo.countryCode = d.country;
                this.deviceInfo.countryName = d.country;
                locationDetected = true;
              }
            }
          } catch {}
        }

        // Fallback 2: infer country from timezone (no network call needed)
        if (!locationDetected) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const tzCountry: Record<string, string> = {
            'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
            'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US', 'America/Denver': 'US',
            'Europe/London': 'GB', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
            'Asia/Dubai': 'AE', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD',
            'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH',
            'America/Toronto': 'CA', 'America/Vancouver': 'CA',
            'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Amsterdam': 'NL',
          };
          if (tzCountry[tz]) {
            this.deviceInfo.countryCode = tzCountry[tz];
            this.deviceInfo.countryName = tzCountry[tz];
          }
        }
      } catch (error) {
        console.warn('Could not detect location:', error);
      }

      await this.trackEvent({
        eventType: 'user_analytics',
        eventData: {
          sessionId: this.sessionId,
          userPseudoId: this.userId,
          countryCode: this.deviceInfo.countryCode,
          countryName: this.deviceInfo.countryName,
          timezone: this.deviceInfo.timezone,
          deviceType: this.deviceInfo.deviceType,
          browser: this.deviceInfo.browser,
          os: this.getOS(),
          screenResolution: this.deviceInfo.screenResolution,
          language: this.deviceInfo.language
        },
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Device detection error:', error);
    }
  }

  private getBrowserName(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getOS(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  }

  private async trackSessionStart(): Promise<void> {
    await this.trackEvent({
      eventType: 'session_start',
      eventData: {
        chatId: 'kruthika_chat',
        ...this.deviceInfo,
        referrer: document.referrer
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: this.sessionStartTime
    });

    // Track cookie consent
    const preferences = CookieManager.getConsentPreferences();
    if (preferences) {
      await this.trackEvent({
        eventType: 'cookie_consent',
        eventData: {
          sessionId: this.sessionId,
          necessary: preferences.necessary,
          analytics: preferences.analytics,
          advertising: (preferences as any).advertising,
          personalization: preferences.personalization,
          aiLearning: preferences.aiLearning || false,
          intimacyLevel: preferences.intimacyLevel || false
        },
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }

    // Track user journey step
    await this.trackJourneyStep('landing', 1);
  }

  private setupRealTimeTracking(): void {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.updateSessionDuration();
      }
    });

    // Track page unload
    window.addEventListener('beforeunload', () => {
      this.updateSessionDuration();
      this.flushEvents(true);
    });

    // Track user interactions for journey funnel
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.chat-input') || target.closest('[data-action="send-message"]')) {
        this.trackJourneyStep('message_sent', 3);
      }
    });
  }

  private async updateSessionDuration(): Promise<void> {
    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    await this.trackEvent({
      eventType: 'session_update',
      eventData: {
        sessionId: this.sessionId,
        endedAt: new Date().toISOString(),
        durationSeconds: duration,
        isActive: false
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isTrackingEnabled) return;
    if (!event || !event.eventType || !event.eventData) return;

    if (!event.userId) event.userId = this.userId;
    if (!event.sessionId) event.sessionId = this.sessionId;
    if (!event.timestamp) event.timestamp = Date.now();

    this.eventQueue.push(event);

    // Batch all events except session_start for better performance
    if (event.eventType === 'session_start') {
      this.flushEvents();
    } else if (this.eventQueue.length >= 50) {
      // Flush when queue reaches 50 events (increased from 10 for better efficiency)
      this.flushEvents();
    }
  }

  public async trackMessage(messageId: string, senderType: 'user' | 'ai', content: string, hasImage: boolean = false): Promise<void> {
    await this.trackEvent({
      eventType: 'message_sent',
      eventData: {
        chatId: 'kruthika_chat',
        messageId,
        senderType,
        content: content.substring(0, 500),
        hasImage
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Update session message count
    await this.trackEvent({
      eventType: 'session_message_increment',
      eventData: {
        sessionId: this.sessionId
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Track journey steps
    if (senderType === 'user') {
      await this.trackJourneyStep('message_sent', 3);

      // Check for long session (15+ minutes)
      if (Date.now() - this.sessionStartTime > 15 * 60 * 1000) {
        await this.trackJourneyStep('long_session', 5);
      }
    }
  }

  public async trackPageView(page: string, title?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'page_view',
      eventData: {
        page,
        title,
        referrer: document.referrer
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackAdInteraction(adType: string, action: 'view' | 'click', adNetwork?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'ad_interaction',
      eventData: {
        adType,
        action,
        network: adNetwork || 'unknown',
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackAdInteractionPublic(adType: string, action: 'view' | 'click', adNetwork?: string): Promise<void> {
    return this.trackAdInteraction(adType, action, adNetwork);
  }

  public async trackUserAction(action: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      eventType: 'user_action',
      eventData: {
        action,
        ...metadata,
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  public async trackAIResponseTime(durationMs: number): Promise<void> {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    await this.trackUserAction('ai_response_time', {
      durationMs: Math.round(durationMs),
    });
  }

  public async trackImageShare(imageUrl: string, context?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'user_action',
      eventData: {
        action: 'image_share',
        imageUrl,
        context,
        page: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // Track journey step for image sharing
    await this.trackJourneyStep('image_share', 4);
  }

  public async trackJourneyStep(stepName: string, order: number): Promise<void> {
    await this.trackEvent({
      eventType: 'journey_step',
      eventData: {
        stepName,
        stepOrder: order,
        pagePath: window.location.pathname
      },
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }

  private generateSessionId(): string {
    if (typeof window === 'undefined') return 'server_session';

    try {
      let sessionId = sessionStorage.getItem('kruthika_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('kruthika_session_id', sessionId);
      }
      return sessionId;
    } catch {
      return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  private getUserId(): string {
    if (typeof window === 'undefined') return 'server_user';

    try {
      let userId = localStorage.getItem('kruthika_user_id');
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('kruthika_user_id', userId);
      }
      return userId;
    } catch {
      return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  private startEventQueue() {
    // Flush analytics events every 60 seconds — balances data freshness with
    // network overhead. Events also flush at 50-event batches and on page unload.
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 60000);
  }

  private async flushEvents(_immediate = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend, sessionId: this.sessionId })
      });
    } catch (error) {
      console.warn('Error flushing analytics events:', error);
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  public async getAnalyticsOverview(dateRange: string = '7d') {
    // 6-second hard timeout — prevents the analytics dashboard from hanging
    // indefinitely when the MySQL pool is slow or the server is under load.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(
        `/api/analytics?type=overview&dateRange=${dateRange}`,
        { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' }
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Analytics overview: session expired or not authenticated (401).');
          return { success: false, error: 'session_expired', status: 401 };
        }
        return { success: false, error: data?.error || `Request failed (${response.status})`, status: response.status };
      }
      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('Analytics overview fetch timed out after 6 s');
        return { success: false, error: 'Request timed out' };
      }
      console.error('Analytics overview error:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async getRealtimeAnalytics() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/analytics?type=realtime', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Analytics realtime: session expired or not authenticated (401).');
          return { success: false, error: 'session_expired', status: 401 };
        }
        return { success: false, error: data?.error || `Request failed (${response.status})`, status: response.status };
      }
      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('Analytics realtime fetch timed out after 6 s');
        return { success: false, error: 'Request timed out' };
      }
      console.error('Real-time analytics error:', error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public enableTracking(): void {
    this.isTrackingEnabled = true;
    this.initializeTracking();
  }

  public disableTracking(): void {
    this.isTrackingEnabled = false;
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.updateSessionDuration();
    this.flushEvents(true);
  }
}

export const analyticsTracker = AnalyticsTracker.getInstance();

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const preferences = CookieManager.getConsentPreferences();
    if (preferences?.analytics) {
      analyticsTracker.enableTracking();
    }
  }, 1000);
}
