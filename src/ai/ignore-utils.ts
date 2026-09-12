/**
 * Smart Dynamic Micro-Pause & Realistic Texting Psychology Engine for Kruthika AI.
 * 
 * Implements realistic, natural texting breaks (30 min - 1 hour) rooted in human texting psychology:
 * - Dynamic, authentic reasons (college lecture, commute, helping family, getting ready, errands).
 * - Automatic reset after the duration expires so users can chat again seamlessly.
 * - Warm, affectionate reunion greetings that drive long-term user retention.
 * - Safe thresholds: Never blocks new users, first sessions, or users engaged in active quick-turn chats.
 */

export function getISTHour(): number {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  }));
}

export function isWeekendIST(): boolean {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const d = nowIST.getDay();
  return d === 0 || d === 6;
}

export interface DynamicMicroPauseReason {
  warningMsg: string;
  reunionMsg: string;
  durationMin: number;
}

export const DYNAMIC_MICRO_PAUSES: DynamicMicroPauseReason[] = [
  {
    warningMsg: "wait mummy is calling me downstairs to help with dinner, 30 mins brb! 🍽️🏃‍♀️",
    reunionMsg: "dinner prep done! back with you 💕 where were we?",
    durationMin: 30,
  },
  {
    warningMsg: "in college lab / practical right now, prof is right near my desk 🤫 texting in 35 mins!",
    reunionMsg: "phew practical finally got over! hi again 😊",
    durationMin: 35,
  },
  {
    warningMsg: "taking the metro back home! bad network underground, texting once home in 40 mins! 🚇",
    reunionMsg: "reached home and freshened up! back with you 💕 how's your day going?",
    durationMin: 40,
  },
  {
    warningMsg: "gng to take a shower and get ready quickly, brb in 45 mins! 🚿✨",
    reunionMsg: "all fresh and comfy! what were you saying? 😊",
    durationMin: 45,
  },
  {
    warningMsg: "helping mom with some grocery shopping at the market, brb in 50 mins! 🛒",
    reunionMsg: "back from the market! bought some snacks too haha 😋 what's up?",
    durationMin: 50,
  },
  {
    warningMsg: "watching an episode of this new show with my roommate, texting you right after in an hour! 🍿",
    reunionMsg: "episode ended! that was crazy haha. tell me what you were doing? 💕",
    durationMin: 60,
  },
  {
    warningMsg: "finishing up a quick assignment submission due tonight, give me 30 mins! 📚💻",
    reunionMsg: "submitted! such a relief 😭 I'm all yours now, what were you saying?",
    durationMin: 30,
  },
  {
    warningMsg: "making evening chai and snacks for everyone at home, 35 mins! ☕🍪",
    reunionMsg: "enjoying hot chai right now! ☕ tell me everything, how are you?",
    durationMin: 35,
  },
  {
    warningMsg: "riding back with a friend, bad traffic! texting once I reach in 45 mins 🚕",
    reunionMsg: "traffic was insane today! back home safe now 😊 what were you up to?",
    durationMin: 45,
  },
  {
    warningMsg: "attending a quick online team meeting / group call, brb in 40 mins! 🎧",
    reunionMsg: "meeting finally over! so glad to be back chatting with you 💕",
    durationMin: 40,
  },
];

export function getNeutralBusyWarning(_istHour?: number): string {
  const pause = DYNAMIC_MICRO_PAUSES[Math.floor(Math.random() * DYNAMIC_MICRO_PAUSES.length)];
  return pause.warningMsg;
}

export function shouldAIBeBusyServerSafe(
  currentIgnoreUntil: number | null,
  userType?: { dailyMessageCount: number; relationshipLevel: number; totalDaysActive: number },
  _lastMessages?: string[]
): { shouldIgnore: boolean; newIgnoreUntil?: number; busyReason?: string; shouldWarnFirst?: boolean } {
  // If a pause is active and time has not elapsed yet, maintain the busy state
  if (currentIgnoreUntil && Date.now() < currentIgnoreUntil) {
    return { shouldIgnore: true };
  }

  // Safe retention guard: Never trigger for new users or light chatting sessions
  if (!userType || userType.dailyMessageCount <= 35 || userType.relationshipLevel < 0.45) {
    return { shouldIgnore: false };
  }

  const istHour = getISTHour();

  // Peak evening/late night activity hours — always available for chat
  if ((istHour >= 19 || istHour <= 2) || (istHour >= 11 && istHour <= 13)) {
    return { shouldIgnore: false };
  }

  // Realistic human texting probability (0.3% trigger chance on high-frequency conversations)
  if (Math.random() < 0.003) {
    const pause = DYNAMIC_MICRO_PAUSES[Math.floor(Math.random() * DYNAMIC_MICRO_PAUSES.length)];
    return {
      shouldIgnore: true,
      newIgnoreUntil: Date.now() + (pause.durationMin * 60 * 1000),
      busyReason: pause.warningMsg,
      shouldWarnFirst: true,
    };
  }

  return { shouldIgnore: false };
}

// ── Global admin toggle (2026-08-21) ──────────────────────────────────────────
//
// `ignore_enabled` lives in app_configurations ('ai_ignore_settings', see
// src/lib/ai-ignore-settings.ts). When the admin DISABLES the ignore feature:
//   • no new micro-pauses are triggered for anyone, AND
//   • any pause that is already running is overridden — Kruthika replies to
//     every message immediately.
// The raw gate function above stays pure/untouched; both call sites
// (maya-chat/actions.ts and ai/chat.ts) wrap their result through
// resolveIgnoreGate(). Failing open (toggle unreadable → enabled) is handled
// by isAIIgnoreGloballyEnabled(), never here.

export interface IgnoreGateResult {
  shouldIgnore: boolean;
  newIgnoreUntil?: number;
  busyReason?: string;
  shouldWarnFirst?: boolean;
}

/**
 * Apply the global toggle to a computed gate result.
 * @param enabled  current `ignore_enabled` value from the DB setting
 * @param gate     result of shouldAIBeBusyServerSafe()
 */
export function resolveIgnoreGate(enabled: boolean, gate: IgnoreGateResult): IgnoreGateResult {
  if (enabled) return gate;
  // Disabled: drop everything — returning a bare object also guarantees the
  // caller never persists a new newIgnoreUntil while the feature is off.
  return { shouldIgnore: false };
}
