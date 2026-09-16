import type { ID } from "./common";

export interface LembretePreferencia {
  id: string;
  label: string;
  descricao: string;
  ativo: boolean;
  horario?: string;
}

export interface PreferenciasNotificacao {
  pacienteId: ID;
  /** Regra §16: nada sobre sintoma/intestino aparece na tela bloqueada quando ativo. */
  textoDiscretoNaTelaBloqueada: boolean;
  naoPerturbeInicio: string;
  naoPerturbeFim: string;
  lembretes: LembretePreferencia[];
}

export interface Consentimento {
  id: string;
  obrigatorio: boolean;
  titulo: string;
  texto: string;
}

export interface ConsentimentoRegistro {
  pacienteId: ID;
  consentimentoId: string;
  aceitoEm: string;
  aceito: boolean;
}
