/** Business timezone for daily quota resets (India-facing product). */
export const QUOTA_TIMEZONE = process.env.QUOTA_TIMEZONE || 'Asia/Kolkata';

/** Returns YYYY-MM-DD in the business timezone (default IST). */
export function getQuotaDateString(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: QUOTA_TIMEZONE });
}
