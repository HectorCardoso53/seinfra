import {
  salvarOrdemFirestore,
  buscarOrdensFirestore,
  atualizarOrdemFirestore,
  excluirOrdemFirestore,
} from "./firestore.js";

// 🔥 VARIÁVEIS GLOBAIS
let ordens = [];
let materiais = [];
let osAtual = null;
let numeroOS = 1;

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  inicializarSistema();
});

async function inicializarSistema() {
  ordens = await buscarOrdensFirestore();

  const anoAtual = new Date().getFullYear();

  let maiorNumero = 0;

  ordens.forEach((ordem) => {
    if (!ordem.numero) return;

    const match = ordem.numero.match(/OS\s*(\d+)\/(\d{4})/);

    if (match) {
      const seq = parseInt(match[1], 10);
      const ano = parseInt(match[2], 10);

      if (ano === anoAtual && seq > maiorNumero) {
        maiorNumero = seq;
      }
    }
  });

  numeroOS = maiorNumero + 1;

  setDataAtual();
  gerarNumeroOS();
  atualizarDashboard();
  carregarTabelaDashboard();
  aplicarFiltros();

  // 🔥 IMPORTANTE
  atualizarHeader("dashboard");
}

window.showPage = function (pageId, menuItem) {
  if (pageId === "relatorios") {
    carregarFiltroAno();
    aplicarFiltros();
  }

  if (pageId === "materiais-mes") {
    carregarAnoMateriais();
  }

  // esconder todas as páginas
  document
    .querySelectorAll(".page")
    .forEach((page) => page.classList.add("hidden"));

  const page = document.getElementById("page-" + pageId);
  if (!page) return;

  page.classList.remove("hidden");

  // menu ativo
  document
    .querySelectorAll(".menu-item")
    .forEach((item) => item.classList.remove("active"));

  if (menuItem) menuItem.classList.add("active");

  // aba Materiais
  if (pageId === "materiais") {
    carregarMateriaisLista();
  }

  // aba Nova OS
  if (pageId === "nova-os") {
    gerarNumeroOS();

    const input = document.getElementById("responsavel-abertura");
    if (input && window.userNome) {
      input.value = window.userNome;
    }
  }

  atualizarHeader(pageId);
};

document.querySelector(".overlay")?.addEventListener("click", () => {
  document.querySelector(".sidebar").classList.remove("open");
  document.querySelector(".overlay").classList.remove("show");
});

function atualizarHeader(pageId) {
  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  const map = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Visão geral do sistema de ordens de serviço",
    },

    "nova-os": {
      title: "Nova Ordem de Serviço",
      subtitle: "Criação de uma nova OS",
    },

    relatorios: {
      title: "Relatórios",
      subtitle: "Consulta e análise das ordens",
    },

    "materiais-mes": {
      title: "Materiais por Mês",
      subtitle: "Relatório de materiais utilizados nas ordens",
    },

    usuarios: {
      title: "Cadastro de Usuários",
      subtitle: "Gerenciamento de acessos do sistema",
    },
  };

  if (map[pageId]) {
    title.textContent = map[pageId].title;
    subtitle.textContent = map[pageId].subtitle;
  }
}

// Gerar número da OS
function gerarNumeroOS() {
  const inputNumero = document.getElementById("numero-os");
  const inputData = document.getElementById("data-abertura");

  if (!inputNumero || !inputData) return;

  // 🔢 número sequencial
  const numeroFormatado = String(numeroOS).padStart(3, "0");

  // 📅 ano baseado na data, mas nunca menor que 2026
  let ano = inputData.value
    ? new Date(inputData.value).getFullYear()
    : new Date().getFullYear();

  if (ano < 2026) {
    ano = 2026;
  }

  // 🏢 SEINFRA fixo
  inputNumero.value = `OS ${numeroFormatado}/${ano} - SEINFRA`;
}

// Definir data atual
function setDataAtual() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const minuto = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("data-abertura").value =
    `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

// Adicionar Material
window.adicionarMaterial = function () {
  const nome = document.getElementById("material-nome").value.trim();
  const quantidadeInput = document.getElementById("material-quantidade").value;
  const unidade = document.getElementById("material-unidade").value.trim();

  // quantidade agora é opcional
  const quantidade = quantidadeInput ? parseFloat(quantidadeInput) : null;

  if (!nome || !unidade) {
    mostrarAlerta(
      "Informe pelo menos a descrição e a unidade do material.",
      "Atenção",
    );
    return;
  }

  materiais.push({
    nome,
    quantidade,
    unidade,
  });

  document.getElementById("material-nome").value = "";
  document.getElementById("material-quantidade").value = "";
  document.getElementById("material-unidade").value = "";

  renderizarMateriais();
};

function renderizarMateriais() {
  const lista = document.getElementById("lista-materiais");

  if (materiais.length === 0) {
    lista.classList.add("hidden");
    lista.innerHTML = "";
    return;
  }

  lista.classList.remove("hidden");

  lista.innerHTML = materiais
    .map(
      (m, index) => `
    <div class="material-item">
      <div class="material-info">
        <strong>${m.nome}</strong><br>
        <small>
    ${m.quantidade ? m.quantidade + " " + m.unidade : m.unidade}
</small>
      </div>
      <button
        type="button"
        class="btn btn-danger btn-small"
        onclick="removerMaterial(${index})">
        Remover
      </button>
    </div>
  `,
    )
    .join("");
}

// Salvar OS
document
  .getElementById("form-os")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const descricao = document.getElementById("descricao-servico").value.trim();
    const responsavelExecucao = document
      .getElementById("responsavel-execucao")
      .value.trim();

    if (!descricao) {
      mostrarAlerta("A descrição do serviço é obrigatória.", "Atenção");
      return;
    }

    if (!responsavelExecucao) {
      mostrarAlerta("O responsável pela execução é obrigatório.", "Atenção");
      return;
    }

    // pega o valor do select
    const setorSelect = document.getElementById("setor-responsavel").value;

    // pega o campo de nova diretoria (se existir)
    const novoSetor = document.getElementById("novo-setor")?.value.trim();

    // define qual será salvo
    const setorFinal = setorSelect === "outro" ? novoSetor : setorSelect;

    const dadosOrdem = {
      numero: document.getElementById("numero-os").value,
      dataAbertura: document.getElementById("data-abertura").value,
      setorResponsavel: document.getElementById("setor-responsavel").value,

      nomeSolicitante: document.getElementById("nome-solicitante").value,
      setorSolicitante: document.getElementById("setor-solicitante").value,
      descricaoServico: descricao,
      localServico: document.getElementById("local-servico").value,

      materiais: [...materiais],

      responsavelExecucao: responsavelExecucao,
      responsavelAbertura: document.getElementById("responsavel-abertura")
        .value,
    };
    try {
      // 🔥 SE ESTIVER EDITANDO
      // 🔥 SE ESTIVER EDITANDO
      if (osAtual && osAtual.id) {
        await atualizarOrdemFirestore(osAtual.id, dadosOrdem);

        mostrarAlerta("Ordem atualizada com sucesso!", "Sucesso");

        osAtual = null; // sai do modo edição

        // 🔥 ATUALIZA DADOS
        ordens = await buscarOrdensFirestore();

        // 🔥 VOLTA PRA ABA RELATÓRIOS
        showPage("relatorios");

        // 🔥 APLICA FILTROS DE NOVO
        aplicarFiltros();

        return; // ⛔ IMPORTANTE: para aqui e não continua
      } else {
        // 🆕 NOVA ORDEM
        dadosOrdem.status = "Aberta";
        dadosOrdem.dataEncerramento = null;
        dadosOrdem.observacaoFinal = null;
        dadosOrdem.assinaturaChefia = null;
        dadosOrdem.assinaturaRecebedor = null;

        await salvarOrdemFirestore(dadosOrdem);

        numeroOS++;
        mostrarAlerta("Ordem criada com sucesso!", "Sucesso");
      }

      ordens = await buscarOrdensFirestore();

      limparFormulario();
      atualizarDashboard();
      carregarTabelaDashboard();
      aplicarFiltros();
    } catch (error) {
      console.error(error);
      mostrarAlerta(error.message, "Erro");
    }
  });

function limparFormulario() {
  document.getElementById("form-os").reset();
  materiais = [];
  renderizarMateriais();
  gerarNumeroOS();
  setDataAtual();
}

window.mostrarAlerta = function (mensagem, titulo = "Aviso") {
  document.getElementById("modal-alerta-titulo").innerText = titulo;
  document.getElementById("modal-alerta-mensagem").innerText = mensagem;
  document.getElementById("modal-alerta").classList.remove("hidden");
};

window.fecharAlerta = function () {
  document.getElementById("modal-alerta").classList.add("hidden");
};

window.fecharConfirm = function () {
  document.getElementById("modal-confirm").classList.add("hidden");
};

// Dashboard
function atualizarDashboard() {
  const total = ordens.length;
  const abertas = ordens.filter((o) => o.status === "Aberta").length;
  const andamento = ordens.filter((o) => o.status === "Em andamento").length;
  const encerradas = ordens.filter((o) => o.status === "Encerrada").length;
  const totalMateriais = ordens.reduce((acc, o) => acc + o.materiais.length, 0);

  document.getElementById("total-ordens").textContent = total;
  document.getElementById("total-andamento").textContent = andamento;
  document.getElementById("total-encerradas").textContent = encerradas;
  document.getElementById("total-materiais").textContent = totalMateriais;

  atualizarGraficos();
}

window.gerarRelatorioMateriais = function () {
  const mes = Number(document.getElementById("materiais-mes").value);
  const ano = Number(document.getElementById("materiais-ano").value);

  let materiaisSomados = {};
  let quantidadeTotal = 0;

  ordens.forEach((ordem) => {
    const data = new Date(ordem.dataAbertura);

    if (data.getMonth() === mes && data.getFullYear() === ano) {
      ordem.materiais?.forEach((mat) => {
        const chave = mat.nome + "_" + mat.unidade;

        if (!materiaisSomados[chave]) {
          materiaisSomados[chave] = {
            nome: mat.nome,
            unidade: mat.unidade,
            quantidade: 0,
            os: 0,
          };
        }

        const qtd = Number(mat.quantidade || 0);

        materiaisSomados[chave].quantidade += qtd;
        materiaisSomados[chave].os += 1;

        quantidadeTotal += qtd;
      });
    }
  });

  const lista = Object.values(materiaisSomados);

  // 🔹 Atualiza CARDS
  document.getElementById("total-materiais-mes").textContent = lista.length;
  document.getElementById("total-quantidade-mes").textContent = quantidadeTotal;

  renderTabelaMateriaisMes(lista);
};

function carregarTabelaDashboard() {
  const tbody = document.getElementById("tabela-dashboard");
  const ultimasOrdens = ordens.slice(-5).reverse();

  if (ultimasOrdens.length === 0) {
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                <h3>Nenhuma ordem de serviço cadastrada</h3>
                <p>Clique em "Nova Ordem" para criar sua primeira OS</p>
            </td>
        </tr>`;
    console.log(ultimasOrdens);
    return;
  }

  tbody.innerHTML = ultimasOrdens
    .map(
      (ordem) => `
        <tr>
            <td>${ordem.numero}</td>
            <td>${formatarData(ordem.dataAbertura)}</td>
            <td>${ordem.nomeSolicitante}</td>
            <td>${(ordem.descricaoServico || "Sem descrição").substring(0, 50)}...</td>
            <td>
                <span class="status-badge status-${ordem.status.toLowerCase().replace(" ", "-")}">
                    ${ordem.status}
                </span>
            </td>
            <td>
                <button class="btn btn-primary btn-small"
                    onclick="visualizarOS('${ordem.id}')">
                    Ver Detalhes
                </button>
            </td>
        </tr>
    `,
    )
    .join("");
}

// Relatórios
window.aplicarFiltros = function () {
  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const mes = document.getElementById("filtro-mes").value;
  const ano = document.getElementById("filtro-ano").value;
  const status = document.getElementById("filtro-status").value;

  const solicitante = document
    .getElementById("filtro-solicitante")
    .value.trim()
    .toLowerCase();

  const setorSolicitante = document
    .getElementById("filtro-setor-solicitante")
    ?.value.trim()
    .toLowerCase();

  let ordensFiltradas = [...ordens];

  if (dataInicio) {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) >= new Date(dataInicio),
    );
  }

  if (dataFim) {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura) <= new Date(dataFim + "T23:59:59"),
    );
  }

  if (mes !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getMonth() === Number(mes),
    );
  }

  if (ano !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      (o) => new Date(o.dataAbertura).getFullYear() === Number(ano),
    );
  }

  if (status) {
    ordensFiltradas = ordensFiltradas.filter((o) => o.status === status);
  }

  if (solicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.nomeSolicitante?.toLowerCase().includes(solicitante),
    );
  }

  // 🔥 NOVO FILTRO POR SETOR
  if (setorSolicitante) {
    ordensFiltradas = ordensFiltradas.filter((o) =>
      o.setorSolicitante?.toLowerCase().includes(setorSolicitante),
    );
  }

  carregarTabelaRelatorios(ordensFiltradas);
};

function carregarFiltroAno() {
  const select = document.getElementById("filtro-ano");
  if (!select) return;

  const anoAtual = new Date().getFullYear();
  const anoInicial = 2026;

  select.innerHTML = '<option value="">Todos</option>';

  for (let ano = anoAtual; ano >= anoInicial; ano--) {
    const opt = document.createElement("option");
    opt.value = ano;
    opt.textContent = ano;
    select.appendChild(opt);
  }
}

function carregarTabelaRelatorios(ordensParaExibir) {
  const tbody = document.getElementById("tabela-relatorios");

  if (!ordensParaExibir || ordensParaExibir.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <h3>Nenhuma ordem encontrada</h3>
          <p>Tente ajustar os filtros</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = ordensParaExibir
    .slice()
    .reverse()
    .map((ordem) => {
      const statusClasse = ordem.status
        ? ordem.status.toLowerCase().replace(/\s/g, "-")
        : "aberta";

      return `
        <tr>
          <td>${ordem.numero || "-"}</td>

          <td>
            ${ordem.dataAbertura ? formatarData(ordem.dataAbertura) : "-"}
          </td>

          <td>
            <span class="status-badge status-${statusClasse}">
              ${ordem.status || "-"}
            </span>
          </td>

          <td>${ordem.nomeSolicitante || "-"}</td>

          <td>${ordem.setorSolicitante || "-"}</td>

          <td>
            ${(ordem.descricaoServico || "-").substring(0, 40)}...
          </td>

          <td style="display:flex; gap:6px;">

            <button 
              class="btn btn-primary btn-small"
              onclick="visualizarOS('${ordem.id}')">
              Ver
            </button>

            <button 
              class="btn btn-secondary btn-small"
              onclick="editarOS('${ordem.id}')">
              Editar
            </button>

            <button 
              class="btn btn-danger btn-small"
              onclick="excluirOS('${ordem.id}')">
              Excluir
            </button>

          </td>
        </tr>
      `;
    })
    .join("");
}

// Visualizar OS
window.visualizarOS = function (id) {
  osAtual = ordens.find((o) => o.id === id);
  if (!osAtual) return;

  const materiaisHTML =
    osAtual.materiais?.length > 0
      ? osAtual.materiais
          .map(
            (m) =>
              `<div style="margin-bottom:6px;">• ${m.nome} - ${m.quantidade} ${m.unidade}</div>`,
          )
          .join("")
      : "<div>Nenhum material informado</div>";

  const criadoEmFormatado = osAtual.criadoEm?.seconds
    ? new Date(osAtual.criadoEm.seconds * 1000).toLocaleString("pt-BR")
    : "-";

  let detalhesHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px;">
                Informações Gerais
            </h3>

            <div><strong>Número:</strong> ${osAtual.numero}</div>
            <div><strong>Status:</strong> ${osAtual.status}</div>
            <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
            <div><strong>Data de Encerramento:</strong> ${
              osAtual.dataEncerramento
                ? formatarDataCompleta(osAtual.dataEncerramento)
                : "-"
            }</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Solicitante
            </h3>

            <div><strong>Nome:</strong> ${osAtual.nomeSolicitante}</div>
            <div><strong>Setor Solicitante:</strong> ${osAtual.setorSolicitante}</div>
            <div><strong>Setor Responsável:</strong> ${osAtual.setorResponsavel}</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Execução
            </h3>

            <div><strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao}</div>
            <div><strong>Responsável Abertura:</strong> ${osAtual.responsavelAbertura}</div>
            <div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Serviço
            </h3>

            <div><strong>Descrição:</strong> ${osAtual.descricaoServico}</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Materiais Utilizados
            </h3>

            <div>${materiaisHTML}</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Encerramento
            </h3>

            <div><strong>Observação Final:</strong> ${osAtual.observacaoFinal || "-"}</div>
            <div><strong>Assinatura Chefia:</strong> ${osAtual.assinaturaChefia || "-"}</div>
            <div><strong>Assinatura Recebedor:</strong> ${osAtual.assinaturaRecebedor || "-"}</div>

            <h3 style="border-bottom:1px solid #ddd; padding-bottom:8px; margin-top:15px;">
                Controle Interno
            </h3>

            <div><strong>Criado por:</strong> ${osAtual.criadoPor || "-"}</div>
            <div><strong>Criado em:</strong> ${criadoEmFormatado}</div>

        </div>
    `;

  document.getElementById("detalhes-content").innerHTML = detalhesHTML;

  const btnEncerrar = document.getElementById("btn-encerrar");
  const btnAlterar = document.getElementById("btn-alterar-status");

  if (osAtual.status === "Encerrada") {
    btnEncerrar.style.display = "none";
    btnAlterar.style.display = "none";
  } else {
    btnEncerrar.style.display = "inline-flex";
    btnAlterar.style.display = "inline-flex";
  }

  const modal = document.getElementById("modal-detalhes");
  modal.classList.remove("hidden");
  modal.classList.add("show");
};

window.fecharModalDetalhes = function () {
  document.getElementById("modal-detalhes").classList.remove("show");
  document.getElementById("modal-detalhes").classList.add("hidden");
  osAtual = null;
};

function fecharMenuMobile() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");

  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// Alterar Status
window.alterarStatus = async function () {
  if (!osAtual) return;

  const novoStatus = osAtual.status === "Aberta" ? "Em andamento" : "Aberta";

  await atualizarOrdemFirestore(osAtual.id, {
    status: novoStatus,
  });

  ordens = await buscarOrdensFirestore();
  visualizarOS(osAtual.id);
  atualizarDashboard();
  carregarTabelaDashboard();
  aplicarFiltros();
};

// Encerramento
window.mostrarEncerramento = function () {
  if (!osAtual) return;

  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const hora = String(now.getHours()).padStart(2, "0");
  const minuto = String(now.getMinutes()).padStart(2, "0");

  document.getElementById("data-encerramento").value =
    `${ano}-${mes}-${dia}T${hora}:${minuto}`;

  // 🔹 Preenche automático
  document.getElementById("assinatura-chefia").value = "Liliana Bentes";

  if (window.userNome) {
    document.getElementById("assinatura-recebedor").value = window.userNome;
  }

  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("hidden");
  modal.classList.add("show");
};

window.excluirOS = function (id) {
  const ordem = ordens.find((o) => o.id === id);
  if (!ordem) return;

  mostrarConfirmacao(
    `Tem certeza que deseja excluir a OS ${ordem.numero}?\n\nEssa ação não poderá ser desfeita.`,
    async function () {
      await excluirOrdemFirestore(id);

      ordens = await buscarOrdensFirestore();

      atualizarDashboard();
      carregarTabelaDashboard();
      aplicarFiltros();

      mostrarAlerta("Ordem excluída com sucesso!", "Sucesso");
    },
  );
};

window.mostrarConfirmacao = function (mensagem, callbackConfirmar) {
  document.getElementById("modal-confirm-mensagem").innerText = mensagem;

  const modal = document.getElementById("modal-confirm");
  modal.classList.remove("hidden");

  const btn = document.getElementById("btn-confirmar-acao");

  btn.onclick = function () {
    callbackConfirmar();
    window.fecharConfirm();
  };
};

window.editarOS = function (id) {
  const ordem = ordens.find((o) => o.id === id);
  if (!ordem) return;

  // 🔒 NÃO PERMITE EDITAR ENCERRADA
  if (ordem.status === "Encerrada") {
    mostrarAlerta("Não é permitido editar uma OS encerrada.", "Atenção");
    return;
  }

  osAtual = ordem;

  showPage("nova-os");

  document.getElementById("numero-os").value = ordem.numero;
  document.getElementById("data-abertura").value = ordem.dataAbertura;
  document.getElementById("setor-responsavel").value = ordem.setorResponsavel;
  document.getElementById("nome-solicitante").value = ordem.nomeSolicitante;
  document.getElementById("setor-solicitante").value = ordem.setorSolicitante;
  document.getElementById("descricao-servico").value = ordem.descricaoServico;
  document.getElementById("local-servico").value = ordem.localServico;
  document.getElementById("responsavel-execucao").value =
    ordem.responsavelExecucao;
  document.getElementById("responsavel-abertura").value =
    ordem.responsavelAbertura;

  materiais = ordem.materiais || [];
  renderizarMateriais();

  mostrarAlerta("Modo edição ativado.", "Informação");
};

window.fecharModalEncerramento = function () {
  const modal = document.getElementById("modal-encerramento");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  document.getElementById("form-encerramento").reset();
};

document
  .getElementById("form-encerramento")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!osAtual) return;

    const observacao = document.getElementById("observacao-final").value.trim();
    const assinaturaChefia = document
      .getElementById("assinatura-chefia")
      .value.trim();
    const assinaturaRecebedor = document
      .getElementById("assinatura-recebedor")
      .value.trim();
    const dataEncerramento = document.getElementById("data-encerramento").value;

    if (!observacao || !assinaturaChefia || !assinaturaRecebedor) {
      alert("Todos os campos são obrigatórios para encerrar a OS.");
      return;
    }

    await atualizarOrdemFirestore(osAtual.id, {
      status: "Encerrada",
      dataEncerramento: dataEncerramento,
      observacaoFinal: observacao,
      assinaturaChefia: assinaturaChefia,
      assinaturaRecebedor: assinaturaRecebedor,
    });

    ordens = await buscarOrdensFirestore();

    fecharModalEncerramento();
    visualizarOS(osAtual.id);
    atualizarDashboard();
    carregarTabelaDashboard();
    aplicarFiltros();

    mostrarAlerta("Ordem de Serviço encerrada com sucesso!", "Sucesso");
  });

function formatarData(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarDataCompleta(dataISO) {
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

function renderTabelaMateriaisMes(lista) {
  const tbody = document.getElementById("tabela-materiais-mes");

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          Nenhum material utilizado neste período
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista
    .map(
      (m) => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.quantidade}</td>
      <td>${m.unidade}</td>
      <td>${m.os}</td>
    </tr>
  `,
    )
    .join("");
}

window.toggleMenu = function () {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");

  if (!sidebar || !overlay) return;

  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
};

document
  .getElementById("data-abertura")
  ?.addEventListener("change", gerarNumeroOS);

document
  .getElementById("setor-responsavel")
  ?.addEventListener("input", gerarNumeroOS);

function carregarAnoMateriais() {
  const select = document.getElementById("materiais-ano");

  if (!select) return;

  const anoAtual = new Date().getFullYear();

  select.innerHTML = "";

  for (let i = anoAtual; i >= 2026; i--) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;

    select.appendChild(opt);
  }
}

let graficoStatus = null;
let graficoMes = null;

function atualizarGraficos() {
  const abertas = ordens.filter((o) => o.status === "Aberta").length;
  const andamento = ordens.filter((o) => o.status === "Em andamento").length;
  const encerradas = ordens.filter((o) => o.status === "Encerrada").length;

  // STATUS DAS ORDENS
  if (graficoStatus) graficoStatus.destroy();

  graficoStatus = new Chart(document.getElementById("grafico-status"), {
    type: "doughnut",

    data: {
      labels: ["Abertas", "Em andamento", "Encerradas"],
      datasets: [
        {
          data: [abertas, andamento, encerradas],
          backgroundColor: ["#3498db", "#ff9800", "#4caf50"],
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // ORDENS POR MÊS
  let meses = new Array(12).fill(0);

  ordens.forEach((o) => {
    const data = new Date(o.dataAbertura);
    meses[data.getMonth()]++;
  });

  if (graficoMes) graficoMes.destroy();

  graficoMes = new Chart(document.getElementById("grafico-mes"), {
    type: "bar",

    data: {
      labels: [
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
      ],

      datasets: [
        {
          label: "Ordens",
          data: meses,
          backgroundColor: "#3498db",
        },
      ],
    },

    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
}

window.gerarPDFMateriais = function () {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map(
      (m, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${m.nome}</td>
            <td>${m.quantidade || "-"}</td>
            <td>${m.unidade}</td>
        </tr>
    `,
    )
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Materiais - ${osAtual.numero}</title>

        <style>
            @page {
                size: A4 portrait;
                margin: 20mm;
            }

            body {
                font-family: Arial, sans-serif;
                color: #000;
            }

            .header {
                text-align: center;
                margin-bottom: 25px;
            }

            .header img {
                width: 80px;
                margin-bottom: 10px;
            }

            .header h1 {
                font-size: 18px;
                margin: 0;
            }

            .header p {
                font-size: 13px;
                margin: 2px 0;
            }
                td:nth-child(3),
td:nth-child(4),
th:nth-child(3),
th:nth-child(4){
  text-align:center;
}

            .title {
                text-align: center;
                font-size: 16px;
                font-weight: bold;
                margin: 20px 0;
            }

            .info {
                margin-bottom: 20px;
                font-size: 14px;
            }

            table {
                width: 100%;
                border-collapse: collapse;
            }

            th, td {
  border: 1px solid #000;
  padding: 8px;
  font-size: 13px;
}

th{
  background-color:#f2f2f2;
}

/* alinhar colunas */
td:nth-child(3),
td:nth-child(4),
th:nth-child(3),
th:nth-child(4){
  text-align:center;
}

            .footer {
                margin-top: 40px;
                font-size: 12px;
                text-align: right;
            }

        </style>
    </head>

    <body>

        <div class="header">
            <img src="assets/img/prefeitura.png">
            <h1>Prefeitura Municipal de Oriximiná</h1>
            <p>Secretaria de Infraestrutura – SEINFRA</p>
        </div>

        <div class="title">
            RELAÇÃO DE MATERIAIS SOLICITADOS
        </div>

        <div class="info">
            <strong>Número da OS:</strong> ${osAtual.numero}<br>
            <strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}<br>
            <strong>Solicitante:</strong> ${osAtual.nomeSolicitante}<br>
            <strong>Setor:</strong> ${osAtual.setorSolicitante}<br>
            <strong>Local do Serviço:</strong> ${osAtual.localServico}<br>
            <strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao}
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Material</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                </tr>
            </thead>
            <tbody>
                ${lista}
            </tbody>
        </table>

        <div class="footer">
            Documento gerado em: ${dataEmissao}
        </div>

        <script>
            window.onload = function () {
                window.print();
            }
        </script>

    </body>
    </html>
  `);

  w.document.close();
};

window.imprimirDetalhesOS = function () {
  if (!osAtual) return;

  const materiaisHTML =
    osAtual.materiais?.length > 0
      ? osAtual.materiais
          .map(
            (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome}</td>
          <td>${m.quantidade || "-"}</td>
          <td>${m.unidade}</td>
        </tr>
      `,
          )
          .join("")
      : `
        <tr>
          <td colspan="4">Nenhum material informado</td>
        </tr>
      `;

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Ordem de Serviço - ${osAtual.numero}</title>

      <style>
        @page {
          size: A4 portrait;
          margin: 20mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #000;
        }

        .header {
          text-align: center;
          margin-bottom: 25px;
        }

        .header img {
          width: 90px;
          margin-bottom: 10px;
        }

        .header h1 {
          font-size: 18px;
          margin: 0;
        }

        .header p {
          font-size: 13px;
          margin: 2px 0;
        }

        .titulo {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin: 20px 0;
        }

        .secao {
          margin-bottom: 20px;
        }

        .secao h3 {
          font-size: 14px;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
          margin-bottom: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
  border: 1px solid #000;
  padding: 8px;
  font-size: 13px;
}

th {
  background-color: #f2f2f2;
}

/* alinhar colunas da tabela */
td:nth-child(1),
th:nth-child(1){
  text-align:center;
  width:40px;
}

td:nth-child(3),
td:nth-child(4),
th:nth-child(3),
th:nth-child(4){
  text-align:center;
}

        .footer {
          margin-top: 40px;
          font-size: 12px;
          text-align: right;
        }

      </style>
    </head>

    <body>

      <div class="header">
        <img src="assets/img/prefeitura.png">
        <h1>Prefeitura Municipal de Oriximiná</h1>
        <p>Secretaria de Infraestrutura – SEINFRA</p>
      </div>

      <div class="titulo">
        ORDEM DE SERVIÇO
      </div>

      <div class="secao">
        <h3>Informações Gerais</h3>
        <div><strong>Número:</strong> ${osAtual.numero}</div>
        <div><strong>Status:</strong> ${osAtual.status}</div>
        <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
        <div><strong>Data de Encerramento:</strong> ${
          osAtual.dataEncerramento
            ? formatarDataCompleta(osAtual.dataEncerramento)
            : "-"
        }</div>
      </div>

      <div class="secao">
        <h3>Solicitante</h3>
        <div><strong>Nome:</strong> ${osAtual.nomeSolicitante}</div>
        <div><strong>Setor:</strong> ${osAtual.setorSolicitante}</div>
        <div><strong>Setor Responsável:</strong> ${osAtual.setorResponsavel}</div>
      </div>

      <div class="secao">
        <h3>Execução</h3>
        <div><strong>Responsável Execução:</strong> ${osAtual.responsavelExecucao}</div>
        <div><strong>Responsável Abertura:</strong> ${osAtual.responsavelAbertura}</div>
        <div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>
      </div>

      <div class="secao">
        <h3>Descrição do Serviço</h3>
        <div>${osAtual.descricaoServico}</div>
      </div>

      <div class="secao">
        <h3>Materiais Utilizados</h3>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Material</th>
              <th>Quantidade</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            ${materiaisHTML}
          </tbody>
        </table>
      </div>

      <div class="secao">
        <h3>Encerramento</h3>
        <div><strong>Observação Final:</strong> ${osAtual.observacaoFinal || "-"}</div>
        <div><strong>Assinatura Chefia:</strong> ${osAtual.assinaturaChefia || "-"}</div>
        <div><strong>Assinatura Recebedor:</strong> ${osAtual.assinaturaRecebedor || "-"}</div>
      </div>

      <div class="footer">
        Documento gerado em: ${dataEmissao}
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>

    </body>
    </html>
  `);

  w.document.close();
};

window.exportarMateriaisOS = function () {
  if (!osAtual || !osAtual.materiais || osAtual.materiais.length === 0) {
    alert("Esta ordem não possui materiais.");
    return;
  }

  const lista = osAtual.materiais
    .map(
      (m, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${m.nome}</td>
            <td>${m.quantidade}</td>
            <td>${m.unidade}</td>
        </tr>
    `,
    )
    .join("");

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Materiais da ${osAtual.numero}</title>
            <style>
    @page {
        size: A4 portrait;
        margin: 15mm;
    }

    html, body {
        width: 210mm;
        min-height: 297mm;
    }

    body {
        font-family: Arial, sans-serif;
        color: #000;
        margin: 0;
        padding: 0;
    }

    .page {
        width: 100%;
        min-height: 100%;
    }

    .header {
        text-align: center;
        margin-bottom: 20px;
    }

    .header img {
        width: 80px;
        margin-bottom: 10px;
    }

    .header h1 {
        font-size: 18px;
        margin: 0;
    }

    .header p {
        font-size: 13px;
        margin: 2px 0;
    }

    .document-title {
        text-align: center;
        font-size: 16px;
        font-weight: bold;
        margin: 20px 0;
    }

    .info-box {
        margin-bottom: 20px;
        font-size: 14px;
    }

    .info-box div {
        margin-bottom: 6px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    th, td {
        border: 1px solid #000;
        padding: 8px;
        font-size: 13px;
    }

    th {
        background-color: #f2f2f2;
    }

    .footer {
        margin-top: 40px;
        font-size: 12px;
        text-align: right;
    }

    @media print {
        body {
            width: 210mm;
            height: 297mm;
        }
    }
</style>

           
        </head>
        <body>

            <div class="header">
                <img src="assets/img/prefeitura.png" alt="Prefeitura">
                <h1>Prefeitura Municipal de Oriximiná</h1>
                <p>Secretaria de Infraestrutura – SEINFRA</p>
            </div>

            <div class="document-title">
                RELAÇÃO DE MATERIAIS SOLICITADOS
            </div>

            <div class="info-box">
                <div><strong>Número da OS:</strong> ${osAtual.numero}</div>
                <div><strong>Data de Abertura:</strong> ${formatarDataCompleta(osAtual.dataAbertura)}</div>
                <div><strong>Solicitante:</strong> ${osAtual.nomeSolicitante}</div>
                <div><strong>Setor:</strong> ${osAtual.setorSolicitante}</div>
                <div><strong>Local do Serviço:</strong> ${osAtual.localServico}</div>
                <div><strong>Responsável pela Execução:</strong> ${osAtual.responsavelExecucao}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Material</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista}
                </tbody>
            </table>

            <div class="footer">
                Documento gerado em: ${dataEmissao}
            </div>

            <script>
                window.onload = function () {
                    window.print();
                }
            </script>

        </body>
        </html>
    `);

  w.document.close();
};

window.imprimirMateriaisMes = function () {
  const linhas = document.querySelectorAll("#tabela-materiais-mes tr");

  if (!linhas.length) {
    mostrarAlerta("Nenhum material para imprimir.", "Atenção");
    return;
  }

  let conteudoTabela = "";

  linhas.forEach((linha) => {
    const colunas = linha.querySelectorAll("td");

    if (colunas.length >= 3) {
      conteudoTabela += `
        <tr>
          <td>${colunas[0].innerText}</td>
          <td>${colunas[1].innerText}</td>
          <td>${colunas[2].innerText}</td>
        </tr>
      `;
    }
  });

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const w = window.open("", "_blank");

  w.document.write(`
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <title>Relatório de Materiais</title>

      <style>

        @page {
          size: A4 portrait;
          margin: 20mm;
        }

        body {
          font-family: Arial, sans-serif;
        }

        .header {
          text-align:center;
          margin-bottom:25px;
        }

        .header img {
          width:80px;
          margin-bottom:10px;
        }

        .titulo{
          text-align:center;
          font-size:16px;
          font-weight:bold;
          margin:20px 0;
        }

        table{
          width:100%;
          border-collapse:collapse;
        }

        th,td{
          border:1px solid #000;
          padding:8px;
          font-size:13px;
        }

        th{
          background:#f2f2f2;
        }

        .footer{
          margin-top:40px;
          text-align:right;
          font-size:12px;
        }

      </style>

  </head>

  <body>

    <div class="header">
      <img src="assets/img/prefeitura.png">
      <h2>Prefeitura Municipal de Oriximiná</h2>
      <p>Secretaria de Infraestrutura – SEINFRA</p>
    </div>

    <div class="titulo">
      RELATÓRIO DE MATERIAIS UTILIZADOS
    </div>

    <table>

      <thead>
        <tr>
          <th>Material</th>
          <th>Quantidade</th>
          <th>Unidade</th>
        </tr>
      </thead>

      <tbody>
        ${conteudoTabela}
      </tbody>

    </table>

    <div class="footer">
      Documento gerado em: ${dataEmissao}
    </div>

    <script>
      window.onload = function(){
        window.print();
      }
    </script>

  </body>
  </html>
  `);

  w.document.close();
};

window.imprimirRelatorio = function () {

  let linhas = "";

  const dataEmissao = new Date().toLocaleString("pt-BR");

  const dataInicio = document.getElementById("filtro-data-inicio").value;
  const dataFim = document.getElementById("filtro-data-fim").value;
  const mes = document.getElementById("filtro-mes").value;
  const ano = document.getElementById("filtro-ano").value;
  const status = document.getElementById("filtro-status").value;

  let ordensFiltradas = [...ordens];

  if (dataInicio) {
    ordensFiltradas = ordensFiltradas.filter(
      o => new Date(o.dataAbertura) >= new Date(dataInicio)
    );
  }

  if (dataFim) {
    ordensFiltradas = ordensFiltradas.filter(
      o => new Date(o.dataAbertura) <= new Date(dataFim + "T23:59:59")
    );
  }

  if (mes !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      o => new Date(o.dataAbertura).getMonth() === Number(mes)
    );
  }

  if (ano !== "") {
    ordensFiltradas = ordensFiltradas.filter(
      o => new Date(o.dataAbertura).getFullYear() === Number(ano)
    );
  }

  if (status) {
    ordensFiltradas = ordensFiltradas.filter(o => o.status === status);
  }

  ordensFiltradas.forEach(o => {

    linhas += `
      <tr>
        <td>${o.numero}</td>
        <td>${formatarData(o.dataAbertura)}</td>
        <td>${o.status}</td>
        <td>${o.nomeSolicitante}</td>
        <td>${o.setorSolicitante}</td>
        <td>${o.descricaoServico}</td>
      </tr>
    `;
  });

  const w = window.open("", "_blank");

  w.document.write(`
  <html>
  <head>
  <title>Relatório</title>

  <style>

  body{
    font-family: Arial;
  }

  table{
    width:100%;
    border-collapse:collapse;
  }

  th,td{
    border:1px solid #000;
    padding:6px;
    font-size:12px;
    vertical-align:top;
  }

  th{
    background:#f2f2f2;
  }

  td:nth-child(6){
    max-width:300px;
    word-break:break-word;
  }

  </style>

  </head>

  <body>

  <h2>RELATÓRIO DE ORDENS DE SERVIÇO</h2>

  <table>

  <thead>
  <tr>
  <th>Nº OS</th>
  <th>Data</th>
  <th>Status</th>
  <th>Solicitante</th>
  <th>Setor</th>
  <th>Descrição</th>
  </tr>
  </thead>

  <tbody>
  ${linhas}
  </tbody>

  </table>

  <p style="margin-top:20px;font-size:12px;">
  Documento gerado em: ${dataEmissao}
  </p>

  <script>
  window.onload = () => window.print()
  </script>

  </body>
  </html>
  `);

  w.document.close();
};
