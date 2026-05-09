/**
 * services/aiProvider.js
 *
 * AI provider facade with environment-controlled primary/fallback strategy.
 *
 * Reads:
 *   AI_PROVIDER          = "openai" | "gemini"  (default: openai)
 *   AI_FALLBACK_PROVIDER = "openai" | "gemini"  (default: gemini)
 *
 * If the primary provider fails (e.g. quota exceeded, key missing) the
 * fallback is tried automatically, and the response includes which provider
 * was actually used.
 */

'use strict';

const { callOpenAI } = require('./openai');
const { callGemini } = require('./gemini');

const PROVIDERS = {
  openai: callOpenAI,
  gemini: callGemini
};

/**
 * Call the configured AI provider with optional fallback.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<{ response: string, provider: string }>}
 */
async function callAI(systemPrompt, userMessage) {
  const primary  = (process.env.AI_PROVIDER          || 'openai').toLowerCase();
  const fallback = (process.env.AI_FALLBACK_PROVIDER || 'gemini').toLowerCase();

  const primaryFn  = PROVIDERS[primary];
  const fallbackFn = PROVIDERS[fallback];

  if (!primaryFn) throw new Error(`Unknown AI provider: ${primary}`);

  try {
    const response = await primaryFn(systemPrompt, userMessage);
    return { response, provider: primary };
  } catch (primaryErr) {
    console.warn(`[AI] Primary provider '${primary}' failed: ${primaryErr.message}`);

    if (!fallbackFn || fallback === primary) throw primaryErr;

    try {
      const response = await fallbackFn(systemPrompt, userMessage);
      return { response, provider: `${fallback} (fallback)` };
    } catch (fallbackErr) {
      console.error(`[AI] Fallback provider '${fallback}' also failed: ${fallbackErr.message}`);
      throw new Error(`Both AI providers failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`);
    }
  }
}

module.exports = { callAI };
