'use strict';

import { auth, db } from './firebase.js';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   CONTROLE DE ESTADO
========================= */
let authChecked = false;

/* =========================
   LOGIN
========================= */
window.login = async function () {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const loading = document.getElementById('login-loading');
  const btn = document.getElementById('btn-login');

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // Reset visual
  emailError.style.display = 'none';
  passwordError.style.display = 'none';
  emailInput.classList.remove('input-error');
  passwordInput.classList.remove('input-error');

  let hasError = false;

  if (!email) {
    emailError.style.display = 'block';
    emailInput.classList.add('input-error');
    hasError = true;
  }

  if (!password) {
    passwordError.style.display = 'block';
    passwordInput.classList.add('input-error');
    hasError = true;
  }

  if (hasError) return;

  // UI loading
  loading.style.display = 'block';
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace('dashboard.html');
  } catch (error) {
    loading.style.display = 'none';
    btn.disabled = false;

    let msg = 'Erro ao fazer login';

    if (error.code === 'auth/invalid-credential') {
      msg = '<i class="bi bi-exclamation-triangle"></i> E-mail ou senha inválidos';
    } else if (error.code === 'auth/network-request-failed') {
      msg = '<i class="bi bi-wifi-off"></i> Sem conexão com a internet';
    }

    passwordError.innerHTML = msg;
    passwordError.style.display = 'block';
    passwordInput.classList.add('input-error');
  }
};

/* =========================
   LOGOUT
========================= */
window.logout = async function () {
  await signOut(auth);
  window.location.replace('index.html');
};

/* =========================
   PROTEÇÃO DE ROTAS
========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert('Usuário sem perfil cadastrado.');
    return;
  }

  const data = snap.data();

  // 🔐 salva globalmente
  window.userRole = data.role;
  window.userNome = data.nome; // 👈 GUARDA O NOME

  // 👤 PREENCHE AUTOMATICAMENTE NA NOVA OS
  const inputResponsavel = document.getElementById('responsavel-abertura');
  if (inputResponsavel) {
    inputResponsavel.value = data.nome;
  }

  // 👁️ menu admin
  if (data.role === 'admin') {
    document.querySelectorAll('.admin-only')
      .forEach(el => el.style.display = 'flex');
  }
});

