const axios = require("axios");

const key = process.env.TRELLO_KEY;
const token = process.env.TRELLO_TOKEN;
const nomeLabelGargalo = "Possível Gargalo";
const marcasComentarioBot = [
  "🤖 Bot Gargalos",
  "🤖 FlowGuard",
];
const limitePorPagina = 1000;

function comentarioEhDoFlowGuard(texto) {
  return marcasComentarioBot.some((marca) => texto?.includes(marca));
}

function acaoEhAutomacaoDoFlowGuard(acao) {
  if (acao.type === "commentCard") {
    return comentarioEhDoFlowGuard(acao.data?.text);
  }

  if (acao.type === "addLabelToCard" || acao.type === "removeLabelFromCard") {
    return acao.data?.label?.name === nomeLabelGargalo;
  }

  return false;
}

async function buscarAcoesDoCartao(cardId) {
  const url = `https://api.trello.com/1/cards/${cardId}/actions`;
  const acoes = [];
  let pagina = 0;

  while (true) {
    const resposta = await axios.get(url, {
      params: {
        key,
        token,
        filter: "all",
        fields: "type,date,data,idMemberCreator",
        limit: limitePorPagina,
        page: pagina,
      },
    });

    const acoesDaPagina = Array.isArray(resposta.data) ? resposta.data : [];
    acoes.push(...acoesDaPagina);

    if (acoesDaPagina.length < limitePorPagina) {
      break;
    }

    pagina += 1;
  }

  return acoes;
}

async function obterUltimaAtividadeRelevante(cardId, fallbackDate) {
  const acoes = await buscarAcoesDoCartao(cardId);
  const acoesRelevantes = acoes.filter(
    (acao) => !acaoEhAutomacaoDoFlowGuard(acao)
  );

  const datasValidas = acoesRelevantes
    .map((acao) => new Date(acao.date))
    .filter((data) => !Number.isNaN(data.getTime()));

  if (datasValidas.length > 0) {
    return new Date(Math.max(...datasValidas)).toISOString();
  }

  // Preserva o valor fornecido pelo Trello quando não há action utilizável.
  return fallbackDate;
}

module.exports = {
  buscarAcoesDoCartao,
  comentarioEhDoFlowGuard,
  obterUltimaAtividadeRelevante,
};
