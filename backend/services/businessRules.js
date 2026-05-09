/**
 * services/businessRules.js
 *
 * Pure business-rule functions for the backend.
 * Mirrors frontend/js/business.js — kept in sync manually.
 */

'use strict';

const PRECO_ALHO    = 19.00;
const PRECO_AGLOMIX = 68.00;
const PRECO_TRIPA   = 1.333; // R$/m
const RATIO_ALHO    = 0.100; // kg per 10 kg
const RATIO_AGLOMIX = 0.350;
const RENDIMENTO_TRIPA = 0.55; // kg mass per metre
const PERDA_MATURACAO  = 0.35;
const ESTOQUE_ALERT_MIN = 10;

/**
 * Calculate total production cost for a batch.
 */
function calcularCusto(kgCarne, precoCarne, metrosTripa = 0) {
  const custoCarne   = kgCarne * precoCarne;
  const custoAglomix = (RATIO_AGLOMIX / 10) * kgCarne * PRECO_AGLOMIX;
  const custoAlho    = (RATIO_ALHO    / 10) * kgCarne * PRECO_ALHO;
  const custoTripa   = metrosTripa * PRECO_TRIPA;
  return {
    custoTotal: custoCarne + custoAglomix + custoAlho + custoTripa,
    custoCarne, custoAglomix, custoAlho, custoTripa
  };
}

/**
 * Estimate unit count from a batch.
 */
function estimarUnidades(kgCarne, metrosTripa = 0, produto = '') {
  const massaTotal = metrosTripa > 0 ? metrosTripa * RENDIMENTO_TRIPA : kgCarne;
  const salames    = ['salame', 'copa'];
  const massaFinal = salames.includes(produto.toLowerCase())
    ? massaTotal * (1 - PERDA_MATURACAO)
    : massaTotal;
  return Math.floor(massaFinal / 0.2);
}

/**
 * Determine stock level for a lot based on recorded sales.
 */
function calcularEstoque(lote, vendas) {
  const vendidas = vendas
    .filter(v => v.loteId === lote.id)
    .reduce((sum, v) => sum + Number(v.unidades), 0);
  return Math.max(0, (lote.unidadesEstimadas || 0) - vendidas);
}

/**
 * Compute profit for a single sale.
 */
function calcularLucroVenda(venda, lote) {
  if (!lote || !lote.unidadesEstimadas) return 0;
  const custoPorUnidade = lote.custoTotal / lote.unidadesEstimadas;
  return (venda.precoUnit - custoPorUnidade) * venda.unidades;
}

/**
 * Build a stock summary object for the AI prompt.
 */
function buildStockSummary(lotes, vendas) {
  return lotes.map(l => ({
    id:                 l.id,
    produto:            l.produto,
    status:             l.status,
    unidadesEstimadas:  l.unidadesEstimadas,
    estoqueAtual:       calcularEstoque(l, vendas),
    custoTotal:         l.custoTotal,
    dataProducao:       l.dataProducao,
    dataFimMaturacao:   l.dataFimMaturacao
  }));
}

module.exports = {
  calcularCusto, estimarUnidades, calcularEstoque,
  calcularLucroVenda, buildStockSummary,
  ESTOQUE_ALERT_MIN, PERDA_MATURACAO
};
