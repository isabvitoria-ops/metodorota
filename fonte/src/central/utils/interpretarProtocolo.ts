import type {
  ConteudoProtocolo,
  ItemProtocolo,
  OpcaoProtocolo,
  RefeicaoProtocolo,
  SecaoProtocolo,
} from "@/central/types/protocolo";

/**
 * Lê o protocolo colado do Google Docs e devolve a estrutura do app.
 *
 * REGRA QUE MANDA EM TUDO AQUI: nenhuma linha é jogada fora. O que o
 * interpretador não souber classificar entra como observação, visível, para
 * ela corrigir na tela antes de publicar. Sumir com uma linha da dieta de
 * alguém é o pior defeito possível neste arquivo — errar na frente dela é
 * apenas chato.
 *
 * O que ele reconhece, e por quê:
 *
 *   * CABEÇALHO DE REFEIÇÃO — "CAFÉ DA MANHÃ", "ALMOÇO", "JANTAR". Quando
 *     vem com traço ("JANTAR - HAMBÚRGUER") é a mesma refeição com outra
 *     opção, que é como ela escreve os dois jantares;
 *   * LINHA DE TABELA — três colunas. Colando do Docs elas vêm separadas por
 *     tabulação; colando de um PDF, por corrida de espaços. Os dois casos
 *     entram;
 *   * CONTINUAÇÃO — linha cuja primeira coluna está vazia é a segunda (e a
 *     terceira…) substituição do item de cima, que é como uma célula de
 *     várias linhas chega ao texto puro;
 *   * OBSERVAÇÃO — o chá, a suplementação, os vegetais liberados, o modo de
 *     preparo. Fica presa à refeição em que apareceu, não solta no fim;
 *   * SEÇÃO DE ROTINA — os blocos em maiúsculas do fim ("ACORDE CEDO").
 */

/** Cabeçalhos que abrem uma refeição. A ordem não importa; o texto, sim. */
const REFEICOES = [
  "CAFE DA MANHA",
  "DESJEJUM",
  "COLACAO",
  "LANCHE DA MANHA",
  "ALMOCO",
  "LANCHE DA TARDE",
  "CAFE DA TARDE",
  "LANCHE",
  "JANTAR",
  "CEIA",
  "PRE TREINO",
  "POS TREINO",
  "PRE-TREINO",
  "POS-TREINO",
];

/** Começos que denunciam observação, mesmo quando a linha está em maiúsculas. */
const INICIOS_DE_NOTA = [
  "SUPLEMENTACAO",
  "OBSERVACAO",
  "OBS",
  "VEGETAIS",
  "IMPORTANTE",
  "ATENCAO",
  "OPCIONAL",
];

const MARCADORES = /^[-–—•●▪*·\u200b\s]+/;

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u200b/g, "");
}

function chave(linha: string): string {
  return semAcento(linha).toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Quebra a linha em colunas.
 *
 * Tabulação primeiro (é o que o Docs entrega). Sem tabulação, duas ou mais
 * casas de espaço também servem: é assim que uma tabela colada de PDF chega.
 * Um espaço só nunca separa coluna — senão todo nome composto viraria duas.
 */
export function colunas(linha: string): string[] {
  if (linha.includes("\t")) return linha.split("\t").map((c) => c.trim());
  if (/\S {2,}\S/.test(linha) || /^ {2,}\S/.test(linha)) {
    return linha.split(/ {2,}/).map((c) => c.trim());
  }
  return [linha.trim()];
}

/** "JANTAR - HAMBÚRGUER" → { nome: "Jantar", opcao: "Hambúrguer" } */
function lerCabecalhoDeRefeicao(linha: string): { nome: string; opcao: string | null } | null {
  const limpa = linha.replace(MARCADORES, "").replace(/[:\s]+$/, "").trim();
  if (!limpa || limpa.length > 60) return null;

  const partes = limpa.split(/\s+[-–—]\s+/);
  const cabeca = partes[0] ?? "";
  if (!REFEICOES.includes(chave(cabeca))) return null;

  const resto = partes.slice(1).join(" - ").trim();
  return { nome: titulo(cabeca), opcao: resto ? titulo(resto) : null };
}

/** "CAFÉ DA MANHÃ" → "Café da manhã". Mantém o que já vem misturado. */
function titulo(texto: string): string {
  const limpo = texto.trim();
  if (limpo !== limpo.toUpperCase()) return limpo;
  const minusculo = limpo.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

function ehCabecalhoDaTabela(celulas: string[]): boolean {
  const texto = chave(celulas.join(" "));
  return texto.includes("ALIMENTO") && (texto.includes("QUANTIDADE") || texto.includes("SUBSTITUI"));
}

function ehOpcaoNumerada(linha: string): string | null {
  const limpa = chave(linha.replace(MARCADORES, ""));
  const achado = /^OPCAO\s*([0-9]+|[IVX]+)?\s*:?$/.exec(limpa);
  if (!achado) return null;
  return achado[1] ? `Opção ${achado[1]}` : "Opção";
}

/** Maiúscula de cabeçalho: "ACORDE CEDO (ANTES DAS 9H)" sim, "Pão de forma" não. */
function ehTituloEmMaiusculas(linha: string): boolean {
  const letras = linha.replace(/[^\p{L}]/gu, "");
  if (letras.length < 3) return false;
  return letras === letras.toLocaleUpperCase("pt-BR");
}

function ehInicioDeNota(linha: string): boolean {
  const limpa = chave(linha.replace(MARCADORES, ""));
  return INICIOS_DE_NOTA.some((inicio) => limpa.startsWith(inicio));
}

function novaOpcao(rotulo: string): OpcaoProtocolo {
  return { rotulo, itens: [], notas: [] };
}

/**
 * Abre uma opção na refeição, aproveitando a última se ela ainda estiver
 * vazia. É o caso de "CAFÉ DA MANHÃ" seguido de "OPÇÃO 1": o cabeçalho já
 * tinha aberto uma, e sem isto a refeição nasceria com uma opção fantasma.
 */
function abrirOpcao(refeicao: RefeicaoProtocolo, rotulo: string): OpcaoProtocolo {
  const ultima = refeicao.opcoes[refeicao.opcoes.length - 1];
  if (ultima && ultima.itens.length === 0 && ultima.notas.length === 0) {
    ultima.rotulo = rotulo;
    return ultima;
  }
  const criada = novaOpcao(rotulo);
  refeicao.opcoes.push(criada);
  return criada;
}

export function interpretarProtocolo(texto: string): ConteudoProtocolo {
  const orientacoes: string[] = [];
  const refeicoes: RefeicaoProtocolo[] = [];
  const secoes: SecaoProtocolo[] = [];

  let refeicao: RefeicaoProtocolo | null = null;
  let opcao: OpcaoProtocolo | null = null;
  let secao: SecaoProtocolo | null = null;
  // "topo" até a primeira refeição; "secoes" é grudento: uma vez que os
  // blocos de rotina começam, o que vem depois é rotina também.
  let modo: "topo" | "refeicoes" | "secoes" = "topo";

  const guardarNota = (linha: string) => {
    const nota = linha.replace(MARCADORES, "").trim();
    if (!nota) return;
    if (modo === "topo") orientacoes.push(nota);
    else if (secao) secao.paragrafos.push(nota);
    else if (opcao) opcao.notas.push(nota);
    else orientacoes.push(nota);
  };

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\u200b/g, "").replace(/\s+$/, "");
    if (!linha.trim()) continue;

    // 1. Refeição vem antes de tudo: "JANTAR - HAMBÚRGUER" é refeição, não
    //    título de seção, mesmo estando em maiúsculas.
    const cabecalho = lerCabecalhoDeRefeicao(linha);
    if (cabecalho) {
      modo = "refeicoes";
      secao = null;
      const existente = refeicoes.find((r) => chave(r.nome) === chave(cabecalho.nome));
      if (existente) {
        refeicao = existente;
        opcao = abrirOpcao(existente, cabecalho.opcao ?? `Opção ${existente.opcoes.length + 1}`);
      } else {
        opcao = novaOpcao(cabecalho.opcao ?? "Padrão");
        refeicao = { nome: cabecalho.nome, opcoes: [opcao] };
        refeicoes.push(refeicao);
      }
      continue;
    }

    // 2. "OPÇÃO 2" dentro de uma refeição.
    const rotulo = ehOpcaoNumerada(linha);
    if (rotulo && refeicao) {
      opcao = abrirOpcao(refeicao, rotulo);
      continue;
    }

    const celulas = colunas(linha);
    if (ehCabecalhoDaTabela(celulas)) continue;

    // 3. Observação declarada: "SUPLEMENTAÇÃO PÓS CAFÉ:", "VEGETAIS:", "OBS".
    if (ehInicioDeNota(linha)) {
      guardarNota(linha);
      continue;
    }

    // 4. Título de bloco de rotina: maiúsculas, sem virar coluna. A partir
    //    daqui o documento é rotina, não mais dieta.
    if (ehTituloEmMaiusculas(linha) && celulas.filter(Boolean).length < 2) {
      if (modo === "refeicoes" || modo === "secoes") {
        modo = "secoes";
        refeicao = null;
        opcao = null;
        secao = { titulo: linha.trim(), paragrafos: [] };
        secoes.push(secao);
        continue;
      }
    }

    if (modo === "secoes") {
      guardarNota(linha);
      continue;
    }

    if (modo === "topo") {
      // Antes da primeira refeição tudo é orientação — inclusive o título
      // "Orientações gerais - Fulana", que não vira orientação nenhuma.
      if (chave(linha).startsWith("ORIENTACOES")) continue;
      orientacoes.push(linha.replace(MARCADORES, "").trim());
      continue;
    }

    if (!opcao) {
      guardarNota(linha);
      continue;
    }

    // 5. Continuação da coluna de substituição: primeira célula vazia.
    const preenchidas = celulas.filter((c) => c !== "");
    if (celulas.length > 1 && celulas[0] === "" && preenchidas.length > 0) {
      const ultimo = opcao.itens[opcao.itens.length - 1];
      if (ultimo) {
        ultimo.substituicoes.push(...preenchidas);
        continue;
      }
    }

    // 6. Linha de tabela de verdade.
    if (celulas.length >= 2) {
      const item: ItemProtocolo = {
        alimento: celulas[0] ?? "",
        quantidade: celulas[1] ?? "",
        substituicoes: celulas.slice(2).filter(Boolean),
      };
      opcao.itens.push(item);
      continue;
    }

    // 7. Uma coluna só. Frase longa é observação; o resto é item que ela
    //    completa na tela — não sumindo, que é o que importa.
    const solta = linha.replace(MARCADORES, "").trim();
    const temMarcador = MARCADORES.test(linha) && linha.trim() !== solta;
    if (temMarcador || solta.length > 90 || /[.:;!?]$/.test(solta)) {
      guardarNota(linha);
      continue;
    }
    opcao.itens.push({ alimento: solta, quantidade: "", substituicoes: [] });
  }

  // Refeição com uma opção só não precisa de rótulo na tela.
  for (const r of refeicoes) {
    if (r.opcoes.length === 1 && r.opcoes[0]) r.opcoes[0].rotulo = "";
  }

  return { orientacoes, refeicoes, secoes };
}

/** Quantas linhas de dieta entraram — serve para ela conferir o que colou. */
export function contarProtocolo(conteudo: ConteudoProtocolo): {
  refeicoes: number;
  itens: number;
  substituicoes: number;
  notas: number;
} {
  let itens = 0;
  let substituicoes = 0;
  let notas = 0;
  for (const refeicao of conteudo.refeicoes) {
    for (const opcao of refeicao.opcoes) {
      itens += opcao.itens.length;
      notas += opcao.notas.length;
      for (const item of opcao.itens) substituicoes += item.substituicoes.length;
    }
  }
  return { refeicoes: conteudo.refeicoes.length, itens, substituicoes, notas };
}
