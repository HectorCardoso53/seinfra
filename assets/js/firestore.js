'use strict';

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  orderBy,
  deleteDoc,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


import { auth } from './firebase.js';

export const db = getFirestore();

/* =========================
   UTIL
========================= */
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-');
}

/* =========================
   DESCONTAR ESTOQUE
========================= */
async function descontarEstoque(materiais) {
  for (const mat of materiais) {
    const idMaterial = normalizarNome(mat.nome);
    const ref = doc(db, 'materiais', idMaterial);

    const snap = await getDoc(ref);
    if (!snap.exists()) continue;

    const atual = snap.data().estoque || 0;

    if (atual < mat.quantidade) {
      throw new Error(`Estoque insuficiente para ${mat.nome}`);
    }

    await updateDoc(ref, {
      estoque: atual - mat.quantidade
    });
  }
}

/* =========================
   SALVAR ORDEM (SEM DUPLICAR)
========================= */
export async function salvarOrdemFirestore(ordem) {

  // 🔒 ID seguro para o Firestore
  // Ex: OS001-2026-SEINFRA
  const idSeguro = ordem.numero
    .replace(/\s+/g, '')
    .replace(/\//g, '-')
    .toUpperCase();

  const ref = doc(db, 'ordens', idSeguro);

  // ❌ bloqueia duplicidade
  const existente = await getDoc(ref);
  if (existente.exists()) {
    throw new Error('Já existe uma Ordem de Serviço com este número.');
  }

  // 💾 salva OS
  await setDoc(ref, {
    ...ordem,
    criadoEm: new Date(),
    criadoPor: auth.currentUser?.email || 'sistema'
  });

  // 📦 desconta materiais
  if (ordem.materiais && ordem.materiais.length > 0) {
    await descontarEstoque(ordem.materiais);
  }
}

/* =========================
   BUSCAR ORDENS
========================= */
export async function buscarOrdensFirestore() {
    const snapshot = await getDocs(collection(db, "ordens"));

    const lista = [];

    snapshot.forEach((docSnap) => {
        lista.push({
            id: docSnap.id,   // 👈 ESSENCIAL
            ...docSnap.data()
        });
    });

    return lista;
}

/* =========================
   ATUALIZAR ORDEM
========================= */
export async function atualizarOrdemFirestore(id, dados) {
  const ref = doc(db, 'ordens', id);
  await updateDoc(ref, dados);
}


/* =========================
   EXCLUIR ORDEM
========================= */
export async function excluirOrdemFirestore(id) {
  const ref = doc(db, "ordens", id);
  await deleteDoc(ref);
}