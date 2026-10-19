import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../../ai/prompt';
import { buildConversationPayload } from '../../ai/multi-provider';

describe('AI Prompt & Token Consumption Audit', () => {
  it('measures exact token efficiency for standard and long-term conversation turns', () => {
    // 1. Benchmark System Prompt
    const systemPrompt = buildSystemPrompt({
      knownName: 'Rahul',
      nickname: 'Rocky',
      relStage: 'warm',
      memKnowledge: 'loves coding in python, studying for exams, lives in Bangalore',
    });

    // Approximate token estimation: ~4 chars per token for English/Hinglish
    const systemPromptWords = systemPrompt.split(/\s+/).length;
    const systemPromptEstimatedTokens = Math.ceil(systemPrompt.length / 3.8);

    console.log('\n📊 [Token Efficiency Audit]');
    console.log(`  📝 System Prompt Character Count: ${systemPrompt.length} chars`);
    console.log(`  📝 System Prompt Word Count:      ${systemPromptWords} words`);
    console.log(`  ⚡ Estimated System Tokens:       ~${systemPromptEstimatedTokens} tokens`);

    // System prompt must be under 320 tokens to minimize per-turn cost
    assert.ok(systemPromptEstimatedTokens < 320, `System prompt too large: ${systemPromptEstimatedTokens} tokens`);

    // 2. Benchmark Full Turn Payload with 10 turns of history
    const sampleHistory = [
      'User: heyy kruthika how are you',
      'AI: heyy Rahul! doing good, just wrapping up class',
      'User: what are you up to today?',
      'AI: heading to canteen with friends for samosa haha',
      'User: nice, save one for me',
      'AI: haha only if you reach Mumbai in 5 mins!',
      'User: lol wish I could',
      'AI: next time you visit for sure!',
      'User: dealing with some annoying code bugs right now',
      'AI: ugh hate bugs! python or javascript today?',
    ];

    const userMessage = 'python... indentation error somewhere';
    const payload = buildConversationPayload(systemPrompt, sampleHistory, userMessage);

    const totalPayloadChars = payload.reduce((acc, m) => acc + m.content.length, 0);
    const totalPayloadWords = payload.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0);
    const totalEstimatedTokens = Math.ceil(totalPayloadChars / 3.8);

    console.log(`\n  💬 Full Turn Context (10-msg history + system prompt + new user msg):`);
    console.log(`  📦 Total Message Count:     ${payload.length} messages`);
    console.log(`  📦 Total Characters:        ${totalPayloadChars} chars`);
    console.log(`  📦 Total Words:             ${totalPayloadWords} words`);
    console.log(`  ⚡ Total Input Tokens:      ~${totalEstimatedTokens} tokens`);

    // Full conversational turn should comfortably sit under 450 tokens
    assert.ok(totalEstimatedTokens < 450, `Turn payload exceeds token budget: ${totalEstimatedTokens} tokens`);
  });
});
