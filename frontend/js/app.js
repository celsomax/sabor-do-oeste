/**
 * app.js – Main application entry point
 *
 * Wires up all modules: Firestore data layer, UI nav, lotes, vendas,
 * compras, dashboard, and IA panel.
 */

import { isConfigured, db } from './firebase-config.js';
import {
  getLotes, addLote, updateLote, deleteLote,
  getVendas, addVenda, deleteVenda,
  getCompras, addCompra, deleteCompra,
  migrateLocalStorageToFirestore
} from './firestore.js';
import {
  calcularCusto, estimarUnidades, calcularLucroVenda,
  dataFimMaturacao, diasRestantesMaturacao, calcularEstoque,
  isSalame, ESTOQUE_ALERT_MIN
} from './business.js';
import {
  initNav, showToast, showConfirm,
  formatBRL, formatDate, produtoLabel, statusBadge, setSyncStatus
} from './ui.js';

// -----------------------------------------------------------------------
// App state
// -----------------------------------------------------------------------
let lotes   = [];
let vendas  = [];
let compras = [];

// -----------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initBackendConfig();
  initLoteForm();
  initVendaForm();
  initCompraForm();
  initIAPanel();

  // Sync status
  if (isConfigured) {
    setSyncStatus('online', 'Sincronizado com Firebase');
    // Run migration once if there's old localStorage data
    const result = await migrateLocalStorageToFirestore();
    if (result.migrated) {
      showToast(
        `Dados migrados do localStorage para Firestore: ${result.results.lotes} lotes, ${result.results.vendas} vendas, ${result.results.compras} compras.`,
        'success', 6000
      );
    }
  } else {
    setSyncStatus('offline', 'Modo local (configure Firebase)');
  }

  await refreshAll();
});

async function refreshAll() {
  try {
    [lotes, vendas, compras] = await Promise.all([getLotes(), getVendas(), getCompras()]);
    renderDashboard();
    renderLotes();
    renderVendas();
    renderCompras();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showToast('Erro ao carregar dados. Verifique o console.', 'error');
  }
}

// -----------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------
function renderDashboard() {
  // Active lots = not 'esgotado'
  const ativos = lotes.filter(l => l.status !== 'esgotado');
  document.getElementById('totalLotes').textContent = ativos.length;

  // Total stock units
  let totalUnidades = 0;
  ativos.forEach(l => { totalUnidades += calcularEstoque(l, vendas); });
  document.getElementById('totalUnidades').textContent = totalUnidades;

  // This month sales
  const hoje = new Date();
  const mesAtual = vendas.filter(v => {
    const d = new Date(v.data);
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  });
  const totalVendasMes = mesAtual.reduce((s, v) => s + v.unidades * v.precoUnit, 0);
  document.getElementById('vendasMes').textContent = formatBRL(totalVendasMes);

  // Estimated profit this month
  const lucroMes = mesAtual.reduce((s, v) => {
    const lote = lotes.find(l => l.id === v.loteId);
    return s + calcularLucroVenda(v, lote);
  }, 0);
  document.getElementById('lucroMes').textContent = formatBRL(lucroMes);

  // Alerts
  renderAlerts(ativos);

  // Maturation
  renderMaturacao(ativos);
}

function renderAlerts(ativos) {
  const list = document.getElementById('alertList');
  const alerts = [];

  ativos.forEach(l => {
    const estoque = calcularEstoque(l, vendas);
    if (estoque < ESTOQUE_ALERT_MIN) {
      const level = estoque === 0 ? 'critical' : 'warning';
      alerts.push({ level, msg: `${produtoLabel(l.produto)} – Lote ${l.id.slice(-6)}: ${estoque} unidades em estoque` });
    }
  });

  if (alerts.length === 0) {
    list.innerHTML = '<p class="empty-msg">Nenhum alerta no momento. ✅</p>';
    return;
  }

  list.innerHTML = alerts.map(a =>
    `<div class="alert-item ${a.level}">⚠️ ${a.msg}</div>`
  ).join('');
}

function renderMaturacao(ativos) {
  const list = document.getElementById('maturacaoList');
  const emMaturacao = ativos.filter(l => l.status === 'maturacao' || (l.diasMaturacao > 0 && l.dataFimMaturacao));

  if (emMaturacao.length === 0) {
    list.innerHTML = '<p class="empty-msg">Nenhum lote em maturação.</p>';
    return;
  }

  list.innerHTML = emMaturacao.map(l => {
    const dias = diasRestantesMaturacao(l.dataFimMaturacao);
    const totalDias = l.diasMaturacao || 1;
    const progresso = Math.max(0, Math.min(100, ((totalDias - dias) / totalDias) * 100));
    const label = dias > 0 ? `${dias} dias restantes` : 'Pronto para comercializar';
    return `
      <div class="mat-item">
        <span>${produtoLabel(l.produto)} – ${l.id.slice(-6)}</span>
        <span>${label}</span>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${progresso}%"></div></div>
      </div>`;
  }).join('');
}

// -----------------------------------------------------------------------
// Lotes
// -----------------------------------------------------------------------
function initLoteForm() {
  const btnNovo     = document.getElementById('btnNovoLote');
  const btnCancelar = document.getElementById('btnCancelarLote');
  const form        = document.getElementById('formLote');
  const loteForm    = document.getElementById('loteForm');

  btnNovo.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) updateCostPreview();
  });
  btnCancelar.addEventListener('click', () => { form.classList.add('hidden'); loteForm.reset(); });

  // Real-time cost preview
  ['loteCarne', 'lotePrecoCarne', 'loteMetrosTripa', 'loteProduto'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCostPreview);
  });

  // Show/hide maturation field
  document.getElementById('loteProduto').addEventListener('change', (e) => {
    const showMat = isSalame(e.target.value);
    document.getElementById('maturacaoGroup').style.display = showMat ? '' : 'none';
  });
  document.getElementById('maturacaoGroup').style.display = 'none';

  loteForm.addEventListener('submit', handleLoteSubmit);
}

function updateCostPreview() {
  const kg      = parseFloat(document.getElementById('loteCarne').value) || 0;
  const preco   = parseFloat(document.getElementById('lotePrecoCarne').value) || 0;
  const metros  = parseFloat(document.getElementById('loteMetrosTripa').value) || 0;
  const produto = document.getElementById('loteProduto').value;

  const { custoTotal, custoCarne, custoAglomix, custoAlho, custoTripa } = calcularCusto(kg, preco, metros);
  const unidades = estimarUnidades(kg, metros, produto);

  document.getElementById('custoCarne').textContent   = formatBRL(custoCarne);
  document.getElementById('custoAglomix').textContent = formatBRL(custoAglomix);
  document.getElementById('custoAlho').textContent    = formatBRL(custoAlho);
  document.getElementById('custoTripa').textContent   = formatBRL(custoTripa);
  document.getElementById('custoTotal').textContent   = formatBRL(custoTotal);
  document.getElementById('qtdUnidades').textContent  = unidades;
}

async function handleLoteSubmit(e) {
  e.preventDefault();
  const produto      = document.getElementById('loteProduto').value;
  const kgCarne      = parseFloat(document.getElementById('loteCarne').value);
  const precoCarne   = parseFloat(document.getElementById('lotePrecoCarne').value);
  const metrosTripa  = parseFloat(document.getElementById('loteMetrosTripa').value) || 0;
  const dataProducao = document.getElementById('loteDataProducao').value;
  const diasMat      = parseInt(document.getElementById('loteDiasMaturacao').value) || 0;

  const { custoTotal, custoCarne, custoAglomix, custoAlho, custoTripa } = calcularCusto(kgCarne, precoCarne, metrosTripa);
  const unidadesEstimadas = estimarUnidades(kgCarne, metrosTripa, produto);

  const data = {
    produto, kgCarne, precoCarne, metrosTripa, dataProducao, diasMaturacao: diasMat,
    dataFimMaturacao: diasMat > 0 ? dataFimMaturacao(dataProducao, diasMat) : null,
    custoTotal, custoCarne, custoAglomix, custoAlho, custoTripa,
    unidadesEstimadas,
    status: diasMat > 0 ? 'maturacao' : 'producao'
  };

  try {
    await addLote(data);
    showToast('Lote registrado com sucesso!', 'success');
    document.getElementById('loteForm').reset();
    document.getElementById('formLote').classList.add('hidden');
    await refreshAll();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar lote.', 'error');
  }
}

function renderLotes() {
  const tbody = document.getElementById('lotesBody');
  if (lotes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lote cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lotes.map(l => {
    const estoque = calcularEstoque(l, vendas);
    const statusAtualizado = estoque === 0 ? 'esgotado'
      : (l.dataFimMaturacao && diasRestantesMaturacao(l.dataFimMaturacao) > 0) ? 'maturacao'
      : 'pronto';

    // Silently update status if changed
    if (l.status !== statusAtualizado) { updateLote(l.id, { status: statusAtualizado }); l.status = statusAtualizado; }

    return `
      <tr>
        <td title="${l.id}">${l.id.slice(-6)}</td>
        <td>${produtoLabel(l.produto)}</td>
        <td>${l.kgCarne} kg</td>
        <td>${formatDate(l.dataProducao)}</td>
        <td>${formatBRL(l.custoTotal)}</td>
        <td>${estoque} / ${l.unidadesEstimadas}</td>
        <td>${statusBadge(l.status)}</td>
        <td>
          <button class="btn-icon" title="Excluir" onclick="window.__deleteLote('${l.id}')">🗑️</button>
        </td>
      </tr>`;
  }).join('');
}

// Expose delete to inline onclick (avoids complex event delegation for simplicity)
window.__deleteLote = async (id) => {
  const ok = await showConfirm('Excluir este lote? As vendas vinculadas a ele serão mantidas.');
  if (!ok) return;
  await deleteLote(id);
  showToast('Lote excluído.', 'warning');
  await refreshAll();
};

// -----------------------------------------------------------------------
// Vendas
// -----------------------------------------------------------------------
function initVendaForm() {
  const btnNovo     = document.getElementById('btnNovaVenda');
  const btnCancelar = document.getElementById('btnCancelarVenda');
  const form        = document.getElementById('formVenda');
  const vendaForm   = document.getElementById('vendaForm');

  btnNovo.addEventListener('click', () => {
    populateLoteSelect();
    form.classList.toggle('hidden');
  });
  btnCancelar.addEventListener('click', () => { form.classList.add('hidden'); vendaForm.reset(); });

  // Live total
  ['vendaUnidades', 'vendaPrecoUnit'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const u = parseFloat(document.getElementById('vendaUnidades').value) || 0;
      const p = parseFloat(document.getElementById('vendaPrecoUnit').value) || 0;
      document.getElementById('vendaTotal').textContent = formatBRL(u * p);
    });
  });

  vendaForm.addEventListener('submit', handleVendaSubmit);
}

function populateLoteSelect() {
  const sel = document.getElementById('vendaLote');
  const disponiveis = lotes.filter(l => l.status !== 'esgotado');
  sel.innerHTML = disponiveis.length
    ? disponiveis.map(l => `<option value="${l.id}">${produtoLabel(l.produto)} – ${l.id.slice(-6)} (${calcularEstoque(l, vendas)} un.)</option>`).join('')
    : '<option value="">Nenhum lote disponível</option>';
}

async function handleVendaSubmit(e) {
  e.preventDefault();
  const loteId    = document.getElementById('vendaLote').value;
  const cliente   = document.getElementById('vendaCliente').value.trim();
  const unidades  = parseInt(document.getElementById('vendaUnidades').value);
  const precoUnit = parseFloat(document.getElementById('vendaPrecoUnit').value);
  const data      = document.getElementById('vendaData').value;

  if (!loteId) return showToast('Selecione um lote.', 'warning');

  const lote = lotes.find(l => l.id === loteId);
  const estoque = calcularEstoque(lote, vendas);

  if (unidades > estoque) {
    return showToast(`Estoque insuficiente. Disponível: ${estoque} unidades.`, 'error');
  }

  try {
    await addVenda({ loteId, produto: lote.produto, cliente, unidades, precoUnit, data });
    showToast('Venda registrada!', 'success');
    document.getElementById('vendaForm').reset();
    document.getElementById('formVenda').classList.add('hidden');
    await refreshAll();
  } catch (err) {
    console.error(err);
    showToast('Erro ao registrar venda.', 'error');
  }
}

function renderVendas() {
  const tbody = document.getElementById('vendasBody');
  if (vendas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhuma venda registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = vendas.map(v => {
    const lote   = lotes.find(l => l.id === v.loteId);
    const lucro  = calcularLucroVenda(v, lote);
    const total  = v.unidades * v.precoUnit;

    return `
      <tr>
        <td>${formatDate(v.data)}</td>
        <td>${v.loteId?.slice(-6) || '–'}</td>
        <td>${produtoLabel(v.produto)}</td>
        <td>${v.cliente || '–'}</td>
        <td>${v.unidades}</td>
        <td>${formatBRL(v.precoUnit)}</td>
        <td>${formatBRL(total)}</td>
        <td class="${lucro >= 0 ? 'color-success' : 'color-danger'}">${formatBRL(lucro)}</td>
      </tr>`;
  }).join('');
}

// -----------------------------------------------------------------------
// Compras
// -----------------------------------------------------------------------
function initCompraForm() {
  document.getElementById('btnNovaCompra').addEventListener('click', () => {
    document.getElementById('formCompra').classList.toggle('hidden');
  });
  document.getElementById('btnCancelarCompra').addEventListener('click', () => {
    document.getElementById('formCompra').classList.add('hidden');
    document.getElementById('compraForm').reset();
  });
  document.getElementById('compraForm').addEventListener('submit', handleCompraSubmit);
}

async function handleCompraSubmit(e) {
  e.preventDefault();
  const item       = document.getElementById('compraItem').value;
  const qtd        = parseFloat(document.getElementById('compraQtd').value);
  const unidade    = document.getElementById('compraUnidade').value;
  const preco      = parseFloat(document.getElementById('compraPreco').value);
  const data       = document.getElementById('compraData').value;
  const fornecedor = document.getElementById('compraFornecedor').value.trim();

  try {
    await addCompra({ item, qtd, unidade, custoTotal: preco, data, fornecedor });
    showToast('Compra registrada!', 'success');
    document.getElementById('compraForm').reset();
    document.getElementById('formCompra').classList.add('hidden');
    await refreshAll();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar compra.', 'error');
  }
}

function renderCompras() {
  const tbody = document.getElementById('comprasBody');
  const ITEM_NAMES = {
    carne_suina: 'Carne Suína', carne_bovina: 'Carne Bovina',
    tripa: 'Tripa', aglomix: 'Tempero Aglomix',
    alho: 'Alho', sal: 'Sal', outro: 'Outro'
  };

  if (compras.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhuma compra registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = compras.map(c => `
    <tr>
      <td>${formatDate(c.data)}</td>
      <td>${ITEM_NAMES[c.item] || c.item}</td>
      <td>${c.qtd}</td>
      <td>${c.unidade}</td>
      <td>${formatBRL(c.custoTotal)}</td>
      <td>${c.fornecedor || '–'}</td>
    </tr>`).join('');
}

// -----------------------------------------------------------------------
// Backend / IA
// -----------------------------------------------------------------------
const BACKEND_LS_KEY = 'sdo_backend_url';

function initBackendConfig() {
  const input  = document.getElementById('backendUrl');
  const btn    = document.getElementById('btnSalvarBackend');
  input.value  = localStorage.getItem(BACKEND_LS_KEY) || '';
  btn.addEventListener('click', () => {
    const url = input.value.trim().replace(/\/$/, '');
    if (url) localStorage.setItem(BACKEND_LS_KEY, url);
    showToast('URL do backend salva.', 'success');
  });
}

function getBackendUrl() {
  return localStorage.getItem(BACKEND_LS_KEY) || '';
}

function initIAPanel() {
  document.getElementById('btnAnalisarEstoque').addEventListener('click', () => {
    runAIAnalysis('analyze');
  });
  document.getElementById('btnSugestaoCompras').addEventListener('click', () => {
    runAIAnalysis('purchase-suggestions');
  });
  document.getElementById('btnPerguntaLivre').addEventListener('click', () => {
    document.getElementById('formPerguntaLivre').classList.toggle('hidden');
  });
  document.getElementById('btnEnviarPergunta').addEventListener('click', () => {
    const q = document.getElementById('textPergunta').value.trim();
    if (!q) return showToast('Digite uma pergunta.', 'warning');
    runAIAnalysis('chat', { question: q });
  });
}

async function runAIAnalysis(endpoint, extraPayload = {}) {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    showToast('Configure a URL do backend antes de usar a IA.', 'warning');
    document.getElementById('backendConfig').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const loading  = document.getElementById('iaLoading');
  const response = document.getElementById('iaResponse');
  const provider = document.getElementById('iaProvider');

  loading.classList.remove('hidden');
  response.innerHTML = '';
  provider.textContent = '';

  const payload = {
    lotes:   lotes.map(l => ({
      id: l.id, produto: l.produto, kgCarne: l.kgCarne, status: l.status,
      custoTotal: l.custoTotal, unidadesEstimadas: l.unidadesEstimadas,
      dataProducao: l.dataProducao, dataFimMaturacao: l.dataFimMaturacao
    })),
    vendas:  vendas.map(v => ({
      loteId: v.loteId, produto: v.produto, unidades: v.unidades,
      precoUnit: v.precoUnit, data: v.data
    })),
    compras: compras.map(c => ({ item: c.item, qtd: c.qtd, unidade: c.unidade, data: c.data })),
    estoques: lotes.map(l => ({
      loteId: l.id, produto: l.produto,
      estoqueAtual: calcularEstoque(l, vendas),
      unidadesEstimadas: l.unidadesEstimadas
    })),
    ...extraPayload
  };

  try {
    const res = await fetch(`${backendUrl}/api/ai/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    provider.textContent = data.provider ? `via ${data.provider}` : '';
    response.textContent = data.response || data.message || JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Erro ao chamar backend IA:', err);
    response.innerHTML = `<span style="color:var(--color-danger)">Erro: ${err.message}. Verifique se o backend está rodando em ${backendUrl}.</span>`;
  } finally {
    loading.classList.add('hidden');
  }
}
