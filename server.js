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
          nome: card.name,
          diasParado,
          url: card.url,
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

app.listen(port, () => {
  console.log(`Dashboard rodando em http://localhost:${port}/dashboard.html`);
});