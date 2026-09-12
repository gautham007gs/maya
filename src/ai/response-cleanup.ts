/**
 * @fileoverview Shared LLM response cleanup utility.
 *
 * Single function used by chat.ts, offline-message-generation.ts, and
 * proactive-messaging-actions.ts. Strips artifacts the LLM should not
 * produce — surrounding quotes and markdown bold/italic — without touching
 * any actual content.
 */

/**
 * Strip leaked "internal planning" artifacts a reasoning-capable model can
 * echo into its final text channel instead of only its hidden thinking
 * channel — e.g. self-labelling its own bubbles ("Bubble 2: ...") or
 * self-auditing the word-count rule the prompt gives it ("... (10 words)").
 *
 * Root cause (see AI_SYSTEM.md / CHANGES_SUMMARY.md "bubble leak" note):
 * the system prompt tells the model "Each bubble must be under 15 words" —
 * a reasoning model sometimes complies with that instruction *visibly*,
 * drafting/labelling/counting its bubbles in the answer text itself rather
 * than purely in its hidden thinking tokens. This is a text-hygiene bug,
 * not a content bug, so it's fixed here rather than by changing the
 * character's voice.
 *
 * Applied line-by-line (multiline) so it works BEFORE the response is
 * split into bubbles, and is also re-applied per-bubble in
 * splitResponseIntoBubbles as defense in depth.
 */
function stripLeakedPlanningArtifacts(text: string): string {
  return text
    // "Bubble 1:", "Bubble 2 -", "bubble1)" ... at the start of a line
    .replace(/^\s*bubble\s*#?\d+\s*[:\-)]\s*/gim, '')
    // trailing/inline self-audit word counts: "(10 words)", "[7 words]"
    .replace(/[\[(]\s*\d{1,3}\s*words?\s*[\])]/gi, '')
    // stray "Word count: 10" style self-audit lines
    .replace(/^\s*word\s*count\s*:?\s*\d+\s*$/gim, '');
}

/**
 * Strip formatting artifacts from a raw LLM response.
 * Applied AFTER the LLM call, BEFORE returning to the caller.
 *
 * Rules (in order):
 *  1. Trim surrounding whitespace
 *  2. Strip leaked planning/labelling artifacts (see stripLeakedPlanningArtifacts)
 *  3. Strip leading/trailing quotation marks (LLMs sometimes wrap their reply in "..." or '...')
 *  4. Strip markdown bold/italic: *italic* and **bold** (one or more asterisks each side)
 *  5. Final trim in case stripping left leading/trailing whitespace
 *
 * Content is never rewritten — only formatting artifacts are removed.
 */
export function cleanLLMResponse(raw: string): string {
  return stripLeakedPlanningArtifacts(raw)
    .trim()
    .replace(/^["']|["']$/g, '')          // leading/trailing quotation marks
    .replace(/\*{1,3}(\S[^*]*?\S)\*{1,3}/g, '$1')  // **bold** / *italic* → unwrapped (preserves content)
    .replace(/^#{1,3}\s+/gm, '')          // leading markdown headers (### Heading → Heading)
    .replace(/[ \t]+\n/g, '\n')           // trailing spaces left behind by the strips above
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Hard-trim a single bubble that is too long.
 *
 * Strategy:
 *  1. If ≤ MAX_CHARS, return as-is.
 *  2. Try to split at the last comma/semicolon/em-dash/en-dash before MAX_CHARS — return the
 *     first part only (the remainder is discarded; the caller already split at sentence level).
 *  3. Otherwise cut at the last word boundary before MAX_CHARS and append "…".
 *
 * MAX_CHARS = 90 keeps bubbles readable on mobile without feeling truncated.
 */
const BUBBLE_MAX_CHARS = 90;

function trimBubble(text: string): string {
  if (text.length <= BUBBLE_MAX_CHARS) return text;

  // Try clause boundary within the limit
  const clauseMatch = text.slice(0, BUBBLE_MAX_CHARS).match(/^(.*[,;—–])\s+\S/);
  if (clauseMatch) return clauseMatch[1].trim();

  // Fall back to word boundary
  const wordBoundary = text.slice(0, BUBBLE_MAX_CHARS).lastIndexOf(' ');
  if (wordBoundary > 30) return text.slice(0, wordBoundary).trim() + '…';

  return text.slice(0, BUBBLE_MAX_CHARS).trim() + '…';
}

/**
 * Convert model output into WhatsApp-style chat bubbles.
 *
 * Priority:
 *  1. Explicit newlines — the prompt asks the model to put each bubble on its own line.
 *  2. Sentence-boundary split — for long single-line responses (>40 chars) that
 *     didn't get split by the model, split at sentence endings (. ! ? ।).
 *  3. Clause-level split — for long lines that have no sentence endings,
 *     split at commas/semicolons/em-dashes.
 *
 * Each bubble is additionally trimmed to ≤ BUBBLE_MAX_CHARS so no single bubble
 * is a wall of text.
 *
 * Capped at maxBubbles (default 3) — trailing parts are merged into the last bubble.
 */
export function splitResponseIntoBubbles(raw: string, maxBubbles = 3): string[] {
  // Step 1: split on explicit newlines
  const lines = stripLeakedPlanningArtifacts(raw)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim().replace(/^["']|["']$/g, '').trim()) // per-line quote wrap (defense in depth)
    .filter(Boolean);

  if (lines.length > 1) {
    // Model used newlines — respect them, trim each, cap at maxBubbles
    const trimmed = lines.map(trimBubble);
    if (trimmed.length <= maxBubbles) return trimmed;
    return [
      ...trimmed.slice(0, maxBubbles - 1),
      trimmed.slice(maxBubbles - 1).join(' '),
    ];
  }

  const text = lines[0] ?? '';

  // Step 2: single-line response — sentence-boundary split for text > 40 chars
  if (text.length > 40) {
    const sentences = text
      .split(/(?<=[.!?।])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      const trimmed = sentences.map(trimBubble);
      if (trimmed.length <= maxBubbles) return trimmed;
      return [
        ...trimmed.slice(0, maxBubbles - 1),
        trimmed.slice(maxBubbles - 1).join(' '),
      ];
    }
  }

  // Step 3: long single-sentence — try clause split (comma / semicolon / em-dash)
  if (text.length > 60) {
    const clauses = text
      .split(/(?<=[,;—–])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 2);

    if (clauses.length > 1) {
      // Merge very short clause fragments
      const merged: string[] = [];
      let acc = '';
      for (const c of clauses) {
        if (acc.length + c.length + 2 < 50) {
          acc = acc ? `${acc}, ${c}` : c;
        } else {
          if (acc) merged.push(acc);
          acc = c;
        }
      }
      if (acc) merged.push(acc);

      if (merged.length > 1) {
        const trimmed = merged.map(trimBubble);
        if (trimmed.length <= maxBubbles) return trimmed;
        return [
          ...trimmed.slice(0, maxBubbles - 1),
          trimmed.slice(maxBubbles - 1).join(' '),
        ];
      }
    }
  }

  // Short single line — one bubble is correct (still trim if oddly long)
  return [trimBubble(text)];
}
