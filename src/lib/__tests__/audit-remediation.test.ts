import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateMemoryPayload, MAX_MEMORY_BODY_BYTES } from '../memory-validation';
import { validateCanonicalUrl } from '../cms-content';

describe('memory-validation', () => {
  it('rejects oversized arrays', () => {
    const facts = Array.from({ length: 60 }, (_, i) => `fact-${i}`);
    const result = validateMemoryPayload({ facts });
    assert.equal(result.ok, false);
  });

  it('accepts bounded payload', () => {
    const result = validateMemoryPayload({
      userName: 'Alex',
      facts: ['likes music'],
      topics: ['travel'],
      relationshipLevel: 0.3,
      messageCount: 5,
    });
    assert.equal(result.ok, true);
  });

  it('exports sane body byte limit', () => {
    assert.ok(MAX_MEMORY_BODY_BYTES <= 64_000);
  });
});

describe('validateCanonicalUrl', () => {
  it('allows same-origin canonical', () => {
    const url = validateCanonicalUrl('https://kruthika.fun/blog/test', 'https://kruthika.fun/fallback');
    assert.equal(url, 'https://kruthika.fun/blog/test');
  });

  it('rejects external canonical', () => {
    const url = validateCanonicalUrl('https://evil.com/hijack', 'https://kruthika.fun/blog/x');
    assert.equal(url, 'https://kruthika.fun/blog/x');
  });
});

describe('consent', () => {
  it('builds rejected consent with advertising disabled', async () => {
    const { saveConsent, CONSENT_VERSION } = await import('../consent');
    const prefs = saveConsent('rejected');
    assert.equal(prefs.choice, 'rejected');
    assert.equal(prefs.advertising, false);
    assert.equal(prefs.version, CONSENT_VERSION);
  });

  it('allows advertising without enabling analytics in custom consent', async () => {
    const { saveConsent } = await import('../consent');
    const prefs = saveConsent('custom', {
      advertising: true,
      analytics: false,
      personalization: false,
      aiLearning: false,
      intimacyLevel: false,
    });
    assert.equal(prefs.choice, 'custom');
    assert.equal(prefs.advertising, true);
    assert.equal(prefs.analytics, false);
    assert.equal(prefs.personalization, false);
  });

  it('re-prompts for an older consent version', async () => {
    const { COOKIE_CONSENT_KEY, getConsentFromRequestCookies } = await import('../consent');
    const priorDecision = encodeURIComponent(JSON.stringify({
      version: 3,
      choice: 'rejected',
      advertising: false,
      analytics: false,
    }));
    const prefs = getConsentFromRequestCookies(name =>
      name === COOKIE_CONSENT_KEY ? priorDecision : undefined,
    );
    assert.equal(prefs, null);
  });

  it('requires an analytics opt-in for server-side analytics writes', async () => {
    const { COOKIE_CONSENT_KEY, isAnalyticsAllowedOnRequest } = await import('../consent');
    const allowed = encodeURIComponent(JSON.stringify({
      version: 4,
      choice: 'custom',
      analytics: true,
      advertising: false,
    }));
    const rejected = encodeURIComponent(JSON.stringify({
      version: 4,
      choice: 'rejected',
      analytics: false,
      advertising: false,
    }));
    assert.equal(
      isAnalyticsAllowedOnRequest(name => name === COOKIE_CONSENT_KEY ? allowed : undefined),
      true,
    );
    assert.equal(
      isAnalyticsAllowedOnRequest(name => name === COOKIE_CONSENT_KEY ? rejected : undefined),
      false,
    );
  });
});

describe('quota-date', () => {
  it('uses business timezone date string', async () => {
    const { getQuotaDateString, QUOTA_TIMEZONE } = await import('../quota-date');
    assert.equal(QUOTA_TIMEZONE, 'Asia/Kolkata');
    assert.match(getQuotaDateString(new Date('2026-01-15T20:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('message-log-privacy', () => {
  it('redacts content to hash metadata', async () => {
    const { redactMessageLogContent } = await import('../message-log-privacy');
    const out = redactMessageLogContent('hello secret');
    assert.match(out, /^\[redacted:[a-f0-9]{12}\] len=\d+$/);
    assert.equal(out.includes('secret'), false);
  });
});

describe('admin-rbac', () => {
  it('super_admin has api_keys permission', async () => {
    const { roleHasPermission, getConfiguredAdminRole } = await import('../admin-rbac');
    assert.equal(getConfiguredAdminRole(), 'super_admin');
    assert.equal(roleHasPermission('super_admin', 'api_keys'), true);
    assert.equal(roleHasPermission('analytics', 'api_keys'), false);
  });
});

describe('geo-content', () => {
  it('has unique copy per major geo market', async () => {
    const { GEO_LOCAL_CONTENT } = await import('../geo-content');
    for (const code of ['us', 'uk', 'in', 'ca', 'au']) {
      assert.ok(GEO_LOCAL_CONTENT[code]?.headline);
      assert.ok(GEO_LOCAL_CONTENT[code]?.body);
    }
  });
});
