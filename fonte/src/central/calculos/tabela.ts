/**
 * A base de alimentos dos Cálculos — TACO, IBGE, USDA, os alimentos dela e a
 * tabela que ela importou (TBCA), numa busca só.
 *
 * É a seção "A tabela" de nutri/app.mjs trazida para cá SEM mudar regra:
 *
 *   * cada alimento carrega a sua fonte, e os números nunca se misturam;
 *   * valor que a tabela não traz é `null` ("—"), nunca zero, e não entra na
 *     soma; o traço da TACO ("Tr") também não soma, mas não deixa o total
 *     incompleto;
 *   * os arquivos de dados são os MESMOS da ferramenta (nutri/dados/*.json),
 *     lidos do site — o app não carrega uma segunda cópia.
 */
import { porGramas, somar } from "./motor/calculos.mjs";
import { MEDIDA_GRAMA, gramasDoItem, ordenarPorRelevancia, porcaoEquivalente, CRITERIO_PADRAO } from "./motor/dieta.mjs";
import { listarAlimentos, medidasDe } from "./motor/meusAlimentos.mjs";
import { lerTabela } from "./motor/tabelaImportada.mjs";

export type Fonte = "taco" | "ibge" | "usda" | "meu" | "importada";

export interface Alimento {
  id: string;
  fonte: Fonte;
  nome: string;
  busca: string;
  grupo: string;
  // O registro como veio da fonte; cada fonte tem o seu formato.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bruto: any;
}

export interface Medida {
  nome: string;
  gramas: number;
  ref?: string;
}

export interface ItemDaDieta {
  codigo: string;
  nome: string;
  quantidade: number;
  medida: Medida;
  igualarPor?: string;
  substitutos?: { codigo: string; nome: string; medida: Medida }[];
  verSubstitutos?: boolean;
}

const FONTES: Record<string, string> = { taco: "TACO", ibge: "IBGE", usda: "USDA", meu: "Meu" };

/** Nome e busca sem acento, para casar com o que ela digita. */
export const semAcento = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const DO_IBGE: Record<string, string> = {
  energia_kcal: "energia_kcal",
  proteina: "proteina_g",
  lipideos: "lipidios_g",
  carboidrato: "carboidrato_g",
  fibra_alimentar: "fibra_g",
};

export interface Resumo {
  taco: { quantos: number; nome: string; instituicao: string };
  ibge: { quantos: number; nome: string } | null;
  usda: { quantos: number; fonte: string } | null;
}

class Base {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taco: any = null;
  pos: Record<string, number> = {};
  posUsda: Record<string, number> = {};
  medidasPadrao: Record<string, unknown[]> = {};
  tabelas: Alimento[] = [];
  alimentos: Alimento[] = [];
  resumo: Resumo | null = null;
  /** Os nutrientes da TACO, na ordem do arquivo (para as colunas extras). */
  nutrientes: string[] = [];
  private carregando: Promise<void> | null = null;

  carregar(): Promise<void> {
    if (!this.carregando) this.carregando = this.ler().catch((e) => {
      this.carregando = null;
      throw e;
    });
    return this.carregando;
  }

  private async ler() {
    const base = `${import.meta.env.BASE_URL}nutri/dados/`;
    const json = (f: string) => fetch(base + f).then((r) => {
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return r.json();
    });
    const [taco, ibge, usda, medidas] = await Promise.all([
      json("taco.json"),
      // IBGE, USDA e medidas são extras: sem eles a TACO continua valendo.
      json("ibge.json").catch(() => null),
      json("usda.json").catch(() => null),
      json("medidas.json").catch(() => null),
    ]);
    this.medidasPadrao = medidas?.alimentos ?? {};
    this.taco = taco;
    this.nutrientes = taco.nutrientes;
    taco.nutrientes.forEach((chave: string, i: number) => (this.pos[chave] = i));

    const tabelas: Alimento[] = taco.alimentos.map((a: { c: string; n: string; b: string; g: string }) => ({
      id: `taco:${a.c}`,
      fonte: "taco" as const,
      nome: a.n,
      busca: a.b,
      grupo: a.g,
      bruto: a,
    }));
    if (ibge) {
      for (const a of ibge.alimentos) {
        const preparo = a.preparo && a.preparo !== "Não se aplica" ? a.preparo : "";
        const nome = preparo ? `${a.nome} (${String(preparo).toLowerCase()})` : a.nome;
        tabelas.push({
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
      usda.nutrientes.forEach((chave: string, i: number) => (this.posUsda[chave] = i));
      for (const a of usda.alimentos) {
        tabelas.push({ id: `usda:${a.c}`, fonte: "usda", nome: a.n, busca: a.b, grupo: "USDA", bruto: a });
      }
    }
    this.tabelas = tabelas;
    this.resumo = {
      taco: { quantos: taco.alimentos.length, nome: taco.nome, instituicao: taco.instituicao },
      ibge: ibge ? { quantos: ibge.alimentos.length, nome: ibge.nome } : null,
      usda: usda ? { quantos: usda.alimentos.length, fonte: usda.fonte } : null,
    };
    this.remontar();
  }

  /** Refeito a cada cadastro: o alimento novo aparece na busca na hora. */
  remontar() {
    const tabela = lerTabela();
    const importados: Alimento[] = (tabela?.alimentos ?? []).map(
      (a: { codigo: string; nome: string; grupo?: string; descricao?: string }) => ({
        id: `imp:${a.codigo}`,
        fonte: "importada" as const,
        nome: a.nome,
        busca: semAcento(`${a.nome} ${a.grupo ?? ""} ${a.descricao ?? ""}`),
        grupo: a.grupo ?? "",
        bruto: a,
      }),
    );
    this.alimentos = [
      ...listarAlimentos().map((a: { id: string; nome: string; grupo?: string }) => ({
        id: a.id,
        fonte: "meu" as const,
        nome: a.nome,
        busca: semAcento(`${a.nome} ${a.grupo ?? ""}`),
        grupo: a.grupo ?? "Meus alimentos",
        bruto: a,
      })),
      ...importados,
      ...this.tabelas,
    ];
  }
}

export const base = new Base();

export function etiquetaDaFonte(fonte: Fonte): string {
  if (fonte === "importada") return lerTabela()?.fonte?.sigla ?? "Importada";
  return FONTES[fonte] ?? fonte;
}

/** O valor de um nutriente naquele alimento, por 100 g, ou null. */
export function valorDe(alimento: Alimento | null | undefined, chave: string): number | null {
  if (!alimento) return null;
  if (alimento.fonte === "importada" || alimento.fonte === "meu") {
    const v = alimento.bruto[chave];
    return v === undefined ? null : v;
  }
  if (alimento.fonte === "usda") {
    const pos = base.posUsda[chave];
    if (pos === undefined) return null;
    const v = alimento.bruto.v[pos];
    return v === undefined ? null : v;
  }
  if (alimento.fonte === "ibge") {
    const campo = DO_IBGE[chave];
    return campo ? (alimento.bruto[campo] ?? null) : null;
  }
  const pos = base.pos[chave];
  if (pos === undefined) return null;
  const achado = (alimento.bruto.v as [number, number][]).find(([p]) => p === pos);
  return achado ? achado[1] : null;
}

/** "Tr" da TACO: presente, abaixo do que o laboratório mede. */
export function ehTraco(alimento: Alimento | null | undefined, chave: string): boolean {
  if (!alimento || alimento.fonte !== "taco") return false;
  const pos = base.pos[chave];
  return pos !== undefined && ((alimento.bruto.t ?? []) as number[]).includes(pos);
}

export function alimentoPorId(id: string): Alimento | null {
  const bruto = String(id);
  const direto = base.alimentos.find((a) => a.id === bruto);
  if (direto) return direto;
  // Ficha antiga guardava só o código da TACO, um número solto.
  if (!/^\d+$/.test(bruto)) return null;
  return base.alimentos.find((a) => a.id === `taco:${bruto}`) ?? null;
}

export function buscar(termo: string): Alimento[] {
  const palavras = semAcento(termo)
    .split(/[\s,.;:/()-]+/)
    .filter(Boolean);
  if (!palavras.length || palavras.join("").length < 2) return [];
  const achados = base.alimentos.filter((a) => palavras.every((p) => a.busca.includes(p)));
  return (ordenarPorRelevancia(achados, palavras, semAcento) as Alimento[]).slice(0, 40);
}

/** Soma um nutriente numa lista de itens: total, faltando (sem dado) e traços. */
export function somaDoNutriente(itens: ItemDaDieta[], chave: string) {
  let tracos = 0;
  const valores: (number | null)[] = [];
  for (const item of itens) {
    const a = alimentoPorId(item.codigo);
    const v = a ? (porGramas(valorDe(a, chave), gramasDoItem(item)) as number | null) : null;
    if (v === null && ehTraco(a, chave)) tracos += 1;
    else valores.push(v);
  }
  const { total, faltando } = somar(valores) as { total: number | null; faltando: number };
  return { total, faltando, tracos };
}

export const mostrar = (v: number | null | undefined, casas = 1, sufixo = "") =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + sufixo;

/** O que a célula mostra: o número, "Tr" ou "—". */
export function textoDaCelula(alimento: Alimento | null, chave: string, gramas: number, casas: number) {
  const v = alimento ? (porGramas(valorDe(alimento, chave), gramas) as number | null) : null;
  if (v !== null) return { texto: mostrar(v, casas), dica: "" };
  if (ehTraco(alimento, chave)) {
    return { texto: "Tr", dica: "Traço: presente em quantidade abaixo do que o laboratório mede. Não entra na soma." };
  }
  return { texto: "—", dica: "A tabela não traz este valor para este alimento." };
}

/** Quanto do substituto equivale ao item, pelo critério do item. */
export function porcaoDoSubstituto(item: ItemDaDieta, sub: { codigo: string; medida: Medida }) {
  const principal = alimentoPorId(item.codigo);
  const troca = alimentoPorId(sub.codigo);
  if (!principal || !troca) return null;
  const criterio = item.igualarPor ?? CRITERIO_PADRAO;
  return porcaoEquivalente(
    porGramas(valorDe(principal, criterio), gramasDoItem(item)),
    valorDe(troca, criterio),
    sub.medida,
  ) as { quantidade: number; gramas: number } | null;
}

/** "90 g" ou "2 unidades (100 g)". */
export function porcaoEmTexto(quantidade: number, medida: Medida, gramas: number) {
  return medida.nome === "g"
    ? `${mostrar(gramas, 0)} g`
    : `${mostrar(quantidade, quantidade % 1 ? 1 : 0)} ${medida.nome} (${mostrar(gramas, 0)} g)`;
}

/** As medidas de um alimento: grama, as dela, as que ela criou e as oficiais. */
export function medidasDoAlimento(codigo: string): Medida[] {
  const alimento = alimentoPorId(codigo);
  const proprias =
    alimento?.fonte === "meu" || alimento?.fonte === "importada" ? ((alimento.bruto.medidas ?? []) as Medida[]) : [];
  const padrao = ((base.medidasPadrao[alimento?.id ?? codigo] ?? []) as unknown[]).map((m) =>
    Array.isArray(m)
      ? { nome: String(m[0]), gramas: Number(m[1]), ref: "USDA SR28 · porção oficial do próprio alimento" }
      : { nome: String((m as { n: string }).n), gramas: Number((m as { g: number }).g), ref: (m as { ref?: string }).ref },
  );
  const saida: Medida[] = [];
  for (const m of [MEDIDA_GRAMA as Medida, ...proprias, ...(medidasDe(codigo) as Medida[]), ...padrao] as Medida[]) {
    const nome = String(m?.nome ?? "").trim();
    const gramas = Number(m?.gramas);
    if (!nome || !Number.isFinite(gramas) || gramas <= 0) continue;
    if (saida.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
    saida.push(m.ref ? { nome, gramas, ref: m.ref } : { nome, gramas });
  }
  return saida;
}

export const NOTA_GUARDADA = "Guardada na ficha: esta medida não está mais na tabela. Vale o peso de quando você escolheu.";

/**
 * As medidas do alimento e, se a medida guardada na ficha saiu da tabela,
 * ela também, com o peso de quando foi escolhida. Sem isso, a dieta salva
 * caía calada para "g": "1 tomate grande (182 g)" virava 1 g.
 */
export function medidasComAGuardada(codigo: string, guardada: { nome?: unknown; gramas?: unknown } | null | undefined): Medida[] {
  const lista = medidasDoAlimento(codigo);
  const nome = String(guardada?.nome ?? "").trim();
  const gramas = Number(guardada?.gramas);
  if (!nome || !(gramas > 0) || lista.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) return lista;
  return [...lista, { nome, gramas, ref: NOTA_GUARDADA }];
}

/** "unidade (69 g)"; medida miúda leva uma casa. */
export function rotuloDaMedida(m: Medida) {
  if (m.nome === "g") return "g";
  const casas = m.gramas < 10 && m.gramas % 1 ? 1 : 0;
  return `${m.nome} (${mostrar(m.gramas, casas)} g)`;
}

/** Lê número escrito do jeito brasileiro ("1.234,5"); vazio ou inválido é 0. */
export function num(v: unknown): number {
  let texto = String(v ?? "").trim();
  if (texto.includes(",") && texto.includes(".")) texto = texto.replace(/\./g, "");
  const n = parseFloat(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
