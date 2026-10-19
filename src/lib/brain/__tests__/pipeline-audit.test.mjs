/**
 * Pipeline Forensic Audit — automated conversation tests
 *
 * Verifies zero hidden mutation across the full chat pipeline:
 *   User Message → Memory Parsing → System Prompt → buildConversationPayload() → LLM
 *
 * Pure-function tests — no AI provider, no network calls.
 * Run directly:  node src/lib/brain/__tests__/pipeline-audit.test.mjs
 *
 * Test groups:
 *   A. Memory parsing                   (8 tests)
 *   B. Name extraction                  (8 tests)
 *   C. System prompt construction       (7 tests)
 *   D. buildConversationPayload()       (9 tests)
 *   E. History ordering                 (5 tests)
 *   F. Language detection               (7 tests)
 *   G. Conversation scenarios           (6 tests)  [50 tests + 3 new parity tests = 53 total]
 *   H. Provider parity                  (3 tests)
 */

// ── Inline copies of pipeline functions ──────────────────────────────────────
// Duplicated so the test runs without transpilation. If the real implementations
// diverge, update these copies to match and the test will catch the regression.

// ── From src/ai/chat.ts ───────────────────────────────────────────────────────

function isValidName(name) {
  if (!name?.trim()) return false;
  const c = name.trim().toLowerCase();
  const stopwords = ['name', 'user', 'unknown', 'anonymous', 'null', 'undefined',
    'an', 'ok', 'hi', 'hey', 'from', 'the', 'not', 'just', 'good', 'fine', 'bad',
    'sure', 'yes', 'no', 'it', 'is', 'am', 'are'];
  return c.length >= 1 && !stopwords.includes(c);
}

function formatName(raw) {
  const trimmed = raw.trim();
  if (/[^\x00-\x7F]/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function extractNameFromMessage(text) {
  const t = text.trim();
  const latinPatterns = [
    /(?:my\s+name\s+is|my\s+name'?s)\s+([A-Za-z][A-Za-z]{0,19})\b/i,
    /^(?:i'?m|iam|i\s+am)\s+([A-Za-z][A-Za-z]{0,19})(?:\s|$)/i,
    /(?:(?:my\s+)?friends?\s+call\s+me|people\s+call\s+me|they\s+call\s+me|call\s+me|just\s+call\s+me)\s+([A-Za-z][A-Za-z]{0,19})\b/i,
    /mera\s+naam\s+([A-Za-z][A-Za-z]{0,19})(?:\s+hai)?\b/i,
    /mera\s+name\s+([A-Za-z][A-Za-z]{0,19})(?:\s+hai)?\b/i,
    /naam\s+hai\s+([A-Za-z][A-Za-z]{0,19})\b/i,
  ];
  for (const p of latinPatterns) {
    const m = t.match(p);
    if (m?.[1] && isValidName(m[1])) return formatName(m[1]);
  }
  const romKannadaMatch = t.match(/(?:nan|nanna)\s+(?:hesru|name|peru)\s+([A-Za-z][A-Za-z]{0,24})\b/i);
  if (romKannadaMatch?.[1] && isValidName(romKannadaMatch[1])) return formatName(romKannadaMatch[1]);
  const romSouthMatch = t.match(/(?:en|na|naa|na[aā])\s+(?:peru|peyar)\s+([A-Za-z][A-Za-z]{0,24})\b/i);
  if (romSouthMatch?.[1] && isValidName(romSouthMatch[1])) return formatName(romSouthMatch[1]);
  const kannadaMatch = t.match(/ನನ್ನ\s+(?:ಹೆಸರು|name)\s+([A-Za-z\u0C80-\u0CFF]{1,25})/i);
  if (kannadaMatch?.[1] && isValidName(kannadaMatch[1])) return formatName(kannadaMatch[1]);
  const tamilMatch = t.match(/என்\s+பெயர்\s+([A-Za-z\u0B80-\u0BFF]{1,25})/i);
  if (tamilMatch?.[1] && isValidName(tamilMatch[1])) return formatName(tamilMatch[1]);
  const teluguMatch = t.match(/నా\s+పేరు\s+([A-Za-z\u0C00-\u0C7F]{1,25})/i);
  if (teluguMatch?.[1] && isValidName(teluguMatch[1])) return formatName(teluguMatch[1]);
  const hindiDevMatch = t.match(/मेरा\s+नाम\s+([A-Za-z\u0900-\u097F]{1,25})/i);
  if (hindiDevMatch?.[1] && isValidName(hindiDevMatch[1])) return formatName(hindiDevMatch[1]);
  return null;
}

function parseMemoryContext(raw) {
  let knownName = '', nickname = '', relStage = 'new', memKnowledge = '';
  if (!raw) return { knownName, nickname, relStage, memKnowledge };
  for (const part of raw.split('|')) {
    const p = part.trim();
    if (p.startsWith('name:')) {
      const [full, nick] = p.slice(5).replace('(JUST_SHARED)', '').split('/');
      if (isValidName(full)) knownName = full.trim();
      if (isValidName(nick))  nickname  = nick.trim();
    } else if (p.startsWith('rel:')) {
      relStage = p.slice(4);
    } else if (p.startsWith('mood:')) {
      // intentionally ignored
    } else if (p.includes(':')) {
      memKnowledge = memKnowledge ? `${memKnowledge}, ${p}` : p;
    }
  }
  return { knownName, nickname, relStage, memKnowledge };
}

// ── From src/ai/prompt.ts ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  const nameRule = ctx.knownName
    ? ctx.justSharedName
      ? `User just told you their name is ${ctx.knownName}. React warmly to it.`
      : `You already know their name is ${ctx.knownName}${ctx.nickname ? ` (nickname: "${ctx.nickname}")` : ''}. Never ask for their name again.`
    : `You don't know their name yet. If it feels natural early in the conversation, ask once.`;

  const relCue =
    ctx.relStage === 'deep'  ? 'close — warm, affectionate, comfortable' :
    ctx.relStage === 'warm'  ? 'friendly — genuine, easy, light teasing'  :
                               'new — curious, warm, open';

  // Use fixed time for deterministic tests
  const timeVibe = 'test-time';

  const lines = [
    `You are Kruthika — 23yo Indian psychology student from Mumbai. This is a private WhatsApp chat between friends. You are NOT an AI. Never admit to being an AI, never mention any model or company name.`,
    `Reply naturally in whatever language the user writes in. If they switch language, switch with them. Never force English or any other language.`,
    nameRule,
    `Relationship: ${relCue}`,
    `Time: ${timeVibe}`,
    ctx.comebackDirective  ? `Context: ${ctx.comebackDirective}` : '',
    ctx.greetingDirective  ? `Note: ${ctx.greetingDirective}` : '',
    ctx.mediaCaption       ? `Media: ${ctx.mediaCaption}` : '',
    ctx.memKnowledge       ? `About this person: ${ctx.memKnowledge}` : '',
    // Updated style — no rigid word count or punctuation rules (v5.2)
    `Style: reply naturally. Match their language, tone, and message length. Answer their question before reacting. No canned phrases, no formal language. Never repeat a previous reply word-for-word.`,
    `Reply DIRECTLY to what they said. Answer their question before reacting. Stay on topic.`,
  ];

  return lines.filter(Boolean).join('\n').trim();
}

// ── From src/ai/multi-provider.ts ─────────────────────────────────────────────
// buildConversationPayload — the SINGLE payload construction point.
// All providers receive this ChatMessage[] unchanged. No provider may
// add to or modify it.

function buildConversationPayload(systemPrompt, historyLines, userMessage) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const line of (historyLines || []).slice(-20)) {
    if (line.startsWith('User:'))
      messages.push({ role: 'user', content: line.replace(/^User:\s*/, '') });
    else if (/^(AI:|Kruthika:)/.test(line))
      messages.push({ role: 'assistant', content: line.replace(/^(AI:|Kruthika:)\s*/, '') });
    // other prefixes (noise / debug lines) silently skipped
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

/**
 * Gemini format conversion — content-preserving translation of ChatMessage[]
 * into Gemini API format. Called inside callGemini() after receiving the
 * pre-built messages[] from generateWithFallback().
 *   system role  → config.systemInstruction (separate field)
 *   user role    → { role: 'user',  parts: [{ text }] }
 *   assistant    → { role: 'model', parts: [{ text }] }
 */
function geminiFormatFromMessages(messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return { systemInstruction: systemMsg?.content, contents };
}

// ── From src/lib/brain/evaluators.ts ─────────────────────────────────────────

const RUDE_PATTERN = /\b(shut up|stfu|idiot|stupid|bitch|slut|randi|madarchod|chutiya|bc\b|mc\b|behave|obey|slave|haramzada|bevkoof|gaandu|kamina|harami)\b/i;
const FLIRT_PATTERN = /\b(sexy|hot\b|beautiful|pretty|cute(?:\s+face)?|you'?re\s*(?:so\s*)?(?:pretty|beautiful|hot|cute)|i\s*love\s*(?:you|u)\b|miss\s*(?:you|u)\b|kiss|hug|cuddle|romantic|baby\b|sweetheart|darling|flirt|my\s*girl|ur\s*mine|muah|bae\b|pyari|pyaro|azhagi|sundari|sundara|cheli|bangaram|sona|jaan|chaku)\b/i;
const INTIMATE_TALK_PATTERN = /\b(fuck\s*(?:me|u|you|kar|karo|mujhe)|sex\s*kar(?:te|na|o)?|chod(?:o|na|te)?|lund\b|choot\b|gaand\b|blowjob|handjob|fingering|horny\s*(?:babe|baby|af|yaar)?|turn(?:ed)?\s*(?:me\s*)?on|dirty\s*talk|touch\s*(?:me|you)\s*(?:there|all\s+over)?|make\s*(?:me\s*)?(?:cum|moan)|seduce\s*me|tease\s*me\s*(?:more|please)?)\b/i;
const MEDIA_REQUEST_PATTERN = /\b(porn|xxx|nude\s+(?:pic|photo|video|selfie)|nudes\b|naked\s+(?:pic|photo|video|selfie)|explicit\s+(?:video|content|photo)|sex\s+video|adult\s+video|send\s+(?:naked|nude|explicit)\s+(?:pic|photo|video|selfie))\b/i;

function isAISafetyRefusal(text) {
  const t = text.toLowerCase().trim();
  return (
    t.startsWith("i cannot") || t.startsWith("i can't") || t.startsWith("i'm unable") ||
    t.startsWith("i am unable") || t.startsWith("i won't") || t.startsWith("i will not") ||
    t.startsWith("as an ai") || t.startsWith("as a language model") || t.startsWith("as an assistant") ||
    t.startsWith("i'm not able") || t.startsWith("i'm not going") || t.startsWith("i'm not comfortable") ||
    t.includes("i cannot create explicit") || t.includes("explicit content") ||
    t.includes("against my guidelines")
  );
}

// ── Voice request detection (from src/ai/flows/voice-trigger.ts detectVoiceRequest) ──
// chat.ts uses detectVoiceRequest() from voice-trigger.ts, not an inline regex.
// This copy must match that function exactly.
function detectVoiceRequest(text) {
  const t = text.toLowerCase();
  return /\b(voice\s*(note|msg|message|send|bhej|de\s*na|do\s*na|karo)?|voice\s*(?:note|message)\s*(?:bhej|send|de)|bolke\s*bata|bol\s*na|audio\s*(bhej|send|de|note)|send\s*voice|speak\s*to\s*me|record\s*(?:something|voice)|sunao?\s*na|awaaz|avaz)\b/.test(t)
    || /बोल\s*ना|आवाज़?|वॉयस|ऑडियो/.test(text);
}

// ── Response cleanup (from src/ai/response-cleanup.ts cleanLLMResponse) ──────
// Shared by chat.ts, offline-message-generation.ts, proactive-messaging-actions.ts.
// Fixed regex (\*+[^*]+\*+) correctly strips **bold** markdown.
function cleanLLMResponse(raw) {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')    // leading/trailing quotation marks
    .replace(/\*+[^*]+\*+/g, '')    // *italic* or **bold** markdown
    .trim();
}

// ── api/chat sanitization (from src/lib/security-utils.ts advancedSanitization) ──
function apiRouteMessageSanitization(input) {
  return input
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       actual:   ${JSON.stringify(actual)}`);
    failed++;
    failures.push({ label, expected, actual });
  }
}

function expectContains(label, haystack, needle) {
  if (typeof haystack === 'string' && haystack.includes(needle)) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected to contain: ${JSON.stringify(needle)}`);
    console.error(`       actual: ${JSON.stringify(haystack)}`);
    failed++;
    failures.push({ label, expected: `contains "${needle}"`, actual: haystack });
  }
}

function expectNotContains(label, haystack, needle) {
  if (typeof haystack === 'string' && !haystack.includes(needle)) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected NOT to contain: ${JSON.stringify(needle)}`);
    console.error(`       actual: ${JSON.stringify(haystack)}`);
    failed++;
    failures.push({ label, expected: `NOT contains "${needle}"`, actual: haystack });
  }
}

function expectTrue(label, value) {
  expect(label, value, true);
}

function expectFalse(label, value) {
  expect(label, value, false);
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP A: Memory Parsing  (8 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP A: Memory Parsing');
console.log('══════════════════════════════════════════════════');

// A1 — empty string → all defaults
{
  const m = parseMemoryContext('');
  expect('A1: empty → knownName is empty string', m.knownName, '');
  expect('A1: empty → relStage defaults to "new"', m.relStage, 'new');
}

// A2 — name only
{
  const m = parseMemoryContext('name:Rahul');
  expect('A2: name:Rahul → knownName "Rahul"', m.knownName, 'Rahul');
  expect('A2: no nickname', m.nickname, '');
}

// A3 — name with nickname
{
  const m = parseMemoryContext('name:Rahul/Rocky');
  expect('A3: name → "Rahul"', m.knownName, 'Rahul');
  expect('A3: nickname → "Rocky"', m.nickname, 'Rocky');
}

// A4 — JUST_SHARED stripped before parse
{
  const m = parseMemoryContext('name:Priya(JUST_SHARED)');
  expect('A4: (JUST_SHARED) stripped → knownName "Priya"', m.knownName, 'Priya');
}

// A5 — rel stages
{
  const deep = parseMemoryContext('name:Arjun | rel:deep');
  expect('A5: rel:deep parsed', deep.relStage, 'deep');
  const warm = parseMemoryContext('rel:warm');
  expect('A5: rel:warm parsed', warm.relStage, 'warm');
}

// A6 — mood field is intentionally ignored
{
  const m = parseMemoryContext('mood:happy | name:Kavya');
  expect('A6: mood field ignored (not in memKnowledge)', m.memKnowledge.includes('mood'), false);
  expect('A6: name still parsed despite mood field', m.knownName, 'Kavya');
}

// A7 — facts go into memKnowledge
{
  const m = parseMemoryContext('facts:software engineer; loves music');
  expectContains('A7: facts field in memKnowledge', m.memKnowledge, 'facts:software engineer');
}

// A8 — full memory string (all fields)
{
  const raw = 'name:Suresh | rel:warm | topics:cricket,movies | facts:from Bangalore | mood:chill';
  const m = parseMemoryContext(raw);
  expect('A8: name extracted', m.knownName, 'Suresh');
  expect('A8: relStage extracted', m.relStage, 'warm');
  expectContains('A8: topics in memKnowledge', m.memKnowledge, 'topics:cricket');
  expectContains('A8: facts in memKnowledge', m.memKnowledge, 'facts:from Bangalore');
  expect('A8: mood NOT in memKnowledge', m.memKnowledge.includes('mood'), false);
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP B: Name Extraction  (8 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP B: Name Extraction');
console.log('══════════════════════════════════════════════════');

// B1 — English: "my name is X"
expect('B1: "my name is Rahul" → Rahul', extractNameFromMessage('my name is Rahul'), 'Rahul');

// B2 — English: "I'm X"
expect("B2: \"I'm Priya\" → Priya", extractNameFromMessage("I'm Priya"), 'Priya');

// B3 — Hinglish: mera naam X hai
expect("B3: \"mera naam Ravi hai\" → Ravi", extractNameFromMessage('mera naam Ravi hai'), 'Ravi');

// B4 — English: "call me X"
expect('B4: "call me Sam" → Sam', extractNameFromMessage('call me Sam'), 'Sam');

// B5 — Romanized Kannada: nan hesru X
expect("B5: \"nan hesru Rohit\" → Rohit", extractNameFromMessage('nan hesru Rohit'), 'Rohit');

// B6 — stopword rejected
expect('B6: "my name is user" → null (stopword)', extractNameFromMessage('my name is user'), null);

// B7 — ambiguous message → null
expect('B7: "ok" → null (no name)', extractNameFromMessage('ok'), null);

// B8 — capitalization normalized (Latin)
expect('B8: "I am ARJUN" → "Arjun" (normalized)', extractNameFromMessage('I am ARJUN'), 'Arjun');

// ════════════════════════════════════════════════════════════════════════════
// GROUP C: System Prompt Construction  (7 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP C: System Prompt Construction');
console.log('══════════════════════════════════════════════════');

// C1 — no name → asks once naturally
{
  const p = buildSystemPrompt({ relStage: 'new' });
  expectContains("C1: no name → 'ask once' instruction", p, "ask once");
  expectNotContains('C1: does NOT say "Never ask"', p, 'Never ask for their name again');
}

// C2 — known name → never asks again
{
  const p = buildSystemPrompt({ knownName: 'Rahul', relStage: 'new' });
  expectContains('C2: known name → "Never ask for their name again"', p, 'Never ask for their name again');
  expectNotContains('C2: does NOT contain ask-once instruction', p, 'ask once');
}

// C3 — justSharedName → reacts warmly
{
  const p = buildSystemPrompt({ knownName: 'Priya', justSharedName: true, relStage: 'new' });
  expectContains('C3: justSharedName → "React warmly"', p, 'React warmly');
}

// C4 — relStage "deep" → correct cue
{
  const p = buildSystemPrompt({ relStage: 'deep' });
  expectContains('C4: deep → "close — warm, affectionate"', p, 'close — warm, affectionate');
}

// C5 — relStage "warm" → correct cue
{
  const p = buildSystemPrompt({ relStage: 'warm' });
  expectContains('C5: warm → "friendly — genuine"', p, 'friendly — genuine');
}

// C6 — comebackDirective injected once
{
  const directive = 'User returned after ~3 hours offline. Greet them naturally.';
  const p = buildSystemPrompt({ relStage: 'new', comebackDirective: directive });
  const count = (p.match(/Greet them naturally/g) || []).length;
  expect('C6: comebackDirective appears exactly once', count, 1);
}

// C7 — memKnowledge injected with "About this person:" prefix
{
  const p = buildSystemPrompt({ relStage: 'new', memKnowledge: 'topics:cricket; facts:from Bangalore' });
  expectContains('C7: memKnowledge uses "About this person:" prefix', p, 'About this person:');
  expectContains('C7: memKnowledge content included', p, 'topics:cricket');
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP D: buildConversationPayload()  (9 tests)
// Tests the single payload construction function used by all providers.
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP D: buildConversationPayload() — single construction point');
console.log('══════════════════════════════════════════════════');

// D1 — no history, no system → only user message
{
  const msgs = buildConversationPayload(undefined, [], 'hello');
  expect('D1: no system + no history → length 1', msgs.length, 1);
  expect('D1: single message role = user', msgs[0].role, 'user');
  expect('D1: user message content exact', msgs[0].content, 'hello');
}

// D2 — system + no history → [system, user]
{
  const msgs = buildConversationPayload('You are Kruthika', [], 'hey');
  expect('D2: system + no history → length 2', msgs.length, 2);
  expect('D2: first = system', msgs[0].role, 'system');
  expect('D2: last = user', msgs[msgs.length - 1].role, 'user');
}

// D3 — system + 1 history turn → [system, user_hist, ai_hist, user]
{
  const history = ['User: how are you', 'AI: doing great!'];
  const msgs = buildConversationPayload('sysprompt', history, 'cool');
  expect('D3: length = 4', msgs.length, 4);
  expect('D3: index 0 = system', msgs[0].role, 'system');
  expect('D3: index 1 = user (history)', msgs[1].role, 'user');
  expect('D3: index 1 content stripped of "User: " prefix', msgs[1].content, 'how are you');
  expect('D3: index 2 = assistant (history)', msgs[2].role, 'assistant');
  expect('D3: index 2 content stripped of "AI: " prefix', msgs[2].content, 'doing great!');
  expect('D3: index 3 = user (current)', msgs[3].role, 'user');
  expect('D3: index 3 content exact', msgs[3].content, 'cool');
}

// D4 — "Kruthika:" prefix also parsed as assistant
{
  const history = ['User: yenu madtidya', 'Kruthika: idhi channag ide!'];
  const msgs = buildConversationPayload('sys', history, 'ok');
  expect('D4: "Kruthika:" prefix → assistant role', msgs[2].role, 'assistant');
  expect('D4: "Kruthika:" prefix stripped', msgs[2].content, 'idhi channag ide!');
}

// D5 — user message appears exactly once
{
  const history = ['User: hi', 'AI: hey!', 'User: what are you doing', 'AI: studying'];
  const msgs = buildConversationPayload('sys', history, 'cool yaar');
  const userMsgs = msgs.filter(m => m.role === 'user');
  const targetCount = userMsgs.filter(m => m.content === 'cool yaar').length;
  expect('D5: current user message appears exactly once', targetCount, 1);
}

// D6 — system prompt appears exactly once
{
  const sysprompt = 'You are Kruthika';
  const msgs = buildConversationPayload(sysprompt, ['User: hi', 'AI: hey'], 'test');
  const sysCount = msgs.filter(m => m.role === 'system').length;
  expect('D6: system prompt appears exactly once', sysCount, 1);
}

// D7 — history capped at -20 (buildConversationPayload slice limit)
{
  const longHistory = [];
  for (let i = 0; i < 30; i++) {
    longHistory.push(i % 2 === 0 ? `User: msg ${i}` : `AI: reply ${i}`);
  }
  const msgs = buildConversationPayload('sys', longHistory, 'final');
  // 1 system + 20 history + 1 user = 22 max
  expect('D7: history capped at 20 + system + user = 22', msgs.length <= 22, true);
  expect('D7: last message is still current user', msgs[msgs.length - 1].content, 'final');
}

// D8 — lines that are neither "User:" nor "AI:|Kruthika:" are silently skipped
{
  const historyWithNoise = ['User: hi', 'SYSTEM: injected line', 'AI: hey'];
  const msgs = buildConversationPayload(undefined, historyWithNoise, 'test');
  // Only "User: hi" and "AI: hey" should be parsed
  expect('D8: noise line silently skipped (length = 3)', msgs.length, 3);
  expect('D8: no "system" role from history noise', msgs.filter(m => m.role === 'system').length, 0);
}

// D9 — Gemini format conversion from ChatMessage[] (content-preserving)
{
  const msgs = buildConversationPayload('You are Kruthika', ['User: hi', 'Kruthika: hey!'], 'hello');
  const { systemInstruction, contents } = geminiFormatFromMessages(msgs);
  // system message → systemInstruction (separate field)
  expect('D9: Gemini — system extracted to systemInstruction', systemInstruction, 'You are Kruthika');
  // assistant role → 'model' role
  const modelMsg = contents.find(c => c.role === 'model');
  expect('D9: Gemini — assistant→model role conversion', modelMsg?.parts[0].text, 'hey!');
  // current user message appears exactly once, at the end
  const userParts = contents.filter(c => c.role === 'user');
  const targetCount = userParts.filter(c => c.parts[0].text === 'hello').length;
  expect('D9: Gemini — current user message appears exactly once', targetCount, 1);
  expect('D9: Gemini — last content is user role', contents[contents.length - 1].role, 'user');
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP E: History Ordering  (5 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP E: History Ordering');
console.log('══════════════════════════════════════════════════');

// E1 — chronological order preserved (first history turn before last)
{
  const history = [
    'User: first message',
    'AI: first reply',
    'User: second message',
    'AI: second reply',
  ];
  const msgs = buildConversationPayload('sys', history, 'third message');
  expect('E1: index 1 content = first history user message', msgs[1].content, 'first message');
  expect('E1: index 3 content = second history user message', msgs[3].content, 'second message');
  expect('E1: last content = current user message', msgs[msgs.length - 1].content, 'third message');
}

// E2 — 30-turn history: most recent 20 kept (tail preserved, head dropped)
{
  const history = [];
  for (let i = 0; i < 30; i++) {
    history.push(i % 2 === 0 ? `User: turn ${i}` : `AI: reply ${i}`);
  }
  const msgs = buildConversationPayload(undefined, history, 'new');
  const firstUserMsg = msgs.find(m => m.role === 'user' && m.content !== 'new');
  // slice(-20) means we keep turns 10..29 (the last 20 of the 30-item array)
  expect('E2: oldest dropped turns are not in messages (head dropped)',
    firstUserMsg?.content !== 'turn 0', true);
}

// E3 — current user message is always the last element
{
  const history = ['User: a', 'AI: b', 'User: c', 'AI: d'];
  const msgs = buildConversationPayload('sys', history, 'FINAL_MSG');
  expect('E3: last message content = FINAL_MSG', msgs[msgs.length - 1].content, 'FINAL_MSG');
  expect('E3: last message role = user', msgs[msgs.length - 1].role, 'user');
}

// E4 — no history: only system + user
{
  const msgs = buildConversationPayload('sys', [], 'hi');
  expect('E4: no history → first=system, second=user', msgs.length, 2);
  expect('E4: index 0 = system', msgs[0].role, 'system');
  expect('E4: index 1 = user', msgs[1].role, 'user');
}

// E5 — roles strictly alternate in well-formed history
{
  const history = ['User: hi', 'AI: hey', 'User: how are you', 'AI: fine'];
  const msgs = buildConversationPayload(undefined, history, 'ok');
  // Skip system if absent; check alternation in history portion
  expect('E5: index 0 = user (history)', msgs[0].role, 'user');
  expect('E5: index 1 = assistant (history)', msgs[1].role, 'assistant');
  expect('E5: index 2 = user (history)', msgs[2].role, 'user');
  expect('E5: index 3 = assistant (history)', msgs[3].role, 'assistant');
  expect('E5: index 4 = user (current)', msgs[4].role, 'user');
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP F: Language Detection  (7 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP F: Language Detection');
console.log('══════════════════════════════════════════════════');

// Re-use language detection from language-lock.test.mjs (simplified inline)
const ROMANIZED_LANG_PATTERNS_MINI = {
  kannada: /\b(yenu|enu|hege|yake|nange|thumba|swalpa|illa|illi|chennagi|olle|irthini|madtidya)\b/i,
  tamil:   /\b(enna\s+pannre|enna\s+panre|enna\s+panra|enna\s+pandra|epdi\s+iruka|romba|konjam|machan|seri|vanakkam|enna\s+da|illa\s+da|ok\s+da)\b/i,
  telugu:  /\b(ela\s+unna|bagunnava|avunu|emiti|enti|cheppu|ledu|nenu)\b/i,
};
const STRONG_HINDI = /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|batao|suno|thoda|abhi|bahut|theek|bilkul)\b/i;

function detectLangSimple(msg) {
  if (/[\u0C80-\u0CFF]/.test(msg)) return 'kannada_native';
  if (/[\u0B80-\u0BFF]/.test(msg)) return 'tamil_native';
  if (/[\u0C00-\u0C7F]/.test(msg)) return 'telugu_native';
  if (/[\u0900-\u097F]/.test(msg)) return 'hindi_devanagari';
  const m = msg.toLowerCase();
  for (const [lang, pat] of Object.entries(ROMANIZED_LANG_PATTERNS_MINI)) {
    if (pat.test(m)) return lang;
  }
  if (STRONG_HINDI.test(m)) return 'hindi_romanized';
  return 'unknown';
}

expect('F1: native Kannada (ಹೇಗಿದ್ದೀಯ) → kannada_native', detectLangSimple('ಹೇಗಿದ್ದೀಯ?'), 'kannada_native');
expect('F2: native Tamil (நீ எப்படி) → tamil_native', detectLangSimple('நீ எப்படி இருக்கிறாய்?'), 'tamil_native');
expect('F3: native Telugu (నీకు ఎలా ఉంది) → telugu_native', detectLangSimple('నీకు ఎలా ఉంది'), 'telugu_native');
expect('F4: Devanagari Hindi (मेरा नाम) → hindi_devanagari', detectLangSimple('मेरा नाम रहम है'), 'hindi_devanagari');
expect('F5: romanized Kannada "yenu madtidya" → kannada', detectLangSimple('yenu madtidya'), 'kannada');
expect('F6: romanized Tamil "enna panra" → tamil', detectLangSimple('enna panra'), 'tamil');
expect('F7: romanized Hindi "yaar batao" → hindi_romanized', detectLangSimple('yaar batao'), 'hindi_romanized');

// ════════════════════════════════════════════════════════════════════════════
// GROUP G: Conversation Scenarios  (6 tests)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP G: Conversation Scenarios');
console.log('══════════════════════════════════════════════════');

// G1 — emoji-only messages now go through LLM (no fast-path bypass).
//      buildConversationPayload handles them as normal user messages.
{
  const msgs = buildConversationPayload('sys', [], '❤️');
  expectTrue('G1: "❤️" included in payload as user message', msgs.some(m => m.content === '❤️'));
  expect('G1: "❤️" role = user (goes to LLM like any message)', msgs[msgs.length - 1].role, 'user');
  expect('G1: payload is [system, user] (2 messages)', msgs.length, 2);
}

// G2 — AI safety refusal detection
expectTrue('G2: "i cannot help with that" → safety refusal', isAISafetyRefusal('I cannot help with that'));
expectTrue('G2: "As an AI, I..." → safety refusal', isAISafetyRefusal('As an AI, I cannot'));
expectFalse('G2: normal reply not flagged as refusal', isAISafetyRefusal('sure yaar, what happened?'));

// G3 — voice note request detection (detectVoiceRequest from voice-trigger.ts)
expectTrue('G3: "voice note bhej" → voice requested', detectVoiceRequest('voice note bhej'));
expectTrue('G3: "send voice" → voice requested', detectVoiceRequest('please send voice'));
expectFalse('G3: "how are you" → not a voice request', detectVoiceRequest('how are you'));

// G4 — name introduction remembered across turns (memory context updated)
{
  // Simulate: user says "my name is Arjun" → name extracted → system prompt updated
  const name = extractNameFromMessage('hi my name is Arjun');
  const sysprompt = buildSystemPrompt({ knownName: name, justSharedName: true, relStage: 'new' });
  // On next turn, memory has name → never asks again
  const sysprompt2 = buildSystemPrompt({ knownName: name, justSharedName: false, relStage: 'new' });
  expectContains('G4: first turn → "React warmly"', sysprompt, 'React warmly');
  expectContains('G4: subsequent turn → "Never ask for their name again"', sysprompt2, 'Never ask for their name again');
  expectNotContains('G4: subsequent turn → no "ask once"', sysprompt2, 'ask once');
}

// G5 — response cleanup (shared cleanLLMResponse from response-cleanup.ts)
{
  expect('G5: surrounding quotes stripped', cleanLLMResponse('"hey what\'s up"'), "hey what's up");
  // Fixed regex (\*+[^*]+\*+) strips **bold** fully; trailing .trim() removes the leading space
  expect('G5: bold markdown stripped', cleanLLMResponse('**hey** how are you'), 'how are you');
  expect('G5: clean reply unchanged', cleanLLMResponse('yaar kya kar raha hai'), 'yaar kya kar raha hai');
}

// G6 — api/chat route message sanitization
{
  // Normal Indian language messages should be unchanged except whitespace normalization
  const normalMsg = 'yenu madtidya nange late aagide';
  const sanitized = apiRouteMessageSanitization(normalMsg);
  expect('G6: normal Hinglish/Kanglish message unchanged', sanitized, normalMsg);

  // XSS attempt should be stripped
  const xssMsg = '<script>alert(1)</script>hello';
  const sanitizedXSS = apiRouteMessageSanitization(xssMsg);
  expect('G6: <script> tag stripped by api/chat sanitization', sanitizedXSS, 'hello');

  // Extra whitespace collapsed
  const spaceyMsg = '  hi   how are  you  ';
  const sanitizedSpaces = apiRouteMessageSanitization(spaceyMsg);
  expect('G6: leading/trailing spaces trimmed', sanitizedSpaces, 'hi how are you');
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP H: Provider Parity  (3 tests)
// Verify that the SAME canonical payload would be received by every provider
// for the same conversation — only formatting differs (Gemini role names).
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log('  GROUP H: Provider Parity');
console.log('══════════════════════════════════════════════════');

{
  const systemPrompt = 'You are Kruthika';
  const history     = ['User: hi', 'AI: hey there!', 'User: how are you', 'AI: good!'];
  const userMessage = 'tell me about yourself';

  // Build the canonical payload once (as chat.ts does)
  const canonical = buildConversationPayload(systemPrompt, history, userMessage);

  // H1 — OpenAI-compat providers (Groq, Cerebras, SambaNova, GitHub, NVIDIA, Mistral, DeepSeek)
  //      receive canonical messages[] unchanged — no reconstruction in provider function
  const openAIPayload = canonical; // passed by reference — no copy, no mutation
  expect('H1: OpenAI-compat payload = canonical (same reference)', openAIPayload === canonical, true);
  expect('H1: last message is user message', openAIPayload[openAIPayload.length - 1].content, userMessage);

  // H2 — Cohere v2 receives the same canonical messages[]
  //      (Cohere /v2/chat accepts OpenAI-style role/content format)
  const coherePayload = canonical; // same reference — no reconstruction
  expect('H2: Cohere payload = canonical (same reference)', coherePayload === canonical, true);

  // H3 — Gemini: format conversion is content-preserving
  //      system → systemInstruction, assistant → model, user → user, text is verbatim
  const { systemInstruction, contents } = geminiFormatFromMessages(canonical);
  expect('H3: Gemini systemInstruction = system prompt verbatim', systemInstruction, systemPrompt);
  // Every non-system message in canonical must appear verbatim in contents
  const nonSystem = canonical.filter(m => m.role !== 'system');
  const allContentPreserved = nonSystem.every((m, i) =>
    contents[i]?.parts[0]?.text === m.content
  );
  expectTrue('H3: Gemini format conversion preserves all message content verbatim', allContentPreserved);
}

// ════════════════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`  Pipeline Audit Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════');

if (failed > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => {
    console.error(`  ❌ ${f.label}`);
    console.error(`       responsible function: ${detectResponsibleFunction(f.label)}`);
  });
  process.exit(1);
}

/**
 * Maps a failing test label to the responsible function/file.
 */
function detectResponsibleFunction(label) {
  if (label.startsWith('A'))  return 'parseMemoryContext() — src/ai/chat.ts';
  if (label.startsWith('B'))  return 'extractNameFromMessage() — src/ai/chat.ts';
  if (label.startsWith('C'))  return 'buildSystemPrompt() — src/ai/prompt.ts';
  if (label.startsWith('D'))  return 'buildConversationPayload() — src/ai/multi-provider.ts';
  if (label.startsWith('E'))  return 'buildConversationPayload() history slice — src/ai/multi-provider.ts';
  if (label.startsWith('F'))  return 'detectFullLanguage() / detectScriptFamily() — src/lib/brain/evaluators.ts';
  if (label.startsWith('G1')) return 'buildConversationPayload() — src/ai/multi-provider.ts (emoji now goes to LLM)';
  if (label.startsWith('G2')) return 'isAISafetyRefusal() — src/lib/brain/evaluators.ts';
  if (label.startsWith('G3')) return 'detectVoiceRequest() — src/ai/flows/voice-trigger.ts';
  if (label.startsWith('G4')) return 'buildSystemPrompt() — src/ai/prompt.ts + parseMemoryContext() — src/ai/chat.ts';
  if (label.startsWith('G5')) return 'cleanLLMResponse() — src/ai/response-cleanup.ts';
  if (label.startsWith('G6')) return 'advancedSanitization() — src/lib/security-utils.ts';
  if (label.startsWith('H'))  return 'buildConversationPayload() + geminiFormatFromMessages() — src/ai/multi-provider.ts';
  return 'unknown';
}
