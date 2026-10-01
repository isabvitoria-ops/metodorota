import {
  ATIVIDADE,
  classificarIMC,
  CONVERSOES,
  distribuicao,
  FAIXAS_MACROS,
  imc,
  massaGorda,
  macrosPorPercentual,
  massaMagra,
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
import { CATEGORIAS, EQUACOES, equacaoPorId } from "./motor/equacoes.mjs";
import { calcularGasto, compararEquacoes } from "./motor/gasto.mjs";
import { fmt as fmtMotor } from "./motor/formato.mjs";
import { ATIVIDADES_MET } from "./motor/met-dados.mjs";
import { metPeloNome } from "./motor/met.mjs";
import { regraDeBolso } from "./motor/bolso.mjs";
import {
  CRITERIOS,
  CRITERIO_PADRAO,
  MEDIDA_GRAMA,
  acrescentarOpcao,
  duplicarRefeicao,
  gramasDoItem,
  itensDoDia,
  normalizarItem,
  normalizarRefeicao,
  opcaoAtiva,
  ordenarPorRelevancia,
  porcaoEquivalente,
  refeicaoNova,
  removerOpcao,
} from "./dieta.mjs";
import {
  excluirAlimento,
  excluirGrupo,
  listarAlimentos,
  listarGrupos,
  medidasDe,
  restaurarDoBackup,
  salvarAlimento,
  salvarGrupo,
  salvarMedidas,
  tudoParaBackup,
} from "./meusAlimentos.mjs";
import { apagarTabela, importarTabela, lerTabela } from "./tabelaImportada.mjs";
import { gravarMemoria, lerMemoria, montarSugestoes, registrar } from "./sugestoes.mjs";
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
  let texto = String(v ?? "").trim();
  // "1.234,5": o ponto é de milhar e a vírgula é a decimal. Sem isto, o
  // parseFloat parava no segundo ponto e lia 1,234.
  if (texto.includes(",") && texto.includes(".")) texto = texto.replace(/\./g, "");
  const n = parseFloat(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
/**
 * Número que não pode ser negativo (gramas, peso, calorias, macros). Valor
 * negativo vira zero E o campo fica marcado: antes a conta engolia o "−50" e
 * SUBTRAÍA 62 kcal do total do dia, sem nenhum aviso.
 */
const numNaoNegativo = (v, campo) => {
  const n = num(v);
  if (campo) {
    campo.setAttribute("aria-invalid", n < 0 ? "true" : "false");
    campo.title = n < 0 ? "Não pode ser negativo — está contando como zero." : "";
  }
  return n < 0 ? 0 : n;
};
/** Texto que vai para dentro de `innerHTML` sem virar código. */
const escaparHtml = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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

const FONTES = { taco: "TACO", ibge: "IBGE", usda: "USDA", meu: "Meu" };

/**
 * A etiqueta da tabela que ela carregou. Vem do arquivo, não daqui: se
 * amanhã ela carregar outra base, a etiqueta tem que mudar junto.
 */
function siglaImportada() {
  return lerTabela()?.fonte?.sigla ?? "Importada";
}

function etiquetaDaFonte(fonte) {
  if (fonte === "importada") return siglaImportada();
  return FONTES[fonte] ?? fonte;
}

/** As tabelas, guardadas cruas para remontar a busca quando ela cadastra. */
let BASE_TABELAS = [];

/**
 * Medidas caseiras com peso oficial, por id de alimento. Ver
 * `scripts/gerar-medidas.py`: o peso vem da tabela de porções do USDA
 * (SR28), e TACO/IBGE só recebem quando o alimento é o mesmo.
 */
let MEDIDAS_PADRAO = {};

/** Onde cada nutriente mora no vetor da USDA. Ver `extrair-usda.py`. */
let POS_USDA = {};

/** Nome e busca sem acento, para casar com o que ela digita. */
const semAcento = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function carregarTaco() {
  const [taco, ibge, usda, medidas] = await Promise.all([
    fetch("./dados/taco.json").then((r) => r.json()),
    // O IBGE e a USDA são extras: se faltarem, a ferramenta continua com a
    // TACO em vez de não abrir.
    fetch("./dados/ibge.json").then((r) => r.json()).catch(() => null),
    fetch("./dados/usda.json").then((r) => r.json()).catch(() => null),
    // Sem as medidas, sobra a grama — que é o que havia antes delas.
    fetch("./dados/medidas.json").then((r) => r.json()).catch(() => null),
  ]);
  MEDIDAS_PADRAO = medidas?.alimentos ?? {};

  TACO = taco;
  TACO.nutrientes.forEach((chave, i) => (POS[chave] = i));

  BASE_TABELAS = TACO.alimentos.map((a) => ({
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
      BASE_TABELAS.push({
        id: `ibge:${a.codigo}:${a.preparo_codigo}`,
        fonte: "ibge",
        nome,
        busca: semAcento(`${nome} ${a.grupo ?? ""}`),
        grupo: a.grupo ?? "",
        bruto: a,
      });
    }
  }

  if (usda) {
    // Os nomes ficam em INGLÊS, como vieram. Traduzir 1.882 nomes por
    // máquina, sem ninguém conferir, produziria erro de alimento — e errar
    // o alimento é errar a prescrição. O que o extrator fez foi juntar
    // APELIDOS de busca ao texto invisível: "manteiga" acha "Butter", e o
    // nome mostrado continua o original, com a etiqueta USDA do lado.
    POS_USDA = {};
    usda.nutrientes.forEach((chave, i) => (POS_USDA[chave] = i));
    for (const a of usda.alimentos) {
      BASE_TABELAS.push({
        id: `usda:${a.c}`,
        fonte: "usda",
        nome: a.n,
        busca: a.b,
        grupo: "USDA",
        bruto: a,
      });
    }
  }

  montarAlimentos();

  $("fonte-taco").innerHTML =
    `Tabelas carregadas (valores por 100 g): ` +
    `<strong>TACO</strong> ${TACO.alimentos.length} alimentos (${TACO.nome}, ${TACO.instituicao})` +
    (ibge ? ` · <strong>IBGE</strong> ${ibge.alimentos.length} (${ibge.nome})` : "") +
    (usda
      ? ` · <strong>USDA</strong> ${usda.alimentos.length} (${usda.fonte}) — esses com o nome em inglês, ` +
        `como vieram; procurar por “manteiga” acha “butter”`
      : "") +
    `. Cada alimento mostra de qual tabela veio. ` +
    `Valor que a tabela não traz aparece como “—” e não entra como zero na soma.`;
}

/**
 * Junta as tabelas com os alimentos dela numa busca só.
 *
 * Refeito a cada cadastro: sem isso, o whey que ela acabou de criar não
 * apareceria na busca até recarregar a página, e ela concluiria que não
 * salvou.
 */
function montarAlimentos() {
  const tabela = lerTabela();
  const importados = (tabela?.alimentos ?? []).map((a) => ({
    // O código da TBCA entra no id: é ele que permite conferir o alimento
    // na fonte, linha por linha, se um número parecer estranho.
    id: `imp:${a.codigo}`,
    fonte: "importada",
    nome: a.nome,
    busca: semAcento(`${a.nome} ${a.grupo ?? ""} ${a.descricao ?? ""}`),
    grupo: a.grupo ?? "",
    bruto: a,
  }));

  ALIMENTOS = [
    ...listarAlimentos().map((a) => ({
      id: a.id,
      fonte: "meu",
      nome: a.nome,
      busca: semAcento(`${a.nome} ${a.grupo ?? ""}`),
      grupo: a.grupo ?? "Meus alimentos",
      bruto: a,
    })),
    ...importados,
    ...BASE_TABELAS,
  ];
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

/**
 * "Tr" da TACO: presente, em quantidade abaixo do que o laboratório mede.
 *
 * Não é zero e não é "sem dado". Antes aparecia como "—" com a dica "a tabela
 * não traz este valor", e ainda contava como dado faltando no total — o
 * significado do traço se perdia. Agora a tela mostra "Tr", e o total não o
 * soma (não há número para somar) mas também não o conta como buraco.
 */
function ehTraco(alimento, chave) {
  if (!alimento || alimento.fonte !== "taco") return false;
  const pos = POS[chave];
  return pos !== undefined && (alimento.bruto.t ?? []).includes(pos);
}

/** Soma um nutriente numa lista de itens: total, faltando (sem dado) e traços. */
function somaDoNutriente(itens, chave) {
  let tracos = 0;
  const valores = [];
  for (const item of itens) {
    const a = alimentoPorId(item.codigo);
    const v = a ? porGramas(valorDe(a, chave), gramasDoItem(item)) : null;
    if (v === null && ehTraco(a, chave)) tracos += 1;
    else valores.push(v);
  }
  const { total, faltando } = somar(valores);
  return { total, faltando, tracos };
}

/** O que a célula mostra: o número, "Tr" ou "—". */
function textoDaCelula(alimento, chave, gramas, casas) {
  const v = alimento ? porGramas(valorDe(alimento, chave), gramas) : null;
  if (v !== null) return { texto: mostrar(v, casas), dica: "" };
  if (ehTraco(alimento, chave)) {
    return { texto: "Tr", dica: "Traço: presente em quantidade abaixo do que o laboratório mede. Não entra na soma." };
  }
  return { texto: "—", dica: "A tabela não traz este valor para este alimento." };
}

function valorDe(alimento, chave) {
  if (!alimento) return null;
  if (alimento.fonte === "importada") {
    // O conversor já gravou com o nome interno, e o que a TBCA marca como
    // traço, não analisado ou sem informação chegou aqui como nulo.
    const v = alimento.bruto[chave];
    return v === undefined ? null : v;
  }
  if (alimento.fonte === "meu") {
    // Os campos dela já têm o nome interno, e o que ela deixou em branco é
    // nulo — nunca zero.
    const v = alimento.bruto[chave];
    return v === undefined ? null : v;
  }
  if (alimento.fonte === "usda") {
    const pos = POS_USDA[chave];
    if (pos === undefined) return null;
    // `null` no vetor é "a fonte não mediu", e continua null — nunca zero.
    const v = alimento.bruto.v[pos];
    return v === undefined ? null : v;
  }
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
  const achados = ALIMENTOS.filter((a) => palavras.every((p) => a.busca.includes(p)));
  return ordenarPorRelevancia(achados, palavras, semAcento).slice(0, 40);
}

/** O alimento de um item da dieta, pelo id composto. */
function alimentoPorId(id) {
  const bruto = String(id);
  const direto = ALIMENTOS.find((a) => a.id === bruto);
  if (direto) return direto;
  // Ficha salva antes das duas tabelas guardava só o código da TACO — um
  // número solto. Sem este recuo, toda dieta já montada perderia os
  // alimentos de uma vez.
  //
  // DEFEITO QUE O ATALHO ANTIGO CAUSAVA: a regra era "não tem dois-pontos,
  // então é TACO". O id de um alimento dela é `meu-1758…`, que também não
  // tem dois-pontos — virava `taco:meu-1758…`, não achava nada, e as
  // medidas caseiras dela (o "scoop = 30 g" do whey) sumiam da lista.
  if (!/^\d+$/.test(bruto)) return null;
  return ALIMENTOS.find((a) => a.id === `taco:${bruto}`) ?? null;
}

/**
 * Quanto do substituto equivale ao item, pelo critério do item. A regra e
 * o arredondamento moram em `dieta.mjs` (`porcaoEquivalente`), que é
 * testado; aqui só se buscam os valores nas tabelas.
 */
function porcaoDoSubstituto(item, sub) {
  const principal = alimentoPorId(item.codigo);
  const troca = alimentoPorId(sub.codigo);
  if (!principal || !troca) return null;
  const criterio = item.igualarPor ?? CRITERIO_PADRAO;
  return porcaoEquivalente(
    porGramas(valorDe(principal, criterio), gramasDoItem(item)),
    valorDe(troca, criterio),
    sub.medida,
  );
}

/** "90 g" ou "2 unidades (100 g)", como vai escrito na dieta. */
function porcaoEmTexto(quantidade, medida, gramas) {
  return medida.nome === "g"
    ? `${mostrar(gramas, 0)} g`
    : `${mostrar(quantidade, quantidade % 1 ? 1 : 0)} ${medida.nome} (${mostrar(gramas, 0)} g)`;
}

// ---------------------------------------------------------------------------
// Dieta
// ---------------------------------------------------------------------------

let dieta = { peso: "", meta: "", refeicoes: [] };

/**
 * As sugestões abertas: aparecem quando ela põe o PRIMEIRO alimento de uma
 * opção, e ficam até ela usar, ignorar tudo, fechar ou tirar esse alimento.
 * `ignoradas` vale só para esta sessão de tela (o histórico de longo prazo
 * fica na memória de `sugestoes.mjs`).
 */
let sugestaoAberta = null;

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

/**
 * Desenha as refeições.
 *
 * Cada refeição tem horário, um botão de recolher, abas de opção e o menu
 * de ações. A opção aberta é a que conta no total do dia — ver `dieta.mjs`,
 * onde essa regra mora e é testada.
 */
function desenharDieta() {
  const caixa = $("refeicoes");
  caixa.innerHTML = "";

  dieta.refeicoes.forEach((refeicao, iR) => {
    const bloco = document.createElement("div");
    bloco.className = "refeicao";

    // ---- topo: horário, nome, recolher, ações --------------------------
    const topo = document.createElement("div");
    topo.className = "refeicao-topo";

    const recolher = document.createElement("button");
    recolher.className = "mini recolher";
    recolher.setAttribute(
      "aria-label",
      refeicao.recolhida ? "Abrir esta refeicao" : "Minimizar esta refeicao",
    );
    recolher.setAttribute("aria-expanded", String(!refeicao.recolhida));
    recolher.title = refeicao.recolhida ? "Abrir" : "Recolher";
    recolher.textContent = refeicao.recolhida ? "▸" : "▾";
    recolher.onclick = () => {
      refeicao.recolhida = !refeicao.recolhida;
      guardarDieta();
      desenharDieta();
    };

    const hora = document.createElement("input");
    hora.type = "time";
    hora.className = "hora";
    // Sem rotulo associado, o leitor de tela anuncia so "campo de hora" e
    // nao diz de QUAL refeicao -- e numa tela com seis refeicoes isso nao
    // ajuda ninguem.
    hora.setAttribute("aria-label", `Horario de ${refeicao.nome || "refeicao"}`);
    hora.value = refeicao.horario ?? "";
    hora.oninput = () => {
      refeicao.horario = hora.value;
      guardarDieta();
    };

    const nome = document.createElement("input");
    nome.value = refeicao.nome;
    nome.setAttribute("aria-label", "Nome da refeicao");
    nome.oninput = () => {
      refeicao.nome = nome.value;
      guardarDieta();
    };

    const duplicar = document.createElement("button");
    duplicar.className = "mini";
    duplicar.textContent = "duplicar";
    duplicar.title = "Copiar esta refeição inteira";
    duplicar.onclick = () => {
      dieta.refeicoes.splice(iR + 1, 0, duplicarRefeicao(refeicao));
      guardarDieta();
      desenharDieta();
    };

    const remover = document.createElement("button");
    remover.className = "mini";
    remover.textContent = "remover";
    remover.onclick = () => {
      if (!window.confirm(`Remover "${refeicao.nome}"?`)) return;
      dieta.refeicoes.splice(iR, 1);
      guardarDieta();
      desenharDieta();
    };

    topo.append(recolher, hora, nome, duplicar, remover);
    bloco.append(topo);

    // Recolhida mostra o resumo: é para isso que serve recolher.
    if (refeicao.recolhida) {
      const resumo = document.createElement("p");
      resumo.className = "nota resumo-refeicao";
      const itens = opcaoAtiva(refeicao).itens ?? [];
      const kcal = somar(itens.map((it) => {
        const a = alimentoPorId(it.codigo);
        return a ? porGramas(valorDe(a, "energia_kcal"), gramasDoItem(it)) : null;
      }));
      resumo.textContent = itens.length
        ? `${itens.map((it) => it.nome).join(", ")} · ${mostrar(kcal.total, 0)} kcal`
        : "Sem alimentos.";
      bloco.append(resumo);
      caixa.append(bloco);
      return;
    }

    // ---- abas de opção --------------------------------------------------
    const abas = document.createElement("div");
    abas.className = "opcoes";
    // Mais de uma opção? Cada aba ganha um "×" para apagar AQUELA opção. O
    // "− opção" de antes apagava só a opção aberta e era um textinho fácil
    // de não achar -- e estando na Principal, apagava a Principal sem
    // querer. O × em cada aba diz exatamente qual sai.
    const podeApagar = refeicao.opcoes.length > 1;
    refeicao.opcoes.forEach((opcao, iO) => {
      const aba = document.createElement("span");
      aba.className = "opcao-wrap";

      const botao = document.createElement("button");
      botao.className = "opcao";
      botao.setAttribute("aria-pressed", String(iO === refeicao.opcaoAtiva));
      botao.textContent = opcao.rotulo;
      botao.onclick = () => {
        refeicao.opcaoAtiva = iO;
        guardarDieta();
        desenharDieta();
      };
      botao.ondblclick = () => {
        const novo = window.prompt("Nome desta opção:", opcao.rotulo);
        if (novo && novo.trim()) {
          opcao.rotulo = novo.trim();
          guardarDieta();
          desenharDieta();
        }
      };
      aba.append(botao);

      if (podeApagar) {
        const apagar = document.createElement("button");
        apagar.className = "opcao-x";
        apagar.textContent = "×";
        apagar.title = `Apagar "${opcao.rotulo}"`;
        apagar.setAttribute("aria-label", `Apagar a opção ${opcao.rotulo}`);
        apagar.onclick = (e) => {
          e.stopPropagation();
          const n = opcao.itens?.length ?? 0;
          if (n && !window.confirm(
            `Apagar "${opcao.rotulo}" e os ${n} ${n === 1 ? "alimento" : "alimentos"} dela?`,
          )) return;
          dieta.refeicoes[iR] = removerOpcao(refeicao, iO);
          guardarDieta();
          desenharDieta();
        };
        aba.append(apagar);
      }

      abas.append(aba);
    });

    const maisOpcao = document.createElement("button");
    maisOpcao.className = "mini";
    maisOpcao.textContent = "+ opção";
    maisOpcao.title = "Outra versão desta mesma refeição. Só a aberta entra no total do dia.";
    maisOpcao.onclick = () => {
      dieta.refeicoes[iR] = acrescentarOpcao(refeicao);
      guardarDieta();
      desenharDieta();
    };
    abas.append(maisOpcao);
    bloco.append(abas);

    if (refeicao.opcoes.length > 1) {
      const aviso = document.createElement("p");
      aviso.className = "nota";
      aviso.textContent =
        "As opções são o mesmo horário: só a que está aberta entra no total do dia.";
      bloco.append(aviso);
    }

    const opcao = opcaoAtiva(refeicao);
    // Está numa opção que não é a Principal? Então mostra a Referência.
    const ehSecundaria = (refeicao.opcaoAtiva ?? 0) !== 0 && (refeicao.opcoes?.length ?? 0) > 1;

    // ---- a tabela da opção aberta ---------------------------------------
    // Numa opção secundária a tabela aparece mesmo vazia: o rodapé traz a
    // Referência da Principal, que é o alvo que ela está perseguindo. Sem
    // isto, a "Opção 2" recém-criada não teria onde mostrar o alvo.
    if (opcao.itens.length || ehSecundaria) {
      const tabela = document.createElement("table");
      tabela.innerHTML =
        "<thead><tr><th>Alimento</th><th>Qtd.</th><th>Medida</th><th>g</th>" +
        MACROS.map(([, r]) => `<th>${r}</th>`).join("") +
        "<th></th></tr></thead>";
      const corpo = document.createElement("tbody");

      // As células ficam guardadas para serem reescritas quando ela mexe na
      // quantidade. Redesenhar a tabela a cada tecla tiraria o cursor do
      // campo no meio do número.
      const celulas = [];
      const gramasTd = [];
      const rodapeCelulas = [];
      /** Por item: as células de cada substituto, reescritas junto. */
      const celulasSubst = [];

      const recalcular = () => {
        opcao.itens.forEach((item, iI) => {
          const a = alimentoPorId(item.codigo);
          const g = gramasDoItem(item);
          if (gramasTd[iI]) gramasTd[iI].textContent = mostrar(g, 0);
          MACROS.forEach(([chave, , casas], iM) => {
            const td = celulas[iI]?.[iM];
            if (td) {
              const { texto, dica } = textoDaCelula(a, chave, g, casas);
              td.textContent = texto;
              td.title = dica;
            }
          });
          // Os substitutos seguem o principal: mudou o frango, muda o peixe.
          (item.substitutos ?? []).forEach((sub, iS) => {
            const c = celulasSubst[iI]?.[iS];
            if (!c) return;
            const troca = alimentoPorId(sub.codigo);
            const porcao = porcaoDoSubstituto(item, sub);
            if (!porcao) {
              c.qtd.textContent = "—";
              c.qtd.title =
                `Não dá para igualar por ${CRITERIOS[item.igualarPor ?? CRITERIO_PADRAO]}: ` +
                "a tabela não traz esse valor, ou este alimento não tem nada dele. Troque o critério ali embaixo.";
              c.g.textContent = "—";
              c.macros.forEach((td) => (td.textContent = "—"));
              return;
            }
            c.qtd.title = "";
            c.qtd.textContent = mostrar(porcao.quantidade, porcao.quantidade % 1 ? 1 : 0);
            c.g.textContent = mostrar(porcao.gramas, 0);
            MACROS.forEach(([chave, , casas], iM) => {
              const v = troca ? porGramas(valorDe(troca, chave), porcao.gramas) : null;
              c.macros[iM].textContent = mostrar(v, casas);
            });
          });
        });
        MACROS.forEach(([chave, , casas], iM) => {
          const { total, faltando, tracos } = somaDoNutriente(opcao.itens, chave);
          if (rodapeCelulas[iM]) {
            rodapeCelulas[iM].textContent =
              (total === null ? (tracos ? "Tr" : "—") : mostrar(total, casas)) + (faltando ? " *" : "");
          }
          // Referência e diferença: só existem na opção secundária.
          if (opcaoDeReferencia) {
            const ref = somaDoNutriente(opcaoDeReferencia.itens ?? [], chave).total;
            if (rodapeReferencia[iM]) {
              rodapeReferencia[iM].textContent = ref === null ? "—" : mostrar(ref, casas);
            }
            const dTd = rodapeDiferenca[iM];
            if (dTd) {
              const d = (total ?? 0) - (ref ?? 0);
              const alvo = ref ?? 0;
              // Perto do alvo (até 5%, ou uma unidade cheia) é "bateu":
              // verde. Longe, vinho. Assim o olho acha rápido o que ainda
              // falta ajustar para igualar a Principal.
              const tolerancia = Math.max(alvo * 0.05, casas === 0 ? 10 : 1);
              dTd.className = Math.abs(d) <= tolerancia ? "dif-ok" : "dif-longe";
              // `Math.abs` no `mostrar` evita o sinal duplo e o separador de
              // milhar do pt-BR; o sinal é posto à mão.
              const quaseZero = Math.abs(d) < (casas === 0 ? 0.5 : 0.05);
              dTd.textContent = quaseZero
                ? "0"
                : (d > 0 ? "+" : "−") + mostrar(Math.abs(d), casas);
            }
          }
        });
        totais();
      };

      opcao.itens.forEach((item, iI) => {
        const alimento = alimentoPorId(item.codigo);
        const tr = document.createElement("tr");

        const nomeTd = document.createElement("td");
        nomeTd.textContent = alimento ? alimento.nome : item.nome;
        if (alimento) {
          const marca = document.createElement("span");
          marca.className = "fonte";
          marca.textContent = etiquetaDaFonte(alimento.fonte);
          nomeTd.append(" ", marca);
        }

        // O selo dos substitutos: mostra quantos há, e abre e fecha a lista.
        const nSubst = item.substitutos?.length ?? 0;
        const selo = document.createElement("button");
        selo.type = "button";
        selo.className = nSubst ? "selo-subst" : "mini selo-subst-vazio";
        selo.textContent = nSubst ? `⇄ ${nSubst}` : "+ substituto";
        selo.title = nSubst
          ? `${nSubst} ${nSubst === 1 ? "substituto" : "substitutos"}, com a gramatura já calculada. Tocar abre e fecha.`
          : "Alimentos que podem trocar este, com a gramatura calculada sozinha";
        selo.setAttribute("aria-expanded", String(Boolean(item.verSubstitutos)));
        selo.onclick = () => {
          item.substitutos ??= [];
          item.igualarPor ??= CRITERIO_PADRAO;
          item.verSubstitutos = !item.verSubstitutos;
          guardarDieta();
          desenharDieta();
        };
        nomeTd.append(" ", selo);

        const qtdTd = document.createElement("td");
        const qtdInput = document.createElement("input");
        qtdInput.type = "text";
        qtdInput.inputMode = "decimal";
        qtdInput.value = String(item.quantidade).replace(".", ",");
        qtdInput.style.width = "64px";
        qtdInput.style.textAlign = "right";
        qtdInput.oninput = () => {
          item.quantidade = numNaoNegativo(qtdInput.value, qtdInput);
          guardarDieta();
          recalcular();
        };
        qtdTd.append(qtdInput);

        const medidaTd = document.createElement("td");
        const medidaSel = document.createElement("select");
        const medidas = medidasDoAlimento(item.codigo);
        medidas.forEach((m, mI) => {
          const op = document.createElement("option");
          // A posição na lista, e não "nome|gramas": um nome com barra
          // vertical quebraria a leitura de volta, e o par inteiro deixaria
          // de casar assim que as gramas mudassem.
          op.value = String(mI);
          op.textContent = rotuloDaMedida(m);
          if (m.ref) op.title = m.ref;
          medidaSel.append(op);
        });

        // "100 g de milho = 1 unidade": a medida caseira tem que poder nascer
        // em cima de um alimento da TACO, não só dos que ela mesma cadastra.
        // Fica aqui dentro, e não num botão à parte, porque é exatamente aqui
        // que ela percebe que a medida falta.
        const criar = document.createElement("option");
        criar.value = "nova";
        criar.textContent = "＋ criar medida…";
        medidaSel.append(criar);

        // A medida guardada é reencontrada PELO NOME. Se ela editar o whey e
        // o scoop passar de 30 g para 32 g, a dieta já montada passa a
        // contar 32 g — antes o par não casava com opção nenhuma, o select
        // caía calado para "g" e a conta seguia com os 30 g velhos, que é o
        // pior dos dois mundos: mostra uma coisa e soma outra.
        const daLista = medidas.findIndex(
          (m) => m.nome.toLowerCase() === String(item.medida?.nome ?? "").toLowerCase(),
        );
        const escolhida = daLista >= 0 ? daLista : 0;
        const medidaAgora = medidas[escolhida] ?? { ...MEDIDA_GRAMA };
        medidaSel.value = String(escolhida);
        if (
          medidaAgora.nome !== item.medida?.nome ||
          medidaAgora.gramas !== item.medida?.gramas
        ) {
          item.medida = { ...medidaAgora };
          guardarDieta();
        }

        // Trocar a unidade não muda o que a paciente come: o prato continua
        // com as mesmas gramas, só escritas de outro jeito. 100 g de whey
        // viram 3,33 scoops, e não 100 scoops — sem esta conversão o total
        // do dia saltava de 380 kcal para 11.400 num clique de dropdown, e
        // ela só descobriria conferindo a soma na mão.
        medidaSel.onchange = () => {
          if (medidaSel.value === "nova") {
            criarMedida(item.codigo, alimento ? alimento.nome : item.nome);
            desenharDieta();
            return;
          }
          const antes = gramasDoItem(item);
          item.medida = { ...(medidas[Number(medidaSel.value)] ?? MEDIDA_GRAMA) };
          item.quantidade = Math.round((antes / item.medida.gramas) * 100) / 100;
          qtdInput.value = String(item.quantidade).replace(".", ",");
          guardarDieta();
          recalcular();
        };
        medidaTd.append(medidaSel);

        const gTd = document.createElement("td");
        gramasTd[iI] = gTd;

        tr.append(nomeTd, qtdTd, medidaTd, gTd);

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
        x.title = "Tirar este alimento";
        x.onclick = () => {
          opcao.itens.splice(iI, 1);
          guardarDieta();
          desenharDieta();
        };
        acaoTd.append(x);
        tr.append(acaoTd);
        corpo.append(tr);

        if (item.verSubstitutos) linhasDeSubstitutos(item, iI);
      });

      /**
       * As sub-linhas do item: um substituto por linha, com a gramatura que
       * sai da conta, e no fim o critério e a busca para acrescentar outro.
       * Nenhuma delas entra no subtotal — ver `dieta.mjs`.
       */
      function linhasDeSubstitutos(item, iI) {
        item.substitutos ??= [];
        celulasSubst[iI] = [];
        item.substitutos.forEach((sub, iS) => {
          const troca = alimentoPorId(sub.codigo);
          const tr = document.createElement("tr");
          tr.className = "subst";

          const nomeTd = document.createElement("td");
          const ou = document.createElement("span");
          ou.className = "subst-ou";
          ou.textContent = "ou";
          nomeTd.append(ou, " ", troca ? troca.nome : sub.nome);
          if (troca) {
            const marca = document.createElement("span");
            marca.className = "fonte";
            marca.textContent = etiquetaDaFonte(troca.fonte);
            nomeTd.append(" ", marca);
          }

          const qtdTd = document.createElement("td");
          const medidaTd = document.createElement("td");
          const medidas = medidasDoAlimento(sub.codigo);
          const sel = document.createElement("select");
          sel.setAttribute("aria-label", `Medida de ${troca ? troca.nome : sub.nome}`);
          medidas.forEach((m, mI) => {
            const op = document.createElement("option");
            op.value = String(mI);
            op.textContent = rotuloDaMedida(m);
            if (m.ref) op.title = m.ref;
            sel.append(op);
          });
          // Pelo nome, como no item principal: medida editada continua casando.
          const achada = medidas.findIndex(
            (m) => m.nome.toLowerCase() === String(sub.medida?.nome ?? "").toLowerCase(),
          );
          sel.value = String(achada >= 0 ? achada : 0);
          sub.medida = { ...(medidas[achada >= 0 ? achada : 0] ?? MEDIDA_GRAMA) };
          sel.onchange = () => {
            sub.medida = { ...(medidas[Number(sel.value)] ?? MEDIDA_GRAMA) };
            guardarDieta();
            recalcular();
          };
          medidaTd.append(sel);

          const gTd = document.createElement("td");
          tr.append(nomeTd, qtdTd, medidaTd, gTd);
          const macros = MACROS.map(() => {
            const td = document.createElement("td");
            tr.append(td);
            return td;
          });

          const acaoTd = document.createElement("td");
          const x = document.createElement("button");
          x.className = "mini";
          x.textContent = "×";
          x.title = "Tirar este substituto";
          x.onclick = () => {
            item.substitutos.splice(iS, 1);
            guardarDieta();
            desenharDieta();
          };
          acaoTd.append(x);
          tr.append(acaoTd);
          corpo.append(tr);
          celulasSubst[iI][iS] = { qtd: qtdTd, g: gTd, macros };
        });

        const trNovo = document.createElement("tr");
        trNovo.className = "subst subst-novo";
        const td = document.createElement("td");
        td.colSpan = 5 + MACROS.length;
        const linha = document.createElement("div");
        linha.className = "subst-controles";

        const rotulo = document.createElement("label");
        rotulo.className = "nota";
        rotulo.textContent = "Igualar por ";
        const criterio = document.createElement("select");
        for (const [chave, nome] of Object.entries(CRITERIOS)) {
          const op = document.createElement("option");
          op.value = chave;
          op.textContent = nome;
          criterio.append(op);
        }
        criterio.value = item.igualarPor ?? CRITERIO_PADRAO;
        criterio.onchange = () => {
          item.igualarPor = criterio.value;
          guardarDieta();
          recalcular();
        };
        rotulo.append(criterio);

        const principal = alimentoPorId(item.codigo);
        const busca = campoDeBusca(
          (a) => {
            item.substitutos.push({ codigo: a.id, nome: a.nome, medida: { ...MEDIDA_GRAMA } });
          },
          `Substituto de ${principal ? principal.nome.split(",")[0] : "este alimento"}…`,
        );
        busca.style.marginTop = "0";
        busca.classList.add("subst-busca");
        linha.append(busca, rotulo);
        td.append(linha);
        trNovo.append(td);
        corpo.append(trNovo);
      }

      const rodape = document.createElement("tfoot");
      const trF = document.createElement("tr");
      trF.innerHTML = "<td>Subtotal</td><td></td><td></td><td></td>";
      for (const [, ,] of MACROS) {
        const td = document.createElement("td");
        rodapeCelulas.push(td);
        trF.append(td);
      }
      trF.append(document.createElement("td"));
      rodape.append(trF);

      // Quando ela NÃO está na Principal, o rodapé ganha duas linhas: a
      // Referência (os macros da opção Principal) e a Diferença. É o que
      // deixa montar "Opção 2" perseguindo os macros da Principal, em vez
      // de às cegas — pedido dela, igual ao que outros apps mostram.
      const opcaoDeReferencia = ehSecundaria ? refeicao.opcoes[0] : null;
      const rodapeReferencia = [];
      const rodapeDiferenca = [];
      if (ehSecundaria) {
        const trRef = document.createElement("tr");
        trRef.className = "referencia";
        trRef.innerHTML = "<td>Referência (Principal)</td><td></td><td></td><td></td>";
        for (const [, ,] of MACROS) {
          const td = document.createElement("td");
          rodapeReferencia.push(td);
          trRef.append(td);
        }
        trRef.append(document.createElement("td"));

        const trDif = document.createElement("tr");
        trDif.className = "diferenca";
        trDif.innerHTML = "<td>Diferença</td><td></td><td></td><td></td>";
        for (const [, ,] of MACROS) {
          const td = document.createElement("td");
          rodapeDiferenca.push(td);
          trDif.append(td);
        }
        trDif.append(document.createElement("td"));
        rodape.append(trRef, trDif);
      }
      tabela.append(corpo, rodape);
      const rolagem = document.createElement("div");
      rolagem.className = "tabela-rolagem";
      rolagem.append(tabela);
      bloco.append(rolagem);
      recalcular();
    }

    bloco.append(
      campoDeBusca((alimento) => {
        const eraOPrimeiro = opcao.itens.length === 0;
        opcao.itens.push({
          codigo: alimento.id,
          nome: alimento.nome,
          quantidade: 100,
          medida: { ...MEDIDA_GRAMA },
        });
        if (eraOPrimeiro) {
          sugestaoAberta = { iR, iO: refeicao.opcaoAtiva, codigo: alimento.id, nome: alimento.nome, ignoradas: new Set() };
        }
      }),
    );

    // ---- sugestões para acompanhar o primeiro alimento ------------------
    const painel = painelDeSugestoes(opcao, iR, refeicao.opcaoAtiva);
    if (painel) bloco.append(painel);

    // ---- grupos favoritos -----------------------------------------------
    const grupos = listarGrupos();
    if (grupos.length) {
      const linha = document.createElement("div");
      linha.className = "grupos-atalho";
      const rotulo = document.createElement("span");
      rotulo.className = "nota";
      rotulo.textContent = "Grupos:";
      linha.append(rotulo);
      for (const g of grupos) {
        const b = document.createElement("button");
        b.className = "mini";
        b.textContent = `+ ${g.nome}`;
        b.title = `Acrescentar os ${g.itens.length} alimentos deste grupo`;
        b.onclick = () => {
          opcao.itens.push(...g.itens.map((i) => normalizarItem(i)));
          guardarDieta();
          desenharDieta();
        };
        linha.append(b);
      }
      bloco.append(linha);
    }

    caixa.append(bloco);
  });

  totais();
}

/**
 * Todas as medidas que servem para aquele alimento, grama incluída.
 *
 * Duas fontes desembocam aqui: a medida que nasce junto com o alimento dela
 * ("scoop = 30 g" no cadastro do whey) e a medida que ela cria depois, por
 * cima de um alimento qualquer ("1 unidade = 100 g" no milho da TACO). Nada
 * impede que as duas tenham o mesmo nome, e aí a lista mostraria "scoop"
 * duas vezes, com gramas diferentes, sem ela saber qual é qual. Vence a de
 * cima, e "g" nunca é sobrescrita.
 */
function medidasDoAlimento(codigo) {
  const alimento = alimentoPorId(codigo);
  const proprias =
    alimento?.fonte === "meu" || alimento?.fonte === "importada"
      ? (alimento.bruto.medidas ?? [])
      : [];
  // As de tabela vêm POR ÚLTIMO: se ela criar a própria "unidade" do kiwi,
  // é a dela que vale, e a oficial sai da lista.
  const padrao = (MEDIDAS_PADRAO[alimento?.id ?? codigo] ?? []).map((m) =>
    Array.isArray(m) ? { nome: m[0], gramas: m[1], ref: "USDA SR28 · porção oficial do próprio alimento" } : { nome: m.n, gramas: m.g, ref: m.ref },
  );
  const saida = [];
  for (const m of [MEDIDA_GRAMA, ...proprias, ...medidasDe(codigo), ...padrao]) {
    const nome = String(m?.nome ?? "").trim();
    const gramas = Number(m?.gramas);
    if (!nome || !Number.isFinite(gramas) || gramas <= 0) continue;
    if (saida.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
    saida.push(m.ref ? { nome, gramas, ref: m.ref } : { nome, gramas });
  }
  return saida;
}

/**
 * "unidade (69 g)". Medida miúda leva uma casa: "unidade (1 g)" para a
 * amêndoa esconderia que são 1,2 g — e dez amêndoas dariam 10 g, não 12.
 */
function rotuloDaMedida(m) {
  if (m.nome === "g") return "g";
  const casas = m.gramas < 10 && m.gramas % 1 ? 1 : 0;
  return `${m.nome} (${mostrar(m.gramas, casas)} g)`;
}

/**
 * Uma medida caseira nova para aquele alimento, das tabelas ou dela.
 *
 * Guarda em `salvarMedidas`, que é por código: a unidade que ela criou para
 * o milho vale para toda dieta em que o milho entrar, hoje e daqui a seis
 * meses. Não é um apelido daquela linha.
 */
function criarMedida(codigo, nome) {
  const comoChama = window.prompt(`Como se chama a medida de "${nome}"? (ex.: unidade, colher, fatia)`);
  if (comoChama === null || !comoChama.trim()) return;

  const quanto = window.prompt(`Quantas gramas tem 1 ${comoChama.trim()} de "${nome}"?`);
  if (quanto === null) return;

  const novas = [...medidasDe(codigo), { nome: comoChama, gramas: quanto }];
  const gravadas = salvarMedidas(codigo, novas);
  if (!gravadas.some((m) => m.nome.toLowerCase() === comoChama.trim().toLowerCase())) {
    window.alert(
      `Não consegui guardar "${comoChama.trim()}". ` +
        "As gramas têm que ser um número maior que zero, e o nome não pode repetir uma medida que já existe neste alimento.",
    );
  }
}

/**
 * Campo de busca com sugestões, teclado incluso. Quem decide onde o
 * alimento entra é `aoEscolher`: na opção aberta, ou nos substitutos de um
 * item.
 */
/**
 * O painel "costuma acompanhar": sugestões tiradas do que ela já montou (ver
 * `sugestoes.mjs`). Nada entra na dieta sem o clique em "usar".
 */
function painelDeSugestoes(opcao, iR, iO) {
  const aberta = sugestaoAberta;
  if (!aberta || aberta.iR !== iR || aberta.iO !== iO) return null;
  // O alimento de partida saiu da opção: as sugestões perderam o sentido.
  if (!opcao.itens.some((i) => i.codigo === aberta.codigo)) return null;

  const sugestoes = montarSugestoes({
    fichas: listarFichas(),
    grupos: listarGrupos(),
    codigoBase: aberta.codigo,
    jaNaOpcao: new Set(opcao.itens.map((i) => i.codigo)),
    memoria: lerMemoria(),
  }).filter((x) => !aberta.ignoradas.has(x.codigo));
  if (!sugestoes.length) return null;

  const caixa = document.createElement("div");
  caixa.className = "sugestoes-refeicao";
  caixa.setAttribute("role", "region");
  caixa.setAttribute("aria-label", `Sugestões para acompanhar ${aberta.nome}`);

  const titulo = document.createElement("div");
  titulo.className = "nota";
  titulo.textContent = `Costuma acompanhar ${aberta.nome}:`;
  caixa.append(titulo);

  for (const x of sugestoes) {
    const linha = document.createElement("div");
    linha.className = "sugestao-linha";

    const nome = document.createElement("span");
    nome.className = "sugestao-nome";
    nome.textContent = `${x.nome} · ${mostrar(x.quantidade, x.quantidade % 1 ? 1 : 0)} ${x.medida.nome}`;
    nome.title =
      x.origem === "grupo"
        ? `Está no seu grupo "${x.grupos.join('", "')}"`
        : x.vezes > 1
          ? `Apareceu junto ${x.vezes} vezes nas suas dietas salvas`
          : "Apareceu junto numa das suas dietas salvas";

    const usar = document.createElement("button");
    usar.className = "mini";
    usar.textContent = "usar";
    usar.setAttribute("aria-label", `Usar ${x.nome}`);
    usar.onclick = () => {
      opcao.itens.push(
        normalizarItem({ codigo: x.codigo, nome: x.nome, quantidade: x.quantidade, medida: { ...x.medida } }),
      );
      gravarMemoria(registrar(lerMemoria(), aberta.codigo, x.codigo, "aceita"));
      guardarDieta();
      desenharDieta();
    };

    const ignorar = document.createElement("button");
    ignorar.className = "mini";
    ignorar.textContent = "ignorar";
    ignorar.setAttribute("aria-label", `Ignorar ${x.nome}`);
    ignorar.onclick = () => {
      aberta.ignoradas.add(x.codigo);
      gravarMemoria(registrar(lerMemoria(), aberta.codigo, x.codigo, "ignorada"));
      desenharDieta();
    };

    linha.append(nome, usar, ignorar);
    caixa.append(linha);
  }

  const fechar = document.createElement("button");
  fechar.className = "mini";
  fechar.textContent = "fechar sugestões";
  fechar.onclick = () => {
    sugestaoAberta = null;
    desenharDieta();
  };
  caixa.append(fechar);
  return caixa;
}

function campoDeBusca(aoEscolher, dica = "Buscar alimento e apertar Enter") {
  const caixa = document.createElement("div");
  caixa.className = "busca";
  caixa.style.marginTop = "10px";

  const campo = document.createElement("input");
  campo.placeholder = dica;
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
    aoEscolher(alimento);
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
    // abria. Silêncio, para quem está montando uma dieta, lê-se como "este
    // alimento não existe nas tabelas".
    if (!achados.length) {
      if (semAcento(campo.value).replace(/[^a-z0-9]/g, "").length < 2) return fechar();
      const aviso = document.createElement("div");
      aviso.className = "nada";
      aviso.innerHTML =
        "Nada com essas palavras nas tabelas.<br><small>" +
        "Tente uma palavra só, ou o nome genérico. Marca de produto elas não têm — " +
        "cadastre em “Meus alimentos”, ali embaixo." +
        "</small>";
      lista.append(aviso);
      lista.hidden = false;
      return;
    }

    achados.forEach((a, i) => {
      const linha = document.createElement("div");
      // textContent, não innerHTML: nome de alimento cadastrado ou importado
      // não pode virar código na página.
      const semKcal = valorDe(a, "energia_kcal") === null;
      const apoio = document.createElement("small");
      apoio.textContent =
        `${etiquetaDaFonte(a.fonte)}${a.grupo ? ` · ${a.grupo}` : ""}` +
        // O leite integral da TACO não tem energia nem macros na própria
        // planilha ("*"). Escolhê-lo somava zero caloria sem ela perceber.
        (semKcal ? " · sem calorias nesta tabela" : "");
      linha.append(a.nome, document.createElement("br"), apoio);
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
  // Só a opção aberta de cada refeição. Ver `itensDoDia` em dieta.mjs: duas
  // opções de café da manhã somadas dariam dois cafés da manhã no dia.
  const todos = itensDoDia(dieta.refeicoes);
  const soma = {};
  const incompleto = {};
  let faltouAlgo = 0;
  let tracosNoDia = 0;

  for (const [chave] of MACROS) {
    const { total, faltando, tracos } = somaDoNutriente(todos, chave);
    soma[chave] = total;
    incompleto[chave] = faltando > 0;
    faltouAlgo += faltando;
    tracosNoDia += tracos;
  }
  // O asterisco vai em CADA nutriente incompleto, não só no aviso de baixo:
  // "Fibra 10,9 g" sem marca parecia completo quando faltava o frango.
  const marca = (chave) => (incompleto[chave] ? " *" : "");

  const peso = numNaoNegativo($("d-peso").value, $("d-peso"));
  const meta = numNaoNegativo($("d-meta").value, $("d-meta"));
  const dist = distribuicao(soma.carboidrato, soma.proteina, soma.lipideos);

  // "— g" seria estranho, e "0,0 g" seria mentira: o que não foi medido sai
  // como travessão sozinho.
  const gramas = (v, chave) => (v === null ? "—" : `${mostrar(v, 1)} g${marca(chave)}`);
  const apoio = (chave, valor) =>
    dist
      ? `${mostrar(dist[chave], 0)}%` + (peso ? ` · ${mostrar(porQuilo(valor, peso), 1)} g/kg` : "")
      : "";

  const linhas = [
    // "meta 1600 · 150" não dizia se as 150 estavam acima ou abaixo. Agora diz.
    [
      "Calorias",
      mostrar(soma.energia_kcal, 0) + marca("energia_kcal"),
      meta && soma.energia_kcal !== null
        ? `meta ${mostrar(meta, 0)} · ${mostrar(Math.abs(soma.energia_kcal - meta), 0)} ${
            soma.energia_kcal >= meta ? "acima" : "abaixo"
          }`
        : "",
    ],
    ["Carboidrato", gramas(soma.carboidrato, "carboidrato"), apoio("carboidrato", soma.carboidrato)],
    ["Proteína", gramas(soma.proteina, "proteina"), apoio("proteina", soma.proteina)],
    ["Gordura", gramas(soma.lipideos, "lipideos"), apoio("lipideo", soma.lipideos)],
    ["Fibra", gramas(soma.fibra_alimentar, "fibra_alimentar"), ""],
  ];

  $("total-dia").innerHTML =
    "<dl>" +
    linhas
      .map(([t, v, apoio]) => `<div><dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd></div>`)
      .join("") +
    "</dl>";

  $("aviso-dados").innerHTML =
    (faltouAlgo
      ? `<div class="aviso">${faltouAlgo} ${faltouAlgo === 1 ? "valor não existe" : "valores não existem"} na tabela para os alimentos escolhidos (marcados com <strong>*</strong>). Eles não entraram como zero — o total está incompleto nesses nutrientes, e é bom saber disso antes de fechar a prescrição.</div>`
      : "") +
    (tracosNoDia
      ? `<p class="nota">${tracosNoDia} ${tracosNoDia === 1 ? "valor é" : "valores são"} <strong>Tr</strong> (traço, na TACO): presente em quantidade mínima, sem número para somar. Não entram no total e não o deixam incompleto.</p>`
      : "");
}

/**
 * A dieta em texto, para colar no WhatsApp.
 *
 * Sai com TODAS as opções, não só a aberta: para a paciente, "ou isto ou
 * aquilo" é justamente o que ela precisa ler. Quem conta uma só é o total
 * do dia, que é conta, não cardápio.
 */
function textoDaDieta() {
  const linhas = [];
  if ($("f-nome")?.value?.trim()) linhas.push($("f-nome").value.trim(), "");

  for (const r of dieta.refeicoes) {
    const temAlgo = r.opcoes.some((o) => o.itens.length);
    if (!temAlgo) continue;
    linhas.push(`${r.horario ? `${r.horario} · ` : ""}${r.nome.toUpperCase()}`);

    r.opcoes.forEach((opcao, i) => {
      if (!opcao.itens.length) return;
      if (r.opcoes.length > 1) linhas.push(`  [${opcao.rotulo}]`);
      for (const item of opcao.itens) {
        const a = alimentoPorId(item.codigo);
        const g = gramasDoItem(item);
        const kcal = a ? porGramas(valorDe(a, "energia_kcal"), g) : null;
        const medida = porcaoEmTexto(item.quantidade, item.medida, g);
        linhas.push(
          `    ${a ? a.nome : item.nome} — ${medida}${kcal !== null ? ` · ${mostrar(kcal, 0)} kcal` : ""}`,
        );
        // Substituto sem conta possível não vai: "ou patinho —" sem gramas
        // deixaria a paciente sem saber quanto comer.
        for (const sub of item.substitutos ?? []) {
          const porcao = porcaoDoSubstituto(item, sub);
          if (!porcao) continue;
          const troca = alimentoPorId(sub.codigo);
          linhas.push(
            `      ou ${troca ? troca.nome : sub.nome} — ${porcaoEmTexto(porcao.quantidade, sub.medida, porcao.gramas)}`,
          );
        }
      }
      if (i < r.opcoes.length - 1 && r.opcoes[i + 1].itens.length) linhas.push("    — ou —");
    });
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

/**
 * Faixas do que um corpo humano adulto (ou adolescente) pode medir.
 *
 * NÃO SÃO LIMITES CLÍNICOS — são limites de DIGITAÇÃO. Antes daqui, altura
 * "1,65" num campo em centímetros dava IMC 236.914 "Obesidade grau III", peso
 * negativo dava massa gorda negativa, e uma dobra de −20 mm entrava na soma.
 * Valor fora da faixa não entra na conta: a tela diz qual foi e por quê.
 */
const FAIXAS_DIGITACAO = {
  idade: { min: 2, max: 110, nome: "Idade", unidade: "anos" },
  peso: { min: 10, max: 350, nome: "Peso", unidade: "kg" },
  altura: { min: 80, max: 230, nome: "Altura", unidade: "cm" },
  dobra: { min: 1, max: 80, nome: "Dobra", unidade: "mm" },
  circunferencia: { min: 10, max: 250, nome: "Circunferência", unidade: "cm" },
};

/**
 * Lê um campo numérico e confere a faixa. Devolve o número, ou 0 (vazio)
 * quando o valor é impossível — e, nesse caso, deixa a explicação em `avisos`.
 */
function lerMedida(id, faixa, avisos, rotulo = faixa.nome) {
  const bruto = String($(id)?.value ?? "").trim();
  if (!bruto) return 0;
  const n = Number(bruto.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) {
    avisos.push(`${rotulo}: não entendi "${bruto}" como número — não entrou na conta.`);
    return 0;
  }
  if (n === 0) return 0;
  if (n < 0) {
    avisos.push(`${rotulo}: valor negativo (${bruto}) não existe — não entrou na conta.`);
    return 0;
  }
  if (faixa === FAIXAS_DIGITACAO.altura && n > 0.5 && n < 2.6) {
    avisos.push(
      `Altura: ${bruto} parece estar em metros. O campo é em centímetros — escreva ${mostrar(n * 100, 0)}.`,
    );
    return 0;
  }
  if (n < faixa.min || n > faixa.max) {
    avisos.push(
      `${rotulo}: ${bruto} ${faixa.unidade} está fora do que dá para medir ` +
        `(${faixa.min} a ${faixa.max} ${faixa.unidade}) — confira a digitação. Não entrou na conta.`,
    );
    return 0;
  }
  return n;
}

const caixaDeAviso = (linhas) =>
  linhas.length ? `<div class="aviso">${linhas.map(escaparHtml).join("<br>")}</div>` : "";

function calcularCorpo() {
  const sexo = $("c-sexo").value;
  const avisosDados = [];
  const idade = lerMedida("c-idade", FAIXAS_DIGITACAO.idade, avisosDados);
  // Lactente e criança pequena pesam menos de 10 kg: sem idade (ou abaixo de 10 anos) o piso é 2 kg.
  const faixaDoPeso = !idade || idade < 10 ? { ...FAIXAS_DIGITACAO.peso, min: 2 } : FAIXAS_DIGITACAO.peso;
  const peso = lerMedida("c-peso", faixaDoPeso, avisosDados);
  const alturaCm = lerMedida("c-altura", FAIXAS_DIGITACAO.altura, avisosDados);
  const protocolo = $("c-protocolo").value;
  const dados = PROTOCOLOS[protocolo];
  const usadas = dados.dobras[sexo];
  const nomes = usadas.map((c) => DOBRAS.find(([k]) => k === c)[1].toLowerCase()).join(", ");

  $("quais-dobras").textContent = usadas.length
    ? `${dados.rotulo}: ${dados.percentual || protocolo === "katch" ? "usa" : "soma"} ${nomes}. ${dados.nota}`
    : dados.soMasculinaConferida
      ? `${dados.rotulo}: aqui está só a versão masculina. A feminina tem outros coeficientes e ` +
        "ainda não foi conferida contra a fonte — escolha outra equação para mulher."
      : `${dados.rotulo} não tem equação publicada para este sexo. Escolha outro protocolo.`;

  // Todas as dobras são conferidas, não só as do protocolo: a soma de todas
  // também aparece na tela.
  const dobraLida = {};
  for (const [c, rotulo] of DOBRAS) {
    dobraLida[c] = lerMedida(`dob-${c}`, FAIXAS_DIGITACAO.dobra, avisosDados, `Dobra ${rotulo.toLowerCase()}`);
  }
  for (const [c, rotulo] of CIRCUNFERENCIAS) {
    lerMedida(`cir-${c}`, FAIXAS_DIGITACAO.circunferencia, avisosDados, rotulo);
  }
  $("aviso-dados-corpo").innerHTML = caixaDeAviso(avisosDados);

  const valores = Object.fromEntries(usadas.map((c) => [c, dobraLida[c]]));
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
          DOBRAS.map(([c]) => dobraLida[c]).reduce((t, v) => t + v, 0),
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
      .map(([t, v, apoio]) => `<div><dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd></div>`)
      .join("") +
    "</dl>";

  const avisosCorpo = [];
  const semFaixaDurnin = protocolo === "durnin" && idade && idade < 17;
  if (faltando && soma > 0) {
    avisosCorpo.push(
      `Falta preencher ${faltando} ${faltando === 1 ? "dobra" : "dobras"} deste protocolo. ` +
        "Não calculo o percentual com dobra faltando — o resultado sairia errado sem avisar.",
    );
  } else if (!idade && soma > 0 && dados.usaIdade) {
    avisosCorpo.push("Esta equação usa a idade. Preencha para o percentual aparecer.");
  }
  if (semFaixaDurnin && soma > 0) {
    avisosCorpo.push("Durnin & Womersley não tem coeficientes abaixo de 17 anos — escolha outra equação.");
  }
  if (!semFaixaDurnin && idade && dados.idade && usadas.length && (idade < dados.idade[0] || idade > dados.idade[1])) {
    avisosCorpo.push(
      `${dados.rotulo} foi validada de ${dados.idade[0]} a ${dados.idade[1]} anos, e a idade informada é ` +
        `${mostrar(idade, 0)}. A conta sai, mas o resultado pode não valer para esta pessoa.`,
    );
  }
  $("aviso-corpo").innerHTML = caixaDeAviso(avisosCorpo);

  // Índices e faixas de referência
  const cintura = lerMedida("cir-cintura", FAIXAS_DIGITACAO.circunferencia, []);
  const quadril = lerMedida("cir-quadril", FAIXAS_DIGITACAO.circunferencia, []);
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
      .map(([t, v, apoio]) => `<div><dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd></div>`)
      .join("") +
    "</dl>";

  // Gasto energético — o motor (motor/) faz a conta; aqui só se lê a tela.
  desenharGasto({ sexo, idade, peso, alturaCm, magra });

  guardarCorpo();
}

// ---------------------------------------------------------------------------
// Gasto energético (motor/)
// ---------------------------------------------------------------------------

const LINHAS_MET = 5;

function montarGasto() {
  const cat = $("g-categoria");
  for (const c of CATEGORIAS) {
    const o = document.createElement("option");
    o.value = c.chave;
    o.textContent = c.rotulo;
    cat.append(o);
  }
  cat.value = "geral";
  listarEquacoes();

  // Lista do Compêndio: um <datalist> só, usado pelas cinco linhas. Digitar filtra;
  // escolher um item preenche o MET (que continua editável).
  const lista = document.createElement("datalist");
  lista.id = "met-lista";
  for (const [, nome] of ATIVIDADES_MET) {
    const o = document.createElement("option");
    o.value = nome;
    lista.append(o);
  }
  document.body.append(lista);

  const linhas = $("g-met-linhas");
  for (let i = 0; i < LINHAS_MET; i++) {
    const d = document.createElement("div");
    d.className = "met-linha";
    d.innerHTML =
      `<input id="met-nome-${i}" type="text" list="met-lista" autocomplete="off" placeholder="Atividade (ex.: corrida)" aria-label="Atividade ${i + 1}" />` +
      `<input id="met-valor-${i}" type="text" inputmode="decimal" placeholder="MET" aria-label="MET da atividade ${i + 1}" />` +
      `<input id="met-min-${i}" type="text" inputmode="decimal" placeholder="min/sessão" aria-label="Minutos por sessão da atividade ${i + 1}" />` +
      `<input id="met-vezes-${i}" type="text" inputmode="decimal" placeholder="vezes/sem." aria-label="Vezes por semana da atividade ${i + 1}" />`;
    linhas.append(d);
    $(`met-nome-${i}`).addEventListener("input", () => {
      const met = metPeloNome($(`met-nome-${i}`).value, ATIVIDADES_MET);
      if (met !== null) {
        $(`met-valor-${i}`).value = String(met).replace(".", ",");
        $(`met-valor-${i}`).dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }
}

/** As equações da categoria escolhida. Mantém a escolha se ela ainda existir. */
function listarEquacoes() {
  const sel = $("g-equacao");
  const antes = sel.value;
  sel.innerHTML = "";
  // As que calculam vêm primeiro; as "aguardando fonte" ficam no fim da lista,
  // para a primeira opção (a que abre sozinha) ser sempre uma que funciona.
  const daCategoria = EQUACOES.filter((x) => x.categoria === $("g-categoria").value);
  const ordenadas = [
    ...daCategoria.filter((x) => x.padrao),
    ...daCategoria.filter((x) => !x.padrao && x.status !== "aguardando_fonte"),
    ...daCategoria.filter((x) => x.status === "aguardando_fonte"),
  ];
  for (const e of ordenadas) {
    const o = document.createElement("option");
    o.value = e.id;
    o.textContent = e.nome + (e.status === "aguardando_fonte" ? " — aguardando fonte" : "");
    sel.append(o);
  }
  if ([...sel.options].some((o) => o.value === antes)) sel.value = antes;
}

/** Os níveis de atividade da equação escolhida (só as que os trazem na fórmula). */
function montarNiveis(eq) {
  const seletor = $("g-pa");
  if (eq.atividade?.tipo !== "pa") return;
  const atual = seletor.value;
  seletor.innerHTML = "";
  for (const n of eq.atividade.niveis) {
    const o = document.createElement("option");
    o.value = n.chave;
    o.textContent = n.rotulo;
    seletor.append(o);
  }
  if ([...seletor.options].some((o) => o.value === atual)) seletor.value = atual;
}

const explicaModo = {
  fa: "Um fator só para a atividade do dia inteiro (GET = GEB × fator). Nas equações que já trazem o nível de atividade dentro da fórmula, o nível é o da própria equação.",
  met: "A base é SEDENTÁRIA (GEB × 1,2) e os exercícios entram à parte pelo MET líquido. O fator de atividade some de propósito: usar os dois contaria a atividade duas vezes.",
};

function desenharGasto(ctx) {
  const eq = equacaoPorId($("g-equacao").value);
  if (!eq) return;
  const modo = $("g-modo").value;
  $("g-explica-modo").textContent = explicaModo[modo];

  // O que aparece depende da equação e do modo.
  const tipo = eq.atividade?.tipo;
  $("g-fa-caixa").hidden = modo === "met" || tipo === "pa" || tipo === "fao";
  $("g-fao-caixa").hidden = modo === "met" || tipo !== "fao";
  $("g-pa-caixa").hidden = modo === "met" || tipo !== "pa";
  $("g-met").hidden = modo !== "met";
  $("g-mm-caixa").hidden = !eq.entradas.includes("massaMagra");
  $("g-sg-caixa").hidden = !eq.entradas.includes("semanaGestacional");
  // O peso antes da gravidez só serve à DRI 2023 (deposição pelo IMC pré-gestacional).
  $("g-pre-caixa").hidden = eq.id !== "dri2023_gestante";
  $("g-meses-caixa").hidden = !eq.entradas.includes("idadeMeses");

  const seletorPa = $("g-pa");
  montarNiveis(eq);

  const mmDigitada = num($("c-mm").value);
  const entrada = {
    sexo: ctx.sexo,
    idade: ctx.idade,
    peso: ctx.peso,
    alturaCm: ctx.alturaCm,
    massaMagra: mmDigitada > 0 ? mmDigitada : ctx.magra || 0,
    semanaGestacional: num($("g-sg").value),
    pesoPreGestacional: num($("g-pre").value),
    idadeMeses: $("g-meses").value.trim() === "" ? NaN : num($("g-meses").value),
  };
  const exercicios = [];
  for (let i = 0; i < LINHAS_MET; i++) {
    const met = num($(`met-valor-${i}`).value);
    const minutos = num($(`met-min-${i}`).value);
    const vezes = num($(`met-vezes-${i}`).value);
    if (met || minutos || vezes || $(`met-nome-${i}`).value.trim()) {
      exercicios.push({ nome: $(`met-nome-${i}`).value.trim(), met, minutos, vezes });
    }
  }
  const atividade = {
    modo,
    fa: num($("c-atividade").value) || 1,
    fao: $("c-fao").value,
    pa: seletorPa.value || "sedentario",
    exercicios,
  };

  const selo = eq.status === "aguardando_fonte"
    ? '<span class="selo-vistoria selo-espera">aguardando fonte</span>'
    : '<span class="selo-vistoria">em vistoria</span>';
  const r = calcularGasto(eq, entrada, atividade);
  const caixa = $("resultado-gasto");
  const como = $("g-como-corpo");

  if (!r.ok) {
    caixa.innerHTML = `<p class="nota">${escaparHtml(eq.nome)} ${selo}<br>${escaparHtml(r.motivo ?? "")}</p>`;
    $("aviso-gasto").innerHTML = "";
    como.innerHTML = `<p class="nota">${escaparHtml(eq.fonte ?? "")}</p>`;
  } else {
    const itens = [
      [eq.resultado === "get" ? "Gasto da fórmula (TEE/EER)" : "GEB (gasto basal)", mostrar(r.geb, 0, " kcal"), ""],
    ];
    if (r.fator) itens.push(["Fator de atividade", mostrar(r.fator, 3), r.modo === "met" ? "sedentário" : ""]);
    if (r.modo === "met") itens.push(["Exercícios (MET líquido)", mostrar(r.kcalMet, 0, " kcal"), "por dia, em média"]);
    itens.push(["GET (gasto total)", mostrar(r.get, 0, " kcal"), "por dia"]);
    caixa.innerHTML =
      `<p class="nota" style="margin:0 0 8px">${escaparHtml(eq.nome)} ${selo}</p>` +
      "<dl>" +
      itens.map(([t, v, ap]) => `<div><dt>${t}</dt><dd>${v}${ap ? ` <span>${ap}</span>` : ""}</dd></div>`).join("") +
      "</dl>";
    $("aviso-gasto").innerHTML = caixaDeAviso(r.avisos);
    como.innerHTML =
      '<ul class="passos">' +
      r.passos.map((p) => `<li><strong>${escaparHtml(p.rotulo)}:</strong> <code>${escaparHtml(p.texto)}</code></li>`).join("") +
      (r.modo === "met" && r.atividades.length
        ? r.atividades
            .map((a) => `<li><strong>MET:</strong> <code>${escaparHtml(a.nome || "atividade")} — (${fmtMotor(a.met)} − 1) × ${fmtMotor(ctx.peso)} kg × ${fmtMotor(a.minutos)}/60 h × ${fmtMotor(a.vezes)}/7 = ${a.kcal === null ? "faltam dados" : fmtMotor(a.kcal, 1) + " kcal/dia"}</code></li>`)
            .join("")
        : "") +
      "</ul>" +
      `<p class="nota"><strong>Fonte:</strong> ${escaparHtml(eq.fonte)}</p>` +
      (eq.observacao ? `<p class="nota">${escaparHtml(eq.observacao)}</p>` : "") +
      (eq.conferida ? `<p class="nota"><strong>Conferência:</strong> ${escaparHtml(eq.conferida)}</p>` : "");
  }

  // Comparação: todas as que calculam, no mesmo modo.
  const comp = compararEquacoes(entrada, atividade);
  $("g-comparar").innerHTML = comp.length
    ? '<table style="margin-top:6px"><tr><th style="text-align:left">Equação</th><th>GEB</th><th>GET</th></tr>' +
      comp
        .map(
          ({ equacao, resultado }) =>
            `<tr><td style="text-align:left">${escaparHtml(equacao.nome)}</td><td>${mostrar(resultado.geb, 0)}</td><td><strong>${mostrar(resultado.get, 0)}</strong></td></tr>`,
        )
        .join("") +
      "</table>"
    : '<p class="nota">Preencha sexo, idade, peso e altura para comparar.</p>';
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
    "g-categoria", "g-equacao", "g-pa", "g-modo", "c-mm", "g-sg", "g-pre", "g-meses",
    ...Array.from({ length: LINHAS_MET }, (_, i) => [`met-nome-${i}`, `met-valor-${i}`, `met-min-${i}`, `met-vezes-${i}`]).flat(),
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
montarGasto();
$("g-categoria").addEventListener("change", () => {
  listarEquacoes();
  calcularCorpo();
});
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
  dieta.refeicoes.push(refeicaoNova());
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
  dieta = { peso: "", meta: "", refeicoes: [refeicaoNova("Café da manhã", "07:00")] };
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
  const kcal = numNaoNegativo($("m-kcal").value, $("m-kcal"));
  const peso = numNaoNegativo($("m-peso").value, $("m-peso"));
  const pct = {
    carboidrato: numNaoNegativo($("m-cho").value, $("m-cho")),
    proteina: numNaoNegativo($("m-ptn").value, $("m-ptn")),
    lipideo: numNaoNegativo($("m-lip").value, $("m-lip")),
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
        .map(([t, v, apoio]) => `<div><dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd></div>`)
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

  const atual = num($("m-atual").value);
  const bolso = regraDeBolso(atual);
  $("resultado-bolso").innerHTML = bolso
    ? "<dl>" +
      [
        ["Regra de bolso — para perder", `${mostrar(bolso.perda[0], 0)} a ${mostrar(bolso.perda[1], 0)} kcal`, "20 a 25 kcal por kg do peso atual"],
        ["Regra de bolso — para ganhar", `${mostrar(bolso.ganho[0], 0)} a ${mostrar(bolso.ganho[1], 0)} kcal`, "30 a 35 kcal por kg do peso atual"],
      ]
        .map(([t, v, ap]) => `<div><dt>${t}</dt><dd>${v} <span>${ap}</span></dd></div>`)
        .join("") +
      "</dl>"
    : "";
  const desejado = num($("m-desejado").value);
  const dias = num($("m-dias").value);
  const ajuste = venta(atual, desejado, dias);
  const kgSemana = dias > 0 ? (Math.abs(atual - desejado) / dias) * 7 : 0;
  $("resultado-venta").innerHTML =
    atual < 0 || desejado < 0 || dias < 0
      ? '<div class="aviso">Peso e prazo precisam ser positivos. Prazo negativo invertia a conta: perder peso aparecia como superávit.</div>'
      : ajuste === null
      ? '<p class="nota">Preencha peso atual, peso desejado e prazo (em dias).</p>'
      : ajuste === 0
      ? '<p class="nota">Peso atual e desejado são iguais: não há ajuste a fazer.</p>'
      : "<dl>" +
        [
          [
            ajuste > 0 ? "Déficit por dia" : "Superávit por dia",
            mostrar(Math.abs(ajuste), 0, " kcal"),
            `${mostrar(Math.abs(atual - desejado), 1)} kg em ${mostrar(dias, 0)} dias · ` +
              `${mostrar(kgSemana, 2)} kg por semana`,
          ],
          [
            "Consumo do dia",
            "GET − VENTA",
            `o gasto (aba Composição corporal) ${ajuste > 0 ? "menos" : "mais"} ${mostrar(Math.abs(ajuste), 0)} kcal`,
          ],
        ]
          .map(([t, v, apoio]) => `<div><dt>${t}</dt><dd>${v}${apoio ? ` <span>${apoio}</span>` : ""}</dd></div>`)
          .join("") +
        "</dl>" +
        // Plausibilidade, não proibição: 7700 kcal/kg é uma conta estática e
        // não avisa quando o prazo pede um ritmo que ninguém sustenta
        // (3 dias para perder 10 kg dava "25.667 kcal por dia", sem um aviso).
        (kgSemana > 1
          ? `<div class="aviso">Isto é <strong>${mostrar(kgSemana, 1)} kg por semana</strong>. Costuma-se planejar até cerca de 1 kg por semana; um ritmo maior pode ser inviável ou exigir um consumo abaixo do seguro. Confira o prazo.</div>`
          : "");
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

/**
 * A data de hoje no relógio do computador dela — não em UTC. Com UTC, uma
 * avaliação feita às 21h saía com a data do dia seguinte.
 */
const hoje = () => {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

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
  lembrarBackup();
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
    // Normaliza na abertura: a ficha pode ter sido salva antes das opções e
    // das medidas caseiras, e sem isto os alimentos dela sumiriam.
    refeicoes: ficha?.dieta?.refeicoes?.length
      ? ficha.dieta.refeicoes.map(normalizarRefeicao)
      : [refeicaoNova("Café da manhã", "07:00")],
  };
  $("d-peso").value = dieta.peso;
  $("d-meta").value = dieta.meta;

  // As listas do gasto dependem umas das outras (categoria → equação → níveis):
  // montam-se na ordem ANTES de jogar os valores guardados, senão o valor
  // não encontra a opção e volta para a primeira.
  definirCampo("g-categoria", ficha?.corpo?.["g-categoria"]);
  listarEquacoes();
  definirCampo("g-equacao", ficha?.corpo?.["g-equacao"]);
  montarNiveis(equacaoPorId($("g-equacao").value) ?? EQUACOES[0]);
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

/**
 * As fichas moram SÓ neste navegador. Limpar os dados do navegador, trocar
 * de computador ou o navegador liberar espaço sozinho apaga tudo — e até
 * aqui nada lembrava disso além de uma frase pequena.
 *
 * Duas defesas, enquanto as fichas não vão para o banco:
 *   1. pedir ao navegador que não apague esta memória por conta própria;
 *   2. avisar quando há fichas e o último backup tem mais de 7 dias.
 */
const CHAVE_ULTIMO_BACKUP = "nutri:ultimo-backup";

function lembrarBackup() {
  const alvo = $("f-lembrete");
  if (!alvo) return;
  const n = listarFichas().length;
  let ultimo = null;
  try {
    ultimo = localStorage.getItem(CHAVE_ULTIMO_BACKUP);
  } catch {
    /* sem memória, sem lembrete */
  }
  const dias = ultimo ? Math.floor((Date.now() - Date.parse(ultimo)) / 86_400_000) : null;
  if (!n || (dias !== null && dias < 7)) {
    alvo.hidden = true;
    return;
  }
  alvo.hidden = false;
  alvo.textContent =
    `${n} ${n === 1 ? "ficha está guardada" : "fichas estão guardadas"} só neste navegador` +
    (dias === null ? ", e ainda não há backup" : `, e o último backup foi há ${dias} dias`) +
    `. Se os dados do navegador forem limpos, ${n === 1 ? "ela some" : "elas somem"}. ` +
    "Clique em “Baixar backup” e guarde o arquivo fora do computador.";
}

try {
  navigator.storage?.persist?.();
} catch {
  /* navegador sem esse recurso: segue igual */
}

$("f-backup").onclick = () => {
  // As fichas mais o que ela cadastrou: alimento e grupo que sumissem num
  // backup restaurado seriam uma perda silenciosa.
  const pacote = JSON.parse(textoDoBackup());
  Object.assign(pacote, tudoParaBackup());
  const arquivo = new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fichas-${hoje()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  try {
    localStorage.setItem(CHAVE_ULTIMO_BACKUP, new Date().toISOString());
  } catch {
    /* segue: o arquivo já foi baixado */
  }
  lembrarBackup();
  escreverEstado(`Backup de ${listarFichas().length} ficha(s) baixado. Guarde fora do computador.`);
};

$("f-restaurar").onclick = () => $("f-arquivo").click();

$("f-arquivo").addEventListener("change", async () => {
  const arquivo = $("f-arquivo").files?.[0];
  if (!arquivo) return;
  try {
    const texto = await arquivo.text();
    const r = restaurarBackup(texto);
    const meus = restaurarDoBackup(JSON.parse(texto));
    listaDesenhada = "";
    desenharListaDeFichas();
    recarregarMeus();
    escreverEstado(
      `Backup restaurado: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s), ` +
        `${meus.alimentos} alimento(s) seu(s), ${meus.grupos} grupo(s). ` +
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

// ---------------------------------------------------------------------------
// Meus alimentos, minhas medidas e meus grupos
// ---------------------------------------------------------------------------

/**
 * O que nenhuma tabela traz.
 *
 * "Quero poder adicionar na hora no banco de dados alimentos que não
 * existem e escrever lá as infos nutricionais, tipo algum whey específico,
 * ou algum pão." A TACO e o IBGE são tabelas de laboratório e de consumo —
 * nenhuma das duas traz marca, e é justamente a marca que ela prescreve.
 *
 * O formulário é por 100 g, como as tabelas, para que os números se somem
 * sem conversão escondida no meio. As medidas caseiras dela entram embaixo:
 * é o "100 g de milho = 1 unidade".
 */
function desenharMeusAlimentos() {
  const caixa = $("meus-alimentos");
  caixa.innerHTML = "";
  const meus = listarAlimentos();
  if (!meus.length) {
    const vazio = document.createElement("p");
    vazio.className = "nota";
    vazio.textContent = "Nenhum alimento seu ainda.";
    caixa.append(vazio);
    return;
  }
  for (const a of meus) {
    const cartao = document.createElement("div");
    cartao.className = "cartao-meu";
    const nome = document.createElement("strong");
    nome.textContent = a.nome;
    const valores = document.createElement("span");
    valores.className = "nota";
    valores.textContent =
      `por 100 g: ${mostrar(a.energia_kcal, 0)} kcal · ` +
      `CHO ${mostrar(a.carboidrato, 1)} · PTN ${mostrar(a.proteina, 1)} · ` +
      `LIP ${mostrar(a.lipideos, 1)} · Fibra ${mostrar(a.fibra_alimentar, 1)}` +
      (a.medidas.length ? ` · ${a.medidas.map((m) => `${m.nome} = ${m.gramas} g`).join(", ")}` : "");
    const editar = document.createElement("button");
    editar.className = "mini";
    editar.textContent = "editar";
    editar.onclick = () => abrirAlimento(a);
    const apagar = document.createElement("button");
    apagar.className = "mini";
    apagar.textContent = "apagar";
    apagar.onclick = () => {
      if (!window.confirm(`Apagar "${a.nome}"? As dietas que já usam este alimento ficam sem ele.`)) return;
      excluirAlimento(a.id);
      recarregarMeus();
    };
    cartao.append(nome, valores, editar, apagar);
    caixa.append(cartao);
  }
}

function desenharMeusGrupos() {
  const caixa = $("meus-grupos");
  caixa.innerHTML = "";
  const grupos = listarGrupos();
  if (!grupos.length) {
    const vazio = document.createElement("p");
    vazio.className = "nota";
    vazio.textContent = "Nenhum grupo ainda. Monte uma refeição e clique em “Criar grupo”.";
    caixa.append(vazio);
    return;
  }
  for (const g of grupos) {
    const cartao = document.createElement("div");
    cartao.className = "cartao-meu";
    const nome = document.createElement("strong");
    nome.textContent = g.nome;
    const itens = document.createElement("span");
    itens.className = "nota";
    itens.textContent = g.itens.length
      ? g.itens.map((i) => i.nome).join(", ")
      : "sem alimentos";
    const apagar = document.createElement("button");
    apagar.className = "mini";
    apagar.textContent = "apagar grupo";
    apagar.onclick = () => {
      if (!window.confirm(`Apagar o grupo "${g.nome}"?`)) return;
      excluirGrupo(g.id);
      recarregarMeus();
    };
    cartao.append(nome, itens, apagar);

    // "Poder excluir o que quero": cada alimento do grupo sai sozinho.
    for (const item of g.itens) {
      const tirar = document.createElement("button");
      tirar.className = "mini";
      tirar.textContent = `− ${item.nome}`;
      tirar.title = `Tirar ${item.nome} do grupo`;
      tirar.onclick = () => {
        salvarGrupo({ ...g, itens: g.itens.filter((i) => i.codigo !== item.codigo) });
        recarregarMeus();
      };
      cartao.append(tirar);
    }
    caixa.append(cartao);
  }
}

function recarregarMeus() {
  montarAlimentos();
  desenharMeusAlimentos();
  desenharMeusGrupos();
  desenharDieta();
}

/**
 * O formulário de um alimento dela.
 *
 * `prompt` em série, e não uma tela: são seis números e duas linhas de
 * texto, usados de vez em quando. Uma tela inteira para isso ocuparia
 * espaço permanente para resolver uma tarefa ocasional.
 *
 * Campo deixado em branco fica NULO, não zero — um whey sem fibra anotada
 * tem fibra desconhecida, não fibra zero. Ver `conferirAlimento`.
 */
function abrirAlimento(existente) {
  const atual = existente ?? {};
  const perguntar = (rotulo, valor) => window.prompt(rotulo, valor ?? "");

  const nome = perguntar("Nome do alimento:", atual.nome);
  if (nome === null || !nome.trim()) return;

  const campos = [
    ["Calorias por 100 g (kcal):", "energia_kcal"],
    ["Carboidrato por 100 g (g):", "carboidrato"],
    ["Proteína por 100 g (g):", "proteina"],
    ["Gordura por 100 g (g):", "lipideos"],
    ["Fibra por 100 g (g) — em branco se não souber:", "fibra_alimentar"],
  ];
  const dados = { id: atual.id, nome, grupo: "Meus alimentos" };
  for (const [rotulo, chave] of campos) {
    const v = perguntar(rotulo, atual[chave] ?? "");
    if (v === null) return;
    dados[chave] = v;
  }

  const medidas = perguntar(
    'Medidas caseiras, uma por linha: "unidade = 100" (o número é em gramas). Deixe em branco se não houver.',
    (atual.medidas ?? []).map((m) => `${m.nome} = ${m.gramas}`).join("\n"),
  );
  if (medidas === null) return;
  dados.medidas = medidas
    .split("\n")
    .map((l) => l.split("="))
    .map(([n, g]) => ({ nome: (n ?? "").trim(), gramas: (g ?? "").trim() }));

  try {
    salvarAlimento(dados);
    recarregarMeus();
  } catch (e) {
    window.alert(e.message);
  }
}

$("novo-alimento").onclick = () => abrirAlimento(null);

// --- a tabela que ela carrega do computador dela ---------------------------

/**
 * Diz o que está carregado, com a citação da fonte à vista.
 *
 * A citação não é enfeite: a licença da TBCA é BY, e atribuir é a condição
 * de usar. Ficando só dentro do arquivo, ninguém a leria.
 */
function desenharEstadoDaTabela() {
  const tabela = lerTabela();
  const alvo = $("estado-tabela");
  if (!tabela) {
    alvo.textContent = "Nenhuma tabela carregada neste navegador.";
    return;
  }
  const comMedida = tabela.alimentos.filter((a) => (a.medidas ?? []).length).length;
  alvo.innerHTML =
    `<strong>${tabela.alimentos.length}</strong> alimentos carregados` +
    (comMedida ? `, ${comMedida} com medida caseira` : "") +
    `. <br><small>${escaparHtml(tabela.fonte.citacao || tabela.fonte.nome)}</small>` +
    (tabela.fonte.licenca ? `<br><small>${escaparHtml(tabela.fonte.licenca)}</small>` : "");
}

$("carregar-tabela").onclick = () => $("arquivo-tabela").click();

$("arquivo-tabela").addEventListener("change", async () => {
  const arquivo = $("arquivo-tabela").files?.[0];
  if (!arquivo) return;
  try {
    const tabela = importarTabela(await arquivo.text());
    // Remontar a busca na hora: sem isto os alimentos só apareceriam depois
    // de recarregar a página, e ela concluiria que não carregou.
    montarAlimentos();
    desenharDieta();
    desenharEstadoDaTabela();
    window.alert(
      `Carreguei ${tabela.alimentos.length} alimentos da ${tabela.fonte.sigla}. ` +
        "Eles já aparecem na busca, com a etiqueta da tabela.",
    );
  } catch (e) {
    window.alert(e.message);
  }
  $("arquivo-tabela").value = "";
});

$("apagar-tabela").onclick = () => {
  const tabela = lerTabela();
  if (!tabela) {
    window.alert("Não há tabela carregada para apagar.");
    return;
  }
  if (!window.confirm(`Apagar a tabela ${tabela.fonte.sigla} deste navegador?`)) return;
  apagarTabela();
  montarAlimentos();
  desenharDieta();
  desenharEstadoDaTabela();
};

desenharEstadoDaTabela();

/**
 * Cria um grupo a partir do que está na refeição aberta.
 *
 * "Criar um grupo de frutas já pré-pronto": a maneira natural é montar a
 * lista uma vez na tela e guardá-la, não redigitar tudo numa tela à parte.
 */
$("novo-grupo").onclick = () => {
  const comItens = dieta.refeicoes
    .map((r) => ({ nome: r.nome, itens: opcaoAtiva(r).itens }))
    .filter((r) => r.itens.length);

  if (!comItens.length) {
    window.alert(
      "Monte uma refeição com os alimentos que você quer no grupo e clique aqui de novo.",
    );
    return;
  }

  const de =
    comItens.length === 1
      ? comItens[0]
      : comItens[
          Math.max(
            0,
            Number(
              window.prompt(
                "De qual refeição?\n" + comItens.map((r, i) => `${i + 1} — ${r.nome}`).join("\n"),
                "1",
              ),
            ) - 1,
          )
        ];
  if (!de) return;

  const nome = window.prompt("Nome do grupo:", de.nome);
  if (!nome || !nome.trim()) return;
  try {
    salvarGrupo({ nome, itens: de.itens });
    recarregarMeus();
  } catch (e) {
    window.alert(e.message);
  }
};

recarregarMeus();
