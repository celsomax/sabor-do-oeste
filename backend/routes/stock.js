/**
 * routes/stock.js
 *
 * GET  /api/stock/alerts  – Return lots with low stock
 * GET  /api/stock/summary – Return full stock summary (requires Firestore)
 * POST /api/stock/calculate-cost – Server-side cost calculation
 */

'use strict';

const { Router } = require('express');
const {
  calcularCusto, estimarUnidades, calcularEstoque,
  buildStockSummary, ESTOQUE_ALERT_MIN
} = require('../services/businessRules');

const router = Router();

// -----------------------------------------------------------------------
// POST /api/stock/calculate-cost
// Stateless endpoint: receives batch parameters, returns cost breakdown.
// -----------------------------------------------------------------------
router.post('/calculate-cost', (req, res) => {
  const { kgCarne, precoCarne, metrosTripa = 0, produto = '' } = req.body;

  if (!kgCarne || !precoCarne) {
    return res.status(400).json({ error: 'kgCarne e precoCarne são obrigatórios.' });
  }

  const costs     = calcularCusto(Number(kgCarne), Number(precoCarne), Number(metrosTripa));
  const unidades  = estimarUnidades(Number(kgCarne), Number(metrosTripa), produto);

  res.json({ ...costs, unidadesEstimadas: unidades });
});

// -----------------------------------------------------------------------
// POST /api/stock/alerts
// Receives current lot + sales data from the client and returns alerts.
// (Firestore-backed version: data comes from the client after it fetches
//  from Firestore; the backend computes the analysis.)
// -----------------------------------------------------------------------
router.post('/alerts', (req, res) => {
  const { lotes = [], vendas = [] } = req.body;

  const summary = buildStockSummary(lotes, vendas);
  const alerts  = summary
    .filter(s => s.estoqueAtual < ESTOQUE_ALERT_MIN)
    .map(s => ({
      loteId:    s.id,
      produto:   s.produto,
      estoque:   s.estoqueAtual,
      nivel:     s.estoqueAtual === 0 ? 'critico' : 'alerta',
      mensagem:  s.estoqueAtual === 0
        ? `Lote ${s.id.slice(-6)} (${s.produto}) está ESGOTADO.`
        : `Lote ${s.id.slice(-6)} (${s.produto}): apenas ${s.estoqueAtual} unidades.`
    }));

  res.json({ total: alerts.length, alerts });
});

// -----------------------------------------------------------------------
// POST /api/stock/summary
// Returns full stock summary with profit calculations.
// -----------------------------------------------------------------------
router.post('/summary', (req, res) => {
  const { lotes = [], vendas = [] } = req.body;

  const summary = buildStockSummary(lotes, vendas);
  const totalReceita = vendas.reduce((s, v) => s + v.unidades * v.precoUnit, 0);
  const totalCusto   = lotes.reduce((s, l) => s + (l.custoTotal || 0), 0);

  res.json({
    lotes:        summary,
    totalLotes:   summary.length,
    totalCusto,
    totalReceita,
    lucroEstimado: totalReceita - totalCusto,
    alertas:      summary.filter(s => s.estoqueAtual < ESTOQUE_ALERT_MIN).length
  });
});

module.exports = router;
