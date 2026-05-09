/**
 * business.js
 *
 * Charcuterie business-rule calculations.
 *
 * Rules (from requirements):
 *   - Alho:    100g per 10 kg of meat  @ R$ 19,00/kg
 *   - Aglomix: 350g per 10 kg of meat  @ R$ 68,00/kg
 *   - Tripa:   R$ 1,33/m (R$ 40,00 per 30m coil)
 *   - Yield:   0,55 kg of mass per metre of tripa
 *   - Maturation loss (salami): 35%
 *
 * Cost formula:
 *   C = (kg_carne × preco_carne)
 *     + (0,35 × kg_carne/10 × 68)   ← Aglomix
 *     + (0,10 × kg_carne/10 × 19)   ← Alho
 *     + (metros_tripa × 1,33)        ← Tripa
 */

const PRECO_ALHO    = 19.00; // R$/kg
const PRECO_AGLOMIX = 68.00; // R$/kg
const PRECO_TRIPA   = 1.333; // R$/m  (R$ 40 / 30m)

// g per 10 kg of meat
const RATIO_ALHO    = 0.100; // kg per 10 kg → factor = 0.100/10
const RATIO_AGLOMIX = 0.350; // kg per 10 kg → factor = 0.350/10

const RENDIMENTO_TRIPA  = 0.55; // kg of mass per metre
const PERDA_MATURACAO   = 0.35; // 35% weight loss during maturation
const ESTOQUE_ALERT_MIN = 10;   // units – trigger alert below this

/**
 * Calculate full cost for a production lot.
 * @param {number} kgCarne       – meat weight in kg
 * @param {number} precoCarne    – meat price in R$/kg
 * @param {number} metrosTripa   – metres of tripa used
 * @returns {{ custoTotal, custoCarne, custoAglomix, custoAlho, custoTripa }}
 */
export function calcularCusto(kgCarne, precoCarne, metrosTripa = 0) {
  const custoCarne   = kgCarne * precoCarne;
  const custoAglomix = (RATIO_AGLOMIX / 10) * kgCarne * PRECO_AGLOMIX;
  const custoAlho    = (RATIO_ALHO    / 10) * kgCarne * PRECO_ALHO;
  const custoTripa   = metrosTripa * PRECO_TRIPA;
  const custoTotal   = custoCarne + custoAglomix + custoAlho + custoTripa;

  return { custoTotal, custoCarne, custoAglomix, custoAlho, custoTripa };
}

/**
 * Estimate how many sausage units come from a batch.
 * Logic: 1 unit ≈ 200g of finished product.
 * For salami, apply maturation loss first.
 *
 * @param {number} kgCarne
 * @param {number} metrosTripa
 * @param {string} produto  – 'salame' triggers maturation loss
 * @returns {number} estimated unit count
 */
export function estimarUnidades(kgCarne, metrosTripa = 0, produto = '') {
  const massaTotal = metrosTripa > 0
    ? metrosTripa * RENDIMENTO_TRIPA
    : kgCarne; // fallback: use meat weight if no tripa info

  const massaFinal = isSalame(produto)
    ? massaTotal * (1 - PERDA_MATURACAO)
    : massaTotal;

  return Math.floor(massaFinal / 0.2); // 200g per unit
}

/**
 * Calculate real profit for a sale, accounting for maturation loss when
 * the product is a salami type.
 *
 * @param {object} venda  – { unidades, precoUnit }
 * @param {object} lote   – { custoTotal, unidadesEstimadas }
 * @returns {number} profit in R$
 */
export function calcularLucroVenda(venda, lote) {
  if (!lote || !lote.unidadesEstimadas || lote.unidadesEstimadas === 0) return 0;
  const custoPorUnidade = lote.custoTotal / lote.unidadesEstimadas;
  return (venda.precoUnit - custoPorUnidade) * venda.unidades;
}

/**
 * Compute the maturation end date given a start date and number of days.
 * @param {string} dataProducao ISO date string
 * @param {number} diasMaturacao
 * @returns {string} ISO date string
 */
export function dataFimMaturacao(dataProducao, diasMaturacao) {
  const d = new Date(dataProducao);
  d.setDate(d.getDate() + Number(diasMaturacao));
  return d.toISOString().split('T')[0];
}

/**
 * How many days remain until maturation ends.
 * Negative = already done.
 */
export function diasRestantesMaturacao(dataFim) {
  const fim  = new Date(dataFim);
  const hoje = new Date();
  return Math.ceil((fim - hoje) / 86_400_000);
}

/**
 * Derive stock level for a lot based on registered sales.
 */
export function calcularEstoque(lote, vendas) {
  const vendidas = vendas
    .filter(v => v.loteId === lote.id)
    .reduce((sum, v) => sum + Number(v.unidades), 0);
  return Math.max(0, (lote.unidadesEstimadas || 0) - vendidas);
}

/**
 * Return true if the produto string indicates a salami (requires maturation).
 */
export function isSalame(produto) {
  return ['salame', 'copa'].includes((produto || '').toLowerCase());
}

export { ESTOQUE_ALERT_MIN, PERDA_MATURACAO, RENDIMENTO_TRIPA };
