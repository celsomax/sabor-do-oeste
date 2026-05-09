/**
 * services/openai.js
 *
 * OpenAI provider wrapper.
 * Uses the official openai npm package.
 * Exported function returns a plain string (the AI response).
 */

'use strict';

let _client = null;

function getClient() {
  if (_client) return _client;
  const { OpenAI } = require('openai');
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

/**
 * Call OpenAI ChatCompletions.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>} AI text response
 */
async function callOpenAI(systemPrompt, userMessage) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured.');
  }

  const client = getClient();
  const model  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system',  content: systemPrompt },
      { role: 'user',    content: userMessage  }
    ],
    temperature: 0.4,
    max_tokens:  1024
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

module.exports = { callOpenAI };
