import OpenAI from 'openai';
import { config } from '../config.js';

const SYSTEM_PROMPT = `Voce e o Especialista Sabor do Oeste, um agente de analise de dados e mestre charcuteiro. Seu objetivo e gerenciar a producao artesanal de salames e linguicas com foco em margem e baixo desperdicio.\n\nParametros de custo:\n- Alho: 100g para cada 10kg de carne (R$ 19,00/kg).\n- Tempero Aglomix: 350g para cada 10kg de carne (R$ 68,00/kg).\n- Tripas: R$ 40,00 por moco de 30m (R$ 1,33/metro) e rendimento de 0,55kg/metro.\n- Salame: considerar quebra de maturacao aproximada de 35%.\n\nTarefas obrigatorias:\n1) Alertar quando estoque < 10 unidades.\n2) Estimar lucro real com quebra de maturacao.\n3) Sugerir compra de carne e tripas para 30 dias com base no historico recente.`;

function compactarDados(dados) {
  const seguro = {
    lotes: Array.isArray(dados?.lotes) ? dados.lotes.slice(-150) : [],
    vendas: Array.isArray(dados?.vendas) ? dados.vendas.slice(-800) : [],
    clientes: Array.isArray(dados?.clientes) ? dados.clientes.slice(-500) : []
  };

  return JSON.stringify(seguro);
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function somarCampos(items, fields) {
  return (items || []).reduce((acc, item) => {
    for (const field of fields) {
      const val = asNumber(item?.[field]);
      if (val) return acc + val;
    }
    return acc;
  }, 0);
}

function contarUltimosDias(vendas, dias = 30) {
  const now = Date.now();
  const janelaMs = dias * 24 * 60 * 60 * 1000;

  return (vendas || []).filter((venda) => {
    const dataBruta = venda?.data || venda?.createdAt || venda?.updatedAt;
    if (!dataBruta) return false;
    const ts = new Date(dataBruta).getTime();
    return Number.isFinite(ts) && now - ts <= janelaMs;
  }).length;
}

function analiseLocal({ perguntaUsuario, dados, erros }) {
  const lotes = Array.isArray(dados?.lotes) ? dados.lotes : [];
  const vendas = Array.isArray(dados?.vendas) ? dados.vendas : [];

  const estoqueUnidades = somarCampos(lotes, [
    'estoqueAtual',
    'qtdEstoque',
    'estoque',
    'unidades',
    'qtdUnidades',
    'quantidade'
  ]);
  const kgEmProducao = somarCampos(lotes, ['kg', 'pesoKg', 'quantidadeKg']);
  const vendas30d = contarUltimosDias(vendas, 30);
  const faturamentoAprox = somarCampos(vendas, ['total', 'valor', 'valorTotal', 'precoTotal']);

  const alertaEstoque =
    estoqueUnidades > 0
      ? estoqueUnidades < 10
        ? `Estoque baixo: ${estoqueUnidades.toFixed(0)} unidades (abaixo do limite de 10).`
        : `Estoque estimado em ${estoqueUnidades.toFixed(0)} unidades.`
      : 'Nao foi possivel inferir estoque em unidades pelos campos recebidos.';

  const risco =
    estoqueUnidades > 0 && estoqueUnidades < 10
      ? 'Risco alto de ruptura de estoque nos proximos dias.'
      : 'Risco principal atual e dependencia de dados incompletos para previsao mais precisa.';

  const compraSugeridaKg = Math.max(10, vendas30d * 1.2);
  const tripaMetros = compraSugeridaKg / 0.55;

  const resposta = [
    '1) Diagnostico',
    `${alertaEstoque} Kg em producao: ${kgEmProducao.toFixed(2)} kg. Vendas (30d): ${vendas30d}.`,
    '',
    '2) Risco imediato',
    risco,
    '',
    '3) Acao recomendada',
    `Planejar lote de ${compraSugeridaKg.toFixed(1)} kg para 30 dias e revisar cadastro de campos de estoque/unidades.`,
    '',
    '4) Estimativa numerica',
    `Tripa sugerida: ${tripaMetros.toFixed(1)} metros. Faturamento aproximado no historico enviado: R$ ${faturamentoAprox.toFixed(2)}.`,
    '',
    '5) Proxima verificacao',
    'Revalidar em 48h apos novas vendas e confirmar se estoque em unidades esta sendo gravado corretamente.',
    '',
    `Modo local sem custo ativado. Pergunta recebida: "${perguntaUsuario}".`
  ].join('\n');

  return {
    provider: 'local',
    resposta,
    avisos: erros
  };
}

async function callOpenAI(prompt) {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY nao configurada.');
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]
  });

  return completion.choices?.[0]?.message?.content?.trim() || 'Sem resposta do modelo.';
}

async function callGemini(prompt) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY nao configurada.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const promptFinal = `${SYSTEM_PROMPT}\n\n${prompt}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptFinal }] }],
      generationConfig: { temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`Erro Gemini: ${response.status} ${msg}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() || 'Sem resposta do modelo.';
}

export async function analisarComIA({ perguntaUsuario, dados }) {
  const pergunta = (perguntaUsuario || '').trim();
  if (!pergunta) {
    throw new Error('Pergunta obrigatoria.');
  }

  const contexto = compactarDados(dados || {});
  const prompt = `Dados atuais do negocio (JSON): ${contexto}\n\nPergunta: ${pergunta}\n\nResponda em 5 blocos:\n1) Diagnostico\n2) Risco imediato\n3) Acao recomendada\n4) Estimativa numerica\n5) Proxima verificacao`; 

  const providers = config.aiProviderPriority.length ? config.aiProviderPriority : ['openai', 'gemini'];
  const erros = [];

  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const resposta = await callOpenAI(prompt);
        return { provider: 'openai', resposta };
      }

      if (provider === 'gemini') {
        const resposta = await callGemini(prompt);
        return { provider: 'gemini', resposta };
      }
    } catch (error) {
      erros.push(`${provider}: ${error.message}`);
    }
  }

  return analiseLocal({ perguntaUsuario: pergunta, dados: dados || {}, erros });
}
