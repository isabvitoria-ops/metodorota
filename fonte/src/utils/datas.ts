import { DIAS_SEMANA_ABREV } from "@/constants/textos";

export function hoje(): Date {
  return new Date();
}

export function dataMenos(dias: number, base: Date = new Date()): Date {
  const x = new Date(base);
  x.setDate(x.getDate() - dias);
  return x;
}

export function rotuloDiaSemana(d: Date): string {
  return DIAS_SEMANA_ABREV[d.getDay()]!;
}

export function formatarDataCurta(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatarDataLonga(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export function paraISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
