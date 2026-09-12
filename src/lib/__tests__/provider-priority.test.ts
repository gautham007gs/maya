import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderProvidersByRank, resolveRankConflicts } from '../provider-priority';

/**
 * Provider priority ordering — the heart of the admin rank feature.
 * Contract:
 *   ranked providers first, ascending by rank
 *   ties broken by position in the built-in default order
 *   unranked providers follow, preserving default order (auto fallback)
 *   ranks for unknown/removed providers are ignored
 */
const BASE = ['openrouter', 'gemini', 'cloudflare', 'groq', 'cerebras', 'deepseek'] as const;

describe('orderProvidersByRank', () => {
  it('empty ranks → exact default order (auto fallback)', () => {
    assert.deepEqual(orderProvidersByRank(BASE, {}), [...BASE]);
  });

  it('ranked providers float to the front in ascending rank', () => {
    const out = orderProvidersByRank(BASE, { deepseek: 1, gemini: 2 });
    assert.equal(out[0], 'deepseek');
    assert.equal(out[1], 'gemini');
    // unranked keep relative default order afterwards
    assert.deepEqual(out.slice(2), ['openrouter', 'cloudflare', 'groq', 'cerebras']);
  });

  it('ties on rank break by default order', () => {
    const out = orderProvidersByRank(BASE, { groq: 5, cerebras: 5 });
    const top2 = out.slice(0, 2);
    assert.ok(top2.includes('groq') && top2.includes('cerebras'));
    assert.equal(out.indexOf('groq') < out.indexOf('cerebras'), true, 'default order must break tie');
  });

  it('gaps in rank numbers are fine (1, 3, 7)', () => {
    const out = orderProvidersByRank(BASE, { cerebras: 7, openrouter: 1, groq: 3 });
    assert.deepEqual(out.slice(0, 3), ['openrouter', 'groq', 'cerebras']);
  });

  it('ignores ranks for providers not in the base order', () => {
    const out = orderProvidersByRank(BASE, { ghost_provider: 1 } as Record<string, number>);
    assert.deepEqual(out, [...BASE]);
  });

  it('full cascade scenario: ox-alpha era defaults + admin override', () => {
    // Default: openrouter first. Admin promotes groq to #1 and demotes openrouter to #3.
    const ranks = { openrouter: 3, groq: 1 };
    const out = orderProvidersByRank(BASE, ranks);
    assert.equal(out[0], 'groq');
    assert.equal(out[1], 'openrouter'); // forced to rank 3, still ahead of unranked
    assert.equal(out[out.length - 1], 'deepseek');
  });
});

describe('resolveRankConflicts', () => {
  it('passes a conflict-free map through unchanged', () => {
    assert.deepEqual(resolveRankConflicts({ gemini: 1, groq: 2 }, BASE), { gemini: 1, groq: 2 });
  });

  it('two providers claiming one rank → default order decides the winner', () => {
    // openrouter is earlier in the default order than gemini → keeps rank 2.
    assert.deepEqual(resolveRankConflicts({ gemini: 2, openrouter: 2 }, BASE), { openrouter: 2 });
  });

  it('displaced provider falls back to Auto (removed from the map)', () => {
    const out = resolveRankConflicts({ groq: 1 }, BASE);
    assert.deepEqual(out, { groq: 1 });
    assert.equal(Object.keys(resolveRankConflicts({ groq: 1, deepseek: 1 }, BASE)).length, 1);
    assert.deepEqual(resolveRankConflicts({ groq: 1, deepseek: 1 }, BASE), { groq: 1 });
  });

  it('resolves multiple conflicts across several ranks', () => {
    const out = resolveRankConflicts(
      { cerebras: 1, sambanova: 1, github: 3, nvidia: 3, mistral: 5 },
      ['openrouter', 'gemini', 'cloudflare', 'groq', 'cerebras', 'sambanova', 'github', 'nvidia', 'mistral', 'cohere', 'deepseek'],
    );
    assert.deepEqual(out, { cerebras: 1, github: 3, mistral: 5 });
  });

  it('drops invalid entries (non-integer / < 1) defensively', () => {
    assert.deepEqual(resolveRankConflicts({ gemini: 1.5, groq: 0, cloudflare: -2 } as any, BASE), {});
  });

  it('result is always unique per rank (no two providers share a rank)', () => {
    const messy = { gemini: 4, groq: 4, cerebras: 4, sambanova: 2, github: 2, openrouter: 7 };
    const out = resolveRankConflicts(messy, [...BASE, 'sambanova', 'github'] as string[]);
    const seen = new Set<number>();
    for (const r of Object.values(out)) {
      assert.ok(!seen.has(r), `duplicate rank ${r} in ${JSON.stringify(out)}`);
      seen.add(r);
    }
  });
});
