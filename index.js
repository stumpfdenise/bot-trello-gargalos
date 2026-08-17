require("dotenv").config();
const axios = require("axios");

// Credenciais e configurações carregadas do arquivo .env
const key = process.env.TRELLO_KEY;
const token = process.env.TRELLO_TOKEN;
const diasLimite = Number(process.env.DIAS_PARADO);
const limiteCardsEmAndamento = Number(process.env.LIMITE_CARDS_EM_ANDAMENTO);

// Código curto do quadro Trello usado no projeto
const boardShortId = "6ox17cAt";

// Nome EXATO da lista analisada no Trello
// (com espaço no final porque o Trello criou assim)
const nomeListaAnalisada = "Em andamento ";

// Nome da etiqueta de gargalo
const nomeLabelGargalo = "Possível Gargalo";

/**
 * Busca todas as listas do quadro Trello.
 */
async function buscarListasDoQuadro() {
  const url = `https://api.trello.com/1/boards/${boardShortId}/lists`;

  const resposta = await axios.get(url, {
    params: {
      key,
      token,
    },
  });

  return resposta.data;
}

/**
 * Busca o ID da lista "Em andamento".
 */
async function buscarIdListaEmAndamento() {
  const listas = await buscarListasDoQuadro();

  const lista = listas.find(
    (item) => item.name === nomeListaAnalisada
  );

  if (!lista) {
    throw new Error(
      `Lista "${nomeListaAnalisada}" não encontrada.`
    );
  }

  return lista.id;
}

/**
 * Busca todas as labels do quadro.
 */
async function buscarLabelsDoQuadro() {
  const url = `https://api.trello.com/1/boards/${boardShortId}/labels`;

  const resposta = await axios.get(url, {
    params: {
      key,
      token,
    },
  });

  return resposta.data;
}

/**
 * Busca o ID da label de gargalo.
 */
async function buscarLabelGargalo() {
  const labels = await buscarLabelsDoQuadro();

  const labelGargalo = labels.find(
    (label) => label.name === nomeLabelGargalo
  );

  if (!labelGargalo) {
    throw new Error(
      `Etiqueta "${nomeLabelGargalo}" não encontrada.`
    );
  }

  return labelGargalo.id;
}

/**
 * Adiciona etiqueta ao card.
 */
async function adicionarLabelAoCard(cardId, labelId) {
  const url = `https://api.trello.com/1/cards/${cardId}/idLabels`;

  await axios.post(url, null, {
    params: {
      key,
      token,
      value: labelId,
    },
  });
}

/**
 * Envia comentário automático ao card.
 */
async function comentarNoCard(cardId, mensagem) {
  const url = `https://api.trello.com/1/cards/${cardId}/actions/comments`;

  await axios.post(url, null, {
    params: {
      key,
      token,
      text: mensagem,
    },
  });
}

/**
 * Analisa os cards da lista "Em andamento"
 * e identifica possíveis gargalos.
 */
async function analisarCards() {
  try {
    const listaEmAndamentoId =
      await buscarIdListaEmAndamento();

    const labelGargaloId =
      await buscarLabelGargalo();

    const url = `https://api.trello.com/1/boards/${boardShortId}/cards`;

    const resposta = await axios.get(url, {
      params: {
        key,
        token,
        fields:
          "id,name,dateLastActivity,url,idLabels,idList",
      },
    });

    // Filtra apenas cards da lista "Em andamento"
    const cardsEmAndamento = resposta.data.filter(
      (card) => card.idList === listaEmAndamentoId
    );

    console.log(
      `📋 Analisando somente a lista: ${nomeListaAnalisada}\n`
    );

    console.log(
      `Total de cartões em andamento: ${cardsEmAndamento.length}\n`
    );

    // Analisa possível sobrecarga na lista "Em andamento"
if (cardsEmAndamento.length >= limiteCardsEmAndamento) {
  console.log("⚠️ POSSÍVEL SOBRECARGA IDENTIFICADA!");
  console.log(
    `A lista "${nomeListaAnalisada}" possui ${cardsEmAndamento.length} cartões em andamento.`
  );
  console.log(
    `Limite configurado para análise: ${limiteCardsEmAndamento} cartões.\n`
  );
}

    for (const card of cardsEmAndamento) {
      const ultimaAtividade = new Date(
        card.dateLastActivity
      );

      const hoje = new Date();

      // Calcula diferença em milissegundos
      const diferencaMs = hoje - ultimaAtividade;

      // Converte para dias inteiros
      const diasParado = Math.floor(
        diferencaMs / (1000 * 60 * 60 * 24)
      );

      console.log(`🟢 Cartão: ${card.name}`);
      console.log(
        `Última atividade: ${card.dateLastActivity}`
      );

      console.log(`Dias parado: ${diasParado}`);

      // Verifica possível gargalo
      if (diasParado >= diasLimite) {
        console.log(
          "⚠️ POSSÍVEL GARGALO IDENTIFICADO!"
        );

        const mensagem =
          `🤖 Bot Gargalos: este card está parado há ${diasParado} dias na lista "${nomeListaAnalisada}". Possível gargalo identificado.`;

        // Envia comentário automático
        // Verifica se já existe comentário do bot para evitar duplicidade
const jaTemComentarioDoBot = await cardJaPossuiComentarioDoBot(card.id);

if (!jaTemComentarioDoBot) {
  await comentarNoCard(card.id, mensagem);
  console.log("💬 Comentário automático enviado ao card!");
} else {
  console.log("💬 O card já possui comentário do bot.");
}

        // Verifica se já possui a etiqueta
        const jaTemLabel =
          card.idLabels.includes(labelGargaloId);

        if (!jaTemLabel) {
          // Adiciona etiqueta visual
          await adicionarLabelAoCard(
            card.id,
            labelGargaloId
          );

          console.log(
            "🏷️ Etiqueta de gargalo adicionada ao card!"
          );
        } else {
          console.log(
            "🏷️ O card já possui a etiqueta de gargalo."
          );
        }

        console.log(
          "✅ Alerta registrado no Trello!"
        );
      }

      console.log("\n");
    }
  } catch (erro) {
    console.error(
      "❌ Erro:",
      erro.response?.data || erro.message
    );
  }
}

/**
 * Verifica se o card já possui um comentário enviado pelo Bot Gargalos.
 * Isso evita que o sistema gere comentários duplicados sempre que for executado.
 */
async function cardJaPossuiComentarioDoBot(cardId) {
  const url = `https://api.trello.com/1/cards/${cardId}/actions`;

  const resposta = await axios.get(url, {
    params: {
      key,
      token,
      filter: "commentCard",
    },
  });

  return resposta.data.some((acao) =>
    acao.data?.text?.includes("🤖 Bot Gargalos")
  );
}

/**
 * Remove etiqueta do card.
 */
async function removerLabelDoCard(cardId, labelId) {
  const url = `https://api.trello.com/1/cards/${cardId}/idLabels/${labelId}`;

  await axios.delete(url, {
    params: {
      key,
      token,
    },
  });
}

/**
 * Verifica e corrige etiquetas de gargalo.
 * Remove a etiqueta "Possível Gargalo" de cards que:
 * - não estão mais na lista "Em andamento"
 * - ou já não atendem ao critério de dias parado
 */
async function verificarECorrigirEtiquetasGargalo() {
  try {
    const listaEmAndamentoId = await buscarIdListaEmAndamento();
    const labelGargaloId = await buscarLabelGargalo();

    const url = `https://api.trello.com/1/boards/${boardShortId}/cards`;

    const resposta = await axios.get(url, {
      params: {
        key,
        token,
        fields: "id,name,dateLastActivity,idLabels,idList",
      },
    });

    // Todos os cards do quadro
    const todosOsCards = resposta.data;

    for (const card of todosOsCards) {
      const possuidEtiquetaGargalo = card.idLabels.includes(labelGargaloId);

      if (!possuidEtiquetaGargalo) {
        // Card não possui etiqueta, nada a fazer
        continue;
      }

      // Card possui etiqueta, verificar se deve ser removida
      const estaEmAndamento = card.idList === listaEmAndamentoId;

      if (!estaEmAndamento) {
        // Etiqueta deve ser removida porque card não está mais em "Em andamento"
        await removerLabelDoCard(card.id, labelGargaloId);
        console.log(
          `🔄 Etiqueta removida: ${card.name} não está mais em "Em andamento".`
        );
        continue;
      }

      // Card está em "Em andamento", verificar se ainda atende ao critério
      const ultimaAtividade = new Date(card.dateLastActivity);
      const hoje = new Date();
      const diferencaMs = hoje - ultimaAtividade;
      const diasParado = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

      if (diasParado < diasLimite) {
        // Card deixou de atender ao critério, remover etiqueta
        await removerLabelDoCard(card.id, labelGargaloId);
        console.log(
          `🔄 Etiqueta removida: ${card.name} não está mais em gargalo (${diasParado} dias).`
        );
      }
    }
  } catch (erro) {
    console.error(
      "❌ Erro ao verificar/corrigir etiquetas:",
      erro.response?.data || erro.message
    );
  }
}

analisarCards();
verificarECorrigirEtiquetasGargalo();