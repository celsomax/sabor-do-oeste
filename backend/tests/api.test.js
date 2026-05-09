/**
 * tests/api.test.js
 *
 * Integration tests for Express routes.
 * Uses Node.js built-in test runner + supertest.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert   = require('node:assert/strict');
const supertest = require('supertest');

// Provide dummy env before loading app
process.env.NODE_ENV     = 'test';
process.env.CORS_ORIGIN  = 'http://localhost:5500';
// Use invalid keys so AI routes fail predictably without real keys
process.env.AI_PROVIDER          = 'openai';
process.env.AI_FALLBACK_PROVIDER = 'gemini';
process.env.OPENAI_API_KEY       = 'test-key';
process.env.GEMINI_API_KEY       = 'test-key';

const app = require('../server');
let request;

before(() => { request = supertest(app); });

// -----------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------
describe('GET /api/health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request.get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(typeof res.body.timestamp === 'string');
  });
});

// -----------------------------------------------------------------------
// POST /api/stock/calculate-cost
// -----------------------------------------------------------------------
describe('POST /api/stock/calculate-cost', () => {
  it('should return cost breakdown for valid input', async () => {
    const res = await request
      .post('/api/stock/calculate-cost')
      .send({ kgCarne: 10, precoCarne: 20, metrosTripa: 0, produto: 'linguica_defumada' });

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.custoTotal === 'number');
    assert.ok(Math.abs(res.body.custoTotal - 225.70) < 0.01, `Expected ~225.70, got ${res.body.custoTotal}`);
    assert.ok(typeof res.body.unidadesEstimadas === 'number');
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request.post('/api/stock/calculate-cost').send({});
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });
});

// -----------------------------------------------------------------------
// POST /api/stock/alerts
// -----------------------------------------------------------------------
describe('POST /api/stock/alerts', () => {
  it('should return alerts for low-stock lots', async () => {
    const lotes = [{
      id: 'L001', produto: 'salame', status: 'pronto',
      unidadesEstimadas: 5, custoTotal: 100,
      dataProducao: '2024-01-01', dataFimMaturacao: null
    }];

    const res = await request
      .post('/api/stock/alerts')
      .send({ lotes, vendas: [] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.alerts[0].loteId, 'L001');
    assert.ok(['alerta', 'critico'].includes(res.body.alerts[0].nivel));
  });

  it('should return no alerts when stock is sufficient', async () => {
    const lotes = [{
      id: 'L002', produto: 'linguica_defumada', status: 'pronto',
      unidadesEstimadas: 50, custoTotal: 300,
      dataProducao: '2024-01-01', dataFimMaturacao: null
    }];

    const res = await request
      .post('/api/stock/alerts')
      .send({ lotes, vendas: [] });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
  });
});

// -----------------------------------------------------------------------
// POST /api/stock/summary
// -----------------------------------------------------------------------
describe('POST /api/stock/summary', () => {
  it('should return summary with correct profit calculation', async () => {
    const lotes = [{
      id: 'L003', produto: 'linguica_defumada', status: 'pronto',
      unidadesEstimadas: 20, custoTotal: 200,
      dataProducao: '2024-01-01', dataFimMaturacao: null
    }];
    const vendas = [{ loteId: 'L003', produto: 'linguica_defumada', unidades: 5, precoUnit: 30, data: '2024-02-01' }];

    const res = await request
      .post('/api/stock/summary')
      .send({ lotes, vendas });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalLotes, 1);
    assert.ok(Math.abs(res.body.totalReceita - 150) < 0.01);
    assert.ok(Math.abs(res.body.totalCusto - 200) < 0.01);
  });
});

// -----------------------------------------------------------------------
// POST /api/ai/chat – validation (will fail AI call without real key)
// -----------------------------------------------------------------------
describe('POST /api/ai/chat – input validation', () => {
  it('should return 400 when question is missing', async () => {
    const res = await request
      .post('/api/ai/chat')
      .send({ lotes: [], vendas: [], compras: [] });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });
});

// -----------------------------------------------------------------------
// 404 handler
// -----------------------------------------------------------------------
describe('Unknown routes', () => {
  it('should return 404 for unknown path', async () => {
    const res = await request.get('/api/unknown-endpoint');
    assert.strictEqual(res.status, 404);
  });
});
