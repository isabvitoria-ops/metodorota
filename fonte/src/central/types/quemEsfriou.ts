/** Quem esfriou (0103). Só datas e fatos; quem decide o que fazer é ela. */
export interface PacienteQueEsfriou {
  id: string;
  nome: string;
  telefone: string | null;
  comAcesso: boolean;
  ultimoRegistro: string | null;
  /** Check-in desta semana com o prazo vencido e sem resposta. */
  checkins: { titulo: string; venceuEm: string }[];
  /** Alimento em teste e nenhum rastreio há mais de 7 dias. Nulo: não se aplica. */
  reintroducao: { emTeste: string[]; ultimoRastreio: string | null } | null;
  cobrancas: { id: string; competencia: string; valor: number; vencimento: string }[];
  /** Com acesso e sem retorno marcado (só um aviso para ela). */
  semRetorno: boolean;
  ultimaConsulta: string | null;
}

/** "Feito" e "Ignorar" do Precisa de um oi (0108). */
export type ComoResolveu = "feito" | "ignorado";

export interface MarcaDoOi {
  /** Os motivos do dia em que ela marcou; mudou, a paciente volta. */
  assinatura: string;
  como: ComoResolveu;
  /** AAAA-MM-DD do dia em que ela marcou. */
  em: string;
}
