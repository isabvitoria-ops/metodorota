import {
  REFEICOES_DO_DIARIO,
  type FotoDoDiario,
  type RefeicaoDoDiario,
} from "@/central/types/diarioDeFotos";

/**
 * As contas do diário de fotos, fora da tela para poderem ser testadas.
 */

/** A foto é reduzida antes de subir: 1280 px no lado maior bastam para ver o prato. */
export const LADO_MAXIMO = 1280;

export function tamanhoReduzido(
  largura: number,
  altura: number,
  maximo = LADO_MAXIMO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return { largura, altura };
  const fator = maximo / maior;
  return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

/** A refeição que provavelmente é, pela hora — ela só corrige se errarmos. */
export function refeicaoPelaHora(hora: number): RefeicaoDoDiario {
  if (hora >= 5 && hora < 9) return "cafe";
  if (hora >= 9 && hora < 11) return "lanche_manha";
  if (hora >= 11 && hora < 15) return "almoco";
  if (hora >= 15 && hora < 18) return "lanche_tarde";
  if (hora >= 18 && hora < 22) return "jantar";
  return "ceia";
}

export function rotuloDaRefeicao(valor: RefeicaoDoDiario): string {
  return REFEICOES_DO_DIARIO.find((r) => r.valor === valor)?.rotulo ?? "Refeição";
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "Hoje", "Ontem" ou "seg, 28/09". Sem depender de fuso: só aritmética de data. */
export function rotuloDoDia(data: string, hoje: string): string {
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const dias = Math.round((ms(hoje) - ms(data)) / 86_400_000);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  const [, mes, dia] = data.split("-");
  return `${DIAS[new Date(ms(data)).getUTCDay()]}, ${dia}/${mes}`;
}

/** Os dias, do mais recente ao mais antigo; dentro do dia, a última foto primeiro. */
export function agruparPorDia(fotos: FotoDoDiario[]): { data: string; fotos: FotoDoDiario[] }[] {
  const porDia = new Map<string, FotoDoDiario[]>();
  for (const f of fotos) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f]);
  return [...porDia.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([data, lista]) => ({
      data,
      fotos: [...lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    }));
}

/**
 * O caminho da foto no balde. A PRIMEIRA PASTA É A PACIENTE — é o que a
 * política do balde olha para separar uma pessoa da outra.
 */
export function caminhoDaFoto(
  pacienteId: string,
  agora: number = Date.now(),
  aleatorio: string = Math.random().toString(36).slice(2, 8),
): string {
  return `${pacienteId}/${agora}-${aleatorio}.jpg`;
}

/** Quantos dias seguidos, terminando hoje ou ontem, têm ao menos uma foto. */
export function diasSeguidos(fotos: FotoDoDiario[], hoje: string): number {
  const dias = new Set(fotos.map((f) => f.data));
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  // Se hoje ainda não tem foto, a sequência não quebrou: ainda dá tempo.
  let cursor = dias.has(hoje) ? ms(hoje) : ms(hoje) - 86_400_000;
  let total = 0;
  while (dias.has(iso(cursor))) {
    total += 1;
    cursor -= 86_400_000;
  }
  return total;
}
