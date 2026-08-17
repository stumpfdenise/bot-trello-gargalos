require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const port = 3000;

const key = process.env.TRELLO_KEY;
const token = process.env.TRELLO_TOKEN;
const diasLimite = Number(process.env.DIAS_PARADO);
const limiteCardsEmAndamento = Number(process.env.LIMITE_CARDS_EM_ANDAMENTO);

const boardShortId = "6ox17cAt";
const nomeListaAnalisada = "Em andamento ";

app.use(express.static("."));

async function buscarListasDoQuadro() {
  const url = `https://api.trello.com/1/boards/${boardShortId}/lists`;

  const resposta = await axios.get(url, {
    params: { key, token },
  });

  return resposta.data;
}

async function buscarIdListaEmAndamento() {
  const listas = await buscarListasDoQuadro();
  const lista = listas.find((item) => item.name === nomeListaAnalisada);

  if (!lista) {
    throw new Error(`Lista "${nomeListaAnalisada}" não encontrada.`);
  }

  return lista.id;
}

app.get("/dados", async (req, res) => {
  try {
    const listaEmAndamentoId = await buscarIdListaEmAndamento();

    const url = `https://api.trello.com/1/boards/${boardShortId}/cards`;

    const resposta = await axios.get(url, {
      params: {
        key,
        token,
        fields: "id,name,dateLastActivity,url,idList",
      },
    });

    const cardsEmAndamento = resposta.data.filter(
      (card) => card.idList === listaEmAndamentoId
    );

    const gargalos = cardsEmAndamento
      .map((card) => {
        const ultimaAtividade = new Date(card.dateLastActivity);
        const hoje = new Date();
        const diferencaMs = hoje - ultimaAtividade;
        const diasParado = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

        return {
          id: card.id,
          nome: card.name,
          diasParado,
          url: card.url,
          dateLastActivity: card.dateLastActivity,
        };
      })
      .filter((card) => card.diasParado >= diasLimite);

    res.json({
      totalEmAndamento: cardsEmAndamento.length,
      limiteCardsEmAndamento,
      sobrecarga: cardsEmAndamento.length >= limiteCardsEmAndamento,
      gargalos,
    });
  } catch (erro) {
    res.status(500).json({
      erro: erro.response?.data || erro.message,
    });
  }
});

app.get("/atividade", async (req, res) => {
  try {
    const url = `https://api.trello.com/1/boards/${boardShortId}/actions`;

    const resposta = await axios.get(url, {
      params: {
        key,
        token,
        filter: "createCard,moveCardFromListToList,commentCard,updateCard",
        fields: "type,date,data",
      },
    });

    const atividades = resposta.data
      .map((acao) => {
        const cardName = acao.data?.card?.name || "Cartão";
        const data = acao.date;

        if (acao.type === "moveCardFromListToList") {
          const listaOrigem = acao.data?.listBefore?.name || "lista anterior";
          const listaDestino = acao.data?.listAfter?.name || "lista atual";

          return {
            timestamp: data,
            cardName,
            descricao: `Movido de ${listaOrigem} para ${listaDestino}`,
          };
        }

        if (acao.type === "createCard") {
          return {
            timestamp: data,
            cardName,
            descricao: "Card criado",
          };
        }

        if (acao.type === "commentCard") {
          return {
            timestamp: data,
            cardName,
            descricao: "Comentário adicionado",
          };
        }

        if (acao.type === "updateCard") {
          const listBefore = acao.data?.listBefore?.name;
          const listAfter = acao.data?.listAfter?.name;

          if (listBefore && listAfter) {
            return {
              timestamp: data,
              cardName,
              descricao: `Movido de ${listBefore} para ${listAfter}`,
            };
          }

          if (acao.data?.old?.pos !== undefined && acao.data?.list && !listBefore && !listAfter) {
            return null;
          }

          if (acao.data?.old?.desc !== undefined) {
            return {
              timestamp: data,
              cardName,
              descricao: "Descrição atualizada",
            };
          }

          if (acao.data?.old?.name !== undefined) {
            return {
              timestamp: data,
              cardName,
              descricao: "Card renomeado",
            };
          }

          if (acao.data?.old?.closed !== undefined) {
            const arquivado = Boolean(acao.data?.old?.closed);
            return {
              timestamp: data,
              cardName,
              descricao: arquivado ? "Card arquivado" : "Card reativado",
            };
          }

          return null;
        }

        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 12)
      .reduce((lista, evento) => {
        const chave = `${evento.cardName}|${evento.descricao}|${evento.timestamp}`;

        if (!lista.some((item) => `${item.cardName}|${item.descricao}|${item.timestamp}` === chave)) {
          lista.push(evento);
        }

        return lista;
      }, []);

    res.json({ atividades });
  } catch (erro) {
    res.status(500).json({
      erro: erro.response?.data || erro.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Dashboard rodando em http://localhost:${port}/dashboard.html`);
});