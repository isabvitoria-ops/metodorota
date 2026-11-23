/** Medicamentos × nutrientes (0101). Tudo aqui é só da nutricionista. */
export type TipoDeMedicamento = "medicamento" | "suplemento" | "fitoterapico";

export const TIPOS_DE_MEDICAMENTO: { chave: TipoDeMedicamento; rotulo: string }[] = [
  { chave: "medicamento", rotulo: "Medicamento" },
  { chave: "suplemento", rotulo: "Suplemento" },
  { chave: "fitoterapico", rotulo: "Fitoterápico" },
];

export interface NutrienteDaBase {
  nutriente: string;
  /** Referência completa (autor, revista, ano, doi). Sem fonte, não entra. */
  fonte: string;
}

/** Uma linha da base dela: um medicamento ou uma classe. */
export interface EntradaDaBase {
  id: string;
  nome: string;
  /** Os nomes que casam com o que a paciente usa (omeprazol, pantoprazol…). */
  termos: string[];
  nutrientes: NutrienteDaBase[];
  /** Nulo = ainda não conferida por ela: não vale para lembrete nem PDF. */
  conferidoEm: string | null;
  anotacao: string | null;
}

export interface MedicamentoDaPaciente {
  id: string;
  pacienteId: string;
  nome: string;
  tipo: TipoDeMedicamento;
  dose: string | null;
  horario: string | null;
  desde: string | null;
  prescritoPor: string | null;
  anotacao: string | null;
  ativo: boolean;
}
