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

  throw new Error(`Falha nos provedores de IA. ${erros.join(' | ')}`);
}
