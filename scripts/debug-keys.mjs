#!/usr/bin/env node
/**
 * Debug script: check which providers have active keys via getActiveKeys()
 */
import { getActiveKeys } from '../src/ai/multi-provider.ts';

async function main() {
  const all = await getActiveKeys();
  console.log('Total active keys:', all.length);
  const byProvider = {};
  for (const k of all) {
    byProvider[k.provider] = byProvider[k.provider] || [];
    byProvider[k.provider].push({ label: k.key_label, id: k.id, status: k.status });
  }
  console.log('By provider:');
  for (const [p, keys] of Object.entries(byProvider)) {
    console.log(`  ${p}: ${keys.map(k => `${k.label}(id=${k.id},${k.status})`).join(', ')}`);
  }

  for (const p of ['nvidia', 'cohere', 'deepseek', 'cerebras']) {
    const keys = await getActiveKeys(p);
    console.log(`  ${p} specific: ${keys.length} keys`);
  }
}

main().catch(console.error);
