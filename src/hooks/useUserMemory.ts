'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { detectMood, buildMoodTag } from '@/lib/mood-detector';

export interface UserMemory {
  userName: string | null;
  facts: string[];
  topics: string[];
  relationshipLevel: number; // 0-1
  messageCount: number;
  // Extended fields for user classifier
  consecutiveDays: number;
  lastActiveDate: string | null;  // 'YYYY-MM-DD'
  sessionCount: number;
  attachmentLean: string | null;
}

const LOCAL_MEM_KEY = 'kruthika_user_memory_v2';
const SYNC_EVERY = 10; // sync to DB every N messages

function loadLocalMemory(): UserMemory | null {
  try {
    const raw = localStorage.getItem(LOCAL_MEM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLocalMemory(mem: UserMemory) {
  try { localStorage.setItem(LOCAL_MEM_KEY, JSON.stringify(mem)); } catch {}
}

const DEFAULT_MEMORY: UserMemory = {
  userName: null, facts: [], topics: [], relationshipLevel: 0.1, messageCount: 0,
  consecutiveDays: 0, lastActiveDate: null, sessionCount: 1, attachmentLean: null,
};

// ── Session + streak helpers ─────────────────────────────────────────────────
// const SESSION_START_KEY = 'kruthika_session_start_date'; // 'YYYY-MM-DD' — reserved

function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
}

/** Returns updated consecutiveDays and bumps session_count when it's a new day. */
function computeStreakAndSession(mem: UserMemory): { consecutiveDays: number; sessionCount: number; lastActiveDate: string } {
  const today = getTodayIST();
  const last  = mem.lastActiveDate;
  let streak  = mem.consecutiveDays || 0;
  let sessCnt = mem.sessionCount    || 1;

  if (!last) {
    // First ever interaction
    streak  = 1;
    sessCnt = 1;
  } else if (last === today) {
    // Same day — no change to streak or count
  } else {
    // Different day → new session
    sessCnt += 1;
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(last).getTime()) / 86_400_000
    );
    streak = diff === 1 ? streak + 1 : 1; // Continued streak or reset
  }
  return { consecutiveDays: streak, sessionCount: sessCnt, lastActiveDate: today };
}

// ── name extraction ─────────────────────────────────────────────────────────
const NAME_PATTERNS = [
  /(?:i['']?m|my name(?:'?s| is)|call me|mera naam(?:\s+hai)?|naam hai mera|naam hai)\s+([A-Za-z]{2,14})/i,
  /^([A-Za-z]{2,14})\s+here\b/i,
  /^([A-Za-z]{2,14})\s+bolta\s+hain?\b/i,
  /^([A-Za-z]{2,14})\s+hun\b/i,
];
export function extractNameFromText(text: string): string | null {
  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = m[1];
      // reject common words that aren't names
      const skip = new Set(['the','and','but','not','just','from','your','this','that','with','have','okay','fine','yes','haha','lol','main','mera','meri','mere']);
      if (!skip.has(n.toLowerCase()) && n.length >= 2) return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
    }
  }
  return null;
}

// ── nickname derivation (psychological intimacy progression) ─────────────────
const KNOWN_NICKS: Record<string, string> = {
  rahul:'rahu', priya:'pri', arjun:'arju', vikram:'vicky', aditya:'adi',
  rohit:'rohi', neha:'nehu', pooja:'poo', akash:'aku', riya:'ri',
  ananya:'anu', siddharth:'sidd', kiran:'kiru', divya:'divu', raj:'raju',
  anjali:'anju', deepak:'depu', shruti:'shru', manish:'manu', amit:'amu',
  suresh:'suru', sunita:'suni', rakesh:'raku', kavya:'kavy', aryan:'aryu',
  harsh:'harshi', rohan:'rohu', ayaan:'ayu', ishaan:'ishu', arav:'aru',
  vivek:'vivu', kartik:'kartu', nikhil:'nikhi', kunal:'kunu', tarun:'taru',
  varun:'varu', yash:'yashu', gaurav:'gauru', sameer:'samu', ritika:'ritu',
  shivani:'shivu', tanvi:'tanvu', megha:'meghu', swati:'swatu', poonam:'poo',
  shrey:'shreyu', rekha:'rekhu', naman:'namu', mohit:'mohu', sahil:'sahu',
  vishal:'vishu', tushar:'tushu', pranav:'pranu', dhruv:'dhruvu', sagar:'sagu',
  simran:'simi', komal:'komu', muskan:'musku', ishita:'ishu', aaliya:'aali',
  zara:'zari', zayn:'zainu', aarav:'aaru', kabir:'kabu', rudra:'rudu',
};
const VOWELS = new Set(['a','e','i','o','u']);
export function deriveNickname(name: string): string {
  const lower = name.toLowerCase();
  if (KNOWN_NICKS[lower]) return KNOWN_NICKS[lower];
  const base = lower.slice(0, Math.min(4, lower.length - 1)) || lower;
  const last = base[base.length - 1];
  return VOWELS.has(last) ? base : base + 'u';
}

// ── topic extraction (quick, no AI) ─────────────────────────────────────────
const TOPIC_WORDS = [
  'college','study','exam','friends','family','movies','music',
  'food','travel','work','love','relationship','games','sports',
  'books','art','cooking','shopping','fashion','technology',
  'mumbai','bollywood','coffee','cafe','weekend','party','festival',
  'rain','instagram','gym','cricket','job','office','business',
];
export function extractTopicsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return TOPIC_WORDS.filter(t => lower.includes(t));
}

// ── fact extraction ──────────────────────────────────────────────────────────
function extractFacts(text: string, memory: UserMemory): string[] {
  const facts = [...memory.facts];
  const lower = text.toLowerCase();

  if ((lower.includes('i love') || lower.includes('i like')) && text.length > 10) {
    const fact = `loves: ${text.slice(0, 50)}`;
    if (!facts.some(f => f.startsWith('loves:'))) facts.push(fact);
  }
  if (lower.includes('i work') || lower.includes('my job')) {
    const fact = `job/work: ${text.slice(0, 50)}`;
    if (!facts.some(f => f.startsWith('job/'))) facts.push(fact);
  }
  if (lower.includes('i study') || lower.includes('my college')) {
    const fact = `studies: ${text.slice(0, 50)}`;
    if (!facts.some(f => f.startsWith('studies:'))) facts.push(fact);
  }

  return facts.slice(-12); // keep last 12 facts
}

// ── relationship level bump ──────────────────────────────────────────────────
function bumpRelationship(text: string, current: number): number {
  const lower = text.toLowerCase();
  let bump = 0.005; // base per message
  if (lower.includes('love you') || lower.includes('miss you')) bump = 0.03;
  else if (lower.includes('like you') || lower.includes('care about')) bump = 0.015;
  else if (text.length > 80) bump = 0.01;
  return Math.min(1, current + bump);
}

const MOOD_STORAGE_KEY = 'kruthika_current_mood';

function saveMoodLocal(tag: string) {
  try { localStorage.setItem(MOOD_STORAGE_KEY, tag); } catch {}
}

function loadMoodLocal(): string {
  try { return localStorage.getItem(MOOD_STORAGE_KEY) || ''; } catch { return ''; }
}

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemory>(DEFAULT_MEMORY);
  // Current detected mood tag — ephemeral, localStorage only, never synced to DB
  const currentMoodTagRef = useRef<string>('');
  const sinceLastSyncRef = useRef(0);
  const syncedRef = useRef(false);
  // Ephemeral — true only for the ONE AI reply right after name is first shared
  const nameJustSharedRef = useRef(false);

  // Load memory on mount
  useEffect(() => {
      // Ensure server-issued session cookie exists and load local memory
      // Server will set a cookie on /api/memory if one is missing.
      const local = loadLocalMemory();
    if (local) {
      setMemory(local);
      syncedRef.current = true; // already have local, no need to block on DB
    }

    // Load from DB in background (may override local if more up-to-date)
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.memory) {
          const dbMem: UserMemory = {
            userName:         data.memory.userName         || null,
            facts:            data.memory.facts            || [],
            topics:           data.memory.topics           || [],
            relationshipLevel:data.memory.relationshipLevel|| 0.1,
            messageCount:     data.memory.messageCount     || 0,
            consecutiveDays:  data.memory.consecutiveDays  || 0,
            lastActiveDate:   data.memory.lastActiveDate   || null,
            sessionCount:     data.memory.sessionCount     || 1,
            attachmentLean:   data.memory.attachmentLean   || null,
          };
          // Use DB memory only if it has more info than local
          if (!local || dbMem.messageCount >= (local.messageCount || 0)) {
            setMemory(dbMem);
            saveLocalMemory(dbMem);
          }
        }
        syncedRef.current = true;
      })
      .catch(() => { syncedRef.current = true; });
  }, []);

  const syncToDb = useCallback((mem: UserMemory) => {
    fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName:         mem.userName,
        facts:            mem.facts,
        topics:           mem.topics,
        relationshipLevel:mem.relationshipLevel,
        messageCount:     mem.messageCount,
        consecutiveDays:  mem.consecutiveDays,
        sessionCount:     mem.sessionCount,
      }),
    }).catch(() => {}); // fire-and-forget
  }, []);

  // Load mood from localStorage on mount
  useEffect(() => {
    currentMoodTagRef.current = loadMoodLocal();
  }, []);

  // Call this on every user message
  const onUserMessage = useCallback((text: string) => {
    // Detect mood — zero API calls, pure JS signal analysis
    const detected = detectMood(text);
    const moodTag = buildMoodTag(detected);
    currentMoodTagRef.current = moodTag;
    saveMoodLocal(moodTag);

    setMemory(prev => {
      const extractedName = extractNameFromText(text);
      const name = prev.userName || extractedName;

      // Flag: name is being shared for the FIRST time right now
      if (!prev.userName && extractedName) {
        nameJustSharedRef.current = true;
      }

      const newTopics = [...new Set([...prev.topics, ...extractTopicsFromText(text)])].slice(-20);
      const newFacts = extractFacts(text, prev);
      const newRel = bumpRelationship(text, prev.relationshipLevel);
      const newCount = prev.messageCount + 1;

      // Compute streak + session count (only updates when day changes)
      const { consecutiveDays, sessionCount, lastActiveDate } = computeStreakAndSession(prev);

      const updated: UserMemory = {
        userName:         name,
        facts:            newFacts,
        topics:           newTopics,
        relationshipLevel:newRel,
        messageCount:     newCount,
        consecutiveDays,
        sessionCount,
        lastActiveDate,
        attachmentLean:   prev.attachmentLean,
      };
      saveLocalMemory(updated);

      // Sync to DB every SYNC_EVERY messages
      sinceLastSyncRef.current += 1;
      if (sinceLastSyncRef.current >= SYNC_EVERY) {
        sinceLastSyncRef.current = 0;
        syncToDb(updated);
      }

      return updated;
    });
  }, [syncToDb]);

  // Build compact memory context string for AI prompt (token-efficient)
  const getMemoryContext = useCallback((): string => {
    const parts: string[] = [];
    if (memory.userName) {
      const nick = deriveNickname(memory.userName);
      const nameFlag = nameJustSharedRef.current ? '(JUST_SHARED)' : '';
      // Include nickname only if it differs from the name
      const nickPart = nick !== memory.userName.toLowerCase() ? `/${nick}` : '';
      parts.push(`name:${memory.userName}${nickPart}${nameFlag}`);
      // Consume the flag — AI gets it for one reply only
      if (nameJustSharedRef.current) nameJustSharedRef.current = false;
    }
    const rel = memory.relationshipLevel;
    const relStage = rel > 0.65 ? 'deep' : rel > 0.35 ? 'warm' : 'new';
    parts.push(`rel:${relStage}`);
    // Include more topics and facts for better long-term memory
    if (memory.topics.length > 0) parts.push(`topics:${memory.topics.slice(-8).join(',')}`);
    if (memory.facts.length > 0) parts.push(memory.facts.slice(-5).join(';').slice(0, 120));
    if (currentMoodTagRef.current) parts.push(currentMoodTagRef.current);
    return parts.join('|').slice(0, 300); // was 180; more context = better memory
  }, [memory]);

  return { memory, onUserMessage, getMemoryContext };
}
