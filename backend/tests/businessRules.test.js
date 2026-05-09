/**
 * tests/businessRules.test.js
 *
 * Unit tests for backend business rule calculations.
 * Uses Node.js built-in test runner (node:test) – no external test framework needed.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  calcularCusto,
  estimarUnidades,
  calcularEstoque,
  calcularLucroVenda,
  buildStockSummary,
  ESTOQUE_ALERT_MIN
} = require('../services/businessRules');

// -----------------------------------------------------------------------
// calcularCusto
// -----------------------------------------------------------------------
describe('calcularCusto', () => {
  it('should return correct total for 10kg at R$20/kg, no tripa', () => {
    const result = calcularCusto(10, 20, 0);
    // Carne: 10 * 20 = 200
    // Aglomix: 0.35 * 10/10 * 68 = 0.35 * 68 = 23.80
    // Alho:    0.10 * 10/10 * 19 = 0.10 * 19 = 1.90
    // Tripa:   0
    // Total:   225.70
    assert.ok(Math.abs(result.custoTotal - 225.70) < 0.01, `Expected ~225.70, got ${result.custoTotal}`);
    assert.ok(Math.abs(result.custoCarne - 200) < 0.01);
    assert.ok(Math.abs(result.custoAglomix - 23.80) < 0.01);
    assert.ok(Math.abs(result.custoAlho - 1.90) < 0.01);
    assert.strictEqual(result.custoTripa, 0);
  });

  it('should add tripa cost correctly (30m at R$1.333/m)', () => {
    const result = calcularCusto(10, 20, 30);
    // Tripa: 30 * 1.333 = 39.99 ≈ 40
    assert.ok(result.custoTripa > 39 && result.custoTripa < 41, `Expected ~40, got ${result.custoTripa}`);
  });

  it('should handle zero meat gracefully', () => {
    const result = calcularCusto(0, 0, 0);
    assert.strictEqual(result.custoTotal, 0);
  });

  it('should scale linearly with kg', () => {
    const r1 = calcularCusto(10, 30, 0);
    const r2 = calcularCusto(20, 30, 0);
    assert.ok(Math.abs(r2.custoTotal - r1.custoTotal * 2) < 0.01);
  });
});

// -----------------------------------------------------------------------
// estimarUnidades
// -----------------------------------------------------------------------
describe('estimarUnidades', () => {
  it('should estimate 275 units for 10kg meat with 10m tripa (linguiça)', () => {
    // mass = 10 * 0.55 = 5.5 kg → 5500g / 200g = 27 units
    const result = estimarUnidades(10, 10, 'linguica_defumada');
    assert.strictEqual(result, 27);
  });

  it('should apply 35% maturation loss for salame', () => {
    // mass = 10m * 0.55 = 5.5 kg → after 35% loss = 5.5 * 0.65 = 3.575 kg → 17 units
    const result = estimarUnidades(10, 10, 'salame');
    assert.strictEqual(result, 17);
  });

  it('should apply 35% maturation loss for copa', () => {
    const result   = estimarUnidades(10, 10, 'copa');
    const without  = estimarUnidades(10, 10, 'linguica_defumada');
    assert.ok(result < without, 'Copa should have fewer units due to maturation loss');
  });

  it('should fallback to meat weight when metrosTripa is 0', () => {
    // mass = 10 kg → 10000g / 200g = 50 units
    const result = estimarUnidades(10, 0, 'linguica_defumada');
    assert.strictEqual(result, 50);
  });
});

// -----------------------------------------------------------------------
// calcularEstoque
// -----------------------------------------------------------------------
describe('calcularEstoque', () => {
  const lote = { id: 'L001', unidadesEstimadas: 100 };

  it('should return full stock when no sales', () => {
    assert.strictEqual(calcularEstoque(lote, []), 100);
  });

  it('should subtract matching sales', () => {
    const vendas = [
      { loteId: 'L001', unidades: 30 },
      { loteId: 'L001', unidades: 20 }
    ];
    assert.strictEqual(calcularEstoque(lote, vendas), 50);
  });

  it('should ignore sales from other lots', () => {
    const vendas = [{ loteId: 'L002', unidades: 50 }];
    assert.strictEqual(calcularEstoque(lote, vendas), 100);
  });

  it('should not return negative stock', () => {
    const vendas = [{ loteId: 'L001', unidades: 200 }];
    assert.strictEqual(calcularEstoque(lote, vendas), 0);
  });
});

// -----------------------------------------------------------------------
// calcularLucroVenda
// -----------------------------------------------------------------------
describe('calcularLucroVenda', () => {
  it('should calculate correct profit', () => {
    const lote  = { custoTotal: 100, unidadesEstimadas: 10 };
    const venda = { precoUnit: 20, unidades: 5 };
    // custo/unit = 100/10 = 10; lucro = (20-10)*5 = 50
    assert.strictEqual(calcularLucroVenda(venda, lote), 50);
  });

  it('should return 0 for missing lot', () => {
    assert.strictEqual(calcularLucroVenda({ precoUnit: 20, unidades: 5 }, null), 0);
  });

  it('should return 0 when selling at cost', () => {
    const lote  = { custoTotal: 100, unidadesEstimadas: 10 };
    const venda = { precoUnit: 10, unidades: 10 };
    assert.strictEqual(calcularLucroVenda(venda, lote), 0);
  });

  it('should return negative when selling below cost', () => {
    const lote  = { custoTotal: 200, unidadesEstimadas: 10 };
    const venda = { precoUnit: 10, unidades: 10 };
    assert.ok(calcularLucroVenda(venda, lote) < 0);
  });
});

// -----------------------------------------------------------------------
// buildStockSummary
// -----------------------------------------------------------------------
describe('buildStockSummary', () => {
  it('should include estoqueAtual in summary', () => {
    const lotes  = [{ id: 'L1', produto: 'salame', status: 'pronto', unidadesEstimadas: 50, custoTotal: 300, dataProducao: '2024-01-01', dataFimMaturacao: null }];
    const vendas = [{ loteId: 'L1', unidades: 10 }];
    const summary = buildStockSummary(lotes, vendas);
    assert.strictEqual(summary[0].estoqueAtual, 40);
  });
});

// -----------------------------------------------------------------------
// ESTOQUE_ALERT_MIN constant
// -----------------------------------------------------------------------
describe('ESTOQUE_ALERT_MIN', () => {
  it('should be 10', () => {
    assert.strictEqual(ESTOQUE_ALERT_MIN, 10);
  });
});
