/**
 * O texto do prazo do check-in (0099). O check-in abre na segunda; com prazo
 * de N dias, fecha às 23:59 do N-ésimo dia (horário de Brasília).
 */
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const diaDaSemana = (iso: string) => SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "";
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Responda até terça, 24/11, às 23:59." — ou, passado o prazo, o recado gentil. */
export function textoDoPrazo(venceEm: string | null, hoje: string): { texto: string; passou: boolean } | null {
  if (!venceEm) return null;
  if (hoje > venceEm) {
    return {
      passou: true,
      texto: `O prazo foi até ${diaDaSemana(venceEm)}, ${ddmm(venceEm)}. Se responder agora, sua nutricionista recebe, mas fica fora da conta da semana.`,
    };
  }
  const quando = hoje === venceEm ? "hoje" : `${diaDaSemana(venceEm)}, ${ddmm(venceEm)},`;
  return { passou: false, texto: `Responda até ${quando} às 23:59.` };
}
