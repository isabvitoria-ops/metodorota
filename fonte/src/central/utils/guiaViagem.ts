import type {
  BlocoDoGuia,
  CorDoSemaforo,
  EstiloDaLista,
  FichaDeViagem,
  GuiaDeViagem,
  ItemDoGuia,
  SecaoDoGuia,
  TipoDeBloco,
  TomDoDestaque,
} from "@/central/types/viagem";

/**
 * Rota Viagem — as regras que não dependem de tela.
 *
 * O guia chega do banco como JSON solto. `normalizarGuia` é a fronteira: o que
 * passar por ela tem a forma certa, e o que vier torto é descartado em vez de
 * derrubar a tela da paciente no meio da viagem.
 */

const TONS: TomDoDestaque[] = ["dica", "atencao", "alerta", "neutro"];
const ESTILOS: EstiloDaLista[] = ["numerada", "marcadores", "cartoes"];
const CORES: CorDoSemaforo[] = ["verde", "amarelo", "vermelho"];

const IMAGEM_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** ~225 KB de imagem. O guia inteiro viaja numa resposta só. */
export const TAMANHO_MAXIMO_DA_IMAGEM = 300_000;

/** Abas dentro de abas não existem na tela; o limite também barra JSON em laço. */
const PROFUNDIDADE_MAXIMA = 2;

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function textoOpcional(valor: unknown): string | undefined {
  const t = texto(valor).trim();
  return t ? t : undefined;
}

function dataIso(valor: unknown): string | null {
  const t = texto(valor);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(`${t}T12:00:00Z`)) ? t : null;
}

function normalizarItem(valor: unknown): ItemDoGuia | null {
  const o = objeto(valor);
  if (!o) return null;
  const titulo = textoOpcional(o.titulo);
  const corpo = texto(o.texto);
  if (!titulo && !corpo.trim()) return null;
  return titulo ? { titulo, texto: corpo } : { texto: corpo };
}

function normalizarItens(valor: unknown): ItemDoGuia[] {
  return lista(valor)
    .map(normalizarItem)
    .filter((i): i is ItemDoGuia => i !== null);
}

function normalizarBloco(valor: unknown, profundidade: number): BlocoDoGuia | null {
  const o = objeto(valor);
  if (!o) return null;
  switch (o.tipo as TipoDeBloco) {
    case "texto":
    case "subtitulo":
      return { tipo: o.tipo as "texto" | "subtitulo", texto: texto(o.texto) };
    case "destaque": {
      const itens = lista(o.itens).map(texto).filter((t) => t.trim());
      return {
        tipo: "destaque",
        tom: TONS.includes(o.tom as TomDoDestaque) ? (o.tom as TomDoDestaque) : "dica",
        titulo: textoOpcional(o.titulo),
        texto: textoOpcional(o.texto),
        ...(itens.length > 0 ? { itens } : {}),
      };
    }
    case "lista":
      return {
        tipo: "lista",
        estilo: ESTILOS.includes(o.estilo as EstiloDaLista) ? (o.estilo as EstiloDaLista) : "marcadores",
        itens: normalizarItens(o.itens),
      };
    case "semaforo":
      return {
        tipo: "semaforo",
        grupos: lista(o.grupos)
          .map((g) => {
            const grupo = objeto(g);
            if (!grupo || !CORES.includes(grupo.cor as CorDoSemaforo)) return null;
            return {
              cor: grupo.cor as CorDoSemaforo,
              titulo: texto(grupo.titulo),
              itens: normalizarItens(grupo.itens),
            };
          })
          .filter((g): g is { cor: CorDoSemaforo; titulo: string; itens: ItemDoGuia[] } => g !== null),
      };
    case "abas":
      if (profundidade >= PROFUNDIDADE_MAXIMA) return null;
      return {
        tipo: "abas",
        abas: lista(o.abas)
          .map((a) => {
            const aba = objeto(a);
            if (!aba) return null;
            return { rotulo: texto(aba.rotulo), blocos: normalizarBlocos(aba.blocos, profundidade + 1) };
          })
          .filter((a): a is { rotulo: string; blocos: BlocoDoGuia[] } => a !== null),
      };
    case "cartao":
      return {
        tipo: "cartao",
        texto: texto(o.texto),
        destaques: lista(o.destaques).map(texto).filter((t) => t.trim()),
      };
    case "tabela": {
      const colunas = lista(o.colunas).map(texto);
      return {
        tipo: "tabela",
        colunas,
        // Toda linha tem exatamente uma célula por coluna: a tela não lida com tabela torta.
        linhas: lista(o.linhas).map((l) => colunas.map((_, i) => texto(lista(l)[i]))),
      };
    }
    case "ficha":
      return { tipo: "ficha" };
    case "diario":
      return { tipo: "diario" };
    case "produto": {
      const imagem = texto(o.imagem);
      const link = texto(o.link).trim();
      return {
        tipo: "produto",
        // Só imagem embutida: endereço de fora deixaria um terceiro saber quando ela abre o guia.
        imagem: IMAGEM_EMBUTIDA.test(imagem) && imagem.length <= TAMANHO_MAXIMO_DA_IMAGEM ? imagem : "",
        titulo: texto(o.titulo),
        texto: texto(o.texto),
        ...(/^https:\/\//i.test(link) ? { link } : {}),
      };
    }
    default:
      return null;
  }
}

function normalizarBlocos(valor: unknown, profundidade: number): BlocoDoGuia[] {
  return lista(valor)
    .map((b) => normalizarBloco(b, profundidade))
    .filter((b): b is BlocoDoGuia => b !== null);
}

/** `null` quando o que veio não é um guia. Nunca lança. */
export function normalizarGuia(valor: unknown): GuiaDeViagem | null {
  const o = objeto(valor);
  if (!o || !Array.isArray(o.secoes)) return null;

  const usados = new Set<string>();
  const secoes: SecaoDoGuia[] = [];
  for (const s of o.secoes) {
    const secao = objeto(s);
    if (!secao) continue;
    // O id vira âncora da tela: precisa existir e não se repetir.
    let id = texto(secao.id).replace(/[^a-z0-9-]/gi, "").toLowerCase() || `secao-${secoes.length + 1}`;
    while (usados.has(id)) id = `${id}-2`;
    usados.add(id);
    secoes.push({
      id,
      rotulo: texto(secao.rotulo),
      titulo: texto(secao.titulo),
      blocos: normalizarBlocos(secao.blocos, 0),
    });
  }

  const dataInicio = dataIso(o.dataInicio);
  const dataFim = dataIso(o.dataFim);
  return {
    chamada: texto(o.chamada),
    destinos: texto(o.destinos),
    periodo: texto(o.periodo),
    dataInicio,
    // Fim antes do início não é uma viagem: sem diário, em vez de um diário ao contrário.
    dataFim: dataInicio && dataFim && dataFim >= dataInicio ? dataFim : null,
    secoes,
  };
}

export function normalizarFicha(valor: unknown): FichaDeViagem | null {
  const o = objeto(valor);
  if (!o) return null;
  const ficha: FichaDeViagem = {
    nome: textoOpcional(o.nome) ?? null,
    nascimento: textoOpcional(o.nascimento) ?? null,
    diagnosticos: textoOpcional(o.diagnosticos) ?? null,
  };
  return ficha.nome || ficha.nascimento || ficha.diagnosticos ? ficha : null;
}

export interface DiaDaViagem {
  numero: number;
  /** AAAA-MM-DD — é a chave do que a paciente anota. */
  data: string;
  /** "11/11" */
  rotulo: string;
  /** "qua" */
  semana: string;
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Viagem mais longa que isto é erro de digitação na data, não um diário de 400 dias. */
export const MAXIMO_DE_DIAS = 90;

/**
 * Um dia para cada data da viagem, contando o primeiro e o último.
 *
 * A conta é feita ao meio-dia UTC: data de calendário não tem fuso, e somar
 * 24 h à meia-noite local repete ou pula um dia na virada do horário de verão.
 */
export function diasDaViagem(dataInicio: string | null, dataFim: string | null): DiaDaViagem[] {
  if (!dataInicio || !dataFim || dataFim < dataInicio) return [];
  const dias: DiaDaViagem[] = [];
  const fim = Date.parse(`${dataFim}T12:00:00Z`);
  for (let t = Date.parse(`${dataInicio}T12:00:00Z`); t <= fim && dias.length < MAXIMO_DE_DIAS; t += 86_400_000) {
    const d = new Date(t);
    const data = d.toISOString().slice(0, 10);
    dias.push({
      numero: dias.length + 1,
      data,
      rotulo: `${data.slice(8, 10)}/${data.slice(5, 7)}`,
      semana: SEMANA[d.getUTCDay()] ?? "",
    });
  }
  return dias;
}

export interface TrechoDeTexto {
  texto: string;
  negrito: boolean;
  italico: boolean;
}

/**
 * Parte um texto em trechos: `**negrito**` e `*itálico*`.
 *
 * Marca sem par fica como está escrita — um asterisco solto ("5 * 2") não
 * pode comer o resto do parágrafo.
 */
export function trechosDeTexto(entrada: string): TrechoDeTexto[] {
  const trechos: TrechoDeTexto[] = [];
  const padrao = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  let cursor = 0;
  for (let m = padrao.exec(entrada); m; m = padrao.exec(entrada)) {
    if (m.index > cursor) trechos.push({ texto: entrada.slice(cursor, m.index), negrito: false, italico: false });
    trechos.push(
      m[1] !== undefined
        ? { texto: m[1], negrito: true, italico: false }
        : { texto: m[2] ?? "", negrito: false, italico: true },
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < entrada.length) trechos.push({ texto: entrada.slice(cursor), negrito: false, italico: false });
  return trechos;
}

/** O texto sem as marcas, para a busca não tropeçar em asterisco. */
export function textoSemMarcas(entrada: string): string {
  return trechosDeTexto(entrada)
    .map((t) => t.texto)
    .join("");
}

export function normalizarParaBusca(entrada: string): string {
  return textoSemMarcas(entrada)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Só as seções com nome curto entram na barra de navegação do guia. */
export function secoesDaBarra(guia: GuiaDeViagem): SecaoDoGuia[] {
  return guia.secoes.filter((s) => s.rotulo.trim() !== "");
}

/** O esqueleto de um guia novo: as seções de sempre, sem texto nenhum. */
export function guiaEmBranco(): GuiaDeViagem {
  const secao = (id: string, rotulo: string, titulo: string, blocos: BlocoDoGuia[] = []): SecaoDoGuia => ({
    id,
    rotulo,
    titulo,
    blocos,
  });
  return {
    chamada: "Seu intestino, em qualquer destino.",
    destinos: "",
    periodo: "",
    dataInicio: null,
    dataFim: null,
    secoes: [
      secao("estrategia", "Estratégia", "Estratégia da viagem", [{ tipo: "lista", estilo: "numerada", itens: [] }]),
      secao("guia", "Guia", "Guia alimentar da viagem", [
        {
          tipo: "semaforo",
          grupos: [
            { cor: "verde", titulo: "O que ajuda", itens: [] },
            { cor: "amarelo", titulo: "Coma, mas observe como se sente", itens: [] },
            { cor: "vermelho", titulo: "Vale evitar", itens: [] },
          ],
        },
      ]),
      secao("pedir", "Pedir", "O que pedir", []),
      secao("kit", "Kit", "Kit de bolso", [{ tipo: "lista", estilo: "marcadores", itens: [] }]),
      secao("alerta", "Alerta", "Sinais de alerta", [{ tipo: "ficha" }]),
      secao("diario", "Diário", "Diário da viagem", [{ tipo: "diario" }]),
    ],
  };
}

/** Um id de seção que ainda não existe no guia. */
export function novoIdDeSecao(guia: GuiaDeViagem): string {
  const usados = new Set(guia.secoes.map((s) => s.id));
  let n = guia.secoes.length + 1;
  while (usados.has(`secao-${n}`)) n += 1;
  return `secao-${n}`;
}

export function blocoEmBranco(tipo: TipoDeBloco): BlocoDoGuia {
  switch (tipo) {
    case "texto":
    case "subtitulo":
      return { tipo, texto: "" };
    case "destaque":
      return { tipo, tom: "dica", texto: "" };
    case "lista":
      return { tipo, estilo: "marcadores", itens: [{ texto: "" }] };
    case "semaforo":
      return {
        tipo,
        grupos: [
          { cor: "verde", titulo: "O que ajuda", itens: [] },
          { cor: "amarelo", titulo: "Coma, mas observe como se sente", itens: [] },
          { cor: "vermelho", titulo: "Vale evitar", itens: [] },
        ],
      };
    case "abas":
      return { tipo, abas: [{ rotulo: "", blocos: [] }] };
    case "cartao":
      return { tipo, texto: "", destaques: [] };
    case "tabela":
      return { tipo, colunas: ["", ""], linhas: [["", ""]] };
    case "ficha":
      return { tipo };
    case "diario":
      return { tipo };
    case "produto":
      return { tipo, imagem: "", titulo: "", texto: "" };
  }
}
