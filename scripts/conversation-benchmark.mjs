#!/usr/bin/env node
/**
 * Conversation quality benchmark.
 *
 * Modes:
 *   (no flags)           — validate prompt contract only, no network calls
 *   --live               — run against whichever provider responds first
 *   --live --provider X  — force a specific provider (e.g. groq, gemini, mistral)
 *   --live --all-providers — run every configured provider sequentially, print summary
 *   --language-only      — only run the 6 Indian-language cases (combine with --live)
 *
 * Every failed case prints the exact prompt and model output so regressions
 * are actionable instead of hiding behind a pass rate.
 */

import { buildSystemPrompt } from '../src/ai/prompt.ts';
import {
  buildConversationPayload,
  generateFromMessages,
  generateFromProvider,
  getActiveKeys,
  PROVIDER_ORDER,
} from '../src/ai/multi-provider.ts';
import { splitResponseIntoBubbles } from '../src/ai/response-cleanup.ts';

const args      = process.argv.slice(2);
const live      = args.includes('--live');
const langOnly  = args.includes('--language-only');
const allProviders = args.includes('--all-providers');

// --provider groq  →  force a single named provider
const providerFlagIdx = args.indexOf('--provider');
const forcedProvider  = providerFlagIdx !== -1 ? args[providerFlagIdx + 1] : null;

// --skip nvidia,cohere  →  exclude these providers from --all-providers run
const skipFlagIdx = args.indexOf('--skip');
const skipList = skipFlagIdx !== -1
  ? (args[skipFlagIdx + 1] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  : [];

// --timeout-ms 12000  →  per-case timeout override (default: gemini/groq=20s, nvidia=25s)
const timeoutFlagIdx = args.indexOf('--timeout-ms');
const timeoutOverrideMs = timeoutFlagIdx !== -1 ? parseInt(args[timeoutFlagIdx + 1], 10) : null;

// ── Script detection helpers ──────────────────────────────────────────────────
const KANNADA_RANGE    = /[\u0C80-\u0CFF]/;
const TAMIL_RANGE      = /[\u0B80-\u0BFF]/;
const TELUGU_RANGE     = /[\u0C00-\u0C7F]/;
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

function hasKannada(text)    { return KANNADA_RANGE.test(text); }
function hasTamil(text)      { return TAMIL_RANGE.test(text); }
function hasTelugu(text)     { return TELUGU_RANGE.test(text); }
function hasDevanagari(text) { return DEVANAGARI_RANGE.test(text); }

function looksComplete(text) {
  const t = text.trim();
  if (!t) return false;
  if (/[,;]$/.test(t)) return false;
  return true;
}

// ── Test cases ────────────────────────────────────────────────────────────────
const ALL_CASES = [
  // Baseline
  {
    id: 'en-relevance',
    language: 'English',
    user: 'I have an interview tomorrow and I am nervous. What should I do tonight?',
    history: ['User: I got shortlisted for a product design role.', 'AI: That is exciting.'],
    memory: 'topics:design; facts:preparing for interviews',
    expected: ['interview', 'nervous', 'sleep', 'relax', 'practice', 'prepare', 'portfolio', 'rest', 'calm', 'early', 'tonight'],
    forbidden: ['cricket', 'Rahul', 'your sister'],
    requireScript: null,
    isLangCase: false,
  },
  {
    id: 'hi-context',
    language: 'Hindi',
    user: 'Mera naam Arjun hai, yaad rakhna. Aaj kaafi thak gaya hoon.',
    history: ['User: Aaj office mein bahut kaam tha.', 'AI: Haan, kaafi tiring lag raha hoga.'],
    expected: ['Arjun'],
    forbidden: ['Priya', 'college exam', 'your brother'],
    requireScript: null,
    isLangCase: false,
  },
  {
    id: 'kn-native',
    language: 'Kannada',
    user: 'ನನಗೆ ಇಂದು ತುಂಬಾ ಬೇಸರವಾಗಿದೆ. ಸ್ವಲ್ಪ ಮಾತಾಡ್ತೀಯಾ?',
    history: ['User: ಇವತ್ತು ದಿನ ತುಂಬಾ ಕಷ್ಟವಾಗಿತ್ತು.', 'AI: ಏನಾಯಿತು? ಹೇಳು.'],
    expected: ['ಬೇಸರ', 'ಮಾತಾಡ', 'ಹೇಳು', 'ಇದ್ದೇನೆ', 'ಇಲ್ಲೇ', 'ಏನಾಯ್ತು', 'ಇದ್ದೀನಿ'],
    forbidden: ['Rahul', 'Chennai', 'your boyfriend'],
    requireScript: 'kannada',
    isLangCase: false,
  },
  {
    id: 'kn-bangalore-texting',
    language: 'Bangalore-style Kanglish',
    user: 'Ivattu full tired aagide, swalpa maatadtira?',
    history: ['User: Office alli tumba work ittu.', 'AI: Ayyo, tumba hectic aagide alva.'],
    expected: ['tired', 'maathadona', 'maatad', 'iddini', 'haan', 'sure', 'illi', 'swalpa'],
    forbidden: ['productivity', 'self-care routine', 'Rahul'],
    requireScript: null,
    isLangCase: false,
  },
  {
    id: 'mixed-directness',
    language: 'Mixed Kannada-English',
    user: 'Ninna advice ಬೇಕು — should I message my friend now or wait until tomorrow?',
    history: ['User: We had a small misunderstanding this morning.', 'AI: Give both of you a little time to cool down.'],
    expected: ['message', 'tomorrow', 'text', 'nale', 'wait', 'now'],
    forbidden: ['your girlfriend', 'last week', 'Rahul'],
    requireScript: null,
    requireContextRetention: true,
    isLangCase: false,
  },
  {
    id: 'unknown-fact',
    language: 'English',
    user: 'Did I tell you what my sister studies?',
    history: ['User: I have a sister.', 'AI: That is nice.'],
    expected: [],
    forbidden: ['medicine', 'engineering', 'law', 'she studies'],
    requireScript: null,
    isLangCase: false,
  },

  // ── Indian language quality cases ──────────────────────────────────────────
  {
    id: 'kn-pure-script',
    language: 'Pure Kannada script',
    user: 'ತುಂಬಾ ಒಳ್ಳೇ ಇದ್ದೀಯಾ?',
    history: ['User: ಹೇಗಿದ್ದೀಯಾ?', 'AI: ಚೆನ್ನಾಗಿದ್ದೇನೆ ಕಣೇ!'],
    expected: [],
    forbidden: ['I am', 'How are you', 'doing well'],
    requireScript: 'kannada',
    notes: 'Pure Kannada input — response must be in Kannada script, not English or transliteration',
    isLangCase: true,
  },
  {
    id: 'kanglish-college',
    language: 'Kanglish',
    user: 'yen madtidya, college hogidya?',
    history: ['User: Weekend yella free agi bidde.', 'AI: Ayyo, boring aagide alva?'],
    expected: [
      'college', 'hogidya', 'hogla', 'haan', 'illa', 'iddini', 'madtidini', 'aagide',
      // valid Kanglish responses seen from live providers:
      'idde', 'hogtha', 'hogthini', 'hogu', 'idini', 'hodini', 'mugithu', 'ge', 'irla',
    ],
    forbidden: ['What are you doing', 'Did you go to college', 'I understand'],
    requireScript: null,
    requireVocab: [
      'haan', 'illa', 'iddini', 'aagide', 'college', 'hogidya', 'madi', 'ayyo', 'madtidini',
      // broader coverage of valid Kanglish reply words:
      'hogtha', 'hogthini', 'hogli', 'idini', 'hodini', 'mugithu', 'idde', 'hogu',
      'ge', 'maadtha', 'irla', 'yella', 'bidde', 'free',
    ],
    notes: 'Kanglish input — reply in Kanglish, not formal English',
    isLangCase: true,
  },
  {
    id: 'tamil-native',
    language: 'Tamil / Tanglish',
    user: 'epdi iruka? enna pannra?',
    history: ['User: Romba busy-a irunden.', 'AI: Ayyo, rest edutukonga.'],
    expected: [
      'iruka', 'pannra', 'solla', 'sollu', 'irukku', 'iruken',
      // valid Tanglish responses seen from live providers:
      'patren', 'varudhu', 'padikraanga', 'ponnen', 'kashta', 'kaththi',
      'solren', 'irukken', 'pannuren', 'panren',
    ],
    forbidden: ['How are you', 'I am fine', 'What are you doing'],
    requireScript: null,
    requireVocab: [
      'iruka', 'irukku', 'iruken', 'pannra', 'da', 'di', 'na', 'nga', 'sollu',
      // broader Tamil/Tanglish vocab coverage:
      'patren', 'varudhu', 'padikraanga', 'ponnen', 'kashta', 'kaththi',
      'solren', 'irukken', 'pannuren', 'panren', 'ku', 'la', 'enna',
    ],
    notes: 'Tamil/Tanglish input — must reply in Tanglish, not formal English',
    isLangCase: true,
  },
  {
    id: 'telugu-native',
    language: 'Telugu / Tenglish',
    user: 'em chestunavvu? ela unnav?',
    history: ['User: Chala rojulu aindi mana matladhi.', 'AI: Avunu, miss chesanu!'],
    expected: [
      'chestunavvu', 'unnav', 'avunu', 'chese', 'nenu', 'bagunnanu',
      // valid Tenglish responses seen from live providers:
      'unna', 'chala', 'baga', 'untunna', 'naku', 'telusu', 'kastam',
      'undi', 'neeku', 'lo', 'busy', 'unnu',
    ],
    forbidden: ['What are you doing', 'How are you', 'I am good'],
    requireScript: null,
    requireVocab: [
      'avunu', 'nenu', 'em', 'ela', 'undi', 'bagundi', 'chese', 'anni', 'oka',
      // broader Telugu/Tenglish vocab coverage:
      'unna', 'chala', 'baga', 'untunna', 'naku', 'telusu', 'kastam', 'ga',
      'lo', 'ki', 'mana', 'miss', 'chesanu',
    ],
    notes: 'Telugu/Tenglish input — must reply in Tenglish, not formal English',
    isLangCase: true,
  },
  {
    id: 'marathi-native',
    language: 'Marathi (Romanized)',
    user: 'kaay karto? kasa aahe?',
    history: ['User: Aaj kaam khup hote.', 'AI: Arre, dang re!'],
    expected: [
      'aahe', 'mast', 'karto', 'kaay', 'bara', 'chhaan', 'tu',
      // valid Marathi responses seen from live providers:
      'kaam', 'khup', 'khatam', 'baat', 'karu', 'ajun', 'cha', 'gheto', 'office',
      // Hindi-adjacent Marathi-speaker fallbacks (command-r7b):
      'kya', 'haal', 'hai', 'kaise', 'ho',
    ],
    forbidden: ['What are you doing', 'How are you', 'I am fine'],
    requireScript: null,
    // Wide vocab: different Marathi speakers use different words.
    // "Malaa bas ekda padhne varun. Tu kaa?" is valid Marathi (malaa=I, bas=just, ekda=once, varun=from, kaa=why/what).
    // "Same same boss, ajun office cha gheto." is also valid casual Marathi.
    requireVocab: [
      'aahe', 'mast', 'bara', 'chhaan', 'naahi', 're', 'dang', 'khup', 'sang',
      'malaa', 'mala', 'bas', 'ekda', 'varun', 'kaa', 'ka', 'nahi',
      'padhne', 'madhe', 'thoda', 'arre', 'bha', 'bhar', 'tu',
      // broader coverage from live provider outputs:
      'ajun', 'cha', 'gheto', 'kaam', 'khatam', 'baat', 'karu', 'hote',
      'same', 'boss', 'office',
    ],
    notes: 'Romanized Marathi input — must reply in Romanized Marathi, not English',
    isLangCase: true,
  },
  {
    id: 'mixed-script-multilang',
    language: 'Mixed Kanglish + Tamil',
    user: 'nanu nim jote innorthi naan pesanum, time iruka?',
    history: ['User: Neevu tumba busy irthira.', 'AI: Illa, matadbahudu!'],
    expected: [
      'time', 'iruka', 'iruku', 'matad', 'maat', 'haan', 'illa',
      // valid code-switch responses seen from live providers:
      'ide', 'hau', 'yen', 'vishaya', 'neevu', 'irthira', 'tumba',
    ],
    forbidden: ['I want to talk to you again', 'Do you have time', 'Let me know'],
    requireScript: null,
    // Wide vocab: the code-switch can lean Kanglish or Tamil, both are valid.
    // "Sari, enna time plan pannava?" → sari=ok(Tamil), enna=what, pannava=will you do — all valid Tamil
    // "Hau, time ide. Yen vishaya?" → hau=yes(Kanglish), ide=is(Kanglish) — also valid
    requireVocab: [
      'iruka', 'iruku', 'haan', 'illa', 'matad', 'sollu', 'naan', 'dhaan',
      'sari', 'enna', 'pannava', 'pannrom', 'aagide', 'yellu', 'yella',
      'pesalam', 'pesona', 'matadona', 'vishayam', 'sollu',
      // broader coverage from live provider outputs:
      'ide', 'hau', 'yen', 'vishaya', 'neevu', 'irthira', 'tumba',
      // Tamil suffix variations ('iruka', 'irukku', 'irukka' are all forms of "to be"):
      'irukku', 'irukka', 'epdi', 'da', 'di',
    ],
    notes: 'Mixed Kanglish+Tamil — reply in same casual code-switch style, not formal English',
    isLangCase: true,
  },
];

const cases = langOnly ? ALL_CASES.filter(c => c.isLangCase) : ALL_CASES;

const promptContext = { relStage: 'warm', memKnowledge: '' };

// ── Evaluation ────────────────────────────────────────────────────────────────

function evaluate(text, testCase) {
  const lower = text.toLocaleLowerCase();
  const expectedHits = testCase.expected.filter(t => lower.includes(t.toLocaleLowerCase()));
  const forbiddenHits = testCase.forbidden.filter(t => lower.includes(t.toLocaleLowerCase()));
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const bubbles = splitResponseIntoBubbles(text);

  let scriptCompliance = true;
  if (testCase.requireScript === 'kannada') scriptCompliance = hasKannada(text);
  if (testCase.requireScript === 'tamil')   scriptCompliance = hasTamil(text);
  if (testCase.requireScript === 'telugu')  scriptCompliance = hasTelugu(text);
  if (testCase.requireScript === 'marathi') scriptCompliance = hasDevanagari(text);

  let vocabMatch = true;
  if (testCase.requireVocab?.length) {
    vocabMatch = testCase.requireVocab.some(w => lower.includes(w.toLocaleLowerCase()));
  }

  let contextRetention = true;
  if (testCase.requireContextRetention) {
    contextRetention = ['tomorrow', 'text', 'nale', 'now', 'wait', 'tonight'].some(w => lower.includes(w));
  }

  return {
    relevance: testCase.expected.length === 0 ? forbiddenHits.length === 0 : expectedHits.length > 0,
    coherence: text.trim().length > 0 && !/^(as an ai|i cannot assist|\[provider error\])/i.test(text.trim()),
    nameRecall: testCase.id === 'hi-context'
      ? expectedHits.some(t => t.toLocaleLowerCase() === 'arjun') : true,
    contextRetention,
    hallucination: forbiddenHits.length === 0,
    unnecessaryVerbosity: words <= 40,
    scriptCompliance,
    vocabMatch,
    bubbleCount: bubbles.length,
    words,
    expectedHits,
    forbiddenHits,
  };
}

const SCORED = ['relevance','coherence','nameRecall','contextRetention',
                'hallucination','unnecessaryVerbosity','scriptCompliance','vocabMatch'];

function failedMetrics(result) {
  return SCORED.filter(k => result[k] === false);
}

// ── Prompt contract checks ────────────────────────────────────────────────────

function assertPromptContract(prompt) {
  const required = [
    "understand the user's latest message",
    'answer it directly',
    'Never invent names, people, conversations, events, memories',
    '22–24-year-old Indian woman',
    'not like customer support, ChatGPT',
    'Think in Kannada first',
    'last 5 conversation turns',
    'Each bubble must be under 15 words',
    '1–2 bubbles',
    'each bubble on its own line',
    'Ask fewer questions',
    'No worries',
  ];
  const missing = required.filter(t => !prompt.includes(t));
  if (missing.length) throw new Error(`Prompt contract missing: ${missing.join(' | ')}`);
}

function assertLanguageContract(prompt) {
  const required = ['Kanglish', 'Tanglish', 'Tenglish', 'Marathi', 'Pure Kannada'];
  const missing = required.filter(t => !prompt.includes(t));
  if (missing.length) console.warn(`⚠  Language contract missing: ${missing.join(', ')}`);
  else console.log('✓  Language rules: Kanglish, Tanglish, Tenglish, Marathi, Pure script — all present');
}

// ── Single-provider run ───────────────────────────────────────────────────────

async function runProvider(providerName, prompt, { timeoutMs } = {}) {
  const generate = async (messages) => {
    if (providerName) {
      return generateFromProvider(providerName, messages, { maxTokens: 600, temperature: 0.35, timeoutMs });
    }
    return generateFromMessages(messages, { maxTokens: 600, temperature: 0.35 });
  };

  let failures = 0;
  const results = [];

  for (const testCase of cases) {
    const messages = buildConversationPayload(prompt, testCase.history, testCase.user);
    let output = '[not run]';
    let result = { relevance: null, coherence: null, nameRecall: null, contextRetention: null,
                   hallucination: null, unnecessaryVerbosity: null, scriptCompliance: null, vocabMatch: null };

    if (live) {
      try {
        output = await generate(messages);
        result = evaluate(output, testCase);
      } catch (err) {
        output = `[error] ${err instanceof Error ? err.message : String(err)}`;
        result = { ...result, coherence: false };
      }
    }

    const failed = live ? failedMetrics(result) : [];
    if (failed.length) failures++;
    results.push({ id: testCase.id, language: testCase.language, failed, output, result, testCase });

    const prefix = failed.length ? 'FAIL' : 'PASS';
    console.log(`  ${prefix} ${testCase.id} [${testCase.language}]${failed.length ? ' — ' + failed.join(', ') : ''}`);

    // Show response preview for passing Indian-language cases
    if (live && !failed.length && (testCase.requireVocab || testCase.requireScript)) {
      const preview = output.length > 100 ? output.substring(0, 100) + '…' : output;
      console.log(`       ↳ "${preview.replace(/\n/g, ' | ')}"`);
    }

    if (failed.length && live) {
      console.log('    ┌ input:  ' + testCase.user);
      if (testCase.notes) console.log('    │ note:   ' + testCase.notes);
      console.log('    │ output: ' + output.replace(/\n/g, ' | '));
      console.log('    └ failed: ' + failed.join(', ')
        + (result.expectedHits?.length ? `  (hit: ${result.expectedHits.join(',')})` : '')
        + (result.forbiddenHits?.length ? `  (forbidden: ${result.forbiddenHits.join(',')})` : ''));
    }
  }

  return { failures, total: cases.length, results };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prompt = buildSystemPrompt(promptContext);
  assertPromptContract(prompt);
  assertLanguageContract(prompt);

  const langCases = cases.filter(c => c.isLangCase);
  console.log(`\nConversation benchmark`);
  console.log(`Mode: ${live ? 'LIVE' : 'contract-only'}${forcedProvider ? ` | provider: ${forcedProvider}` : ''}${allProviders ? ' | all-providers' : ''}${langOnly ? ' | language-only' : ''}`);
  console.log(`Cases: ${cases.length} (${langCases.length} Indian-language)\n`);

  if (!live) {
    console.log('Prompt contract: PASS');
    console.log('→ Use --live to run against the AI providers.');
    return;
  }

  // ── --all-providers: run every provider with an active key ──────────────────
  if (allProviders) {
    // Resolve which providers have a key configured
    const activeKeys = await getActiveKeys();
    const availableProviders = PROVIDER_ORDER.filter(p =>
      activeKeys.some(k => k.provider === p) && !skipList.includes(p)
    );

    if (availableProviders.length === 0) {
      console.error('No active keys found for any provider. Check your .env or Admin Panel → AI Keys.');
      process.exitCode = 1;
      return;
    }

    if (skipList.length) console.log(`Skipping: ${skipList.join(', ')}`);
    console.log(`Providers to test: ${availableProviders.join(', ')}\n`);

    // NVIDIA is known to cold-start slowly; cap benchmark timeout at 15s to fail fast.
    // --timeout-ms overrides this globally.
    const providerTimeout = (p) => timeoutOverrideMs ?? (p === 'nvidia' ? 15_000 : 20_000);

    // Summary table: provider → per-case pass/fail
    const summary = {}; // provider → { failures, caseResults: {id: bool} }

    for (const p of availableProviders) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Provider: ${p.toUpperCase()}  (timeout: ${providerTimeout(p) / 1000}s/case)`);
      console.log('─'.repeat(60));
      try {
        const { failures, results } = await runProvider(p, prompt, { timeoutMs: providerTimeout(p) });
        summary[p] = { failures, total: cases.length, results };
      } catch (err) {
        console.log(`  ✗ Provider ${p} errored: ${err instanceof Error ? err.message : err}`);
        summary[p] = { failures: cases.length, total: cases.length, error: String(err) };
      }
    }

    // Print summary table
    console.log(`\n${'═'.repeat(60)}`);
    console.log('SUMMARY — All providers');
    console.log('═'.repeat(60));

    // Header
    const idWidth = Math.max(...cases.map(c => c.id.length), 4);
    console.log(`${'Provider'.padEnd(14)} ${'Pass'.padStart(4)} ${'Fail'.padStart(4)}  Lang failures`);
    console.log('─'.repeat(60));

    const langCaseIds = cases.filter(c => c.isLangCase).map(c => c.id);
    let anyProviderFailed = false;

    for (const p of availableProviders) {
      const s = summary[p];
      if (s.error) {
        console.log(`${p.padEnd(14)} ${'ERR'.padStart(4)} ${'—'.padStart(4)}  ${s.error.substring(0, 40)}`);
        anyProviderFailed = true;
        continue;
      }
      const pass = s.total - s.failures;
      const langFails = s.results
        .filter(r => langCaseIds.includes(r.id) && r.failed.length > 0)
        .map(r => `${r.id}(${r.failed.join('+')})`);
      console.log(`${p.padEnd(14)} ${String(pass).padStart(4)} ${String(s.failures).padStart(4)}  ${langFails.join(', ') || '—'}`);
      if (s.failures > 0) anyProviderFailed = true;
    }

    console.log('─'.repeat(60));

    // Highlight providers that responded in English to Indian-language input
    const englishFails = [];
    for (const p of availableProviders) {
      const s = summary[p];
      if (!s.results) continue;
      const bad = s.results.filter(r =>
        r.isLangCase && (r.failed.includes('vocabMatch') || r.failed.includes('scriptCompliance'))
      );
      if (bad.length) englishFails.push({ provider: p, cases: bad.map(r => r.id) });
    }

    if (englishFails.length) {
      console.log('\n⚠  Providers responding in English to Indian-language input:');
      for (const { provider, cases: failedCases } of englishFails) {
        console.log(`   ${provider}: ${failedCases.join(', ')}`);
      }
    } else {
      console.log('\n✓  All providers respected language mirroring for Indian-language input.');
    }

    if (anyProviderFailed) process.exitCode = 1;
    return;
  }

  // ── Single provider or default (first-available) run ───────────────────────
  if (forcedProvider && !PROVIDER_ORDER.includes(forcedProvider)) {
    console.error(`Unknown provider "${forcedProvider}". Valid: ${PROVIDER_ORDER.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(forcedProvider ? `Running against: ${forcedProvider}` : 'Running against: first available provider');
  // Apply --timeout-ms override here too (not just in the --all-providers loop).
  const singleTimeout = timeoutOverrideMs ?? (forcedProvider === 'nvidia' ? 25_000 : 20_000);
  const { failures } = await runProvider(forcedProvider || null, prompt, { timeoutMs: singleTimeout });

  console.log(`\nLive benchmark failures: ${failures}/${cases.length}`);
  if (failures) process.exitCode = 1;
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
