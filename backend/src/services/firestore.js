import fs from 'node:fs';
import admin from 'firebase-admin';
import { config } from '../config.js';

let db = null;

const BACKUP_COLLECTION = 'sabor_do_oeste_backups';
const MAX_BACKUPS = 30;

function buildCredentials() {
  if (config.firebaseServiceAccountJson) {
    return JSON.parse(config.firebaseServiceAccountJson);
  }

  if (config.firebaseServiceAccountPath) {
    const raw = fs.readFileSync(config.firebaseServiceAccountPath, 'utf8');
    return JSON.parse(raw);
  }

  return null;
}

export function getFirestore() {
  if (db) return db;

  const cred = buildCredentials();
  if (!cred) {
    throw new Error('Firebase nao configurado. Defina FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_SERVICE_ACCOUNT_PATH.');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      projectId: config.firebaseProjectId || cred.project_id
    });
  }

  db = admin.firestore();
  return db;
}

function mergeById(existingArr, incomingArr) {
  const map = new Map();

  const keyFor = (item) => {
    if (item && item.id) return `id:${item.id}`;
    return `raw:${JSON.stringify(item || {})}`;
  };

  (Array.isArray(existingArr) ? existingArr : []).forEach((item) => {
    map.set(keyFor(item), item);
  });

  (Array.isArray(incomingArr) ? incomingArr : []).forEach((item) => {
    map.set(keyFor(item), item);
  });

  return Array.from(map.values());
}

async function backupCurrentSnapshotIfAny(firestore, currentData) {
  const lotes = Array.isArray(currentData?.lotes) ? currentData.lotes : [];
  const vendas = Array.isArray(currentData?.vendas) ? currentData.vendas : [];
  const clientes = Array.isArray(currentData?.clientes) ? currentData.clientes : [];
  const total = lotes.length + vendas.length + clientes.length;
  if (!total) return;

  await firestore.collection(BACKUP_COLLECTION).add({
    backedUpAt: new Date().toISOString(),
    sourceUpdatedAt: currentData?.updatedAt || null,
    lotes,
    vendas,
    clientes,
    deleted: currentData?.deleted || { lotes: [], vendas: [], clientes: [] }
  });

  const stale = await firestore
    .collection(BACKUP_COLLECTION)
    .orderBy('backedUpAt', 'desc')
    .offset(MAX_BACKUPS)
    .select()
    .get();

  if (!stale.empty) {
    const batch = firestore.batch();
    stale.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function importSnapshotFromLocal(payload) {
  const firestore = getFirestore();
  const docRef = firestore.collection('sabor_do_oeste').doc('snapshot');
  const atual = await docRef.get();
  const atualData = atual.exists ? atual.data() || {} : {};

  await backupCurrentSnapshotIfAny(firestore, atualData);

  const deleted = {
    lotes: Array.isArray(atualData?.deleted?.lotes) ? atualData.deleted.lotes : [],
    vendas: Array.isArray(atualData?.deleted?.vendas) ? atualData.deleted.vendas : [],
    clientes: Array.isArray(atualData?.deleted?.clientes) ? atualData.deleted.clientes : []
  };

  const deletedLotes = new Set(deleted.lotes);
  const deletedVendas = new Set(deleted.vendas);
  const deletedClientes = new Set(deleted.clientes);

  const lotesAtuais = (Array.isArray(atualData?.lotes) ? atualData.lotes : []).filter((l) => !deletedLotes.has(l?.id));
  const vendasAtuais = (Array.isArray(atualData?.vendas) ? atualData.vendas : []).filter((v) => !deletedVendas.has(v?.id) && !deletedLotes.has(v?.loteId));
  const clientesAtuais = (Array.isArray(atualData?.clientes) ? atualData.clientes : []).filter((c) => !deletedClientes.has(c?.id));

  const lotesIncoming = (Array.isArray(payload?.lotes) ? payload.lotes : []).filter((l) => !deletedLotes.has(l?.id));
  const vendasIncoming = (Array.isArray(payload?.vendas) ? payload.vendas : []).filter((v) => !deletedVendas.has(v?.id) && !deletedLotes.has(v?.loteId));
  const clientesIncoming = (Array.isArray(payload?.clientes) ? payload.clientes : []).filter((c) => !deletedClientes.has(c?.id));

  const snapshot = {
    lotes: mergeById(lotesAtuais, lotesIncoming),
    vendas: mergeById(vendasAtuais, vendasIncoming),
    clientes: mergeById(clientesAtuais, clientesIncoming)
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      ...snapshot,
      deleted,
      updatedAt: now
    },
    { merge: true }
  );

  return {
    lotes: snapshot.lotes.length,
    vendas: snapshot.vendas.length,
    clientes: snapshot.clientes.length,
    updatedAt: now
  };
}

export async function exportSnapshotFromCloud() {
  const firestore = getFirestore();
  const doc = await firestore.collection('sabor_do_oeste').doc('snapshot').get();

  if (!doc.exists) {
    return {
      lotes: [],
      vendas: [],
      clientes: [],
      updatedAt: null
    };
  }

  const data = doc.data() || {};
  return {
    lotes: Array.isArray(data.lotes) ? data.lotes : [],
    vendas: Array.isArray(data.vendas) ? data.vendas : [],
    clientes: Array.isArray(data.clientes) ? data.clientes : [],
    updatedAt: data.updatedAt || null
  };
}

export async function deleteLoteFromCloud(loteId) {
  const id = (loteId || '').trim();
  if (!id) {
    throw new Error('ID do lote obrigatorio.');
  }

  const firestore = getFirestore();
  const docRef = firestore.collection('sabor_do_oeste').doc('snapshot');
  const snap = await docRef.get();
  const data = snap.exists ? snap.data() || {} : {};

  const lotes = Array.isArray(data.lotes) ? data.lotes : [];
  const vendas = Array.isArray(data.vendas) ? data.vendas : [];
  const clientes = Array.isArray(data.clientes) ? data.clientes : [];

  const lotesFiltrados = lotes.filter((l) => l?.id !== id);
  const vendasFiltradas = vendas.filter((v) => v?.loteId !== id);
  const removedLotes = lotes.length - lotesFiltrados.length;
  const removedVendas = vendas.length - vendasFiltradas.length;

  const deletedAtual = {
    lotes: Array.isArray(data?.deleted?.lotes) ? data.deleted.lotes : [],
    vendas: Array.isArray(data?.deleted?.vendas) ? data.deleted.vendas : [],
    clientes: Array.isArray(data?.deleted?.clientes) ? data.deleted.clientes : []
  };

  const deletedLotes = Array.from(new Set([...deletedAtual.lotes, id]));

  const now = new Date().toISOString();
  await docRef.set(
    {
      lotes: lotesFiltrados,
      vendas: vendasFiltradas,
      clientes,
      deleted: {
        ...deletedAtual,
        lotes: deletedLotes
      },
      updatedAt: now
    },
    { merge: true }
  );

  return {
    loteId: id,
    removedLotes,
    removedVendas,
    updatedAt: now
  };
}
