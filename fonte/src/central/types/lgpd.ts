/**
 * Termo de uso, privacidade e direitos da paciente (LGPD) — migração 0063.
 */
export interface TermoDeUso {
  versao: number;
  texto: string;
  publicadoEm: string | null;
}

/** O aceite de quem está usando. A nutricionista nunca fica pendente. */
export interface EstadoDoTermo {
  versao: number;
  aceito: boolean;
  aceitoEm: string | null;
  /**
   * Já viu a tela que ensina a colocar o app na tela inicial. Fica no banco, e
   * não no aparelho, para não reaparecer se ela trocar de telefone.
   */
  boasVindasVistas: boolean;
}

export interface SituacaoDosAceites {
  versao: number;
  aceitaram: number;
  comConta: number;
  pendentes: number;
}

export interface PedidoLgpd {
  id: string;
  pacienteId: string | null;
  pacienteNome: string;
  motivo: string | null;
  criadoEm: string;
  atendidoEm: string | null;
}
