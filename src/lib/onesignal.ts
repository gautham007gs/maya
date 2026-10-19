
let OneSignalModule: typeof import('react-onesignal').default | null = null;
export const getOneSignal = async () => {
  if (typeof window === 'undefined') return null;
  if (!OneSignalModule) {
    try {
      const mod = await import('react-onesignal');
      OneSignalModule = (mod.default || mod) as typeof import('react-onesignal').default;
    } catch {
      return null;
    }
  }
  return OneSignalModule;
};

let isOneSignalInitialized = false;
let initAttempted = false;

// Queue of identities to login once the SDK initializes. OneSignal.login()
// can only be called after init, so if setUserId() is invoked before init
// completes we hold the value and apply it as soon as init finishes.
let pendingLoginId: string | null = null;

export const getIsInitialized = () => isOneSignalInitialized;

export const initOneSignal = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  if (isOneSignalInitialized) {
    // Flush any identity that arrived while we were initializing.
    if (pendingLoginId) {
      const id = pendingLoginId;
      pendingLoginId = null;
      await setUserId(id);
    }
    return true;
  }
  if (initAttempted) return false;

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID' || !appId.trim()) {
    console.info('[OneSignal] App ID not configured — push disabled.');
    initAttempted = true;
    return false;
  }

  const hostname = window.location.hostname;
  const isProduction = hostname === 'kruthika.fun' || hostname === 'www.kruthika.fun';
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (!isProduction && !isLocalDev) {
    console.info('[OneSignal] Skipping init — not on a supported domain.');
    initAttempted = true;
    return false;
  }

  const OneSignal = await getOneSignal();
  if (!OneSignal) {
    initAttempted = true;
    return false;
  }

  initAttempted = true;

  try {
    console.info('[OneSignal] Initializing on', isProduction ? 'production' : 'dev', 'domain…');
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      // Dedicated scope keeps the OneSignal worker separate from the PWA
      // /sw.js (root scope). One service worker per scope only — without
      // this, one registration silently clobbers the other and pushes break
      // after a reload, deploy, or browser restart.
      serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
      serviceWorkerUpdaterPath: 'push/onesignal/OneSignalSDKUpdaterWorker.js',
      serviceWorkerParam: { scope: '/push/onesignal/' },
      // Auto-prompt disabled on initial load so it does not hijack LCP (Largest Contentful Paint)
      // or block main-thread rendering. Opt-in prompt is triggered upon user request.
      promptOptions: {
        slidedown: {
          prompts: [{
            type: 'push',
            autoPrompt: false,
            delay: {
              pageViews: 1,
              timeDelay: 60,
            },
            text: {
              actionMessage: 'Get a gentle nudge when your chat is waiting.',
              acceptButton: 'Allow',
              cancelButton: 'Not now',
            },
          }],
        },
      },
      notifyButton: {
        enable: false,
        prenotify: false,
        showCredit: false,
        text: {} as any,
      },
    });
    isOneSignalInitialized = true;
    console.info('[OneSignal] ✅ Initialized. Permission:', Notification.permission);
    if (pendingLoginId) {
      const id = pendingLoginId;
      pendingLoginId = null;
      await setUserId(id);
    }
    return true;
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (
      msg.includes('Can only be used on') ||
      msg.includes('domain') ||
      msg.includes('origin')
    ) {
      console.info('[OneSignal] Domain restriction — SDK only works on its configured site.', msg);
    } else {
      console.warn('[OneSignal] Init warning:', msg);
    }
    isOneSignalInitialized = false;
    return false;
  }
};

/**
 * Request push notification permission.
 *
 * Uses OneSignal.Notifications.requestPermission() when available. The normal
 * opt-in path is OneSignal's auto slidedown prompt configured during init.
 *
 * There is deliberately NO fallback to the raw browser Notification API: if
 * OneSignal is not initialized (wrong domain, no App ID, init failed) we return
 * false so the UI can show "Notifications are currently unavailable" rather
 * than creating a half-configured native subscription OneSignal can't deliver
 * to or target.
 */
export const subscribeUser = async (): Promise<boolean> => {
  if (!isOneSignalInitialized) {
    console.info('[OneSignal] subscribeUser skipped — OneSignal not initialized.');
    return false;
  }

  try {
    const OneSignal = await getOneSignal();
    if (!OneSignal) return false;
    const granted = await OneSignal.Notifications.requestPermission();
    return granted === true;
  } catch (err) {
    console.warn('[OneSignal] requestPermission error:', err);
    return false;
  }
};

export const getPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
};

export const setUserTag = async (key: string, value: string): Promise<void> => {
  if (!isOneSignalInitialized) return;
  try {
    const OneSignal = await getOneSignal();
    if (OneSignal) await OneSignal.User.addTag(key, value);
  } catch (err) {
    console.warn('[OneSignal] Tag error:', err);
  }
};

/**
 * Register a stable external id for this user (derived server-side from the
 * verified session cookie). Used with OneSignal.login() so the cron job can
 * target the user via include_aliases.external_id instead of raw player ids.
 *
 * Safe to call before init completes — the login is applied once the SDK is
 * ready. Calling with the same id repeatedly is idempotent.
 */
export const setUserId = async (userId: string): Promise<void> => {
  if (!userId) return;
  if (!isOneSignalInitialized) {
    pendingLoginId = userId;
    return;
  }
  try {
    const OneSignal = await getOneSignal();
    if (OneSignal) await OneSignal.login(userId);
  } catch (err) {
    console.warn('[OneSignal] Login error:', err);
  }
};
