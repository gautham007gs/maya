/**
 * vertex-ai.ts — backward-compat shim
 *
 * Despite the filename, this project calls the Gemini Developer API directly
 * with an API key (via @google/genai) — not Google Cloud Vertex AI. The name
 * is legacy from an earlier architecture decision; kept as-is since renaming
 * would touch every file that imports from here for zero functional gain.
 *
 * All AI calls go through the multi-provider engine (multi-provider.ts).
 * This file keeps the same export surface so every import in the codebase
 * continues to work without changes.
 */

export {
  generateAIResponse,
  generateEmotionalResponse,
  generateMultilingualResponse,
  testAIProvider as testVertexAI,
} from './multi-provider';
