"use strict";

import { auth, db } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ==========================
   AUTH SECUNDÁRIO (NÃO DESLOGA O ADMIN)
========================== */
const secondaryApp = initializeApp(auth.app.options, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

window.excluirUsuario = async function (id) {
  const result = await Swal.fire({
    title: "Tem certeza?",
    text: "Essa ação não poderá ser desfeita!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  });

  if (!result.isConfirmed) return;

  await deleteDoc(doc(db, "users", id));

  Swal.fire("Excluído!", "Usuário removido.", "success");

  carregarUsuarios();
};

window.toggleStatus = async function (id, statusAtual) {
  try {
    await updateDoc(doc(db, "users", id), {
      ativo: !statusAtual,
    });

    carregarUsuarios();
  } catch (error) {
    console.error(error);
    alert("Erro ao atualizar status");
  }
};

window.editarUsuario = async function (id) {
  const docRef = doc(db, "users", id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return;

  const u = docSnap.data();

  document.getElementById("edit-id").value = id;
  document.getElementById("edit-nome").value = u.nome;
  document.getElementById("edit-setor").value = u.setor;
  document.getElementById("edit-telefone").value = u.telefone;
  document.getElementById("edit-role").value = u.role;

  document.getElementById("modal-editar").classList.remove("hidden");
};

window.salvarEdicao = async function () {
  const id = document.getElementById("edit-id").value;
  const nome = document.getElementById("edit-nome").value.trim();
  const setor = document.getElementById("edit-setor").value.trim();
  const telefone = document.getElementById("edit-telefone").value.trim();
  const role = document.getElementById("edit-role").value;

  if (!nome || !setor || !telefone) {
    alert("Preencha todos os campos");
    return;
  }

  try {
    await updateDoc(doc(db, "users", id), {
      nome,
      setor,
      telefone,
      role,
    });

    alert("Usuário atualizado com sucesso!");

    fecharModal();
    carregarUsuarios();
  } catch (error) {
    console.error(error);
    alert("Erro ao atualizar");
  }
};


window.fecharModal = function () {
  document.getElementById("modal-editar").classList.add("hidden");
};
/* ==========================
   CADASTRO DE USUÁRIOS
========================== */
const formUser = document.getElementById("form-user");

if (formUser) {
  formUser.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("user-nome").value.trim();
    const cpf = document.getElementById("user-cpf").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const setor = document.getElementById("user-setor").value.trim();
    const telefone = document.getElementById("user-telefone").value.trim();
    const senha = document.getElementById("user-senha").value.trim();
    const role = document.getElementById("user-role").value;

    if (!nome || !cpf || !email || !setor || !telefone || !senha) {
      alert("Preencha todos os campos.");
      return;
    }

    if (cpf.length !== 11 || isNaN(cpf)) {
      alert("CPF inválido.");
      return;
    }

    try {
      // 🔐 cria usuário SEM derrubar o admin
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        senha,
      );

      const uid = cred.user.uid;

      // 🧾 perfil no Firestore
      await setDoc(doc(db, "users", uid), {
        nome,
        cpf,
        email,
        setor,
        telefone,
        role, // admin | user
        ativo: true,
        criadoEm: serverTimestamp(),
      });

      alert("Usuário cadastrado com sucesso!");
      formUser.reset();
      carregarUsuarios();
    } catch (error) {
      console.error(error);

      let msg = "Erro ao cadastrar usuário";

      if (error.code === "auth/email-already-in-use") {
        msg = "E-mail já cadastrado";
      }

      alert(msg);
    }
  });
}
/* ==========================
   LISTAGEM DE USUÁRIOS
========================== */
async function carregarUsuarios() {
  const lista = document.getElementById("lista-usuarios");
  if (!lista) return;

  lista.innerHTML = "";

  const snapshot = await getDocs(collection(db, "users"));

  if (snapshot.empty) {
    lista.innerHTML = "<p>Nenhum usuário cadastrado.</p>";
    return;
  }

  snapshot.forEach((docSnap) => {
    const u = docSnap.data();
    const id = docSnap.id;

    lista.innerHTML += `
      <div class="user-card">
        <div class="user-header">
          <div>
            <h4>${u.nome}</h4>
            <span class="badge ${u.role === "admin" ? "badge-admin" : "badge-user"}">
              ${u.role}
            </span>
          </div>
          <span class="${u.ativo ? "status-ativo" : "status-inativo"}">
            ${u.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>

        <div class="user-info">
          <p><b>Email:</b> ${u.email}</p>
          <p><b>Setor:</b> ${u.setor}</p>
          <p><b>Telefone:</b> ${u.telefone}</p>
        </div>

        <div class="user-actions">
          <button onclick="editarUsuario('${id}')" class="btn-edit">
            ✏ Editar
          </button>

          <button onclick="toggleStatus('${id}', ${u.ativo})" class="btn-warning">
            ${u.ativo ? "Inativar" : "Ativar"}
          </button>

          <button onclick="excluirUsuario('${id}')" class="btn-delete">
            🗑 Excluir
          </button>
        </div>
      </div>
    `;
  });
}

carregarUsuarios();
