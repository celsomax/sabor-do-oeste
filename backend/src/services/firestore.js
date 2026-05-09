import fs from 'node:fs';
import admin from 'firebase-admin';
import { config } from '../config.js';

let db = null;

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

export async function importSnapshotFromLocal(payload) {
  const firestore = getFirestore();
  const snapshot = {
    lotes: Array.isArray(payload?.lotes) ? payload.lotes : [],
    vendas: Array.isArray(payload?.vendas) ? payload.vendas : [],
    clientes: Array.isArray(payload?.clientes) ? payload.clientes : []
  };

  const now = new Date().toISOString();
  await firestore.collection('sabor_do_oeste').doc('snapshot').set(
    {
      ...snapshot,
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
