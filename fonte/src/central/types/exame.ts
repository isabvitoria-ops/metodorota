/**
 * Exames guardados.
 *
 * O único módulo do sistema que guarda ARQUIVO. O arquivo vive num balde
 * privado do Supabase; esta linha é só o metadado que aponta para ele.
 * Ver o cabeçalho da migração 0045 para por que as duas coisas são
 * protegidas separadamente.
 */
export interface Exame {
  id: string;
  /** O endereço dentro do balde: "<id-da-paciente>/<arquivo>". */
  caminho: string;
  nome: string;
  tipo: string;
  tamanho: number;
  /** A data DO EXAME, que não é a data do envio. */
  data: string | null;
  descricao: string | null;
  /** Quem mandou. "Ela mandou" e "eu guardei" são coisas diferentes. */
  origem: "nutricionista" | "paciente";
  criadoEm: string;
}

export interface EspacoDosExames {
  arquivos: number;
  bytes: number;
  pacientesComExame: number;
}
