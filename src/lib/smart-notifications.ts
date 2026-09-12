/**
 * Smart Notifications — re-engagement push logic via OneSignal REST API
 * All sends are server-side (via /api/admin/notifications/reengagement).
 * This module provides helpers callable from client-side admin code.
 */

export interface ReengagementTemplate {
  id: string;
  label: string;
  title: string;
  message: string;
  emoji: string;
}

export interface ReengagementAudience {
  type: 'all' | 'inactive' | 'external_ids' | 'tags';
  inactiveHours?: number;
  externalIds?: string[];
  tags?: { key: string; relation: string; value: string }[];
}

export interface SendReengagementOptions {
  templateId?: string;
  customTitle?: string;
  customMessage?: string;
  imageUrl?: string;
  iconUrl?: string;
  url?: string;
  /** Audience to target. Defaults to 'all' (kept explicit so admins choose). */
  audience?: ReengagementAudience;
  /** Set to true to actually send. Without it the API returns an estimate. */
  confirm?: boolean;
}

export interface SendResult {
  success: boolean;
  notificationId?: string;
  recipients?: number;
  templateUsed?: string;
  needsConfirmation?: boolean;
  estimatedRecipients?: number | null;
  estimateSource?: string;
  error?: string;
}

/**
 * Send a re-engagement notification via the admin API.
 * Must be called from a context where the admin session cookie is present.
 *
 * Two-phase flow: call without `confirm: true` first to get an estimated
 * recipient count; then re-call with `confirm: true` to actually send.
 */
export async function sendReengagement(options: SendReengagementOptions): Promise<SendResult> {
  try {
    const res = await fetch('/api/admin/notifications/reengagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? 'Send failed' };
    if (data.needsConfirmation) {
      return {
        success: false,
        needsConfirmation: true,
        estimatedRecipients: data.estimatedRecipients,
        estimateSource: data.estimateSource,
        error: data.message,
      };
    }
    return {
      success: true,
      notificationId: data.notificationId,
      recipients: data.recipients,
      templateUsed: data.templateUsed,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error' };
  }
}

/**
 * Fetch available re-engagement templates from the server.
 */
export async function fetchReengagementTemplates(): Promise<ReengagementTemplate[]> {
  try {
    const res = await fetch('/api/admin/notifications/reengagement', { credentials: 'include' });
    const data = await res.json();
    return data.templates ?? [];
  } catch {
    return [];
  }
}

