import type { CamposDoDiario, DiaDoDiarioDeViagem } from "@/central/types/viagem";
import { numeroDeTexto } from "@/central/utils/numero";

/**
 * Diário do Rota Viagem — as regras que não dependem de tela.
 *
 * O diário é preenchido no exterior, muitas vezes sem internet. Por isso ele
 * vive primeiro no aparelho e só depois vai para o banco: cada dia carrega a
 * marca `pendente` enquanto a nutricionista ainda não recebeu aquela versão.
 */

export const CAMPOS_VAZIOS: CamposDoDiario = {
  onde: "",
  inchaco: "",
  dor: "",
  azia: "",
  evacuacoes: "",
  bristol: "",
  observacoes: "",
};

export type DiaLocal = CamposDoDiario & { pendente?: boolean };
export type DiarioLocal = Record<string, DiaLocal>;

/** As faixas são as mesmas que o banco exige; fora delas ele recusa o dia inteiro. */
const FAIXAS: Record<"inchaco" | "dor" | "azia" | "evacuacoes" | "bristol", [number, number]> = {
  inchaco: [0, 10],
  dor: [0, 10],
  azia: [0, 10],
  evacuacoes: [0, 30],
  bristol: [1, 7],
};

export type CampoNumerico = keyof typeof FAIXAS;

export function eCampoNumerico(campo: keyof CamposDoDiario): campo is CampoNumerico {
  return campo in FAIXAS;
}

/**
 * O que ela digitou num campo de número, já dentro da faixa.
 * "12" vira "10"; "3,6" vira "4"; texto vira vazio.
 */
export function numeroNaFaixa(campo: CampoNumerico, digitado: string): string {
  const n = numeroDeTexto(digitado);
  if (n === null || !Number.isFinite(n)) return "";
  const [minimo, maximo] = FAIXAS[campo];
  return String(Math.min(maximo, Math.max(minimo, Math.round(n))));
}

export function camposDe(dia: DiaLocal | undefined): CamposDoDiario {
  if (!dia) return CAMPOS_VAZIOS;
  const { onde, inchaco, dor, azia, evacuacoes, bristol, observacoes } = dia;
  return { onde, inchaco, dor, azia, evacuacoes, bristol, observacoes };
}

export function temAlgoPreenchido(dia: DiaLocal | undefined): boolean {
  return Object.values(camposDe(dia)).some((v) => v.trim() !== "");
}

/** Um dia vindo do banco, na forma em que os campos da tela trabalham. */
export function camposDoServidor(dia: DiaDoDiarioDeViagem): CamposDoDiario {
  const n = (v: number | null) => (v === null ? "" : String(v));
  return {
    onde: dia.onde ?? "",
    inchaco: n(dia.inchaco),
    dor: n(dia.dor),
    azia: n(dia.azia),
    evacuacoes: n(dia.evacuacoes),
    bristol: n(dia.bristol),
    observacoes: dia.observacoes ?? "",
  };
}

/**
 * Junta o que está no aparelho com o que está no banco.
 *
 * O dia `pendente` do aparelho ganha: é a versão mais nova, que ainda não
 * subiu. Nos outros vale o banco — é assim que o que ela preencheu num
 * aparelho aparece no outro.
 */
export function mesclarDiario(local: DiarioLocal, servidor: DiaDoDiarioDeViagem[]): DiarioLocal {
  const junto: DiarioLocal = { ...local };
  for (const dia of servidor) {
    if (junto[dia.dia]?.pendente) continue;
    junto[dia.dia] = { ...camposDoServidor(dia), pendente: false };
  }
  return junto;
}

/** Os dias que ainda precisam subir. */
export function diasPendentes(local: DiarioLocal): string[] {
  return Object.keys(local).filter((dia) => local[dia]?.pendente);
}

/**
 * O diário da primeira versão ficava guardado pelo NÚMERO do dia (1, 2, 3…).
 * Aqui ele passa para a data, e o que estiver preenchido fica marcado para subir.
 */
export function migrarDiarioPorNumero(antigo: unknown, datas: string[]): DiarioLocal {
  if (antigo === null || typeof antigo !== "object" || Array.isArray(antigo)) return {};
  const novo: DiarioLocal = {};
  for (const [chave, valor] of Object.entries(antigo as Record<string, unknown>)) {
    const data = datas[Number(chave) - 1];
    if (!data || valor === null || typeof valor !== "object") continue;
    const v = valor as Record<string, unknown>;
    const texto = (c: keyof CamposDoDiario) => (typeof v[c] === "string" ? (v[c] as string) : "");
    const dia: DiaLocal = {
      onde: texto("onde"),
      observacoes: texto("observacoes"),
      inchaco: numeroNaFaixa("inchaco", texto("inchaco")),
      dor: numeroNaFaixa("dor", texto("dor")),
      azia: numeroNaFaixa("azia", texto("azia")),
      evacuacoes: numeroNaFaixa("evacuacoes", texto("evacuacoes")),
      bristol: numeroNaFaixa("bristol", texto("bristol")),
    };
    if (temAlgoPreenchido(dia)) novo[data] = { ...dia, pendente: true };
  }
  return novo;
}

/** Lê o diário guardado no aparelho. Nunca lança; lixo vira diário vazio. */
export function lerDiarioLocal(bruto: string | null): DiarioLocal {
  if (!bruto) return {};
  try {
    const dados: unknown = JSON.parse(bruto);
    if (dados === null || typeof dados !== "object" || Array.isArray(dados)) return {};
    const diario: DiarioLocal = {};
    for (const [dia, valor] of Object.entries(dados as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || valor === null || typeof valor !== "object") continue;
      const v = valor as Record<string, unknown>;
      const texto = (c: keyof CamposDoDiario) => (typeof v[c] === "string" ? (v[c] as string) : "");
      diario[dia] = {
        onde: texto("onde"),
        inchaco: texto("inchaco"),
        dor: texto("dor"),
        azia: texto("azia"),
        evacuacoes: texto("evacuacoes"),
        bristol: texto("bristol"),
        observacoes: texto("observacoes"),
        pendente: v.pendente === true,
      };
    }
    return diario;
  } catch {
    return {};
  }
}
