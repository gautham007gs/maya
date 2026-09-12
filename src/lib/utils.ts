import { clsx, type ClassValue } from "clsx"
// @ts-ignore
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if the current device is likely Android.
 * @returns {boolean} True if likely an Android device, false otherwise.
 */
export function isAndroid(): boolean {
  if (typeof window !== 'undefined' && window.navigator) {
    const userAgent = window.navigator.userAgent;
    return /android/i.test(userAgent);
  }
  return false;
}
