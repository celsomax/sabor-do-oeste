/**
 * routes/ai.js
 *
 * POST /api/ai/analyze              – Stock + profit analysis
 * POST /api/ai/purchase-suggestions – 30-day purchase forecast
 * POST /api/ai/chat                 – Free-form question
 */

'use strict';

const { Router }   = require('express');
const { callAI }   = require('../services/aiProvider');
const { buildStockSummary, calcularLucroVenda, ESTOQUE_ALERT_MIN } = require('../services/businessRules');

const router = Router();

// -----------------------------------------------------------------------
// Shared system prompt (Sabor do Oeste Specialist)
// -----------------------------------------------------------------------
const SYSTEM_PROMPT = `Você é o Especialista Sabor do Oeste, um agente de análise de dados e mestre charcuteiro.
Seu objetivo é gerenciar a produção artesanal de salames e linguiças.
Analise estoque, lucro real (com quebra de maturação de 35% para salames e copas) e sugestões de compra para o próximo mês com foco em margem e baixo desperdício.

Regras de negócio:
- Alho: 100g a cada 10kg de carne (preço base R$ 19,00/kg)
- Tempero Aglomix: 350g a cada 10kg de carne (preço base R$ 68,00/kg)
- Tripas: R$ 40,00 por moço de 30m (R$ 1,33 por metro)
- Rendimento médio das tripas: 0,55kg de massa por metro
- Quebra de maturação em salames/copas: 35% de perda de peso

Responda sempre em português, de forma objetiva, organizada e com dados concretos quando disponíveis.
Use marcadores e seções claras. Não inclua dados ou cálculos que não foram fornecidos.`;

// -----------------------------------------------------------------------
// POST /api/ai/analyze
// -----------------------------------------------------------------------
router.post('/analyze', async (req, res, next) => {
  try {
    const { lotes = [], vendas = [], compras = [] } = req.body;

    const stockSummary = buildStockSummary(lotes, vendas);
    const alertas = stockSummary.filter(s => s.estoqueAtual < ESTOQUE_ALERT_MIN);

    // Compute profit per sale
    const vendasComLucro = vendas.map(v => {
      const lote  = lotes.find(l => l.id === v.loteId);
      const lucro = calcularLucroVenda(v, lote);
      return { ...v, lucro };
    });

    const totalLucroEstimado = vendasComLucro.reduce((s, v) => s + v.lucro, 0);
    const totalReceita       = vendas.reduce((s, v) => s + v.unidades * v.precoUnit, 0);

    const userMessage = `
## Dados Atuais do Sistema

### Estoque (${stockSummary.length} lotes)
${JSON.stringify(stockSummary, null, 2)}

### Alertas (estoque < ${ESTOQUE_ALERT_MIN} unidades)
${alertas.length > 0 ? JSON.stringify(alertas, null, 2) : 'Nenhum alerta.'}

### Vendas Recentes (${vendas.length} registros)
Receita total: R$ ${totalReceita.toFixed(2)}
Lucro estimado total: R$ ${totalLucroEstimado.toFixed(2)}

### Compras Recentes (${compras.length} registros)
${JSON.stringify(compras.slice(0, 20), null, 2)}

---
Por favor, forneça:
1. **Diagnóstico de estoque** – alertas e produtos em risco.
2. **Análise de lucro real** – considerando quebra de maturação.
3. **Tendências** – produtos mais e menos lucrativos.
4. **Recomendações imediatas** – o que fazer agora.`;

    const result = await callAI(SYSTEM_PROMPT, userMessage);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------
// POST /api/ai/purchase-suggestions
// -----------------------------------------------------------------------
router.post('/purchase-suggestions', async (req, res, next) => {
  try {
    const { lotes = [], vendas = [], compras = [], estoques = [] } = req.body;

    // Aggregate recent sales (last 60 days) for demand forecast
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const recentVendas = vendas.filter(v => new Date(v.data) >= cutoff);

    const userMessage = `
## Dados para Previsão de Compras (próximos 30 dias)

### Estoque atual
${JSON.stringify(estoques, null, 2)}

### Lotes ativos
${JSON.stringify(lotes.filter(l => l.status !== 'esgotado'), null, 2)}

### Vendas dos últimos 60 dias (${recentVendas.length} registros)
${JSON.stringify(recentVendas, null, 2)}

### Histórico de compras recentes
${JSON.stringify(compras.slice(0, 15), null, 2)}

---
Com base nesses dados, forneça:
1. **Previsão de demanda** – quantas unidades de cada produto serão necessárias em 30 dias.
2. **Lista de compras** – carne (kg), tripas (metros), temperos, quantidades estimadas e custo total projetado.
3. **Prioridade** – o que comprar primeiro e por quê.
4. **Alertas** – riscos de ruptura de estoque iminente.`;

    const result = await callAI(SYSTEM_PROMPT, userMessage);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------
// POST /api/ai/chat
// Accepts a free-form question (max 1000 characters) plus optional context.
// -----------------------------------------------------------------------
router.post('/chat', async (req, res, next) => {
  try {
    const { question, lotes = [], vendas = [], compras = [], estoques = [] } = req.body;

    const MAX_QUESTION_LENGTH = 1000;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Campo "question" é obrigatório.' });
    }

    if (question.trim().length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error: `A pergunta deve ter no máximo ${MAX_QUESTION_LENGTH} caracteres. Enviado: ${question.trim().length}.`
      });
    }

    const sanitizedQuestion = question.trim();

    const contextMsg = `
## Contexto do Sistema
- Lotes ativos: ${lotes.length}
- Vendas registradas: ${vendas.length}
- Compras registradas: ${compras.length}
- Estoque geral: ${JSON.stringify(estoques.slice(0, 10), null, 2)}

## Pergunta do Usuário
${sanitizedQuestion}`;

    const result = await callAI(SYSTEM_PROMPT, contextMsg);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
