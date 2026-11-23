/**
 * As contas do relatório para o médico. Puras e testadas: só contam e
 * filtram pelo período o que foi registrado. Nada aqui interpreta.
 */
import type { DadosDoRelatorio, SecaoDoRelatorio } from "@/central/types/relatorioMedico";
import { rotuloSintoma, STATUS } from "@/central/utils/reintroducao";

interface Entrada {
  paciente: string;
  de: string;
  ate: string;
  medico: string | null;
  emitidoEm: string;
  secoes: SecaoDoRelatorio[];
  parecer: string | null;
  fases: { fase: string; inicio: string }[];
  registros: { data: string; sintomas: string[]; bristol: number | null }[];
  itens: { nome: string; status: string }[];
  checkins: { titulo: string; envios: { data: string; nota: number | null }[] }[];
  avaliacoes: { data: string; peso: number | null; circunferencias: { nome: string; valor: string }[] }[];
  consultas: { data: string; status: string; resumo: string | null; observacoes: string | null }[];
}

const noPeriodo = (d: string, de: string, ate: string) => d >= de && d <= ate;

// A leitura DELA de cada alimento, na ordem em que a tela já mostra.
const SITUACOES = ["bem_tolerado", "tolerancia_parcial", "sintomas_observados", "nao_tolerado", "necessita_reavaliacao"];

export function montarRelatorio(e: Entrada): DadosDoRelatorio {
  const quer = (s: SecaoDoRelatorio) => e.secoes.includes(s);

  // A fase em que ela estava no fim do período (a última que começou até lá).
  const fase = [...e.fases].filter((f) => f.inicio <= e.ate).sort((a, b) => a.inicio.localeCompare(b.inicio)).pop();

  const regs = e.registros.filter((r) => noPeriodo(r.data, e.de, e.ate));
  const contar = <T,>(lista: T[]) => {
    const m = new Map<T, number>();
    for (const x of lista) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const porSintoma = contar(regs.flatMap((r) => r.sintomas.filter((s) => s !== "nenhum")));
  const bristol = contar(regs.map((r) => r.bristol).filter((b): b is number => b !== null));

  const avals = e.avaliacoes.filter((a) => noPeriodo(a.data, e.de, e.ate)).sort((a, b) => a.data.localeCompare(b.data));
  const comPeso = avals.filter((a) => a.peso !== null) as { data: string; peso: number; circunferencias: { nome: string; valor: string }[] }[];

  return {
    paciente: e.paciente,
    de: e.de,
    ate: e.ate,
    medico: e.medico?.trim() || null,
    emitidoEm: e.emitidoEm,
    parecer: e.parecer?.trim() || null,
    fase: quer("fase") && fase ? { nome: fase.fase, desde: fase.inicio } : null,
    sintomas: quer("sintomas")
      ? {
          registros: regs.length,
          comSintoma: regs.filter((r) => r.sintomas.some((s) => s !== "nenhum")).length,
          porSintoma: [...porSintoma.entries()]
            .map(([s, vezes]) => ({ rotulo: rotuloSintoma(s as never), vezes }))
            .sort((a, b) => b.vezes - a.vezes || a.rotulo.localeCompare(b.rotulo, "pt-BR")),
          bristol: [...bristol.entries()].map(([tipo, vezes]) => ({ tipo, vezes })).sort((a, b) => a.tipo - b.tipo),
        }
      : null,
    tolerancia: quer("tolerancia")
      ? SITUACOES.map((s) => ({
          situacao: STATUS.find((x) => x.chave === s)?.rotulo ?? s,
          alimentos: e.itens.filter((i) => i.status === s).map((i) => i.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
        })).filter((g) => g.alimentos.length > 0)
      : null,
    checkin: quer("checkin")
      ? e.checkins
          .map((q) => ({
            titulo: q.titulo,
            notas: q.envios
              .filter((x): x is { data: string; nota: number } => x.nota !== null && noPeriodo(x.data, e.de, e.ate))
              .sort((a, b) => a.data.localeCompare(b.data)),
          }))
          .filter((q) => q.notas.length > 0)
      : null,
    peso: quer("peso")
      ? {
          primeira: comPeso[0] ? { data: comPeso[0].data, peso: comPeso[0].peso } : null,
          ultima: comPeso.length > 1 ? { data: comPeso[comPeso.length - 1]!.data, peso: comPeso[comPeso.length - 1]!.peso } : null,
          circunferencias: (avals[avals.length - 1]?.circunferencias ?? []).filter((c) => c.nome.trim() && c.valor.trim()),
        }
      : null,
    consultas: quer("consultas")
      ? e.consultas
          .filter((c) => c.status === "concluida" && noPeriodo(c.data, e.de, e.ate) && (c.resumo?.trim() || c.observacoes?.trim()))
          .sort((a, b) => a.data.localeCompare(b.data))
          .map((c) => ({ data: c.data, resumo: c.resumo?.trim() || null, observacoes: c.observacoes?.trim() || null }))
      : null,
  };
}

/** "−4,2 kg" ou "+1,0 kg" entre a primeira e a última pesagem do período. */
export function variacaoDoPeso(p: DadosDoRelatorio["peso"]): string | null {
  if (!p?.primeira || !p.ultima) return null;
  const d = Math.round((p.ultima.peso - p.primeira.peso) * 10) / 10;
  return `${d < 0 ? "−" : "+"}${Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg`;
}
