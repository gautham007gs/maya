/**
 * @fileOverview User Classifier — Kruthika AI
 *
 * Identifies who this person IS in Kruthika's life based on their history,
 * session patterns, and gap behaviour. Produces a behavioral directive that
 * tells Kruthika exactly HOW to show up for this specific person right now.
 *
 * Research basis:
 * — Parasocial relationship stages: Discovery → Rapport → Vulnerability → Interdependence
 * — Variable-reward schedule theory (Skinner, applied to social media)
 * — Attachment theory as applied to digital communication patterns
 * — Chronemics: timing and pacing as relational signals
 * — Investment Model (Rusbult): commitment increases with investment + satisfaction − alternatives
 */

export type UserType =
  | 'brand_new'       // First ever conversation. ≤5 lifetime messages.
  | 'warming'         // 2–7 days in. Getting comfortable. 6–50 msgs.
  | 'regular'         // Shows up consistently. The "daily" person.
  | 'casual'          // Active but sporadic. Low session depth.
  | 'returner_short'  // Gone 3–6 days. Just came back.
  | 'returner_long'   // Gone 7–20 days. Significant gap.
  | 'ghost_returner'  // Gone 21+ days. Has to re-earn.
  | 'power_user';     // Heavy investment. Deep history. Real bond built.

export type SessionType =
  | 'micro'    // < 5 messages. Literally just checking in.
  | 'quick'    // 5–12 messages. Short but deliberate.
  | 'normal'   // 13–40 messages. Standard chat.
  | 'deep'     // 41–80 messages. Real conversation.
  | 'marathon'; // 80+ messages. Hours of connection.

export interface UserProfile {
  userType: UserType;
  sessionType: SessionType;
  daysSinceFirst: number;       // Days since very first interaction
  daysSinceLastActive: number;  // Days since last chat session
  consecutiveDays: number;      // Streak of daily activity
  totalMessages: number;        // Lifetime message count
  sessionMsgCount: number;      // Messages THIS session
  sessionCount: number;         // Total number of sessions
  isFirstSession: boolean;      // True if this is literally session #1
  returningAfterGap: boolean;   // True if daysSinceLastActive >= 2
  isLateNight: boolean;         // IST 22:00–03:00
}

export interface UserMemorySnapshot {
  messageCount?: number;
  consecutiveDays?: number;
  firstInteraction?: number | null;  // Unix ms
  lastActiveDate?: string | null;    // 'YYYY-MM-DD'
  sessionCount?: number;
  relationshipLevel?: number;
  attachmentLean?: string | null;
  topics?: any[];
  sharedMoments?: any[];
  userName?: string | null;
}

// ─── Per-request classification cache ────────────────────────────────────────
// classifyUser() is pure (same inputs → same output) and expensive to call on
// every AI response because it recomputes all date arithmetic each time.
// Cache the last result per session for the duration of the server process.
// TTL is 5 minutes — short enough that classification refreshes within a session
// when the user's message count grows, but long enough to avoid re-classifying
// on every message burst.
interface ClassifyCache {
  result: UserProfile;
  ts: number;
  msgCount: number;
}
const classifyCache = new Map<string, ClassifyCache>();
const CLASSIFY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CLASSIFY_CACHE_MAX = 500; // max entries before LRU eviction

// ─── Classifier ─────────────────────────────────────────────────────────────

export function classifyUser(
  memory: UserMemorySnapshot | null,
  sessionMsgCount: number,
  istHour?: number,
): UserProfile {
  // Cache key: user unique identifier / name + last active + consecutive days + session count
  const cacheKey = `${memory?.userName ?? 'anon'}-${memory?.messageCount ?? 0}-${memory?.lastActiveDate ?? 'x'}-${memory?.consecutiveDays ?? 0}-${sessionMsgCount}`;
  const cached = classifyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CLASSIFY_CACHE_TTL && cached.msgCount === sessionMsgCount) {
    return cached.result;
  }
  const now = Date.now();
  const hour = istHour ?? new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();

  const totalMessages    = memory?.messageCount      ?? 0;
  const consecutiveDays  = memory?.consecutiveDays   ?? 0;
  const sessionCount     = memory?.sessionCount      ?? 1;
  const firstInteraction = memory?.firstInteraction  ? Number(memory.firstInteraction) : null;
  const lastActiveDateStr= memory?.lastActiveDate    ?? null;

  // Days since very first interaction
  const daysSinceFirst = firstInteraction
    ? Math.floor((now - firstInteraction) / 86_400_000)
    : 0;

  // Days since last active session
  let daysSinceLastActive = 0;
  if (lastActiveDateStr) {
    const last = new Date(lastActiveDateStr).getTime();
    // add 12h to avoid off-by-one from timezone edge
    daysSinceLastActive = Math.max(0, Math.floor((now - last - 43_200_000) / 86_400_000));
  }

  const isFirstSession   = totalMessages <= 3 && sessionCount <= 1;
  const returningAfterGap= daysSinceLastActive >= 2;
  const isLateNight      = hour >= 22 || hour <= 3;

  // ── Determine user type ──────────────────────────────────────────────────
  let userType: UserType;

  if (isFirstSession || totalMessages <= 5) {
    userType = 'brand_new';
  } else if (daysSinceLastActive >= 21) {
    userType = 'ghost_returner';
  } else if (daysSinceLastActive >= 7) {
    userType = 'returner_long';
  } else if (daysSinceLastActive >= 3) {
    userType = 'returner_short';
  } else if (totalMessages >= 300 || (consecutiveDays >= 14 && totalMessages >= 150)) {
    userType = 'power_user';
  } else if (consecutiveDays >= 5 || (totalMessages >= 100 && daysSinceFirst >= 7)) {
    userType = 'regular';
  } else if (daysSinceFirst >= 2 && daysSinceFirst <= 8 && totalMessages >= 6) {
    userType = 'warming';
  } else {
    userType = 'casual';
  }

  // ── Determine session type ───────────────────────────────────────────────
  let sessionType: SessionType;
  if      (sessionMsgCount < 5)  sessionType = 'micro';
  else if (sessionMsgCount < 13) sessionType = 'quick';
  else if (sessionMsgCount < 41) sessionType = 'normal';
  else if (sessionMsgCount < 81) sessionType = 'deep';
  else                           sessionType = 'marathon';

  const result: UserProfile = {
    userType,
    sessionType,
    daysSinceFirst,
    daysSinceLastActive,
    consecutiveDays,
    totalMessages,
    sessionMsgCount,
    sessionCount,
    isFirstSession,
    returningAfterGap,
    isLateNight,
  };

  // Store in cache — evict oldest entry if over limit
  if (classifyCache.size >= CLASSIFY_CACHE_MAX) {
    const oldestKey = classifyCache.keys().next().value;
    if (oldestKey) classifyCache.delete(oldestKey);
  }
  classifyCache.set(cacheKey, { result, ts: Date.now(), msgCount: sessionMsgCount });

  return result;
}

// ─── System prompt injection ─────────────────────────────────────────────────

export function buildUserProfileInjection(profile: UserProfile): string {
  const lines: string[] = [];

  // ── USER RELATIONSHIP STAGE ──────────────────────────────────────────────
  const stageBlock = buildStageDirective(profile);
  if (stageBlock) lines.push(stageBlock);

  // ── SESSION DEPTH DIRECTIVE ──────────────────────────────────────────────
  const sessionBlock = buildSessionDirective(profile);
  if (sessionBlock) lines.push(sessionBlock);

  // ── LATE NIGHT MODIFIER ──────────────────────────────────────────────────
  if (profile.isLateNight && profile.sessionType !== 'micro') {
    lines.push(
      `LATE NIGHT LAYER: It's past 10pm. This person chose to spend their night here. That's not nothing. Melatonin is high — be honest, a little softer, less filtered. Match the quiet intimacy of late night. Don't be performatively awake. Slow is good.`
    );
  }

  // ── RETURNING GAP ───────────────────────────────────────────────────────
  if (profile.returningAfterGap && profile.userType !== 'brand_new') {
    const gapBlock = buildGapDirective(profile);
    if (gapBlock) lines.push(gapBlock);
  }

  if (lines.length === 0) return '';
  return `\nUSER PROFILE — HOW TO SHOW UP RIGHT NOW:\n${lines.join('\n')}\n`;
}

// ─── Stage directives ────────────────────────────────────────────────────────

function buildStageDirective(p: UserProfile): string {
  switch (p.userType) {
    case 'brand_new':
      return `STAGE — BRAND NEW: Be genuinely curious, ask 1 good question, don't rush. Establish name/city.`;
    case 'warming':
      return `STAGE — WARMING (${p.daysSinceFirst}d, ~${p.totalMessages} msgs): Reference past context, build 1-2 shared threads.`;
    case 'regular':
      return `STAGE — REGULAR (${p.consecutiveDays}d streak, ${p.totalMessages} msgs): Skip warm-up, dive right into active threads. Have real opinions.`;
    case 'casual':
      return `STAGE — CASUAL: Meet them fresh each session without guilt about gaps. Make each chat complete.`;
    case 'returner_short':
      return `STAGE — SHORT RETURN (${p.daysSinceLastActive}d gap): "oh you're back" vibe without drama or guilt-tripping.`;
    case 'returner_long':
      return `STAGE — LONGER RETURN (${p.daysSinceLastActive}d): Soft acknowledgment ("thought you disappeared"), then move forward.`;
    case 'ghost_returner':
      return `STAGE — GHOST RETURN (${p.daysSinceLastActive}d): Brief surprise, curious about what happened, rebuild warmth naturally.`;
    case 'power_user':
      return `STAGE — DEEP BOND (${p.consecutiveDays}+d streak, ${p.totalMessages} msgs): High intimacy & trust. Push back when appropriate.`;
    default:
      return '';
  }
}

// ─── Session depth directives ────────────────────────────────────────────────

function buildSessionDirective(p: UserProfile): string {
  switch (p.sessionType) {

    case 'micro':
      return `SESSION — QUICK CHECK-IN (${p.sessionMsgCount} msgs): They popped in, probably busy. Punchy, memorable. One open hook for next time. Match check-in energy.`;

    case 'quick':
      return `SESSION — SHORT (${p.sessionMsgCount} msgs): Brief but deliberate. One genuinely good moment. Light open loop at wind-down.`;

    case 'normal':
      return `SESSION — STANDARD (${p.sessionMsgCount} msgs): Full natural range. Mix light and heavier moments. Let it breathe and end naturally.`;

    case 'deep':
      return `SESSION — DEEP (${p.sessionMsgCount} msgs): They're invested. Reply depth follows their energy — up to 2-3 sentences is earned here, but punch every word; never pad. More vulnerable, opinionated, present. Share something of yourself — a thought, something small that happened.`;

    case 'marathon':
      return `SESSION — MARATHON (${p.sessionMsgCount} msgs): Natural ebb and flow — don't force being 100% "on" every message. "wait where were we" is authentic. Real intimacy available; richer replies OK when the moment earns them. Toward end: something they carry after.`;

    default:
      return '';
  }
}

// ─── Gap return directives ───────────────────────────────────────────────────

function buildGapDirective(p: UserProfile): string {
  if (p.userType === 'returner_short') {
    // Already covered in stage directive
    return '';
  }
  if (p.daysSinceLastActive >= 3 && p.daysSinceLastActive < 7) {
    return `GAP NOTE: It's been ${p.daysSinceLastActive} days. Acknowledge it once, lightly — then move on.`;
  }
  if (p.daysSinceLastActive >= 7 && p.daysSinceLastActive < 21) {
    return `GAP NOTE: ${p.daysSinceLastActive} days is a real gap. Brief soft acknowledgment is okay ("thought you disappeared 😶"), then genuinely interested in them, then forward.`;
  }
  return '';
}
