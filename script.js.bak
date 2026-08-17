async function carregarDados() {

  const resposta = await fetch("/dados");

  const dados = await resposta.json();

  document.getElementById("total-cards").innerText =
    `${dados.totalEmAndamento} tarefas`;

  document.getElementById("total-gargalos").innerText =
    dados.gargalos.length;

  document.getElementById("resumo-em-andamento").innerText =
    dados.totalEmAndamento;

  const statusGeral =
    document.getElementById("status-geral");

  const statusTitulo =
    document.getElementById("status-titulo");

  const statusDescricao =
    document.getElementById("status-descricao");

  const totalGargalos =
    dados.gargalos.length;

  statusGeral.classList.remove(
    "verde",
    "amarelo",
    "vermelho"
  );

  if (totalGargalos === 0) {

    statusGeral.classList.add("verde");

    statusTitulo.innerText =
      "🟢 Fluxo saudável";

    statusDescricao.innerText =
      "Nenhum gargalo foi identificado na lista em andamento.";

  } else if (totalGargalos <= 2) {

    statusGeral.classList.add("amarelo");

    statusTitulo.innerText =
      "🟡 Atenção ao fluxo";

    statusDescricao.innerText =
      "Algumas tarefas podem precisar de acompanhamento.";

  } else {

    statusGeral.classList.add("vermelho");

    statusTitulo.innerText =
      "🔴 Fluxo crítico";

    statusDescricao.innerText =
      "Há múltiplos gargalos identificados. Recomenda-se atenção da equipe.";

  }

  const listaGargalos =
    document.getElementById("lista-gargalos");

  listaGargalos.innerHTML = "";

  dados.gargalos.forEach((gargalo) => {

    listaGargalos.innerHTML += `
      <div class="gargalo-item">

        <div class="gargalo-nome">
          🚨 ${gargalo.nome}
        </div>

        <div class="gargalo-dias">
          ⏱️ ${gargalo.diasParado} dias sem movimentação
<textarea
  class="campo-impedimento"
  id="impedimento-${gargalo.nome}"
  placeholder="Descreva o motivo do bloqueio ou necessidade de reavaliação..."
>${localStorage.getItem(`impedimento-${gargalo.nome}`) || ""}</textarea>

<button
  class="botao-impedimento"
  onclick="salvarImpedimento('${gargalo.nome}')"
>
  💾 Salvar impedimento
</button>

      </div>
    `;

  });

  console.log(JSON.stringify(dados, null, 2));

}

carregarDados();

function salvarImpedimento(nomeCard) {
  const campo = document.getElementById(`impedimento-${nomeCard}`);
  const texto = campo.value;

  localStorage.setItem(`impedimento-${nomeCard}`, texto);

  alert("Impedimento salvo com sucesso!");
}