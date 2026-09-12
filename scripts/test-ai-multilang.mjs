/**
 * Test script: Gemini-first provider + multilingual quality check.
 * Usage: node scripts/test-ai-multilang.mjs
 */
import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

// Parse .env manually (dotenv not installed as direct dep)
function loadEnv() {
  try {
    const lines = readFileSync('.env', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('❌ GEMINI_API_KEY not set'); process.exit(1); }

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

const SYSTEM = `You are Kruthika — a 22-year-old Indian woman from Mumbai texting a friend on WhatsApp. Reply short and natural. Keep replies to 1–3 short bubbles, each bubble on its own line. Reply in the exact language the user uses. For Kannada use natural conversational Kannada.`;

const TESTS = [
  { lang: 'Kannada',    msg: 'ನೀನು ಹೇಗಿದ್ದಿ? ಇವತ್ತು ಏನ್ ಮಾಡ್ತಿದ್ದಿ?' },
  { lang: 'Hinglish',   msg: 'arre yaar kya chal raha hai, bata na kya kar rahi thi' },
  { lang: 'Tamil',      msg: 'enna panra? semma bore aaguthu today' },
  { lang: 'Telugu',     msg: 'ela unnav? emi chestunnav ippudu' },
  { lang: 'Hindi',      msg: 'kya haal hai? aaj kuch khaas plan hai?' },
  { lang: 'English',    msg: 'hey! what are you up to? feeling bored lol' },
  { lang: 'Multi-bubble', msg: 'tell me about yourself and what you love doing today' },
];

async function probe(model) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
  const r = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: 'say hi' }] }],
    config: { maxOutputTokens: 20, temperature: 0 },
  });
  return (r.text ?? '').length > 0;
}

async function chat(model, msg) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
  const r = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: msg }] }],
    config: { systemInstruction: SYSTEM, temperature: 0.88, maxOutputTokens: 280 },
  });
  return (r.text ?? '').trim();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n━━━ Gemini model availability (new hierarchy) ━━━\n');
  let firstOk = null;
  for (const m of MODELS) {
    process.stdout.write(`  ${m.padEnd(42)}`);
    try {
      const ok = await probe(m);
      console.log(ok ? '✅' : '❌ no content');
      if (ok && !firstOk) firstOk = m;
    } catch (e) {
      const msg = (e?.message ?? String(e)).substring(0, 70);
      console.log(`❌  ${msg}`);
    }
    await sleep(600);
  }

  if (!firstOk) { console.error('\n❌ No Gemini model responded. Check key.'); process.exit(1); }
  console.log(`\n✅ Primary model: ${firstOk}\n`);

  console.log('━━━ Multilingual chat test ━━━\n');
  for (const t of TESTS) {
    process.stdout.write(`  [${t.lang.padEnd(12)}] `);
    try {
      const resp = await chat(firstOk, t.msg);
      const bubbles = resp.split('\n').map(l => l.trim()).filter(Boolean);
      console.log(`${bubbles.length} bubble(s):`);
      bubbles.forEach((b, i) => console.log(`    ${i+1}. ${b}`));
    } catch (e) {
      console.log(`❌ ${(e?.message ?? '').substring(0, 80)}`);
    }
    await sleep(1200);
  }
  console.log('\n✅ Done.\n');
})();
