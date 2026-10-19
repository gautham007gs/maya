// OneSignal Web Push service worker (dedicated scope /push/onesignal/)
// Registered separately from the PWA /sw.js so they never conflict.
// See docs: https://documentation.onesignal.com/docs/onesignal-service-worker
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
