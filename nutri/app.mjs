import {
  ATIVIDADE,
  cunningham,
  densidadeDurnin,
  densidadePollock3,
  densidadePollock7,
  distribuicao,
  faulkner,
  harrisBenedict,
  imc,
  massaGorda,
  massaMagra,
  mifflin,
  porGramas,
  porQuilo,
  siri,
  somar,
} from "./calculos.mjs";

/**
 * A tela da bancada. Só amarra campo em conta: quem calcula é
 * `calculos.mjs`, que é testado. Aqui não mora nenhuma fórmula.
 */

const $ = (id) => document.getElementById(id);
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const mostrar = (v, casas = 1, sufixo = "") =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) +
      sufixo;

// ---------------------------------------------------------------------------
// A tabela
// ---------------------------------------------------------------------------

/** Posição de cada nutriente no vetor compacto do arquivo. */
let TACO = null;
let POS = {};

async function carregarTaco() {
  const resposta = await fetch("./dados/taco.json");
  TACO = await resposta.json();
  TACO.nutrientes.forEach((chave, i) => (POS[chave] = i));
  $("fonte-taco").textContent =
    `${TACO.alimentos.length} alimentos da ${TACO.nome} (${TACO.instituicao}), por ${TACO.base}. ` +
    `Valores sem dado aparecem como “—” e não entram como zero na soma.`;
}

/**
 * O valor de um nutriente naquele alimento, ou null.
 *
 * Traço e "sem dado" voltam null de propósito: na TACO eles não são zero, e
 * tratá-los como zero mudaria a conta de sódio, ferro e colesterol de
 * centenas de alimentos.
 */
function valorDe(alimento, chave) {
  const pos = POS[chave];
  if (pos === undefined) return null;
  const achado = alimento.v.find(([p]) => p === pos);
  return achado ? achado[1] : null;
}

function buscar(termo) {
  const limpo = termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (limpo.length < 2 || !TACO) return [];
  const palavras = limpo.split(/\s+/);
  return TACO.alimentos
    .filter((a) => palavras.every((p) => a.b.includes(p)))
    .slice(0, 40);
}

// ---------------------------------------------------------------------------
// Dieta
// ---------------------------------------------------------------------------

const CHAVE_DIETA = "nutri:dieta:v1";
let dieta = { nome: "", peso: "", meta: "", refeicoes: [] };

function guardarDieta() {
  try {
    localStorage.setItem(CHAVE_DIETA, JSON.stringify(dieta));
  } catch {
    /* navegador sem armazenamento: a conta continua funcionando na tela */
  }
}

function lerDieta() {
  try {
    const guardado = localStorage.getItem(CHAVE_DIETA);
    if (guardado) dieta = JSON.parse(guardado);
  } catch {
    /* ignora */
  }
  if (!dieta.refeicoes?.length) {
    dieta.refeicoes = [{ nome: "Café da manhã", itens: [] }];
  }
}

const MACROS = [
  ["energia_kcal", "kcal", 0],
  ["carboidrato", "CHO", 1],
  ["proteina", "PTN", 1],
  ["lipideos", "LIP", 1],
  ["fibra_alimentar", "Fibra", 1],
];

function desenharDieta() {
  const caixa = $("refeicoes");
  caixa.innerHTML = "";

  dieta.refeicoes.forEach((refeicao, iR) => {
    const bloco = document.createElement("div");
    bloco.className = "refeicao";

    const topo = document.createElement("div");
    topo.className = "refeicao-topo";
    const nome = document.createElement("input");
    nome.value = refeicao.nome;
    nome.oninput = () => {
      refeicao.nome = nome.value;
      guardarDieta();
    };
    const remover = document.createElement("button");
    remover.className = "mini";
    remover.textContent = "remover refeição";
    remover.onclick = () => {
      dieta.refeicoes.splice(iR, 1);
      guardarDieta();
      desenharDieta();
    };
    topo.append(nome, remover);
    bloco.append(topo);

    if (refeicao.itens.length) {
      const tabela = document.createElement("table");
      tabela.innerHTML =
        "<thead><tr><th>Alimento</th><th>g</th>" +
        MACROS.map(([, r]) => `<th>${r}</th>`).join("") +
        "<th></th></tr></thead>";
      const corpo = document.createElement("tbody");

      // As células ficam guardadas para serem reescritas quando ela mexe nas
      // gramas. Redesenhar a tabela inteira a cada tecla tiraria o cursor do
      // campo no meio do número — e foi assim que a primeira versão saiu:
      // o total do dia mudava e a linha do alimento ficava parada.
      const celulas = [];
      const rodapeCelulas = [];

      const recalcular = () => {
        refeicao.itens.forEach((item, iI) => {
          const a = TACO.alimentos.find((x) => x.c === item.codigo);
          MACROS.forEach(([chave, , casas], iM) => {
            const v = a ? porGramas(valorDe(a, chave), item.gramas) : null;
            const td = celulas[iI]?.[iM];
            if (td) {
              td.textContent = mostrar(v, casas);
              td.title = v === null ? "A tabela não traz este valor para este alimento." : "";
            }
          });
        });
        MACROS.forEach(([chave, , casas], iM) => {
          const { total, faltando } = somar(
            refeicao.itens.map((item) => {
              const a = TACO.alimentos.find((x) => x.c === item.codigo);
              return a ? porGramas(valorDe(a, chave), item.gramas) : null;
            }),
          );
          if (rodapeCelulas[iM]) {
            rodapeCelulas[iM].textContent = mostrar(total, casas) + (faltando ? " *" : "");
          }
        });
        totais();
      };

      refeicao.itens.forEach((item, iI) => {
        const alimento = TACO.alimentos.find((a) => a.c === item.codigo);
        const tr = document.createElement("tr");
        const nomeTd = document.createElement("td");
        nomeTd.textContent = alimento ? alimento.n : item.nome;
        const gTd = document.createElement("td");
        const gInput = document.createElement("input");
        gInput.type = "number";
        gInput.step = "1";
        gInput.value = item.gramas;
        gInput.style.width = "72px";
        gInput.style.textAlign = "right";
        gInput.oninput = () => {
          item.gramas = num(gInput.value);
          guardarDieta();
          recalcular();
        };
        gTd.append(gInput);
        tr.append(nomeTd, gTd);

        celulas[iI] = [];
        for (const [, ,] of MACROS) {
          const td = document.createElement("td");
          celulas[iI].push(td);
          tr.append(td);
        }

        const acaoTd = document.createElement("td");
        const x = document.createElement("button");
        x.className = "mini";
        x.textContent = "×";
        x.onclick = () => {
          refeicao.itens.splice(iI, 1);
          guardarDieta();
          desenharDieta();
        };
        acaoTd.append(x);
        tr.append(acaoTd);
        corpo.append(tr);
      });

      const rodape = document.createElement("tfoot");
      const trF = document.createElement("tr");
      trF.innerHTML = "<td>Subtotal</td><td></td>";
      for (const [, ,] of MACROS) {
        const td = document.createElement("td");
        rodapeCelulas.push(td);
        trF.append(td);
      }
      trF.append(document.createElement("td"));
      rodape.append(trF);
      tabela.append(corpo, rodape);
      bloco.append(tabela);
      recalcular();
    }

    bloco.append(campoDeBusca(refeicao));
    caixa.append(bloco);
  });

  totais();
}

/** Campo de busca com sugestões, teclado incluso. */
function campoDeBusca(refeicao) {
  const caixa = document.createElement("div");
  caixa.className = "busca";
  caixa.style.marginTop = "10px";

  const campo = document.createElement("input");
  campo.placeholder = "Buscar alimento na TACO e apertar Enter";
  const lista = document.createElement("div");
  lista.className = "sugestoes";
  lista.hidden = true;
  let marcado = 0;
  let achados = [];

  function fechar() {
    lista.hidden = true;
    lista.innerHTML = "";
    achados = [];
  }

  function escolher(alimento) {
    refeicao.itens.push({ codigo: alimento.c, nome: alimento.n, gramas: 100 });
    guardarDieta();
    fechar();
    campo.value = "";
    desenharDieta();
  }

  campo.oninput = () => {
    achados = buscar(campo.value);
    marcado = 0;
    lista.innerHTML = "";
    if (!achados.length) return fechar();
    achados.forEach((a, i) => {
      const linha = document.createElement("div");
      linha.innerHTML = `${a.n}<br><small>${a.g} · código ${a.c}</small>`;
      if (i === 0) linha.className = "marcado";
      linha.onmousedown = (e) => {
        e.preventDefault();
        escolher(a);
      };
      lista.append(linha);
    });
    lista.hidden = false;
  };

  campo.onkeydown = (e) => {
    if (lista.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      marcado = Math.max(0, Math.min(achados.length - 1, marcado + (e.key === "ArrowDown" ? 1 : -1)));
      [...lista.children].forEach((n, i) => (n.className = i === marcado ? "marcado" : ""));
      lista.children[marcado]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (achados[marcado]) escolher(achados[marcado]);
    } else if (e.key === "Escape") {
      fechar();
    }
  };

  campo.onblur = () => setTimeout(fechar, 120);
  caixa.append(campo, lista);
  return caixa;
}

function totais() {
  const todos = dieta.refeicoes.flatMap((r) => r.itens);
  const soma = {};
  let faltouAlgo = 0;

  for (const [chave] of MACROS) {
    const { total, faltando } = somar(
      todos.map((item) => {
        const a = TACO?.alimentos.find((x) => x.c === item.codigo);
        return a ? porGramas(valorDe(a, chave), item.gramas) : null;
      }),
    );
    soma[chave] = total;
    faltouAlgo += faltando;
  }

  const peso = num($("d-peso").value);
  const meta = num($("d-meta").value);
  const dist = distribuicao(soma.carboidrato, soma.proteina, soma.lipideos);

  const linhas = [
    ["Calorias", mostrar(soma.energia_kcal, 0), meta ? `meta ${mostrar(meta, 0)} · ${mostrar(soma.energia_kcal - meta, 0)}` : ""],
    ["Carboidrato", mostrar(soma.carboidrato, 1) + " g", dist ? `${mostrar(dist.carboidrato, 0)}%` + (peso ? ` · ${mostrar(porQuilo(soma.carboidrato, peso), 1)} g/kg` : "") : ""],
    ["Proteína", mostrar(soma.proteina, 1) + " g", dist ? `${mostrar(dist.proteina, 0)}%` + (peso ? ` · ${mostrar(porQuilo(soma.proteina, peso), 1)} g/kg` : "") : ""],
    ["Gordura", mostrar(soma.lipideos, 1) + " g", dist ? `${mostrar(dist.lipideo, 0)}%` + (peso ? ` · ${mostrar(porQuilo(soma.lipideos, peso), 1)} g/kg` : "") : ""],
    ["Fibra", mostrar(soma.fibra_alimentar, 1) + " g", ""],
  ];

  $("total-dia").innerHTML =
    "<dl>" +
    linhas
      .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
      .join("") +
    "</dl>";

  $("aviso-dados").innerHTML = faltouAlgo
    ? `<div class="aviso">${faltouAlgo} ${faltouAlgo === 1 ? "valor não existe" : "valores não existem"} na tabela para os alimentos escolhidos (marcados com <strong>*</strong>). Eles não entraram como zero — o total está incompleto nesses nutrientes, e é bom saber disso antes de fechar a prescrição.</div>`
    : "";
}

function textoDaDieta() {
  const linhas = [];
  if (dieta.nome) linhas.push(dieta.nome, "");
  for (const r of dieta.refeicoes) {
    if (!r.itens.length) continue;
    linhas.push(r.nome.toUpperCase());
    for (const item of r.itens) {
      const a = TACO.alimentos.find((x) => x.c === item.codigo);
      const kcal = a ? porGramas(valorDe(a, "energia_kcal"), item.gramas) : null;
      linhas.push(`  ${a ? a.n : item.nome} — ${item.gramas} g${kcal !== null ? ` (${mostrar(kcal, 0)} kcal)` : ""}`);
    }
    linhas.push("");
  }
  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// Composição corporal
// ---------------------------------------------------------------------------

const DOBRAS = [
  ["biceps", "Bíceps"],
  ["triceps", "Tríceps"],
  ["peitoral", "Peitoral / tórax"],
  ["subescapular", "Subescapular"],
  ["axilar", "Axilar média"],
  ["suprailiaca", "Supra-ilíaca"],
  ["abdominal", "Abdominal"],
  ["coxa", "Coxa"],
  ["panturrilha", "Panturrilha"],
];

const CIRCUNFERENCIAS = [
  ["peitoral", "Peitoral"],
  ["cintura", "Cintura"],
  ["abdomen", "Abdômen"],
  ["quadril", "Quadril"],
  ["braco_dir", "Braço direito"],
  ["braco_contraido", "Braço contraído"],
  ["coxa_dir", "Coxa direita"],
  ["coxa_esq", "Coxa esquerda"],
  ["pant_dir", "Panturrilha direita"],
  ["pant_esq", "Panturrilha esquerda"],
];

/** Quais dobras cada protocolo soma. Nada aqui é escolha minha. */
const PROTOCOLOS = {
  pollock3: {
    rotulo: "Jackson & Pollock, 3 dobras",
    dobras: { masculino: ["peitoral", "abdominal", "coxa"], feminino: ["triceps", "suprailiaca", "coxa"] },
  },
  pollock7: {
    rotulo: "Jackson & Pollock, 7 dobras",
    dobras: {
      masculino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
      feminino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
    },
  },
  durnin: {
    rotulo: "Durnin & Womersley, 4 dobras",
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
  },
  faulkner: {
    rotulo: "Faulkner, 4 dobras",
    dobras: {
      masculino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
      feminino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
    },
  },
};

const CHAVE_CORPO = "nutri:corpo:v1";

function camposCorpo() {
  const dobras = $("dobras");
  for (const [chave, rotulo] of DOBRAS) {
    const div = document.createElement("div");
    div.innerHTML = `<label for="dob-${chave}">${rotulo}</label><input id="dob-${chave}" type="number" step="0.5" />`;
    dobras.append(div);
  }
  const circ = $("circunferencias");
  for (const [chave, rotulo] of CIRCUNFERENCIAS) {
    const div = document.createElement("div");
    div.innerHTML = `<label for="cir-${chave}">${rotulo}</label><input id="cir-${chave}" type="number" step="0.5" />`;
    circ.append(div);
  }
  const atividade = $("c-atividade");
  for (const a of ATIVIDADE) {
    const opcao = document.createElement("option");
    opcao.value = String(a.fator);
    opcao.textContent = `${a.rotulo} — ×${a.fator}`;
    atividade.append(opcao);
  }
  atividade.value = "1.375";
}

function calcularCorpo() {
  const sexo = $("c-sexo").value;
  const idade = num($("c-idade").value);
  const peso = num($("c-peso").value);
  const alturaCm = num($("c-altura").value);
  const protocolo = $("c-protocolo").value;
  const usadas = PROTOCOLOS[protocolo].dobras[sexo];

  $("quais-dobras").textContent =
    `${PROTOCOLOS[protocolo].rotulo}: soma ${usadas.map((c) => DOBRAS.find(([k]) => k === c)[1].toLowerCase()).join(", ")}.`;

  const valores = usadas.map((c) => num($(`dob-${c}`).value));
  const faltando = valores.filter((v) => !v).length;
  const soma = valores.reduce((t, v) => t + v, 0);

  let percentual = null;
  let densidade = null;
  if (!faltando && soma > 0) {
    if (protocolo === "faulkner") {
      percentual = faulkner(soma);
    } else {
      densidade =
        protocolo === "pollock3"
          ? densidadePollock3(soma, idade, sexo)
          : protocolo === "pollock7"
            ? densidadePollock7(soma, idade, sexo)
            : densidadeDurnin(soma, idade, sexo);
      percentual = siri(densidade);
    }
  }

  const gorda = massaGorda(peso, percentual);
  const magra = massaMagra(peso, percentual);
  const indice = imc(peso, alturaCm / 100);

  $("resultado-corpo").innerHTML =
    "<dl>" +
    [
      ["Soma das dobras", mostrar(soma, 1, " mm"), `${usadas.length} dobras`],
      ["Densidade", densidade ? mostrar(densidade, 4) : "—", densidade ? "g/cm³" : ""],
      ["Gordura", percentual === null ? "—" : mostrar(percentual, 2, "%"), percentual === null ? "" : "por Siri"],
      ["Massa gorda", mostrar(gorda, 1, " kg"), ""],
      ["Massa magra", mostrar(magra, 1, " kg"), ""],
      ["IMC", mostrar(indice, 2), "kg/m²"],
    ]
      .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
      .join("") +
    "</dl>";

  $("aviso-corpo").innerHTML =
    faltando && soma > 0
      ? `<div class="aviso">Falta preencher ${faltando} ${faltando === 1 ? "dobra" : "dobras"} deste protocolo. Não calculo o percentual com dobra faltando — o resultado sairia errado sem avisar.</div>`
      : !idade && soma > 0 && protocolo !== "faulkner"
        ? `<div class="aviso">Esta equação usa a idade. Preencha para o percentual aparecer.</div>`
        : "";

  // Gasto energético
  const fator = num($("c-atividade").value) || 1;
  const tmbMifflin = mifflin(peso, alturaCm, idade, sexo);
  const tmbHB = harrisBenedict(peso, alturaCm, idade, sexo);
  const tmbCun = magra ? cunningham(magra) : null;

  $("resultado-energia").innerHTML =
    "<dl>" +
    [
      ["Mifflin-St Jeor", mostrar(tmbMifflin, 0), tmbMifflin ? `total ${mostrar(tmbMifflin * fator, 0)}` : ""],
      ["Harris-Benedict", mostrar(tmbHB, 0), tmbHB ? `total ${mostrar(tmbHB * fator, 0)}` : ""],
      ["Cunningham", mostrar(tmbCun, 0), tmbCun ? `total ${mostrar(tmbCun * fator, 0)}` : ""],
    ]
      .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
      .join("") +
    "</dl>";

  guardarCorpo();
}

function guardarCorpo() {
  const dados = { campos: {} };
  for (const id of ["c-nome", "c-data", "c-sexo", "c-idade", "c-peso", "c-altura", "c-protocolo", "c-atividade"]) {
    dados.campos[id] = $(id).value;
  }
  for (const [chave] of DOBRAS) dados.campos[`dob-${chave}`] = $(`dob-${chave}`).value;
  for (const [chave] of CIRCUNFERENCIAS) dados.campos[`cir-${chave}`] = $(`cir-${chave}`).value;
  try {
    localStorage.setItem(CHAVE_CORPO, JSON.stringify(dados));
  } catch {
    /* ignora */
  }
}

function lerCorpo() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_CORPO) ?? "null");
    if (!guardado) return;
    for (const [id, valor] of Object.entries(guardado.campos ?? {})) {
      if ($(id)) $(id).value = valor;
    }
  } catch {
    /* ignora */
  }
}

// ---------------------------------------------------------------------------
// Ligação
// ---------------------------------------------------------------------------

document.querySelectorAll("nav button").forEach((botao) => {
  botao.onclick = () => {
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    botao.setAttribute("aria-pressed", "true");
    document.querySelectorAll("section.aba").forEach((s) => s.classList.remove("ativa"));
    $(botao.dataset.aba).classList.add("ativa");
  };
});

camposCorpo();
lerCorpo();
for (const campo of document.querySelectorAll("#corpo input, #corpo select")) {
  campo.addEventListener("input", calcularCorpo);
}
if (!$("c-data").value) $("c-data").value = new Date().toISOString().slice(0, 10);
calcularCorpo();

$("nova-refeicao").onclick = () => {
  dieta.refeicoes.push({ nome: "Nova refeição", itens: [] });
  guardarDieta();
  desenharDieta();
};

$("copiar").onclick = async () => {
  try {
    await navigator.clipboard.writeText(textoDaDieta());
    $("copiar").textContent = "Copiado";
    setTimeout(() => ($("copiar").textContent = "Copiar como texto"), 1500);
  } catch {
    window.prompt("Copie daqui:", textoDaDieta());
  }
};

$("limpar-dieta").onclick = () => {
  if (!window.confirm("Apagar a dieta que está na tela?")) return;
  dieta = { nome: "", peso: "", meta: "", refeicoes: [{ nome: "Café da manhã", itens: [] }] };
  $("d-nome").value = "";
  $("d-peso").value = "";
  $("d-meta").value = "";
  guardarDieta();
  desenharDieta();
};

$("limpar-corpo").onclick = () => {
  if (!window.confirm("Apagar a avaliação que está na tela?")) return;
  for (const campo of document.querySelectorAll("#corpo input")) campo.value = "";
  $("c-data").value = new Date().toISOString().slice(0, 10);
  calcularCorpo();
};

for (const id of ["d-nome", "d-peso", "d-meta"]) {
  $(id).addEventListener("input", () => {
    dieta[id.slice(2)] = $(id).value;
    guardarDieta();
    totais();
  });
}

lerDieta();
$("d-nome").value = dieta.nome ?? "";
$("d-peso").value = dieta.peso ?? "";
$("d-meta").value = dieta.meta ?? "";

carregarTaco()
  .then(desenharDieta)
  .catch(() => {
    $("fonte-taco").textContent =
      "Não consegui carregar a tabela de alimentos. Recarregue a página; se continuar, me avise.";
  });
