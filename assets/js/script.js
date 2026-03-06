import { db, auth } from "./firebase.js";

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── STATE ──────────────────────────────────────────────
let visits = [];
let editingId = null;
let currentPage = 1;
const PAGE_SIZE = 8;
let filterDate = "";
let filterService = "";
let searchTerm = "";

// Chart instances
let chartService = null;
let chartMonth = null;

window.logout = async function () {
  await signOut(auth);
  window.location.replace("/index.html");
};
async function loadVisits() {
  const q = query(collection(db, "visitas"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  visits = [];

  querySnapshot.forEach((docSnap) => {
    visits.push({
      id: docSnap.id,
      ...docSnap.data(),
    });
  });

  updateSidebarCounter();
}

// ─── HELPERS ────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function serviceBadgeClass(service) {
  const map = {
    Certidão: "badge-certidao",
    Protocolo: "badge-protocolo",
    Informação: "badge-informacao",
    Requerimento: "badge-requerimento",
    Outros: "badge-outros",
  };
  return map[service] || "badge-outros";
}

function updateSidebarCounter() {
  const el = document.getElementById("visit-count");
  if (el) el.textContent = visits.length;
}

// ─── NAVIGATION ─────────────────────────────────────────
function navigate(page) {

  document.querySelectorAll(".page")
    .forEach(p => p.classList.remove("active"));

  document.querySelectorAll(".nav-item")
    .forEach(n => n.classList.remove("active"));

  document.getElementById(`page-${page}`)?.classList.add("active");

  document.querySelectorAll(`[data-nav="${page}"]`)
    .forEach(n => n.classList.add("active"));

  atualizarHeader(page); // ← ADICIONE ESTA LINHA

  if (page === "lista") renderTable();
  if (page === "dashboard") renderDashboard();

}

// ─── SIDEBAR MOBILE ─────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("show");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("show");
}

// ─── FORM ────────────────────────────────────────────────
function initForm() {
  const form = document.getElementById("visit-form");
  form.addEventListener("submit", handleFormSubmit);
  document
    .getElementById("btn-cancel-edit")
    .addEventListener("click", cancelEdit);
  document.getElementById("btn-clear").addEventListener("click", clearForm);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const data = getFormData();
  if (!validateForm(data)) return;

  try {
    if (editingId) {
      // atualizar no Firestore
      await updateDoc(doc(db, "visitas", editingId), data);

      showToast("Visita atualizada com sucesso!", "success");
      cancelEdit();
    } else {
      // salvar no Firestore
      await addDoc(collection(db, "visitas"), {
        ...data,
        createdAt: new Date().toISOString(),
      });

      showToast("Visita cadastrada com sucesso!", "success");
      clearForm();
    }

    // recarregar lista
    await loadVisits();

    // atualizar tabela e dashboard
    renderTable();
    renderDashboard();
  } catch (error) {
    console.error("Erro ao salvar visita:", error);
    showToast("Erro ao salvar visita.", "error");
  }
}

function getFormData() {
  return {
    name: document.getElementById("f-name").value.trim(),
    phone: document.getElementById("f-phone").value.trim(),
    date: document.getElementById("f-date").value,
    service: document.getElementById("f-service").value,
    notes: document.getElementById("f-notes").value.trim(),
  };
}

function validateForm(data) {
  if (!data.name) {
    showToast("Informe o nome da pessoa.", "error");
    return false;
  }
  if (!data.phone) {
    showToast("Informe o telefone.", "error");
    return false;
  }
  if (!data.date) {
    showToast("Informe a data da visita.", "error");
    return false;
  }
  if (!data.service) {
    showToast("Selecione o tipo de serviço.", "error");
    return false;
  }
  return true;
}

function clearForm() {
  document.getElementById("visit-form").reset();
  document.getElementById("f-date").value = today();
}

function cancelEdit() {
  editingId = null;
  document.getElementById("form-card-title").textContent = "Nova Visita";
  document.getElementById("btn-submit").innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Cadastrar Visita`;
  document.getElementById("btn-cancel-edit").style.display = "none";
  clearForm();
}

// ─── TABLE ────────────────────────────────────────────────
function getFilteredVisits() {
  return visits.filter((v) => {
    const matchDate = !filterDate || v.date === filterDate;
    const matchService = !filterService || v.service === filterService;
    const matchSearch =
      !searchTerm ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.phone.includes(searchTerm);
    return matchDate && matchService && matchSearch;
  });
}

function renderTable() {
  const filtered = getFilteredVisits();
  const total = filtered.length;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("visits-tbody");

  if (!total) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
          </svg>
          <p>Nenhuma visita encontrada.</p>
        </div>
      </td></tr>`;
  } else {
    tbody.innerHTML = page
      .map(
        (v) => `
      <tr>
        <td><strong>${escapeHtml(v.name)}</strong></td>
        <td>${escapeHtml(v.phone)}</td>
        <td>${formatDate(v.date)}</td>
        <td><span class="badge ${serviceBadgeClass(v.service)}">${escapeHtml(v.service)}</span></td>
        <td style="color:var(--text-muted);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(v.notes || "—")}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-icon edit" onclick="editVisit('${v.id}')" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon delete" onclick="confirmDelete('${v.id}')" title="Excluir">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  }

  // Pagination
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageInfo = document.getElementById("page-info");
  const pageBtns = document.getElementById("page-btns");

  pageInfo.textContent = total
    ? `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}`
    : "0 visitas";

  let btns = "";
  btns += `<button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? "disabled" : ""}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (
      pages <= 6 ||
      i === 1 ||
      i === pages ||
      Math.abs(i - currentPage) <= 1
    ) {
      btns += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === 2 && currentPage > 4) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    } else if (i === pages - 1 && currentPage < pages - 3) {
      btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }
  btns += `<button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage >= pages ? "disabled" : ""}>›</button>`;
  pageBtns.innerHTML = btns;
}

function changePage(p) {
  const filtered = getFilteredVisits();
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderTable();
}

function editVisit(id) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;
  editingId = id;

  document.getElementById("f-name").value = v.name;
  document.getElementById("f-phone").value = v.phone;
  document.getElementById("f-date").value = v.date;
  document.getElementById("f-service").value = v.service;
  document.getElementById("f-notes").value = v.notes || "";

  document.getElementById("form-card-title").textContent = "Editar Visita";
  document.getElementById("btn-submit").innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar Alterações`;
  document.getElementById("btn-cancel-edit").style.display = "inline-flex";

  navigate("cadastro");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function confirmDelete(id) {
  const v = visits.find((v) => v.id === id);
  if (!v) return;
  document.getElementById("confirm-name").textContent = v.name;
  document.getElementById("confirm-overlay").classList.add("open");
  document.getElementById("btn-confirm-delete").onclick = () => deleteVisit(id);
}

async function deleteVisit(id) {
  await deleteDoc(doc(db, "visitas", id));

  await loadVisits();

  renderTable();
  renderDashboard();

  showToast("Visita excluída.", "success");
}

function closeConfirm() {
  document.getElementById("confirm-overlay").classList.remove("open");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── FILTERS ─────────────────────────────────────────────
function initFilters() {
  document.getElementById("filter-date").addEventListener("input", (e) => {
    filterDate = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.getElementById("filter-service").addEventListener("change", (e) => {
    filterService = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.getElementById("filter-search").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.getElementById("btn-clear-filters").addEventListener("click", () => {
    filterDate = "";
    filterService = "";
    searchTerm = "";
    document.getElementById("filter-date").value = "";
    document.getElementById("filter-service").value = "";
    document.getElementById("filter-search").value = "";
    currentPage = 1;
    renderTable();
  });
}

// ─── PHONE MASK ──────────────────────────────────────────
function initPhoneMask() {
  const el = document.getElementById("f-phone");
  el.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 6) {
      this.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
      this.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      this.value = `(${v}`;
    }
  });
}

// ─── DASHBOARD ────────────────────────────────────────────
function renderDashboard() {
  // Stats
  const total = visits.length;
  const thisMonth = visits.filter(
    (v) => v.date && v.date.slice(0, 7) === today().slice(0, 7),
  ).length;
  const today_ = visits.filter((v) => v.date === today()).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-month").textContent = thisMonth;
  document.getElementById("stat-today").textContent = today_;

  // Most common service
  const serviceCounts = {};
  visits.forEach(
    (v) => (serviceCounts[v.service] = (serviceCounts[v.service] || 0) + 1),
  );
  const topService = Object.entries(serviceCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  document.getElementById("stat-top-service").textContent = topService
    ? topService[0]
    : "—";

  renderServiceChart(serviceCounts);
  renderMonthChart();
}

const CHART_COLORS = [
  "#2D5A3D",
  "#1A3A5C",
  "#8B6914",
  "#8B2635",
  "#5A2D82",
  "#4A8A5D",
  "#2A5A8C",
  "#B08020",
  "#B03045",
  "#7A4DA2",
];

function renderServiceChart(counts) {
  const ctx = document.getElementById("chart-service").getContext("2d");
  const labels = Object.keys(counts);
  const data = Object.values(counts);

  if (chartService) chartService.destroy();
  chartService = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { family: "'DM Sans', sans-serif", size: 12 },
            color: "#7A7469",
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} visita(s)`,
          },
        },
      },
    },
  });
}

function renderMonthChart() {
  const ctx = document.getElementById("chart-month").getContext("2d");
  const monthMap = {};
  visits.forEach((v) => {
    if (!v.date) return;
    const ym = v.date.slice(0, 7);
    monthMap[ym] = (monthMap[ym] || 0) + 1;
  });

  const sorted = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8);
  const labels = sorted.map(([ym]) => {
    const [y, m] = ym.split("-");
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  });
  const data = sorted.map(([, v]) => v);

  if (chartMonth) chartMonth.destroy();
  chartMonth = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Visitas",
          data,
          backgroundColor: "#2D5A3D",
          borderRadius: 6,
          borderSkipped: false,
          hoverBackgroundColor: "#4A8A5D",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.parsed.y} visita(s)` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'DM Sans', sans-serif", size: 12 },
            color: "#7A7469",
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { family: "'DM Sans', sans-serif", size: 12 },
            color: "#7A7469",
          },
          grid: { color: "#EDE9E0" },
          border: { display: false },
        },
      },
    },
  });
}

// ─── TOAST ────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon =
    type === "success"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  toast.innerHTML = `${icon} ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── SEED DATA ────────────────────────────────────────────
function seedIfEmpty() {
  if (visits.length > 0) return;
  const names = [
    "Ana Souza",
    "Carlos Mendes",
    "Fernanda Lima",
    "João Pedro",
    "Marcia Santos",
    "Rafael Oliveira",
    "Beatriz Costa",
    "Lucas Ferreira",
    "Patrícia Nunes",
    "André Alves",
  ];
  const phones = [
    "(91) 99234-5678",
    "(91) 98765-4321",
    "(91) 97654-3210",
    "(91) 96543-2109",
    "(91) 95432-1098",
    "(91) 94321-0987",
    "(91) 93210-9876",
    "(91) 92109-8765",
    "(91) 91098-7654",
    "(91) 90987-6543",
  ];
  const services = [
    "Certidão",
    "Protocolo",
    "Informação",
    "Requerimento",
    "Outros",
  ];
  const notes = ["Urgente", "Retorno", "Primeira visita", "", ""];

  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 90));
    visits.push({
      id: generateId(),
      createdAt: d.toISOString(),
      name: names[i],
      phone: phones[i],
      date: d.toISOString().split("T")[0],
      service: services[i % services.length],
      notes: notes[i % notes.length],
    });
  }
  saveVisits();
}

function atualizarHeader(pageId){

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  const map = {

    dashboard:{
      title:"Dashboard",
      subtitle:"Resumo e análise das visitas registradas"
    },

    cadastro:{
      title:"Cadastrar Visita",
      subtitle:"Registro de novos atendimentos"
    },

    lista:{
      title:"Lista de Visitas",
      subtitle:"Consulta de visitas registradas"
    }

  };

  if(map[pageId]){
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }

}

// ─── INIT ─────────────────────────────────────────────────
// ─── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {

  await loadVisits();

  initForm();
  initFilters();
  initPhoneMask();

  const dateInput = document.getElementById("f-date");
  if (dateInput) {
    dateInput.value = today();
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  const todayBadge = document.getElementById("today-badge");
  if (todayBadge) {
    const d = new Date();
    todayBadge.textContent = d.toLocaleDateString(
      "pt-BR",
      { weekday: "long", day: "2-digit", month: "long" }
    );
  }

  const hamburger = document.getElementById("hamburger");
  if (hamburger) {
    hamburger.addEventListener("click", toggleSidebar);
  }

  const overlay = document.getElementById("sidebar-overlay");
  if (overlay) {
    overlay.addEventListener("click", closeSidebar);
  }

  const cancelDelete = document.getElementById("btn-cancel-delete");
  if (cancelDelete) {
    cancelDelete.addEventListener("click", closeConfirm);
  }

  navigate("dashboard");

  renderTable();
  renderDashboard();

});


window.editVisit = editVisit;
window.confirmDelete = confirmDelete;
window.changePage = changePage;