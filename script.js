/**
 * FlowGuard - Dashboard de Monitoramento de Gargalos
 * Script de carregamento e renderização de dados
 */

const impedimentosSalvosComCampoLimpo = new Set();

async function carregarDados() {
  try {
    const [respostaDados, respostaAtividade] = await Promise.all([
      fetch("/dados"),
      fetch("/atividade").catch(() => ({ ok: false }))
    ]);

    if (!respostaDados.ok) {
      throw new Error(`Erro ${respostaDados.status}: ${respostaDados.statusText}`);
    }

    const dados = await respostaDados.json();

    if (!dados || typeof dados !== 'object') {
      throw new Error("Resposta do servidor inválida: estrutura inesperada");
    }

    if (!Array.isArray(dados.gargalos)) {
      throw new Error("Resposta do servidor inválida: 'gargalos' não é um array");
    }

    if (typeof dados.totalEmAndamento !== 'number') {
      throw new Error("Resposta do servidor inválida: 'totalEmAndamento' não é um número");
    }

    document.getElementById("total-cards").innerText =
      `${dados.totalEmAndamento} tarefas`;

    document.getElementById("total-gargalos").innerText =
      dados.gargalos.length;

    document.getElementById("resumo-em-andamento").innerText =
      dados.totalEmAndamento;

    atualizarStatusGeral(dados);
    renderizarGargalos(dados.gargalos);
    renderizarCentralImpedimentos(dados.gargalos);

    const atividade = respostaAtividade.ok
      ? await respostaAtividade.json()
      : { atividades: [] };

    const atividadesDoSistema = [...(atividade.atividades || [])];
    const atividadesLocalStorage = obterAtividadesImpedimentos();
    const atividadesAgrupadas = [...atividadesDoSistema, ...atividadesLocalStorage]
      .filter((item) => item && item.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    renderizarAtividade(atividadesAgrupadas);

    console.log("✓ Dashboard atualizada com sucesso", dados, atividade);

  } catch (erro) {
    console.error("✗ Erro ao carregar dados:", erro.message);

    const listaGargalos = document.getElementById("lista-gargalos");
    listaGargalos.innerHTML = `
      <div class="empty-state">
        Erro ao carregar dados: ${erro.message}
      </div>
    `;
    renderizarAtividade([]);
  }
}

/**
 * Atualiza o status geral do fluxo
 */
function atualizarStatusGeral(dados) {
  const statusGeral = document.getElementById("status-geral");
  const statusTitulo = document.getElementById("status-titulo");
  const statusDescricao = document.getElementById("status-descricao");

  const totalGargalos = dados.gargalos ? dados.gargalos.length : 0;
  const sobrecargaWIP = dados.sobrecarga || false;
  const totalEmAndamento = dados.totalEmAndamento || 0;
  const limiteCardsEmAndamento = dados.limiteCardsEmAndamento || 0;
  const wipNoLimite = totalEmAndamento === limiteCardsEmAndamento;

  // Remover classes anteriores
  statusGeral.classList.remove("verde", "amarelo", "vermelho");

  // Determinar status baseado em gargalos E sobrecarga de WIP
  let status = "verde";
  let titulo = "SAUDÁVEL";
  let descricao = "Nenhum gargalo foi identificado na lista em andamento.";

  // Verificar se há gargalos
  if (totalGargalos > 0) {
    if (totalGargalos > 2) {
      status = "vermelho";
      titulo = "ATENÇÃO";

      if (sobrecargaWIP) {
        descricao = `Há múltiplos gargalos identificados (${totalGargalos}). Limite de trabalho em andamento excedido: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas. Atenção da equipe necessária.`;
      } else if (wipNoLimite) {
        descricao = `Há múltiplos gargalos identificados (${totalGargalos}). WIP no limite: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas.`;
      } else {
        descricao = "Há múltiplos gargalos identificados. Recomenda-se atenção da equipe.";
      }
    } else {
      status = "amarelo";
      titulo = "ATENÇÃO";

      if (sobrecargaWIP) {
        descricao = `Algumas tarefas podem precisar de acompanhamento. Limite de trabalho em andamento excedido: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas.`;
      } else if (wipNoLimite) {
        descricao = `Algumas tarefas podem precisar de acompanhamento. WIP no limite: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas.`;
      } else {
        descricao = "Algumas tarefas podem precisar de acompanhamento.";
      }
    }
  } else if (sobrecargaWIP) {
    // Sem gargalos por tempo, mas com WIP excedido
    status = "amarelo";
    titulo = "ATENÇÃO";
    descricao = `Limite de trabalho em andamento excedido: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas.`;
  } else if (wipNoLimite) {
    status = "verde";
    titulo = "SAUDÁVEL";
    descricao = `WIP no limite: ${totalEmAndamento} de ${limiteCardsEmAndamento} tarefas.`;
  }

  statusGeral.classList.add(status);
  statusTitulo.innerText = titulo;
  statusDescricao.innerText = descricao;
}

/**
 * Renderiza a lista de gargalos identificados
 */
function renderizarGargalos(gargalos) {
  const listaGargalos = document.getElementById("lista-gargalos");

  // Limpar conteúdo anterior
  listaGargalos.innerHTML = "";

  // Verificar se há gargalos
  if (!gargalos || gargalos.length === 0) {
    listaGargalos.innerHTML = `
      <div class="empty-state">
        Nenhum gargalo identificado. Fluxo saudável.
      </div>
    `;
    return;
  }

  // Renderizar cada gargalo
  gargalos.forEach((gargalo) => {
    const textoImpedimento = obterTextoImpedimento(gargalo);
    const urlLink = gargalo.url
      ? `<a class="gargalo-link" href="${gargalo.url}" target="_blank" rel="noopener noreferrer">Ver no Trello</a>`
      : "";

    const dataUltimaAtividade = gargalo.dateLastActivity
      ? new Date(gargalo.dateLastActivity).toLocaleDateString("pt-BR")
      : "Data indisponível";

    const html = `
      <div class="gargalo-item">
        <div class="gargalo-nome">${gargalo.nome}</div>

        <div class="gargalo-meta">
          <div class="gargalo-dias">
            ${gargalo.diasParado} dias sem atividade
          </div>
          ${urlLink}
        </div>

        <div class="gargalo-ultima-atividade">
          Última atividade: ${dataUltimaAtividade}
        </div>

        <textarea
          class="campo-impedimento"
          id="impedimento-${gargalo.nome}"
          data-card-id="${gargalo.id || ""}"
          data-card-name="${gargalo.nome}"
          placeholder="Descreva o motivo do bloqueio ou necessidade de reavaliação..."
        >${textoImpedimento}</textarea>

        <button
          class="botao-impedimento"
          onclick="salvarImpedimento('${gargalo.nome}')"
        >
          Salvar impedimento
        </button>
      </div>
    `;

    listaGargalos.innerHTML += html;
  });
}

function obterTextoImpedimento(gargalo) {
  const chaveCampo = gargalo.id
    ? `id:${gargalo.id}`
    : `nome:${gargalo.nome}`;

  if (impedimentosSalvosComCampoLimpo.has(chaveCampo)) {
    return "";
  }

  if (gargalo.id) {
    const valorPorId = localStorage.getItem(`impedimento-id-${gargalo.id}`);

    if (valorPorId) {
      try {
        const dados = JSON.parse(valorPorId);
        if (dados && typeof dados.texto === "string" && dados.texto.trim()) {
          return dados.texto;
        }
      } catch (erro) {
        console.warn("Registro de impedimento por ID inválido:", gargalo.id);
      }
    }
  }

  return localStorage.getItem(`impedimento-${gargalo.nome}`) || "";
}

/**
 * Renderiza a central de impedimentos com todos os registros do localStorage
 */
function renderizarCentralImpedimentos(gargalos) {
  const centralImpedimentos = document.getElementById("central-impedimentos");

  const impedimentosMap = new Map();
  const tarefasComRegistroPorId = new Set();
  const nomesPorId = new Map((gargalos || [])
    .filter((gargalo) => gargalo && gargalo.id && gargalo.nome)
    .map((gargalo) => [String(gargalo.id), gargalo.nome]));
  const chavesArmazenamento = Object.keys(localStorage)
    .filter((chave) => chave.startsWith("impedimento-"))
    .sort((a, b) => {
      const registroPorIdA = a.startsWith("impedimento-id-");
      const registroPorIdB = b.startsWith("impedimento-id-");
      return Number(registroPorIdB) - Number(registroPorIdA);
    });

  chavesArmazenamento.forEach((chave) => {
    const valor = localStorage.getItem(chave);

    if (!valor || !valor.trim()) {
      return;
    }

    let registro = null;

    if (chave.startsWith("impedimento-id-")) {
      try {
        const dados = JSON.parse(valor);

        if (dados && dados.texto && dados.texto.trim()) {
          registro = {
            tarefa: dados.cardName || nomesPorId.get(String(dados.cardId)) || chave.replace("impedimento-id-", ""),
            texto: dados.texto,
            diasParado: dados.diasParado || null,
            cardId: dados.cardId || "",
            salvoEm: dados.salvoEm || null,
            atualizadoEm: dados.atualizadoEm || null,
          };
        }
      } catch (erro) {
        console.warn("Registro de impedimento em formato antigo ou inválido:", chave);
      }
    }

    if (!registro) {
      const nomeTarefa = chave.replace("impedimento-", "");
      registro = {
        tarefa: nomeTarefa,
        texto: valor.trim(),
        diasParado: null,
        cardId: "",
        salvoEm: null,
        atualizadoEm: null,
      };
    }

    const registroPorId = Boolean(registro.cardId);
    const chaveUnica = registroPorId
      ? `id:${registro.cardId}`
      : `nome:${registro.tarefa}`;

    if (registroPorId) {
      tarefasComRegistroPorId.add(registro.tarefa);
    } else if (tarefasComRegistroPorId.has(registro.tarefa)) {
      return;
    }

    if (!impedimentosMap.has(chaveUnica)) {
      impedimentosMap.set(chaveUnica, registro);
    }
  });

  const impedimentos = Array.from(impedimentosMap.values())
    .sort((a, b) => {
      const dataA = new Date(a.atualizadoEm || a.salvoEm || 0).getTime();
      const dataB = new Date(b.atualizadoEm || b.salvoEm || 0).getTime();
      return dataB - dataA;
    });

  centralImpedimentos.innerHTML = "";

  if (impedimentos.length === 0) {
    centralImpedimentos.innerHTML = `
      <div class="empty-state">
        Nenhum impedimento registrado.
      </div>
    `;
    return;
  }

  impedimentos.forEach((impedimento) => {
    const badgeTexto = impedimento.diasParado !== null
      ? `Parada por ${impedimento.diasParado} dias`
      : "Registro de impedimento";

    let dataTexto = "";
    if (impedimento.atualizadoEm) {
      const dataFormatada = formatarDataHora(impedimento.atualizadoEm);
      if (dataFormatada) {
        dataTexto = `<div class="impedimento-data">Atualizado em: ${dataFormatada}</div>`;
      }
    } else if (impedimento.salvoEm) {
      const dataFormatada = formatarDataHora(impedimento.salvoEm);
      if (dataFormatada) {
        dataTexto = `<div class="impedimento-data">Registrado em: ${dataFormatada}</div>`;
      }
    }

    const cardId = impedimento.cardId ? impedimento.cardId : "";
    const chaveEdicao = cardId ? `id:${cardId}` : `nome:${impedimento.tarefa}`;

    const html = `
      <div class="impedimento-card" data-chave-edicao="${chaveEdicao}">
        <div class="impedimento-titulo">${escapeHtml(impedimento.tarefa)}</div>
        <div class="impedimento-status">
          ${badgeTexto}
        </div>
        <div class="impedimento-texto">
          ${escapeHtml(impedimento.texto)}
        </div>
        ${dataTexto}
        <div class="impedimento-acoes">
          <button class="botao-editar-impedimento" onclick="iniciarEdicaoImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Editar</button>
          <button class="botao-resolver-impedimento" onclick="resolverImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Resolver</button>
        </div>
      </div>
    `;

    centralImpedimentos.innerHTML += html;
  });
}

function obterAtividadesImpedimentos() {
  const eventos = [];

  Object.keys(localStorage).forEach((chave) => {
    if (!chave.startsWith("impedimento-id-")) {
      return;
    }

    try {
      const valor = localStorage.getItem(chave);
      const dados = JSON.parse(valor);

      if (!dados || !dados.texto) {
        return;
      }

      const timestamp = dados.atualizadoEm || dados.salvoEm;
      if (!timestamp) {
        return;
      }

      eventos.push({
        timestamp,
        cardName: dados.cardName || "Cartão",
        descricao: "impedimento registrado no FlowGuard",
      });
    } catch (erro) {
      console.warn("Evento de impedimento inválido em localStorage:", chave);
    }
  });

  return eventos;
}

/**
 * Inicia a edição de um impedimento
 */
function iniciarEdicaoImpedimento(button) {
  const card = button.closest("[data-chave-edicao]");
  if (!card) return;

  const textoDiv = card.querySelector(".impedimento-texto");
  const textoAtual = textoDiv.textContent.trim();
  const botoesDiv = card.querySelector(".impedimento-acoes");

  const textarea = document.createElement("textarea");
  textarea.className = "campo-impedimento-edicao";
  textarea.value = textoAtual;
  textarea.style.display = "block";
  textarea.style.width = "100%";
  textarea.style.minHeight = "80px";
  textarea.style.marginBottom = "10px";
  textarea.style.padding = "8px";
  textarea.style.fontFamily = "inherit";
  textarea.style.fontSize = "inherit";
  textarea.style.borderRadius = "4px";
  textarea.style.border = "1px solid #ccc";

  textoDiv.style.display = "none";
  textoDiv.parentNode.insertBefore(textarea, textoDiv);

  botoesDiv.innerHTML = `
    <button class="botao-salvar-edicao" onclick="salvarEdicaoImpedimento(this)" style="background: #2d7a3e; border: none; color: white; cursor: pointer; padding: 6px 12px; border-radius: 4px; margin-right: 8px; font-size: 0.9em;">Salvar alteração</button>
    <button class="botao-cancelar-edicao" onclick="cancelarEdicaoImpedimento(this)" style="background: #666; border: none; color: white; cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 0.9em;">Cancelar</button>
  `;

  textarea.focus();
}

/**
 * Cancela a edição de um impedimento
 */
function cancelarEdicaoImpedimento(button) {
  const card = button.closest("[data-chave-edicao]");
  if (!card) return;

  const textarea = card.querySelector(".campo-impedimento-edicao");
  const textoDiv = card.querySelector(".impedimento-texto");
  const botoesDiv = card.querySelector(".impedimento-acoes");

  if (textarea) {
    textarea.remove();
  }
  textoDiv.style.display = "block";
  botoesDiv.innerHTML = `
    <button class="botao-editar-impedimento" onclick="iniciarEdicaoImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Editar</button>
    <button class="botao-resolver-impedimento" onclick="resolverImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Resolver</button>
  `;
}

function resolverImpedimento(button) {
  const card = button.closest("[data-chave-edicao]");
  if (!card) return;

  const chaveEdicao = card.dataset.chaveEdicao;
  const nomeTarefa = card.querySelector(".impedimento-titulo")?.textContent.trim();

  if (chaveEdicao.startsWith("id:")) {
    const cardId = chaveEdicao.substring(3);
    const chavePorId = `impedimento-id-${cardId}`;
    const valorPorId = localStorage.getItem(chavePorId);
    let nomeRegistro = nomeTarefa;

    if (valorPorId) {
      try {
        const dados = JSON.parse(valorPorId);
        nomeRegistro = dados.cardName || nomeRegistro;
      } catch (erro) {
        console.warn("Registro de impedimento por ID inválido ao resolver:", cardId);
      }
    }

    localStorage.removeItem(chavePorId);
    if (nomeRegistro) {
      localStorage.removeItem(`impedimento-${nomeRegistro}`);
    }
  } else if (chaveEdicao.startsWith("nome:")) {
    localStorage.removeItem(`impedimento-${chaveEdicao.substring(5)}`);
  }

  renderizarCentralImpedimentos([]);
}

/**
 * Salva a edição de um impedimento
 */
function salvarEdicaoImpedimento(button) {
  const card = button.closest("[data-chave-edicao]");
  if (!card) return;

  const chaveEdicao = card.dataset.chaveEdicao;
  const textarea = card.querySelector(".campo-impedimento-edicao");
  const textoNovo = textarea.value.trim();

  if (!textoNovo) {
    alert("Por favor, digite o impedimento antes de salvar.");
    return;
  }

  let cardId = "";
  let nomeTarefa = "";

  if (chaveEdicao.startsWith("id:")) {
    cardId = chaveEdicao.substring(3);
  } else if (chaveEdicao.startsWith("nome:")) {
    nomeTarefa = chaveEdicao.substring(5);
  }

  if (cardId) {
    const chaveArmazenamento = `impedimento-id-${cardId}`;
    const valorArmazenado = localStorage.getItem(chaveArmazenamento);
    
    try {
      const dados = JSON.parse(valorArmazenado) || {};
      dados.texto = textoNovo;
      dados.atualizadoEm = new Date().toISOString();
      localStorage.setItem(chaveArmazenamento, JSON.stringify(dados));
    } catch (erro) {
      console.error("Erro ao atualizar impedimento:", erro);
      alert("Erro ao salvar edição.");
      return;
    }
  } else if (nomeTarefa) {
    const chaveArmazenamento = `impedimento-${nomeTarefa}`;
    localStorage.setItem(chaveArmazenamento, textoNovo);
  }

  const textoDiv = card.querySelector(".impedimento-texto");
  const botoesDiv = card.querySelector(".impedimento-acoes");

  textarea.remove();
  textoDiv.textContent = textoNovo;
  textoDiv.style.display = "block";
  botoesDiv.innerHTML = `
    <button class="botao-editar-impedimento" onclick="iniciarEdicaoImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Editar</button>
    <button class="botao-resolver-impedimento" onclick="resolverImpedimento(this)" style="background: none; border: none; color: #0066cc; cursor: pointer; font-size: 0.9em; text-decoration: underline; padding: 0; margin-top: 8px;">Resolver</button>
  `;

  if (cardId) {
    const chaveArmazenamento = `impedimento-id-${cardId}`;
    const valorArmazenado = localStorage.getItem(chaveArmazenamento);
    try {
      const dados = JSON.parse(valorArmazenado);
      const dataFormatada = formatarDataHora(dados.atualizadoEm);
      if (dataFormatada) {
        const dataDiv = card.querySelector(".impedimento-data") || document.createElement("div");
        dataDiv.className = "impedimento-data";
        dataDiv.textContent = `Atualizado em: ${dataFormatada}`;
        if (!card.querySelector(".impedimento-data")) {
          card.appendChild(dataDiv);
        }
      }
    } catch (erro) {
      console.error("Erro ao recuperar dados de atualização:", erro);
    }
  }

  alert("Impedimento atualizado com sucesso!");
}

function escapeHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formata data/hora no padrão DD/MM/AAAA HH:mm
 */
function formatarDataHora(dataString) {
  try {
    const data = new Date(dataString);
    if (Number.isNaN(data.getTime())) {
      return null;
    }
    return data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (erro) {
    return null;
  }
}

function renderizarAtividade(atividades) {
  const container = document.getElementById("atividade-recente");

  if (!container) {
    return;
  }

  if (!Array.isArray(atividades) || atividades.length === 0) {
    container.className = "activity-empty-state empty-state";
    container.textContent = "Nenhuma atividade recente disponível no momento.";
    return;
  }

  const eventos = [...atividades]
    .filter((item) => item && item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  if (eventos.length === 0) {
    container.className = "activity-empty-state empty-state";
    container.textContent = "Nenhuma atividade recente disponível no momento.";
    return;
  }

  container.className = "activity-list";

  const html = eventos.map((evento) => {
    const data = new Date(evento.timestamp);
    const dataFormatada = Number.isNaN(data.getTime())
      ? "Data indisponível"
      : data.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

    return `
      <div class="activity-item">
        <div class="activity-time">${escapeHtml(dataFormatada)}</div>
        <div class="activity-text">
          <strong>${escapeHtml(evento.cardName || "Cartão")}</strong>
          <span> — ${escapeHtml(evento.descricao || "atividade registrada")}</span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

/**
 * Salva impedimento no localStorage
 */
function salvarImpedimento(nomeCard) {
  const campo = document.getElementById(`impedimento-${nomeCard}`);

  if (!campo) {
    console.error(`Campo de impedimento não encontrado: ${nomeCard}`);
    alert("Erro ao salvar impedimento. Tente novamente.");
    return;
  }

  const texto = campo.value.trim();

  if (!texto) {
    alert("Por favor, descreva o impedimento antes de salvar.");
    return;
  }

  const cardId = campo.dataset.cardId || "";
  const chaveLegada = `impedimento-${nomeCard}`;
  const agora = new Date().toISOString();

  if (cardId) {
    const chaveArmazenamento = `impedimento-id-${cardId}`;
    const registroExistente = localStorage.getItem(chaveArmazenamento);
    let dadosRegistro;

    if (registroExistente) {
      try {
        dadosRegistro = JSON.parse(registroExistente);
        dadosRegistro.texto = texto;
        dadosRegistro.atualizadoEm = agora;
      } catch (erro) {
        dadosRegistro = {
          cardId,
          cardName: nomeCard,
          texto,
          diasParado: null,
          salvoEm: agora,
          atualizadoEm: null,
        };
      }
    } else {
      dadosRegistro = {
        cardId,
        cardName: nomeCard,
        texto,
        diasParado: null,
        salvoEm: agora,
        atualizadoEm: null,
      };
    }

    localStorage.setItem(chaveArmazenamento, JSON.stringify(dadosRegistro));
  } else {
    localStorage.setItem(chaveLegada, texto);
  }

  impedimentosSalvosComCampoLimpo.add(cardId ? `id:${cardId}` : `nome:${nomeCard}`);
  campo.value = "";

  const resposta = fetch("/dados")
    .then(r => r.json())
    .then(dados => {
      if (Array.isArray(dados.gargalos)) {
        renderizarCentralImpedimentos(dados.gargalos);
      }
      const campoAtual = document.getElementById(`impedimento-${nomeCard}`);
      if (campoAtual) {
        campoAtual.value = "";
      }
    })
    .catch(erro => console.error("Erro ao atualizar central:", erro));

  alert("Impedimento salvo com sucesso!");
}

// Carregar dados ao iniciar a página
carregarDados();

document.addEventListener("DOMContentLoaded", () => {
  const botaoAtualizar = Array.from(document.querySelectorAll("button"))
    .find((botao) => botao.textContent.trim().toLowerCase().includes("atualizar"));

  if (!botaoAtualizar) {
    console.warn('Botão "Atualizar" não encontrado no dashboard.');
    return;
  }

  const textoOriginal = botaoAtualizar.textContent.trim() || "Atualizar";

  botaoAtualizar.addEventListener("click", async () => {
    if (botaoAtualizar.disabled) return;

    botaoAtualizar.disabled = true;
    botaoAtualizar.textContent = "Atualizando...";

    await carregarDados();

    botaoAtualizar.textContent = "Atualizado ✓";

    setTimeout(() => {
      botaoAtualizar.textContent = textoOriginal;
      botaoAtualizar.disabled = false;
    }, 1200);
  });
});
