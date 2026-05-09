/**
 * firestore.js
 *
 * Data Access Layer: Firestore + localStorage fallback.
 *
 * Strategy:
 *  - When Firestore is configured (isConfigured === true), all reads/writes
 *    go to Firestore AND are mirrored to localStorage as a cache.
 *  - When Firestore is NOT configured (development or demo mode), the app
 *    works entirely from localStorage so nothing is lost during setup.
 *
 * Collections:
 *   lotes      – production batches
 *   vendas     – sales
 *   compras    – raw material purchases
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { db, isConfigured } from './firebase-config.js';

// -----------------------------------------------------------------------
// localStorage helpers
// -----------------------------------------------------------------------
const LS_KEYS = { lotes: 'sdo_lotes', vendas: 'sdo_vendas', compras: 'sdo_compras' };

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(LS_KEYS[key]) || '[]'); }
  catch { return []; }
}

function lsSet(key, data) {
  localStorage.setItem(LS_KEYS[key], JSON.stringify(data));
}

function lsAdd(key, item) {
  const list = lsGet(key);
  list.push(item);
  lsSet(key, list);
  return item;
}

function lsDelete(key, id) {
  const list = lsGet(key).filter(i => i.id !== id);
  lsSet(key, list);
}

function lsUpdate(key, id, updates) {
  const list = lsGet(key).map(i => i.id === id ? { ...i, ...updates } : i);
  lsSet(key, list);
}

// -----------------------------------------------------------------------
// Generic CRUD helpers for Firestore
// -----------------------------------------------------------------------
async function fsGetAll(col) {
  const q = query(collection(db, col), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// -----------------------------------------------------------------------
// LOTES
// -----------------------------------------------------------------------
export async function getLotes() {
  if (!isConfigured) return lsGet('lotes').reverse();
  const lotes = await fsGetAll('lotes');
  lsSet('lotes', lotes); // mirror
  return lotes;
}

export async function addLote(data) {
  const lote = { ...data, criadoEm: new Date().toISOString(), status: 'producao' };
  if (!isConfigured) {
    lote.id = 'L' + Date.now();
    lsAdd('lotes', lote);
    return lote;
  }
  const ref = await addDoc(collection(db, 'lotes'), { ...lote, criadoEm: serverTimestamp() });
  lote.id = ref.id;
  const list = lsGet('lotes');
  list.push(lote);
  lsSet('lotes', list);
  return lote;
}

export async function updateLote(id, updates) {
  lsUpdate('lotes', id, updates);
  if (!isConfigured) return;
  await updateDoc(doc(db, 'lotes', id), updates);
}

export async function deleteLote(id) {
  lsDelete('lotes', id);
  if (!isConfigured) return;
  await deleteDoc(doc(db, 'lotes', id));
}

// -----------------------------------------------------------------------
// VENDAS
// -----------------------------------------------------------------------
export async function getVendas() {
  if (!isConfigured) return lsGet('vendas').reverse();
  const vendas = await fsGetAll('vendas');
  lsSet('vendas', vendas);
  return vendas;
}

export async function addVenda(data) {
  const venda = { ...data, criadoEm: new Date().toISOString() };
  if (!isConfigured) {
    venda.id = 'V' + Date.now();
    lsAdd('vendas', venda);
    return venda;
  }
  const ref = await addDoc(collection(db, 'vendas'), { ...venda, criadoEm: serverTimestamp() });
  venda.id = ref.id;
  const list = lsGet('vendas');
  list.push(venda);
  lsSet('vendas', list);
  return venda;
}

export async function deleteVenda(id) {
  lsDelete('vendas', id);
  if (!isConfigured) return;
  await deleteDoc(doc(db, 'vendas', id));
}

// -----------------------------------------------------------------------
// COMPRAS
// -----------------------------------------------------------------------
export async function getCompras() {
  if (!isConfigured) return lsGet('compras').reverse();
  const compras = await fsGetAll('compras');
  lsSet('compras', compras);
  return compras;
}

export async function addCompra(data) {
  const compra = { ...data, criadoEm: new Date().toISOString() };
  if (!isConfigured) {
    compra.id = 'C' + Date.now();
    lsAdd('compras', compra);
    return compra;
  }
  const ref = await addDoc(collection(db, 'compras'), { ...compra, criadoEm: serverTimestamp() });
  compra.id = ref.id;
  const list = lsGet('compras');
  list.push(compra);
  lsSet('compras', list);
  return compra;
}

export async function deleteCompra(id) {
  lsDelete('compras', id);
  if (!isConfigured) return;
  await deleteDoc(doc(db, 'compras', id));
}

// -----------------------------------------------------------------------
// localStorage → Firestore Migration
// Exports existing localStorage data to Firestore when Firebase is first
// configured. Safe to call multiple times (no-op if already migrated).
// -----------------------------------------------------------------------
export async function migrateLocalStorageToFirestore() {
  if (!isConfigured) return { migrated: false, reason: 'firebase-not-configured' };

  const MIGRATION_KEY = 'sdo_migrated_v1';
  if (localStorage.getItem(MIGRATION_KEY)) return { migrated: false, reason: 'already-done' };

  const results = { lotes: 0, vendas: 0, compras: 0 };

  for (const key of ['lotes', 'vendas', 'compras']) {
    const items = lsGet(key);
    for (const item of items) {
      await addDoc(collection(db, key), { ...item, migratedFromLocalStorage: true });
      results[key]++;
    }
  }

  localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  return { migrated: true, results };
}
