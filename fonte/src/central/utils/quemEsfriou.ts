/**
 * Quem esfriou (0103): as frases de cada motivo e o que abre no WhatsApp.
 * Puras e testadas. As regras de quem entra estão no banco (quem_esfriou).
 */
import type { PacienteQueEsfriou } from "@/central/types/quemEsfriou";

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** A mensagem aprovada por ela em 23/11/2026, para check-in e reintrodução. */
export function mensagemDeOi(): string {
  return "Oi, diva! Senti sua falta por aqui. Como você está? Me conta como foi a semana.";
}

/** Quem precisa de mensagem (motivos 1 a 3). O "sem retorno" (4) é só aviso para ela. */
export function precisaDeOi(p: PacienteQueEsfriou): boolean {
  return p.checkins.length > 0 || p.reintroducao !== null || p.cobrancas.length > 0;
}

/** Uma frase por motivo, curta, com a data de onde veio. */
export function motivos(p: PacienteQueEsfriou): string[] {
  const saida: string[] = [];
  for (const c of p.checkins) saida.push(`${c.titulo}: o prazo venceu em ${ddmm(c.venceuEm)} e não teve resposta.`);
  if (p.reintroducao) {
    const alimentos = p.reintroducao.emTeste.join(", ");
    saida.push(
      p.reintroducao.ultimoRastreio
        ? `Testando ${alimentos} e sem rastreio desde ${ddmm(p.reintroducao.ultimoRastreio)}.`
        : `Testando ${alimentos} e sem nenhum rastreio ainda.`,
    );
  }
  for (const c of p.cobrancas) saida.push(`Cobrança venceu em ${ddmm(c.vencimento)}.`);
  return saida;
}

/** "Último registro: há 6 dias" (ou "hoje", "ontem", "nenhum ainda"). */
export function textoDoUltimoRegistro(ultimo: string | null, hoje: string): string {
  if (!ultimo) return "nenhum ainda";
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${ultimo}T12:00:00Z`)) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
