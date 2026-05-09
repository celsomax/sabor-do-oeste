/**
 * services/gemini.js
 *
 * Google Gemini provider wrapper.
 * Uses @google/generative-ai npm package.
 */

'use strict';

let _genAI = null;

function getClient() {
  if (_genAI) return _genAI;
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
}

/**
 * Call Gemini generateContent.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>} AI text response
 */
async function callGemini(systemPrompt, userMessage) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured.');
  }

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    systemInstruction: systemPrompt
  });

  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

module.exports = { callGemini };
