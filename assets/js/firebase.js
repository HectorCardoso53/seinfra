'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   CONFIGURAÇÃO FIREBASE
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAetN1hjVd9LMSUex0c4KGzkzpdSP7AQGU",
  authDomain: "seinfra-dbf5e.firebaseapp.com",
  projectId: "seinfra-dbf5e",
  storageBucket: "seinfra-dbf5e.firebasestorage.app",
  messagingSenderId: "1033717206698",
  appId: "1:1033717206698:web:fc8860c17f9fc56cea0ad3"
};

/* =========================
   INICIALIZA
========================= */
const app = initializeApp(firebaseConfig);

/* =========================
   EXPORTA SERVIÇOS
========================= */
export const auth = getAuth(app);
export const db = getFirestore(app);
