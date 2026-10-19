/**
 * Security-module tests for the audit fixes:
 *   - key-encryption.ts  (issue 6: plaintext API keys at rest)
 *   - analytics-events.ts (issue 5: analytics batch pollution)
 *   - trusted-hosts.ts    (issues 11/12: proxy host reflection + CORS)
 *
 * Run: npm test
 * Uses node:test + tsx (no test framework required).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  encryptSecret,
  decryptSecret,
  isEncryptionEnabled,
  getEncryptionVersion,
  normalizeSecret,
} from '../key-encryption';
import { sanitizeAnalyticsEvent, ALLOWED_EVENT_TYPES } from '../analytics-events';
import { isTrustedHost, normalizeForwardedProto } from '../trusted-hosts';

// ── key-encryption (issue 6) ─────────────────────────────────────────────────

test('key-encryption: roundtrip encrypt -> decrypt', () => {
  process.env.MASTER_ENCRYPTION_KEY = 'unit-test-master-key';
  const secret = 'sk-proj-super-secret-credential';
  const stored = encryptSecret(secret);

  assert.ok(stored.startsWith('enc:v1:'), 'should use envelope format');
  assert.notEqual(stored, secret, 'must not store plaintext');
  assert.equal(decryptSecret(stored), secret);
  assert.equal(getEncryptionVersion(), 'v1');
  assert.equal(isEncryptionEnabled(), true);
});

test('key-encryption: two encryptions of the same secret differ (random IV)', () => {
  process.env.MASTER_ENCRYPTION_KEY = 'unit-test-master-key';
  const stored1 = encryptSecret('same-secret');
  const stored2 = encryptSecret('same-secret');
  assert.notEqual(stored1, stored2, 'random IV must produce different ciphertexts');
});

test('key-encryption: legacy plaintext rows remain readable', () => {
  process.env.MASTER_ENCRYPTION_KEY = 'unit-test-master-key';
  const legacy = 'sk-legacy-plaintext';
  assert.equal(decryptSecret(legacy), legacy, 'plaintext should pass through unchanged');
});

test('key-encryption: tampered envelope fails authentication', () => {
  process.env.MASTER_ENCRYPTION_KEY = 'unit-test-master-key';
  const stored = encryptSecret('integrity-check-secret');
  // Corrupt the auth tag portion (enc:v1:<iv>:<tag>:<ciphertext>).
  const parts = stored.split(':');
  const tag = parts[3];
  parts[3] = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
  const tampered = parts.join(':');
  assert.throws(() => decryptSecret(tampered), /auth/i, 'GCM auth should reject tampering');
});

test('key-encryption: no master key => plaintext fallback + decrypt passthrough', () => {
  const oldKey = process.env.MASTER_ENCRYPTION_KEY;
  const oldDev = process.env.DEV_ONLY;
  delete process.env.MASTER_ENCRYPTION_KEY;
  process.env.DEV_ONLY = 'true';
  try {
    assert.equal(isEncryptionEnabled(), false);
    assert.equal(encryptSecret('plain-fallback'), 'plain-fallback');
    assert.equal(decryptSecret('plain-fallback'), 'plain-fallback');
  } finally {
    if (oldKey !== undefined) process.env.MASTER_ENCRYPTION_KEY = oldKey;
    else delete process.env.MASTER_ENCRYPTION_KEY;
    if (oldDev !== undefined) process.env.DEV_ONLY = oldDev;
    else delete process.env.DEV_ONLY;
  }
});

test('key-encryption: normalizeSecret re-encrypts legacy values when enabled', () => {
  process.env.MASTER_ENCRYPTION_KEY = 'unit-test-master-key';
  const normalized = normalizeSecret('sk-legacy-to-encrypt');
  assert.ok(normalized.startsWith('enc:v1:'));
  assert.equal(decryptSecret(normalized), 'sk-legacy-to-encrypt');
});

// ── analytics-events (issue 5) ───────────────────────────────────────────────

test('analytics-events: unknown event types are rejected', () => {
  const r = sanitizeAnalyticsEvent({ eventType: 'drop_everything', eventData: {} });
  assert.ok(!r.ok);
  assert.match((r as { reason: string }).reason, /unknown eventType/);
});

test('analytics-events: message_sent sanitizes and caps fields', () => {
  const r = sanitizeAnalyticsEvent({
    eventType: 'message_sent',
    eventData: {
      messageId: 'msg_1',
      senderType: 'user',
      content: 'x'.repeat(2000),
      hasImage: true,
      arbitraryInjected: 'DROP TABLE users;',
    },
    timestamp: 123456789, // must be ignored
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  const data = r.event.eventData;
  assert.equal(data.messageId, 'msg_1');
  assert.equal(data.senderType, 'user');
  assert.equal((data.content as string).length, 500, 'content must be capped at 500');
  assert.equal(data.arbitraryInjected, undefined, 'injected fields are stripped');
  // Server timestamp wins — the bogus client timestamp is never used.
  assert.ok(Math.abs(r.event.timestamp - Date.now()) < 5000);
});

test('analytics-events: invalid senderType is rejected', () => {
  const r = sanitizeAnalyticsEvent({
    eventType: 'message_sent',
    eventData: { senderType: 'admin', content: 'hi' },
  });
  assert.ok(!r.ok);
});

test('analytics-events: ad action must be view|click', () => {
  const bad = sanitizeAnalyticsEvent({ eventType: 'ad_interaction', eventData: { action: 'evil' } });
  assert.ok(!bad.ok);
  const good = sanitizeAnalyticsEvent({ eventType: 'ad_interaction', eventData: { action: 'click' } });
  assert.ok(good.ok);
});

test('analytics-events: allowlist covers all documented events', () => {
  for (const t of ['message_sent', 'session_start', 'session_resume', 'session_update',
    'session_message_increment', 'ad_interaction', 'image_shared', 'page_view',
    'user_action', 'cookie_consent', 'journey_step', 'user_analytics']) {
    assert.ok(ALLOWED_EVENT_TYPES.has(t), `missing ${t}`);
  }
});

// ── trusted-hosts (issues 11/12) ─────────────────────────────────────────────

test('trusted-hosts: production hosts are trusted', () => {
  assert.equal(isTrustedHost('kruthika.fun'), true);
  assert.equal(isTrustedHost('www.kruthika.fun'), true);
  assert.equal(isTrustedHost('https://kruthika.fun'), true);
});

test('trusted-hosts: attacker hosts are rejected', () => {
  assert.equal(isTrustedHost('evil.com'), false);
  assert.equal(isTrustedHost('kruthika.fun.evil.com'), false);
  assert.equal(isTrustedHost('notkruthika.fun'), false);
  assert.equal(isTrustedHost(''), false);
});

test('trusted-hosts: forwarded proto normalisation', () => {
  assert.equal(normalizeForwardedProto('https'), 'https');
  assert.equal(normalizeForwardedProto('http'), 'http');
  assert.equal(normalizeForwardedProto(null), 'https');
  assert.equal(normalizeForwardedProto('garbage'), 'https');
});
