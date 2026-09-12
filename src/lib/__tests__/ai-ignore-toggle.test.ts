import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveIgnoreGate, shouldAIBeBusyServerSafe } from '../../ai/ignore-utils';

/**
 * Tests for the global admin toggle on the AI-ignore feature.
 *
 * Contract (Admin → AI Replies):
 *   ignore_enabled = true   → gate result passes through untouched
 *   ignore_enabled = false  → AI NEVER ignores — not even an already-running
 *                             pause; no new pause timestamp may be emitted.
 */

const ACTIVE_PAUSE_RESULT = {
  shouldIgnore: true,
  newIgnoreUntil: Date.now() + 30 * 60 * 1000,
  busyReason: 'in college lab, brb!',
  shouldWarnFirst: true,
};

describe('AI ignore global toggle (resolveIgnoreGate)', () => {
  it('enabled → gate result passes through unchanged', () => {
    const out = resolveIgnoreGate(true, ACTIVE_PAUSE_RESULT);
    assert.equal(out.shouldIgnore, true);
    assert.equal(out.shouldWarnFirst, true);
    assert.equal(out.busyReason, ACTIVE_PAUSE_RESULT.busyReason);
    assert.equal(out.newIgnoreUntil, ACTIVE_PAUSE_RESULT.newIgnoreUntil);
  });

  it('disabled → never ignores, even with an active pause', () => {
    const out = resolveIgnoreGate(false, ACTIVE_PAUSE_RESULT);
    assert.equal(out.shouldIgnore, false);
    assert.equal(out.newIgnoreUntil, undefined, 'no new pause may be persisted while OFF');
    assert.equal(out.busyReason, undefined);
    assert.equal(out.shouldWarnFirst, undefined);
  });

  it('disabled → a would-trigger gate is also suppressed', () => {
    const wouldTrigger = {
      shouldIgnore: true,
      newIgnoreUntil: Date.now() + 60 * 60 * 1000,
      busyReason: 'watching a show, brb!',
      shouldWarnFirst: true,
    };
    const out = resolveIgnoreGate(false, wouldTrigger);
    assert.equal(out.shouldIgnore, false);
  });

  it('enabled → a non-ignore result stays non-ignore (identity)', () => {
    const calm = { shouldIgnore: false };
    assert.deepEqual(resolveIgnoreGate(true, calm), calm);
  });

  it('toggle round-trip: OFF then ON restores normal gate behaviour', () => {
    // While OFF nothing sticks; when re-enabled the pure gate decides again.
    const off = resolveIgnoreGate(false, ACTIVE_PAUSE_RESULT);
    assert.equal(off.shouldIgnore, false);
    // New evaluation happens fresh each message — simulate enabled path:
    const on = resolveIgnoreGate(true, { shouldIgnore: true });
    assert.equal(on.shouldIgnore, true);
  });
});

describe('shouldAIBeBusyServerSafe safety rails (unchanged by toggle work)', () => {
  it('new users are never ignored regardless of toggle wiring upstream', () => {
    for (let i = 0; i < 200; i++) {
      const r = shouldAIBeBusyServerSafe(null, { dailyMessageCount: 5, relationshipLevel: 0.9, totalDaysActive: 1 }, []);
      assert.equal(r.shouldIgnore, false);
    }
  });
});
