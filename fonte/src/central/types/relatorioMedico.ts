/**
 * Relatório de evolução para o médico (lote 3, aprovado em 23/11/2026).
 * É uma FOTOGRAFIA: o que entrou no PDF fica guardado assim, para baixar de
 * novo igual. Só dados registrados; o único texto livre é o parecer dela.
 */
export type SecaoDoRelatorio = "fase" | "sintomas" | "tolerancia" | "checkin" | "peso" | "consultas";

export const SECOES_DO_RELATORIO: { chave: SecaoDoRelatorio; rotulo: string }[] = [
  { chave: "fase", rotulo: "Fase do método" },
  { chave: "sintomas", rotulo: "Sintomas e Bristol" },
  { chave: "tolerancia", rotulo: "Tolerou e não tolerou" },
  { chave: "checkin", rotulo: "Check-in da semana" },
  { chave: "peso", rotulo: "Peso e medidas" },
  { chave: "consultas", rotulo: "Anotações de consulta" },
];

export interface DadosDoRelatorio {
  paciente: string;
  de: string;
  ate: string;
  medico: string | null;
  emitidoEm: string;
  fase: { nome: string; desde: string } | null;
  sintomas: {
    registros: number;
    comSintoma: number;
    porSintoma: { rotulo: string; vezes: number }[];
    bristol: { tipo: number; vezes: number }[];
  } | null;
  tolerancia: { situacao: string; alimentos: string[] }[] | null;
  checkin: { titulo: string; notas: { data: string; nota: number }[] }[] | null;
  peso: {
    primeira: { data: string; peso: number } | null;
    ultima: { data: string; peso: number } | null;
    circunferencias: { nome: string; valor: string }[];
  } | null;
  consultas: { data: string; resumo: string | null; observacoes: string | null }[] | null;
  parecer: string | null;
}

export interface RelatorioGuardado {
  id: string;
  criadoEm: string;
  dados: DadosDoRelatorio;
}
