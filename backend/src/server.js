import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { analisarComIA } from './services/ai.js';
import { deleteLoteFromCloud, exportSnapshotFromCloud, importSnapshotFromLocal } from './services/firestore.js';

const app = express();

function resolveCorsOrigin(origin, callback) {
  const allowed = config.frontendOrigins;
  if (allowed.includes('*')) return callback(null, true);
  if (!origin) return callback(null, true);
  if (allowed.includes(origin)) return callback(null, true);
  return callback(new Error(`Origem nao permitida: ${origin}`));
}

app.use(helmet());
app.use(
  cors({
    origin: resolveCorsOrigin
  })
);
app.use(express.json({ limit: '2mb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sabor-do-oeste-backend', env: config.nodeEnv });
});

app.post('/api/sync/import-local', async (req, res) => {
  try {
    const result = await importSnapshotFromLocal(req.body?.dados || {});
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/sync/export-cloud', async (_req, res) => {
  try {
    const result = await exportSnapshotFromCloud();
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete('/api/sync/lote/:id', async (req, res) => {
  try {
    const result = await deleteLoteFromCloud(req.params?.id || '');
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/ai/analisar', async (req, res) => {
  try {
    const perguntaUsuario = req.body?.perguntaUsuario;
    const dados = req.body?.dados;
    const result = await analisarComIA({ perguntaUsuario, dados });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(config.port, () => {
  console.log(`[sabor-do-oeste-backend] rodando em http://localhost:${config.port}`);
});
