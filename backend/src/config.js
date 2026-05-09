import dotenv from 'dotenv';

dotenv.config();

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asOrigins(value) {
  if (!value || value.trim() === '*') return ['*'];
  return value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const config = {
  port: asNumber(process.env.PORT, 8787),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigins: asOrigins(process.env.FRONTEND_ORIGIN || '*'),
  rateLimitWindowMs: asNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: asNumber(process.env.RATE_LIMIT_MAX, 120),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  aiProviderPriority: (process.env.AI_PROVIDER_PRIORITY || 'openai,gemini')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
};
