import {
  ATIVIDADE,
  classificarIMC,
  CONVERSOES,
  cunningham,
  distribuicao,
  FAIXAS_MACROS,
  faoOms,
  fatorFao,
  harrisBenedict,
  imc,
  massaGorda,
  macrosPorPercentual,
  massaMagra,
  mifflin,
  pesoIdeal,
  relacaoCinturaQuadril,
  riscoCintura,
  riscoRCQ,
  porGramas,
  porQuilo,
  somar,
  venta,
} from "./calculos.mjs";
import { PROTOCOLOS } from "./protocolos.mjs";

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

const CHAVE_CORPO = "nutri:corpo:v1";

function camposCorpo() {
  // A lista de equações da tela é montada a partir do mapa acima, e não
  // escrita à mão no HTML. Duas listas para manter em sincronia é uma
  // esperando ficar desatualizada em silêncio.
  const protocolos = $("c-protocolo");
  for (const [chave, dados] of Object.entries(PROTOCOLOS)) {
    const opcao = document.createElement("option");
    opcao.value = chave;
    opcao.textContent = dados.rotulo;
    protocolos.append(opcao);
  }

  const conversoes = $("c-equacao");
  for (const [chave, conv] of Object.entries(CONVERSOES)) {
    const opcao = document.createElement("option");
    opcao.value = chave;
    opcao.textContent = conv.rotulo;
    conversoes.append(opcao);
  }

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
  const dados = PROTOCOLOS[protocolo];
  const usadas = dados.dobras[sexo];
  const nomes = usadas.map((c) => DOBRAS.find(([k]) => k === c)[1].toLowerCase()).join(", ");

  $("quais-dobras").textContent = usadas.length
    ? `${dados.rotulo}: ${dados.percentual || protocolo === "katch" ? "usa" : "soma"} ${nomes}. ${dados.nota}`
    : `${dados.rotulo} não tem equação publicada para este sexo. Escolha outro protocolo.`;

  const valores = Object.fromEntries(usadas.map((c) => [c, num($(`dob-${c}`).value)]));
  const lista = usadas.map((c) => valores[c]);
  const faltando = lista.filter((v) => !v).length;
  const soma = lista.reduce((t, v) => t + v, 0);

  // A conversão é a do autor da equação, não uma escolha solta na tela. O
  // seletor serve para ela trocar de propósito; trocar de protocolo puxa a
  // conversão certa junto.
  const conversao = CONVERSOES[$("c-equacao").value] ?? CONVERSOES.siri;

  let percentual = null;
  let densidade = null;
  if (!faltando && soma > 0) {
    if (dados.percentual) {
      percentual = dados.percentual({ soma, idade, sexo, valores });
    } else {
      densidade = dados.densidade({ soma, idade, sexo, valores });
      percentual = densidade === null ? null : conversao.calcular(densidade);
    }
  }

  const gorda = massaGorda(peso, percentual);
  const magra = massaMagra(peso, percentual);
  const indice = imc(peso, alturaCm / 100);

  $("resultado-corpo").innerHTML =
    "<dl>" +
    [
      [
        "Soma do protocolo",
        mostrar(soma, 1, " mm"),
        protocolo === "katch"
          ? `${usadas.length} dobras · esta equação NÃO usa a soma — cada dobra entra com o seu coeficiente`
          : `${usadas.length} dobras · é esta que entra na conta`,
      ],
      [
        "Soma de todas as medidas",
        mostrar(
          DOBRAS.map(([c]) => num($(`dob-${c}`).value)).reduce((t, v) => t + v, 0),
          1,
          " mm",
        ),
        "todas as dobras anotadas",
      ],
      ["Densidade", densidade ? mostrar(densidade, 4) : "—", densidade ? "g/cm³" : ""],
      [
        "Gordura",
        percentual === null ? "—" : mostrar(percentual, 2, "%"),
        percentual === null ? "" : dados.percentual ? "da própria equação" : `por ${conversao.rotulo}`,
      ],
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
      : !idade && soma > 0 && dados.usaIdade
        ? `<div class="aviso">Esta equação usa a idade. Preencha para o percentual aparecer.</div>`
        : "";

  // Índices e faixas de referência
  const cintura = num($("cir-cintura").value);
  const quadril = num($("cir-quadril").value);
  const rcq = relacaoCinturaQuadril(cintura, quadril);
  const faixaPeso = pesoIdeal(alturaCm / 100);

  $("resultado-faixas").innerHTML =
    "<dl>" +
    [
      ["IMC", mostrar(indice, 1), classificarIMC(indice) ?? ""],
      [
        "Peso ideal",
        faixaPeso ? `${mostrar(faixaPeso.minimo, 1)} – ${mostrar(faixaPeso.maximo, 1)}` : "—",
        faixaPeso ? "kg · IMC 18,5–24,9" : "",
      ],
      // Campo vazio mostra travessão, não "0,0 cm": zero aqui leria como
      // uma cintura medida de zero centímetros.
      ["Cintura", cintura ? mostrar(cintura, 1, " cm") : "—", riscoCintura(cintura, sexo) ?? ""],
      ["Cintura/quadril", rcq === null ? "—" : mostrar(rcq, 2), riscoRCQ(rcq, sexo) ?? ""],
    ]
      .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
      .join("") +
    "</dl>";

  // Gasto energético
  const fator = num($("c-atividade").value) || 1;
  const tmbMifflin = mifflin(peso, alturaCm, idade, sexo);
  const tmbHB = harrisBenedict(peso, alturaCm, idade, sexo);
  const tmbCun = magra ? cunningham(magra) : null;
  const tmbFao = faoOms(peso, idade, sexo);
  const fatorOcupacional = fatorFao($("c-fao").value, idade, sexo);

  $("resultado-energia").innerHTML =
    "<dl>" +
    [
      ["Mifflin-St Jeor", mostrar(tmbMifflin, 0), tmbMifflin ? `total ${mostrar(tmbMifflin * fator, 0)}` : ""],
      ["Harris-Benedict", mostrar(tmbHB, 0), tmbHB ? `total ${mostrar(tmbHB * fator, 0)}` : ""],
      ["Cunningham", mostrar(tmbCun, 0), tmbCun ? `total ${mostrar(tmbCun * fator, 0)}` : ""],
      [
        "FAO/OMS 1985",
        mostrar(tmbFao, 0),
        tmbFao && fatorOcupacional ? `× ${fatorOcupacional} = ${mostrar(tmbFao * fatorOcupacional, 0)}` : "",
      ],
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

/**
 * Trocar de equação puxa junto a conversão daquele autor.
 *
 * Sem isto, escolher Petroski deixaria Siri ligado do protocolo anterior e
 * o percentual sairia com a conta errada — parecendo certo. Ela ainda pode
 * trocar a conversão depois, de propósito; o que não pode é herdar a do
 * protocolo passado sem perceber.
 */
function seguirConversaoDoAutor() {
  const dados = PROTOCOLOS[$("c-protocolo").value];
  const seletor = $("c-equacao");
  const proprio = !dados.percentual;
  seletor.disabled = !proprio;
  if (proprio) seletor.value = dados.conversao;
  $("aviso-conversao").textContent = proprio
    ? `${dados.rotulo} foi publicada com ${CONVERSOES[dados.conversao].rotulo}.`
    : "Esta equação devolve o percentual direto — não passa por conversão.";
}
$("c-protocolo").addEventListener("change", () => {
  seguirConversaoDoAutor();
  calcularCorpo();
});
seguirConversaoDoAutor();
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


// ---------------------------------------------------------------------------
// Macros e gasto
// ---------------------------------------------------------------------------

function calcularMacros() {
  const kcal = num($("m-kcal").value);
  const peso = num($("m-peso").value);
  const pct = {
    carboidrato: num($("m-cho").value),
    proteina: num($("m-ptn").value),
    lipideo: num($("m-lip").value),
  };
  const soma = pct.carboidrato + pct.proteina + pct.lipideo;

  $("m-soma").textContent =
    soma === 100
      ? "Soma 100% — fechado."
      : `Soma ${mostrar(soma, 0)}%. Falta${soma > 100 ? "m" : ""} ${mostrar(Math.abs(100 - soma), 0)} ponto(s) para fechar 100%.`;
  $("m-soma").style.color = soma === 100 ? "" : "var(--alerta)";

  const r = macrosPorPercentual(kcal, pct, peso);
  $("resultado-macros").innerHTML = r
    ? "<dl>" +
      [
        ["Carboidrato", mostrar(r.carboidrato.gramas, 0, " g"), `${mostrar(r.carboidrato.kcal, 0)} kcal` + (peso ? ` · ${mostrar(r.carboidrato.porQuilo, 1)} g/kg` : "")],
        ["Proteína", mostrar(r.proteina.gramas, 0, " g"), `${mostrar(r.proteina.kcal, 0)} kcal` + (peso ? ` · ${mostrar(r.proteina.porQuilo, 1)} g/kg` : "")],
        ["Gordura", mostrar(r.lipideo.gramas, 0, " g"), `${mostrar(r.lipideo.kcal, 0)} kcal` + (peso ? ` · ${mostrar(r.lipideo.porQuilo, 1)} g/kg` : "")],
      ]
        .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
        .join("") +
      "</dl>"
    : "<p class=\"nota\">Informe as calorias totais.</p>";

  // Como a divisão dela se compara com as faixas publicadas.
  $("faixas-macros").innerHTML = Object.values(FAIXAS_MACROS)
    .map((f) => {
      const linhas = [
        ["Carboidrato", pct.carboidrato, f.carboidrato],
        ["Proteína", pct.proteina, f.proteina],
        ["Gordura", pct.lipideo, f.lipideo],
      ]
        .map(([nome, valor, [minimo, maximo]]) => {
          const dentro = valor >= minimo && valor <= maximo;
          return `<td>${nome} <strong>${mostrar(valor, 0)}%</strong> <span style="color:var(--apagado)">(${minimo}–${maximo})</span> ${dentro ? "✓" : "fora"}</td>`;
        })
        .join("");
      return `<table style="margin-top:8px"><tr><th style="text-align:left">${f.rotulo}</th></tr><tr>${linhas}</tr></table>`;
    })
    .join("");

  const ajuste = venta(num($("m-atual").value), num($("m-desejado").value), num($("m-dias").value));
  $("resultado-venta").innerHTML =
    ajuste === null
      ? '<p class="nota">Preencha peso atual, peso desejado e prazo.</p>'
      : "<dl>" +
        [
          [
            ajuste > 0 ? "Déficit por dia" : "Superávit por dia",
            mostrar(Math.abs(ajuste), 0, " kcal"),
            `${mostrar(Math.abs(num($("m-atual").value) - num($("m-desejado").value)), 1)} kg em ${num($("m-dias").value)} dias`,
          ],
        ]
          .map(([t, v, apoio]) => `<dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd>`)
          .join("") +
        "</dl>";
}

for (const campo of document.querySelectorAll("#macros input")) {
  campo.addEventListener("input", calcularMacros);
}
for (const botao of document.querySelectorAll("#macros button[data-preset]")) {
  botao.onclick = () => {
    const [c, p, l] = botao.dataset.preset.split(",");
    $("m-cho").value = c;
    $("m-ptn").value = p;
    $("m-lip").value = l;
    calcularMacros();
  };
}
calcularMacros();
