/**
 * ui.js – Shared UI utilities
 */

// -----------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------
export function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// -----------------------------------------------------------------------
// Toast notifications
// -----------------------------------------------------------------------
export function showToast(msg, type = 'info', durationMs = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), durationMs + 300);
}

// -----------------------------------------------------------------------
// Confirmation modal
// -----------------------------------------------------------------------
export function showConfirm(msg) {
  return new Promise(resolve => {
    const modal   = document.getElementById('modal');
    const msgEl   = document.getElementById('modalMsg');
    const confirm = document.getElementById('modalConfirm');
    const cancel  = document.getElementById('modalCancel');

    msgEl.textContent = msg;
    modal.classList.remove('hidden');

    const cleanup = () => { modal.classList.add('hidden'); };

    confirm.onclick = () => { cleanup(); resolve(true); };
    cancel.onclick  = () => { cleanup(); resolve(false); };
  });
}

// -----------------------------------------------------------------------
// Currency formatting
// -----------------------------------------------------------------------
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(value || 0);
}

// -----------------------------------------------------------------------
// Date formatting
// -----------------------------------------------------------------------
export function formatDate(isoStr) {
  if (!isoStr) return '–';
  return new Date(isoStr + 'T12:00:00').toLocaleDateString('pt-BR');
}

// -----------------------------------------------------------------------
// Sync status indicator
// -----------------------------------------------------------------------
export function setSyncStatus(state, label) {
  const el  = document.getElementById('syncStatus');
  const dot = el.querySelector('.dot');
  dot.className = `dot ${state}`;
  // The sync-status div contains: <span class="dot …"></span> text
  // Update the text node directly to avoid innerHTML usage
  let textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = ' ' + label;
  } else {
    el.appendChild(document.createTextNode(' ' + label));
  }
}

// -----------------------------------------------------------------------
// Product name map
// -----------------------------------------------------------------------
const PRODUCT_NAMES = {
  linguica_defumada: 'Linguiça Defumada',
  linguica_fresca:   'Linguiça Fresca',
  salame:            'Salame',
  copa:              'Copa',
  bacon:             'Bacon'
};

export function produtoLabel(key) {
  return PRODUCT_NAMES[key] || key;
}

// -----------------------------------------------------------------------
// Status badge HTML
// -----------------------------------------------------------------------
export function statusBadge(status) {
  const map = {
    producao:  ['badge-info',    '🔵 Produção'],
    maturacao: ['badge-warning', '🟡 Maturação'],
    pronto:    ['badge-success', '🟢 Pronto'],
    esgotado:  ['badge-danger',  '🔴 Esgotado']
  };
  const [cls, label] = map[status] || ['badge-info', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
