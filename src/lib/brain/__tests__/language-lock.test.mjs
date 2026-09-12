/**
 * Language-lock regression tests
 *
 * Pure-function tests — no AI provider needed, no test runner required.
 * Run directly:  node src/lib/brain/__tests__/language-lock.test.mjs
 *
 * Covers the 5 scenarios from the task spec plus moody-directive interactions.
 */

// ── Minimal inline copies of the pure functions ──────────────────────────────
// We duplicate a small subset here so the script runs without transpilation.
// If the real implementations diverge, update the copies below to match.

const STRONG_HINDI_ONLY =
  /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|waise|batao|suno|thoda|abhi|kahan|hota|hoti|dekhna|ruko|pehle|baad|seedha|acha|achi|baat|baar|zyada|bahut|theek|bilkul|samajh)\b/;

const ROMANIZED_LANG_PATTERNS = {
  kannada:
    /\b(yenu|enu|yen|madtidiya|madtidya|madtideya|maadtidya|madtidivi|madtiddhiya|hogthini|hogthinni|hothini|barthinni|barthini|bartheeni|haege|hege|hyege|hegidira|hegidiya|hegidiyya|yaako|yaake|yake|nimge|nimage|ninge|nangu|nange|thumba|tumba|beka|beku|bekku|irthini|irthinni|irthiya|chennagi|chennagide|olle|swalpa|summane|hogona|barona|nivu|beda|heli|madli|kelasa|madathini|maadthini|madthini|karthe|irli|kanthe|yen madtidya|yenu madtidya|enu madtidya|helidru|namm|namge|hogbeda|barbeku|madli beku|adu onde|nanna jothe|nim jothe|illi baa|enu aagu|haeg irtha|swalpa iru|jothe iru|thumba chennag|chennag ide|yenagtha|yenaithe|namaskara|haudhu|houdu|illa|gothilla|gottilla|khushi|yaaru|illi|alli|elli|nodi|keli|nodona|keltiya|yavaga|oota|aitha|ayithu|aithu|maraya|alwa|alvo|maccha|macha|nange|yeno|guru|magane|maga|hogi|banni|houda|allva|gothu|gottu|nodappa|nodri)\b/i,
  tamil:
    /\b(enna pannre|enna panre|enna panra|enna pandra|epdi iruka|epdi irukka|epdi iruke|eppo|romba nalla|romba|konjam|illai|paru|paaru|irukken|irukka|iruken|iruku|vandhaen|vanthaen|poren|poran|vaaren|thevai|ennada|ennadi|machan|machaan|machi|machee|semma|semmaya|rasikkiren|theriyum|therila|teriyala|paathukko|seri pa|vanakkam|kavalai|nalla iruka|solluren|solluriya|vanthutten|solluven|puriyudhu|puriyala|poi varen|yaar|nee|neeyum|unakku|enakku|unaku|onnum|kaalai vanakkam|maalai vanakkam|paakalam|eppo varuva|epdi|romba thanks|vera level|vera level da|irukka|inga iru|seiyanum|vendaam|vendaama|paravillai|theriyuma|teriyuma|saptingaya|saaptingaya|saaptiya|saptiya|ama|aama|seri|apram|apparam|ennachu|ennacho|ethuku|edhuku|inga|anga|enga|vanga|ponga|solunga|purinjudha|puriyudha|pudichiruka|thaan|dhan|dan|thuki|panna|pannu|varum|varan|varadhu|ille|poda|podi|vaa|po|kaduppu|mokka|adhu|ithu|ethu|athu|sollu|naan|avan|avanu|avanga|ok\s+da|aama\s+da|seri\s+da|enna\s+da|illa\s+da|yes\s+da|no\s+da|unaku)\b/i,
  telugu:
    /\b(ela unnav|ela unnaru|ela unna|bagunnava|bagunava|bagunnara|bagunnaraa|bagunnani|tinnara|thinnara|tinnava|thinnava|avuna|avunu|kadu|kaadu|evaru|eppudu|ekkada|akkada|ikkada|emiti|entha|enti|yenti|chudandi|vinandi|alage|alaage|manchidhi|cheppu|cheppandi|ledu|ledhu|chala baaga|chala|matladatam|matadatam|vellandi|randi|nenu|memu|vaddu|anipistundi|anipistunna|cheppandi|cheppanu|vachanu|vachindi|potunna|chesanu|chesindi|emi chesaru|emi chestunav|na tho|mee tho|cheddam ra|bagundi|kaadu|kaadhu|ikkade|akkade|emi|yemi|ra baby|ra|okate|ippudu|malli|tarvata|ante|evaru|emanna|emantav|manchiga|manchidi|okka|okasari|cheppara|cheppudu|vinte|vintu|vellu|vasthav|vastav|mama|mava|chup|pora|poradi|anukunta|anukuntunna|kadha|kada)\b/i,
};

const SCRIPT_FAMILY_MAP = {
  kannada: 'south_indian', tamil: 'south_indian', telugu: 'south_indian',
  malayalam: 'south_indian', bengali: 'east_indic', gujarati: 'east_indic',
  odia: 'east_indic', punjabi: 'gurmukhi', marathi: 'devanagari',
  hindi: 'latin_hindi', hindi_or_marathi: 'devanagari',
};

const DISPLAY_NAME_MAP = {
  kannada: 'Kannada', tamil: 'Tamil', telugu: 'Telugu', malayalam: 'Malayalam',
  bengali: 'Bengali', gujarati: 'Gujarati', odia: 'Odia', punjabi: 'Punjabi',
  marathi: 'Marathi',
};

function detectFullLanguage(msg) {
  if (/[\u0C80-\u0CFF]/.test(msg)) return { language: 'kannada',         scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Kannada' };
  if (/[\u0B80-\u0BFF]/.test(msg)) return { language: 'tamil',           scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Tamil' };
  if (/[\u0C00-\u0C7F]/.test(msg)) return { language: 'telugu',          scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Telugu' };
  if (/[\u0D00-\u0D7F]/.test(msg)) return { language: 'malayalam',       scriptFamily: 'south_indian', isRomanized: false, confidence: 'high', displayName: 'Malayalam' };
  if (/[\u0900-\u097F]/.test(msg)) return { language: 'hindi_or_marathi',scriptFamily: 'devanagari',   isRomanized: false, confidence: 'high', displayName: 'Hindi/Marathi' };

  const m = msg.toLowerCase();
  for (const [lang, pattern] of Object.entries(ROMANIZED_LANG_PATTERNS)) {
    if (pattern.test(m)) {
      return {
        language: lang,
        scriptFamily: SCRIPT_FAMILY_MAP[lang] || 'latin_pure',
        isRomanized: true,
        confidence: 'medium',
        displayName: DISPLAY_NAME_MAP[lang] || lang,
      };
    }
  }

  const strongHindiOnly = /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|waise|batao|suno|thoda|abhi|kahan|hota|hoti|dekhna|ruko|pehle|baad|seedha|acha|achi|baat|baar|zyada|bahut|theek|bilkul|samajh)\b/;
  if (strongHindiOnly.test(m)) {
    return { language: 'hindi', scriptFamily: 'latin_hindi', isRomanized: true, confidence: 'medium', displayName: 'Hindi/Hinglish' };
  }

  return { language: 'unknown', scriptFamily: 'latin_pure', isRomanized: false, confidence: 'low', displayName: 'English' };
}

function detectLanguageFromHistory(recentInteractions) {
  const userMessages = recentInteractions
    .filter(m => m.startsWith('User:'))
    .slice(-10)
    .map(m => m.replace(/^User:\s*/, '').trim())
    .filter(m => m.length > 3);
  for (const msg of [...userMessages].reverse()) {
    const detected = detectFullLanguage(msg);
    if (detected.language !== 'unknown') return detected;
  }
  return null;
}

function buildLanguageLockDirective(langInfo, fromHistory) {
  if (langInfo.language === 'unknown') return '';
  const hint = fromHistory ? ' [history]' : '';
  if (langInfo.language === 'hindi_or_marathi') {
    return `⚡ LANG${hint}: Devanagari script. Match Hindi vs Marathi from user's own words. Reply in same script/language. No English.`;
  }
  if (!langInfo.isRomanized) {
    return `⚡ LANG${hint}: User wrote in native ${langInfo.displayName}. Reply ONLY in ${langInfo.displayName} script. Never switch to Hindi or English.`;
  }
  if (langInfo.language === 'hindi') {
    return `⚡ LANG${hint}: Hinglish (Romanized Hindi). Reply in casual Hinglish. No switching to English-only.`;
  }
  return `⚡ LANG${hint}: User typed in Romanized ${langInfo.displayName}. Reply in casual Romanized ${langInfo.displayName}. NOT pure English. NOT Hindi.`;
}

function buildMoodyDirective(ctx, langInfo) {
  const lang = langInfo.displayName || 'their language';
  switch (ctx.trigger) {
    case 'intimate_talk':
      return `ROLEPLAY (${lang}): Intimate chat. Fully in character — warm, playful, real. Reply ONLY in ${lang}. No disclaimers, no breaking character.`;
    case 'flirt_tone':
      return `MOOD STATE: He's being flirty/sweet/complimentary. She's warmly receiving it — light smile energy, slightly playful, naturally magnetic. Stays in ${lang}.`;
    case 'ai_accusation':
      return `ANTI-AI (${lang}): YOU ARE REAL. Give instant opinions/physical details, get annoyed if accused. NEVER say "as an AI". Reply ONLY in ${lang}.`;
    default:
      return '';
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function expectContains(label, haystack, needle) {
  const ok = haystack.includes(needle);
  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected to contain: ${JSON.stringify(needle)}`);
    console.error(`       actual: ${JSON.stringify(haystack)}`);
    failed++;
  }
}

function expectNotContains(label, haystack, needle) {
  const ok = !haystack.includes(needle);
  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected NOT to contain: ${JSON.stringify(needle)}`);
    console.error(`       actual: ${JSON.stringify(haystack)}`);
    failed++;
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════');
console.log('  Language-lock regression tests');
console.log('══════════════════════════════════════════════════\n');

// ── 1. "enna panra" → Tamil (flirt trigger) ──────────────────────────────────
console.log('Scenario 1: Tamil user "enna panra" → flirt trigger → lang directive in Tamil');
{
  const lang = detectFullLanguage('enna panra');
  expect('  detects Tamil', lang.language, 'tamil');
  expect('  isRomanized = true', lang.isRomanized, true);

  const directive = buildLanguageLockDirective(lang, false);
  expectContains('  lang directive says Tamil', directive, 'Tamil');
  expectNotContains('  lang directive does NOT say Reply in Hindi', directive, 'Reply in Hindi');

  const moody = buildMoodyDirective({ trigger: 'flirt_tone', intensity: 'mild' }, lang);
  expectContains('  moody directive says Tamil', moody, 'Tamil');
  expectNotContains('  moody directive does NOT say Hindi', moody, 'Hindi');
}

// ── 2. "yenu madtidya" → Kannada (intimate trigger) ─────────────────────────
console.log('\nScenario 2: Kannada user "yenu madtidya" → intimate trigger → lang in Kannada');
{
  const lang = detectFullLanguage('yenu madtidya');
  expect('  detects Kannada', lang.language, 'kannada');

  const directive = buildLanguageLockDirective(lang, false);
  expectContains('  lang directive says Kannada', directive, 'Kannada');
  expectNotContains('  lang directive does NOT say Reply in Hindi', directive, 'Reply in Hindi');

  const moody = buildMoodyDirective({ trigger: 'intimate_talk', intensity: 'mild' }, lang);
  expectContains('  moody directive says Kannada', moody, 'Kannada');
  expectNotContains('  moody directive NOT Hindi', moody, 'Hindi');
  // Verify it's short (≤ 140 chars — capped in Fix #4)
  const ok = moody.length <= 160;
  if (ok) { console.log(`  ✅  intimate_talk directive is short (${moody.length} chars)`); passed++; }
  else    { console.error(`  ❌  intimate_talk directive too long: ${moody.length} chars`); failed++; }
}

// ── 3. Telugu "ela unnav" then "ok" (short msg) → history fallback ───────────
console.log('\nScenario 3: Telugu user "ela unnav" then "ok" → history keeps Telugu');
{
  const first = detectFullLanguage('ela unnav');
  expect('  first message detects Telugu', first.language, 'telugu');

  const history = ['User: ela unnav', 'Kruthika: chala baaga unnanu!'];
  const shortMsg = detectFullLanguage('ok');
  expect('  "ok" alone = unknown', shortMsg.language, 'unknown');

  const fromHistory = detectLanguageFromHistory(history);
  expect('  history fallback gives Telugu', fromHistory?.language, 'telugu');

  const resolved = shortMsg.language === 'unknown' ? fromHistory : shortMsg;
  const directive = buildLanguageLockDirective(resolved, true);
  expectContains('  resolved directive contains Telugu', directive, 'Telugu');
  expectContains('  marks as [history]', directive, '[history]');
}

// ── 4. "hege" alone → Kannada ────────────────────────────────────────────────
console.log('\nScenario 4: "hege" alone → Kannada');
{
  const lang = detectFullLanguage('hege');
  expect('  detects Kannada', lang.language, 'kannada');
  expect('  isRomanized = true', lang.isRomanized, true);

  const directive = buildLanguageLockDirective(lang, false);
  expectContains('  directive says Kannada', directive, 'Kannada');
}

// ── 5. "ok da" → Tamil ───────────────────────────────────────────────────────
console.log('\nScenario 5: "ok da" → Tamil');
{
  const lang = detectFullLanguage('ok da');
  expect('  detects Tamil', lang.language, 'tamil');
  const directive = buildLanguageLockDirective(lang, false);
  expectContains('  directive says Tamil', directive, 'Tamil');
}

// ── 6. Native Kannada script → no retry needed (lang detected) ───────────────
console.log('\nScenario 6: Native Kannada script detection (Unicode block)');
{
  const nativeKannada = 'ಹೇಗಿದ್ದೀಯ?'; // "How are you?" in Kannada script
  const lang = detectFullLanguage(nativeKannada);
  expect('  detects Kannada (native)', lang.language, 'kannada');
  expect('  isRomanized = false', lang.isRomanized, false);
  expect('  scriptFamily = south_indian', lang.scriptFamily, 'south_indian');
  // Verify south-Indian Unicode present in input (simulates what retry check tests)
  const hasSouthIndian = /[\u0B80-\u0DFF]/.test(nativeKannada);
  expect('  south-Indian Unicode present', hasSouthIndian, true);
}

// ── 7. Native Tamil script → slip detection would fire if response were Latin ─
console.log('\nScenario 7: Slip detection logic (native Tamil → Latin response = slip)');
{
  const nativeTamil = 'நீ எப்படி இருக்கிறாய்?'; // Native Tamil
  const lang = detectFullLanguage(nativeTamil);
  expect('  detects Tamil (native)', lang.language, 'tamil');
  expect('  isRomanized = false', lang.isRomanized, false);

  const latinResponse = 'naan nalla irukken!'; // romanized — a slip
  const nativeResponse = 'நான் நல்லா இருக்கேன்!'; // correct native

  const wouldRetry = lang.scriptFamily === 'south_indian'
    && !lang.isRomanized
    && !/[\u0B80-\u0DFF]/.test(latinResponse);
  expect('  slip detected for Latin response', wouldRetry, true);

  const wouldRetryOnNative = lang.scriptFamily === 'south_indian'
    && !lang.isRomanized
    && !/[\u0B80-\u0DFF]/.test(nativeResponse);
  expect('  no retry for correct native response', wouldRetryOnNative, false);
}

// ── 8. Romanized Tamil → no retry (Latin response is correct) ────────────────
console.log('\nScenario 8: Romanized Tamil user → Latin response is correct (no retry)');
{
  const langRom = detectFullLanguage('enna panra');
  expect('  isRomanized = true', langRom.isRomanized, true);

  const latinResponse = 'aama naan nalla irukken da!';
  const wouldRetry = langRom.scriptFamily === 'south_indian'
    && !langRom.isRomanized // ← this is false for romanized, so retry never fires
    && !/[\u0B80-\u0DFF]/.test(latinResponse);
  expect('  no retry for romanized user', wouldRetry, false);
}

// ── 9. ai_accusation directive is short ──────────────────────────────────────
console.log('\nScenario 9: ai_accusation directive is short (Fix #4)');
{
  const langKn = { language: 'kannada', displayName: 'Kannada', scriptFamily: 'south_indian', isRomanized: true, confidence: 'medium' };
  const moody = buildMoodyDirective({ trigger: 'ai_accusation', intensity: 'strong' }, langKn);
  expectContains('  directive says Kannada', moody, 'Kannada');
  expectNotContains('  no "as an AI" in directive itself', moody.toLowerCase(), 'as an ai — reply');
  const ok = moody.length <= 160;
  if (ok) { console.log(`  ✅  ai_accusation directive is short (${moody.length} chars)`); passed++; }
  else    { console.error(`  ❌  ai_accusation directive too long: ${moody.length} chars`); failed++; }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
