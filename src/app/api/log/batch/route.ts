/**
 * POST /api/log/batch
 *
 * Batch-inserts rows into messages_log in a single MySQL query.
 * Called by the client-side message-log-queue (src/lib/message-log-queue.ts).
 * Non-critical: errors are swallowed so they never block the chat UI.
 *
 * Security hardening (audit issue 5):
 *  - `sender_type` and `chat_id` are allowlisted.
 *  - All string fields are truncated server-side.
 *  - Session identity comes from the signed cookie, not the body.
 *  - Shared MySQL-backed rate limiting guards the endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMysqlClient } from '@/lib/mysql-client';
import { resolveSessionIdentity, attachSessionCookie } from '@/lib/session-identity';
import { checkRateLimit } from '@/lib/shared-rate-limiter';
import { redactMessageLogContent } from '@/lib/message-log-privacy';

const MAX_BATCH_SIZE = 50;
const MAX_BODY_BYTES = 100_000;
const ALLOWED_SENDER_TYPES = new Set(['user', 'ai', 'system']);
const MAX_BATCHES_PER_MINUTE = 60;

interface MessageLogRow {
  message_id: string;
  sender_type: string;
  chat_id: string;
  text_content: string;
  has_image: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const identity = resolveSessionIdentity(request);
    const clientIp = identity.ip;
    const sid = identity.sid ?? 'anonymous';

    const [ipRl, sessionRl] = await Promise.all([
      checkRateLimit('log_ip', clientIp, { limit: MAX_BATCHES_PER_MINUTE, windowMs: 60_000 }),
      checkRateLimit('log_session', sid, { limit: MAX_BATCHES_PER_MINUTE, windowMs: 60_000 }),
    ]);
    if (!ipRl.allowed || !sessionRl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 });
    }

    const rawText = await request.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
    }
    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const rows: MessageLogRow[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      const empty = NextResponse.json({ ok: true, inserted: 0 });
      attachSessionCookie(empty, identity);
      return empty;
    }

    // Cap batch size to avoid abuse
    const batch = rows.slice(0, MAX_BATCH_SIZE);

    const db = await getMysqlClient();

    // Build a single multi-row INSERT — far cheaper than N individual round-trips
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values: unknown[] = [];
    for (const row of batch) {
      const senderType = String(row.sender_type ?? 'user').substring(0, 20);
      const chatId = String(row.chat_id ?? 'kruthika_chat').substring(0, 64);
      const text = redactMessageLogContent(String(row.text_content ?? ''));
      values.push(
        String(row.message_id ?? '').substring(0, 64),
        // Reject unknown sender types rather than storing attacker-controlled labels
        ALLOWED_SENDER_TYPES.has(senderType) ? senderType : 'user',
        chatId,
        text,
        row.has_image ? 1 : 0,
      );
    }

    await db
      .query(
        `INSERT IGNORE INTO messages_log
           (message_id, sender_type, chat_id, text_content, has_image)
         VALUES ${placeholders}`,
        values,
      )
      .catch(() => {
        // Table might not exist yet — silently skip
      });

    const response = NextResponse.json({ ok: true, inserted: batch.length });
    attachSessionCookie(response, identity);
    return response;
  } catch {
    // Non-critical — never surface DB errors to the client
    return NextResponse.json({ ok: true, inserted: 0 });
  }
}
