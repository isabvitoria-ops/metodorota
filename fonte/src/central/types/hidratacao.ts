export type TipoLiquido = "agua" | "cha" | "suco" | "outro";

export interface RegistroHidratacao {
  id: string;
  ml: number;
  tipo: TipoLiquido;
  criadoEm: string;
}

export interface DiaHidratacao {
  data: string;
  totalMl: number;
}

export interface MinhaHidratacao {
  metaMl: number | null;
  hoje: RegistroHidratacao[];
  historico: DiaHidratacao[];
}

export interface HidratacaoDoPaciente {
  metaMl: number | null;
  dias: DiaHidratacao[];
}
