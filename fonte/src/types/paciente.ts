import type { ID, ISODateString, RegistroDominio } from "./common";
import type { UnidadeExibicao } from "./common";

export interface Nutricionista {
  id: ID;
  nome: string;
  email: string;
  /** Regra §5: MFA obrigatório no primeiro login em cada dispositivo novo, com opção de "confiar neste dispositivo". */
  dispositivosConfiaveis: { deviceId: string; confiadoAte: ISODateString }[];
}

/**
 * Regra #14: login é só por convite — sem cadastro público de paciente.
 * `ativo=false` (acesso encerrado) nunca apaga dado (regra #8): é reversível
 * a qualquer momento, sem recriar cadastro.
 */
export interface Paciente extends RegistroDominio {
  nome: string;
  apelidoFeed: string;
  email: string;
  objetivo: string;
  ativo: boolean;
  convidadoEm: ISODateString;
  ultimoLoginEm: ISODateString | null;
  /** Texto que a nutricionista lê ("quinta, 14h") — livre, nunca usado para contas. */
  proximaConsultaRotulo?: string;
  /** A data de verdade da próxima consulta. É o que permite contar "esta semana". */
  proximaConsultaEm?: ISODateString;
  faseRotulo?: string;
  /** Códigos TACO liberados para este paciente — só o que está aqui existe para ela (montador, trocas, busca). */
  alimentosLiberadosCodigoTaco: number[];
  materiaisLiberadosId: ID[];
  /** Regra #7: decisão da nutricionista, nunca automática. */
  preferenciaUnidade: UnidadeExibicao;
  /** Regra #13: paciente registra peso mas, se "cego", não vê o número — só a nutricionista. */
  pesoModoCego: boolean;
}

/**
 * Métricas derivadas (adesão, último check-in, pendências) para a lista de
 * pacientes e o dashboard — nunca armazenadas em `Paciente`, sempre
 * calculadas por `services/pacienteService` a partir do histórico real
 * (check-ins, diário, questionários). Aqui o mock só simula o resultado
 * já pronto que o serviço devolveria.
 */
export interface ResumoAdesaoPaciente {
  pacienteId: ID;
  adesaoPercentual: number;
  ultimoCheckinRotulo: string;
  pendencias: string[];
}
