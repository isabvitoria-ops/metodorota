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
import {
  apagarFicha,
  fichaVazia,
  lerFicha,
  listarFichas,
  migrarGavetaAntiga,
  novoId,
  restaurarBackup,
  salvarFicha,
  textoDoBackup,
} from "./fichas.mjs";

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

/**
 * Duas tabelas, uma busca só.
 *
 * POR QUE DUAS. Ela foi calcular uma dieta, escreveu "tapioca, goma" e não
 * achou nada. Fui conferir: a TACO tem 597 alimentos e "goma de tapioca"
 * não é um deles — a TACO é tabela de laboratório, de alimentos genéricos,
 * e não traz marca nem todo preparo do dia a dia. A extração estava
 * completa; faltava alimento na fonte, não no arquivo.
 *
 * A tabela do IBGE, que já estava extraída aqui do lado sem ser usada, tem
 * "Tapioca de goma", "Goma de mandioca", "Farinha de tapioca" e mais 1.119
 * alimentos, com energia e os quatro macros. Juntas cobrem muito mais do
 * que cada uma sozinha.
 *
 * O QUE ELAS NÃO SÃO: uma coisa só. A TACO traz 66 nutrientes, o IBGE
 * traz 5. Todo alimento carrega a sua fonte, aparece na tela com ela, e os
 * números nunca se misturam — somar sódio da TACO com um alimento do IBGE
 * que não tem sódio daria uma conta que parece completa e não é. O que
 * falta continua "—", nunca zero.
 */
let TACO = null;
let POS = {};
let ALIMENTOS = [];

const FONTES = { taco: "TACO", ibge: "IBGE" };

/** Nome e busca sem acento, para casar com o que ela digita. */
const semAcento = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function carregarTaco() {
  const [taco, ibge] = await Promise.all([
    fetch("./dados/taco.json").then((r) => r.json()),
    // O IBGE é um extra: se faltar, a ferramenta continua com a TACO em vez
    // de não abrir.
    fetch("./dados/ibge.json").then((r) => r.json()).catch(() => null),
  ]);

  TACO = taco;
  TACO.nutrientes.forEach((chave, i) => (POS[chave] = i));

  ALIMENTOS = TACO.alimentos.map((a) => ({
    id: `taco:${a.c}`,
    fonte: "taco",
    nome: a.n,
    busca: a.b,
    grupo: a.g,
    bruto: a,
  }));

  if (ibge) {
    for (const a of ibge.alimentos) {
      // O IBGE repete o mesmo alimento por preparo. "Não se aplica" é o
      // preparo vazio deles, e escrevê-lo no nome só ocuparia espaço.
      const preparo = a.preparo && a.preparo !== "Não se aplica" ? a.preparo : "";
      const nome = preparo ? `${a.nome} (${preparo.toLowerCase()})` : a.nome;
      ALIMENTOS.push({
        id: `ibge:${a.codigo}:${a.preparo_codigo}`,
        fonte: "ibge",
        nome,
        busca: semAcento(`${nome} ${a.grupo ?? ""}`),
        grupo: a.grupo ?? "",
        bruto: a,
      });
    }
  }

  $("fonte-taco").innerHTML =
    `<strong>${TACO.alimentos.length}</strong> alimentos da ${TACO.nome} (${TACO.instituicao})` +
    (ibge
      ? ` e <strong>${ibge.alimentos.length}</strong> da ${ibge.nome} (${ibge.instituicao})`
      : "") +
    `, por 100 g. Cada alimento mostra de qual tabela veio. ` +
    `Valor que a tabela não traz aparece como “—” e não entra como zero na soma.`;
}

/**
 * O valor de um nutriente naquele alimento, ou null.
 *
 * Traço e "sem dado" voltam null de propósito: na TACO eles não são zero, e
 * tratá-los como zero mudaria a conta de sódio, ferro e colesterol de
 * centenas de alimentos. No IBGE vale o mesmo para o traço.
 *
 * Um nutriente que a tabela daquele alimento nem tem — sódio num alimento
 * do IBGE — também é null. Não é o mesmo que zero, e a tela mostra "—".
 */
const DO_IBGE = {
  energia_kcal: "energia_kcal",
  proteina: "proteina_g",
  lipideos: "lipidios_g",
  carboidrato: "carboidrato_g",
  fibra_alimentar: "fibra_g",
};

function valorDe(alimento, chave) {
  if (!alimento) return null;
  if (alimento.fonte === "ibge") {
    const campo = DO_IBGE[chave];
    return campo ? (alimento.bruto[campo] ?? null) : null;
  }
  const pos = POS[chave];
  if (pos === undefined) return null;
  const achado = alimento.bruto.v.find(([p]) => p === pos);
  return achado ? achado[1] : null;
}

/**
 * Procurar nas duas tabelas.
 *
 * DEFEITO QUE A PONTUAÇÃO CAUSAVA: as palavras saíam quebradas só por
 * espaço, então a vírgula grudava. Procurando "manteiga, tapioca" a palavra
 * virava "manteiga," e não casava com "Tapioca, com manteiga" — onde
 * "manteiga" está no fim, sem vírgula. Agora a pontuação separa como o
 * espaço.
 */
function buscar(termo) {
  const palavras = semAcento(termo)
    .split(/[\s,.;:/()\-]+/)
    .filter(Boolean);
  if (!palavras.length || palavras.join("").length < 2) return [];
  return ALIMENTOS.filter((a) => palavras.every((p) => a.busca.includes(p))).slice(0, 40);
}

/** O alimento de um item da dieta, pelo id composto. */
function alimentoPorId(id) {
  // Ficha salva antes das duas tabelas guardava só o código da TACO. Sem
  // este recuo, toda dieta já montada perderia os alimentos de uma vez.
  const alvo = String(id).includes(":") ? String(id) : `taco:${id}`;
  return ALIMENTOS.find((a) => a.id === alvo) ?? null;
}

// ---------------------------------------------------------------------------
// Dieta
// ---------------------------------------------------------------------------

let dieta = { peso: "", meta: "", refeicoes: [] };

/** A dieta não tem mais gaveta própria: ela é um pedaço da ficha aberta. */
function guardarDieta() {
  guardarFicha();
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
        // `TACO?`: abrir uma ficha com alimentos antes de a tabela terminar
        // de carregar chegava aqui com TACO nulo e derrubava a tela inteira.
        refeicao.itens.forEach((item, iI) => {
          const a = alimentoPorId(item.codigo);
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
              const a = alimentoPorId(item.codigo);
              return a ? porGramas(valorDe(a, chave), item.gramas) : null;
            }),
          );
          if (rodapeCelulas[iM]) {
            rodapeCelulas[iM].textContent =
              (total === null ? "—" : mostrar(total, casas)) + (faltando ? " *" : "");
          }
        });
        totais();
      };

      refeicao.itens.forEach((item, iI) => {
        const alimento = alimentoPorId(item.codigo);
        const tr = document.createElement("tr");
        const nomeTd = document.createElement("td");
        nomeTd.textContent = alimento ? alimento.nome : item.nome;
        if (alimento) {
          // De qual tabela veio, na própria linha: os nutrientes das duas não
          // são os mesmos, e ela precisa saber disso ao olhar um "—".
          const marca = document.createElement("span");
          marca.className = "fonte";
          marca.textContent = FONTES[alimento.fonte];
          nomeTd.append(" ", marca);
        }
        const gTd = document.createElement("td");
        const gInput = document.createElement("input");
        // Texto com teclado numérico, não `type="number"`: ver o comentário
        // em camposCorpo(). Vale igual para gramas — "62,5 g" existe.
        gInput.type = "text";
        gInput.inputMode = "decimal";
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
  campo.placeholder = "Buscar alimento (TACO e IBGE) e apertar Enter";
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
    refeicao.itens.push({ codigo: alimento.id, nome: alimento.nome, gramas: 100 });
    guardarDieta();
    fechar();
    campo.value = "";
    desenharDieta();
  }

  campo.oninput = () => {
    achados = buscar(campo.value);
    marcado = 0;
    lista.innerHTML = "";

    // DEFEITO QUE ISTO CONSERTA: não achando nada, a caixa simplesmente não
    // abria. Silêncio, na tela de quem está montando uma dieta, lê-se como
    // "este alimento não existe nas tabelas" — foi o que aconteceu com
    // "tapioca, goma", e a conclusão dela foi que faltava alimento no
    // sistema. Dizer que a busca não achou, e o que tentar em seguida, custa
    // três linhas.
    if (!achados.length) {
      if (semAcento(campo.value).replace(/[^a-z0-9]/g, "").length < 2) return fechar();
      const aviso = document.createElement("div");
      aviso.className = "nada";
      aviso.innerHTML =
        "Nada com essas palavras nas duas tabelas.<br><small>" +
        "Tente uma palavra só, ou o nome genérico — as tabelas escrevem " +
        "“Queijo, mozarela”, “Tapioca de goma”. Marca de produto elas não têm." +
        "</small>";
      lista.append(aviso);
      lista.hidden = false;
      return;
    }

    achados.forEach((a, i) => {
      const linha = document.createElement("div");
      linha.innerHTML =
        `${a.nome}<br><small>${FONTES[a.fonte]}${a.grupo ? ` · ${a.grupo}` : ""}</small>`;
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
      // `achados` está vazio quando o que a caixa mostra é o aviso de "nada
      // encontrado": Enter ali não pode escolher coisa nenhuma.
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
        const a = alimentoPorId(item.codigo);
        return a ? porGramas(valorDe(a, chave), item.gramas) : null;
      }),
    );
    soma[chave] = total;
    faltouAlgo += faltando;
  }

  const peso = num($("d-peso").value);
  const meta = num($("d-meta").value);
  const dist = distribuicao(soma.carboidrato, soma.proteina, soma.lipideos);

  // "— g" seria estranho, e "0,0 g" seria mentira: o que não foi medido sai
  // como travessão sozinho.
  const gramas = (v) => (v === null ? "—" : `${mostrar(v, 1)} g`);
  const apoio = (chave, valor) =>
    dist
      ? `${mostrar(dist[chave], 0)}%` + (peso ? ` · ${mostrar(porQuilo(valor, peso), 1)} g/kg` : "")
      : "";

  const linhas = [
    // "meta 1600 · 150" não dizia se as 150 estavam acima ou abaixo. Agora diz.
    [
      "Calorias",
      mostrar(soma.energia_kcal, 0),
      meta && soma.energia_kcal !== null
        ? `meta ${mostrar(meta, 0)} · ${mostrar(Math.abs(soma.energia_kcal - meta), 0)} ${
            soma.energia_kcal >= meta ? "acima" : "abaixo"
          }`
        : "",
    ],
    ["Carboidrato", gramas(soma.carboidrato), apoio("carboidrato", soma.carboidrato)],
    ["Proteína", gramas(soma.proteina), apoio("proteina", soma.proteina)],
    ["Gordura", gramas(soma.lipideos), apoio("lipideo", soma.lipideos)],
    ["Fibra", gramas(soma.fibra_alimentar), ""],
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
      const a = alimentoPorId(item.codigo);
      const kcal = a ? porGramas(valorDe(a, "energia_kcal"), item.gramas) : null;
      linhas.push(`  ${a ? a.nome : item.nome} — ${item.gramas} g${kcal !== null ? ` (${mostrar(kcal, 0)} kcal)` : ""}`);
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

/**
 * NENHUM campo de número nesta ferramenta usa `type="number"`, e isso é
 * decisão, não descuido.
 *
 * DEFEITO QUE ISTO CONSERTA, e ele era grave: digitando "47,8" naquele
 * campo, o navegador descartava a vírgula e juntava os dígitos. O peso
 * virava 478 kg. Uma dobra de 9,6 mm virava 96 mm — e essa é a pior,
 * porque 478 kg salta aos olhos e 96 mm não: sai um percentual de gordura
 * errado com cara de certo. Conferido no navegador, acontecia tanto em
 * pt-BR quanto em en-US.
 *
 * `type="text"` com `inputmode="decimal"` aceita a vírgula, continua
 * abrindo o teclado numérico no celular, e `num()` converte na entrada.
 */
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
    div.innerHTML = `<label for="dob-${chave}">${rotulo}</label><input id="dob-${chave}" type="text" inputmode="decimal" />`;
    dobras.append(div);
  }
  const circ = $("circunferencias");
  for (const [chave, rotulo] of CIRCUNFERENCIAS) {
    const div = document.createElement("div");
    div.innerHTML = `<label for="cir-${chave}">${rotulo}</label><input id="cir-${chave}" type="text" inputmode="decimal" />`;
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

/**
 * Todos os campos da aba de composição.
 *
 * `c-equacao` e `c-fao` FALTAVAM nesta lista, e a falta tinha efeito
 * visível: a paciente voltava com o protocolo certo mas com a conversão e
 * o fator ocupacional zerados no primeiro item da lista, então o
 * percentual de gordura e o gasto energético mudavam sozinhos entre uma
 * abertura e outra.
 */
function idsDoCorpo() {
  return [
    "c-data", "c-sexo", "c-idade", "c-peso", "c-altura",
    "c-protocolo", "c-equacao", "c-atividade", "c-fao",
    ...DOBRAS.map(([c]) => `dob-${c}`),
    ...CIRCUNFERENCIAS.map(([c]) => `cir-${c}`),
  ];
}

const IDS_MACROS = ["m-kcal", "m-peso", "m-cho", "m-ptn", "m-lip", "m-atual", "m-desejado", "m-dias"];

function guardarCorpo() {
  guardarFicha();
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
  if (!window.confirm("Apagar a dieta que está na tela? A avaliação física desta ficha continua.")) return;
  dieta = { peso: "", meta: "", refeicoes: [{ nome: "Café da manhã", itens: [] }] };
  $("d-peso").value = "";
  $("d-meta").value = "";
  guardarDieta();
  desenharDieta();
};

$("limpar-corpo").onclick = () => {
  if (!window.confirm("Apagar a avaliação que está na tela? A dieta desta ficha continua.")) return;
  for (const campo of document.querySelectorAll("#corpo input")) campo.value = "";
  $("c-data").value = hoje();
  calcularCorpo();
};

for (const id of ["d-peso", "d-meta"]) {
  $(id).addEventListener("input", () => {
    dieta[id.slice(2)] = $(id).value;
    guardarDieta();
    totais();
  });
}

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

  // Dizia "Faltam 20 pontos" quando a soma passava de 100 — onde sobravam,
  // não faltavam. E o plural vinha do lado errado da comparação: "Falta 2"
  // no singular para dois pontos.
  const diferenca = Math.round(Math.abs(100 - soma));
  const pontos = `${diferenca} ${diferenca === 1 ? "ponto" : "pontos"}`;
  $("m-soma").textContent =
    soma === 100
      ? "Soma 100% — fechado."
      : soma > 100
        ? `Soma ${mostrar(soma, 0)}%. ${diferenca === 1 ? "Sobra" : "Sobram"} ${pontos} para fechar 100%.`
        : `Soma ${mostrar(soma, 0)}%. ${diferenca === 1 ? "Falta" : "Faltam"} ${pontos} para fechar 100%.`;
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

// ---------------------------------------------------------------------------
// Fichas: quem está na tela, e como ela sai daqui sem se perder
// ---------------------------------------------------------------------------

const hoje = () => new Date().toISOString().slice(0, 10);

/** A ficha aberta. Começa nova a cada abertura — nunca a paciente de ontem. */
let fichaAtual = { id: novoId(), nome: "" };

/** Lê a tela inteira: as três abas são a mesma paciente. */
function fichaDaTela() {
  const campos = (ids) => Object.fromEntries(ids.map((id) => [id, $(id)?.value ?? ""]));
  return {
    id: fichaAtual.id,
    nome: $("f-nome").value.trim(),
    dieta: { peso: $("d-peso").value, meta: $("d-meta").value, refeicoes: dieta.refeicoes },
    corpo: campos(idsDoCorpo()),
    macros: campos(IDS_MACROS),
  };
}

function escreverEstado(texto, alerta = false) {
  $("f-estado").textContent = texto;
  $("f-estado").style.color = alerta ? "var(--alerta)" : "";
}

/**
 * Como a tela está quando nada foi preenchido.
 *
 * Não dá para perguntar "os campos estão vazios?", porque vários nascem
 * preenchidos: a data é a de hoje, o sexo é feminino, o protocolo é o
 * primeiro da lista, os macros vêm 50/30/20. Perguntando pelo vazio, toda
 * abertura da ferramenta gravava uma ficha "sem nome" na lista — foi o que
 * apareceu ao conferir no navegador. A pergunta certa é outra: mudou
 * alguma coisa em relação ao ponto de partida?
 */
let estadoLimpo = null;

function estaComoNasceu(ficha) {
  const { id, nome, ...resto } = ficha;
  return !String(nome ?? "").trim() && JSON.stringify(resto) === estadoLimpo;
}

/**
 * Grava a ficha aberta. Chamada a cada tecla — não há botão de salvar.
 *
 * Ficha intocada não vira registro, senão cada abertura da ferramenta
 * deixaria uma linha vazia na lista.
 */
function guardarFicha() {
  // Durante a montagem da tela ainda não há com o que comparar, e não há
  // nada dela para gravar: o primeiro desenho dispara este caminho sozinho.
  if (estadoLimpo === null) return;
  const ficha = fichaDaTela();
  if (estaComoNasceu(ficha) || fichaVazia(ficha)) return;
  if (!salvarFicha(ficha)) {
    escreverEstado("Não consegui gravar nesta ficha — a memória do navegador recusou. Baixe o backup antes de fechar.", true);
    return;
  }
  desenharListaDeFichas();
  escreverEstado(
    `Salvo automaticamente em “${ficha.nome || "ficha sem nome"}”. ` +
      "Fica na memória deste navegador: baixe o backup de vez em quando.",
  );
}

/** A assinatura do que a lista mostra, para não redesenhar a cada tecla. */
let listaDesenhada = "";

function desenharListaDeFichas() {
  const lista = $("f-lista");
  const fichas = listarFichas();
  const assinatura = fichas.map((f) => `${f.id}:${f.nome}`).join("|") + `#${fichaAtual.id}`;
  if (assinatura === listaDesenhada) return;
  listaDesenhada = assinatura;
  lista.innerHTML = "";
  const vazio = document.createElement("option");
  vazio.value = "";
  vazio.textContent = fichas.length ? `Abrir ficha salva… (${fichas.length})` : "Nenhuma ficha salva ainda";
  lista.append(vazio);
  for (const f of fichas) {
    const opcao = document.createElement("option");
    opcao.value = f.id;
    const data = f.atualizadoEm ? new Date(f.atualizadoEm).toLocaleDateString("pt-BR") : "";
    opcao.textContent = `${f.nome || "sem nome"}${data ? ` — ${data}` : ""}`;
    lista.append(opcao);
  }
  lista.value = fichas.some((f) => f.id === fichaAtual.id) ? fichaAtual.id : "";
}

/**
 * Põe um valor num campo, respeitando o que o campo aceita.
 *
 * Uma caixa de texto vazia é uma caixa vazia. Uma LISTA vazia não existe:
 * atribuir "" a um `<select>` que não tem opção vazia deixa o seletor num
 * estado sem valor, e foi assim que "nova ficha" derrubou a tela inteira na
 * primeira tentativa — `c-sexo` voltava "" e a conta procurava as dobras de
 * um sexo que não existe. Lista sem valor válido volta para a primeira
 * opção. Vale também para um protocolo gravado que não exista mais.
 */
function definirCampo(id, valor) {
  const campo = $(id);
  if (!campo) return;
  const texto = valor ?? "";
  if (campo.tagName !== "SELECT") {
    campo.value = texto;
    return;
  }
  const existe = [...campo.options].some((o) => o.value === texto);
  campo.value = existe ? texto : (campo.options[0]?.value ?? "");
}

/** Joga uma ficha (ou o vazio) na tela. */
function mostrarFicha(ficha) {
  fichaAtual = { id: ficha?.id ?? novoId(), nome: ficha?.nome ?? "" };
  $("f-nome").value = ficha?.nome ?? "";

  dieta = {
    peso: ficha?.dieta?.peso ?? "",
    meta: ficha?.dieta?.meta ?? "",
    refeicoes: ficha?.dieta?.refeicoes?.length
      ? ficha.dieta.refeicoes
      : [{ nome: "Café da manhã", itens: [] }],
  };
  $("d-peso").value = dieta.peso;
  $("d-meta").value = dieta.meta;

  for (const id of idsDoCorpo()) definirCampo(id, ficha?.corpo?.[id]);
  if (!$("c-data").value) $("c-data").value = hoje();

  for (const id of IDS_MACROS) {
    const guardado = ficha?.macros?.[id];
    if (guardado !== undefined && guardado !== "") definirCampo(id, guardado);
  }

  seguirConversaoDoAutor();
  desenharDieta();
  calcularCorpo();
  calcularMacros();
  desenharListaDeFichas();
  escreverEstado(
    ficha
      ? `Ficha de ${ficha.nome || "paciente sem nome"} aberta.`
      : "Ficha nova. O que você digitar é salvo sozinho.",
  );
}

$("f-nome").addEventListener("input", () => {
  fichaAtual.nome = $("f-nome").value;
  guardarFicha();
});

$("f-lista").addEventListener("change", () => {
  const id = $("f-lista").value;
  if (!id) return;
  mostrarFicha(lerFicha(id));
});

$("f-nova").onclick = () => {
  // O que está na tela já está gravado (salvamento a cada tecla), então
  // "nova ficha" não pede confirmação: não há nada a perder.
  mostrarFicha(null);
  $("f-nome").focus();
};

$("f-apagar").onclick = () => {
  const ficha = lerFicha(fichaAtual.id);
  if (!ficha) {
    escreverEstado("Esta ficha ainda não foi salva — não há o que apagar.");
    return;
  }
  if (!window.confirm(`Apagar a ficha de ${ficha.nome || "paciente sem nome"}? Isto não volta atrás.`)) return;
  apagarFicha(fichaAtual.id);
  listaDesenhada = "";
  mostrarFicha(null);
  escreverEstado("Ficha apagada.");
};

$("f-backup").onclick = () => {
  const arquivo = new Blob([textoDoBackup()], { type: "application/json" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fichas-${hoje()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  escreverEstado(`Backup de ${listarFichas().length} ficha(s) baixado. Guarde fora do computador.`);
};

$("f-restaurar").onclick = () => $("f-arquivo").click();

$("f-arquivo").addEventListener("change", async () => {
  const arquivo = $("f-arquivo").files?.[0];
  if (!arquivo) return;
  try {
    const r = restaurarBackup(await arquivo.text());
    listaDesenhada = "";
    desenharListaDeFichas();
    escreverEstado(
      `Backup restaurado: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s). ` +
        "Nada do que já estava aqui foi apagado.",
    );
  } catch (e) {
    escreverEstado(`Não consegui ler este arquivo: ${e.message}`, true);
  }
  $("f-arquivo").value = "";
});

// A aba de macros também é da paciente, e também não se perde.
for (const campo of document.querySelectorAll("#macros input")) {
  campo.addEventListener("input", guardarFicha);
}

// A paciente que estava na tela na versão antiga vira a primeira ficha, em
// vez de sumir na atualização.
const recuperada = migrarGavetaAntiga();
mostrarFicha(null);
// Feito o primeiro desenho, isto é o ponto de partida com que toda ficha
// nova será comparada.
{
  const { id, nome, ...resto } = fichaDaTela();
  estadoLimpo = JSON.stringify(resto);
}
if (recuperada) {
  escreverEstado(
    `Guardei o que estava na tela antes como a ficha “${recuperada.nome}”. ` +
      "Ela está na lista de fichas salvas.",
  );
}
