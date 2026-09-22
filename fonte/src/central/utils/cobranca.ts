import type { Cobranca, SituacaoCobranca } from "@/central/types/financeiro";

/**
 * As contas da tela de cobrança.
 *
 * O dinheiro em si é somado no banco (`painel_financeiro`), porque soma de
 * dinheiro precisa de uma conta só. Aqui ficam as decisões de APRESENTAÇÃO,
 * que são as que mudam de ideia com o tempo.
 */

export function reais(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** "outubro de 2026", a partir do primeiro dia do mês. */
export function mesPorExtenso(iso: string): string {
  const [ano, mes] = iso.split("-");
  const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const i = Number(mes) - 1;
  return MESES[i] && ano ? `${MESES[i]} de ${ano}` : iso;
}

export function dia(iso: string): string {
  const [ano, mes, d] = iso.split("-");
  return ano && mes && d ? `${d}/${mes}/${ano}` : iso;
}

const TEXTO: Record<SituacaoCobranca, string> = {
  aberta: "em aberto",
  vencendo: "vence esta semana",
  atrasada: "atrasada",
  paga: "paga",
  cancelada: "cancelada",
};

export function textoDaSituacao(s: SituacaoCobranca): string {
  return TEXTO[s] ?? s;
}

/**
 * Quantos dias de atraso. Zero ou negativo vira `null`: "0 dias de atraso"
 * não é atraso, e mostrar isso confundiria mais do que ajudaria.
 */
export function diasDeAtraso(cobranca: Cobranca, hoje: string): number | null {
  if (cobranca.status !== "aberta") return null;
  const venc = new Date(`${cobranca.vencimento}T00:00:00Z`).getTime();
  const agora = new Date(`${hoje}T00:00:00Z`).getTime();
  if (Number.isNaN(venc) || Number.isNaN(agora)) return null;
  const dias = Math.floor((agora - venc) / 86400000);
  return dias > 0 ? dias : null;
}

/**
 * A mensagem pronta de cobrança, para o WhatsApp.
 *
 * O TOM É O PONTO. Ela cobra pessoas que atende clinicamente, algumas com
 * transtorno alimentar, e a mensagem sai com o nome dela embaixo. Então:
 * nenhuma ameaça, nenhum "regularize", nenhum "sob pena de". É um lembrete
 * entre duas pessoas que se conhecem.
 *
 * E o texto NÃO É ENVIADO SOZINHO: ele abre o WhatsApp com a mensagem
 * escrita, e ela lê, edita se quiser, e aperta enviar. Disparo automático
 * de cobrança clínica é exatamente o tipo de coisa que um dia sai errado
 * com a pessoa errada no dia errado.
 */
export function mensagemDeCobranca(cobranca: Cobranca, nutricionista: string): string {
  const primeiroNome = cobranca.paciente.split(" ")[0] ?? cobranca.paciente;
  const linhas = [
    `Oi, ${primeiroNome}! Tudo bem?`,
    "",
    `Passando para lembrar do acompanhamento de ${mesPorExtenso(cobranca.competencia)}, ` +
      `no valor de ${reais(cobranca.valor)}, com vencimento em ${dia(cobranca.vencimento)}.`,
    "",
    "Se já tiver pago, pode ignorar esta mensagem. Qualquer coisa, é só me falar.",
  ];
  if (nutricionista.trim()) linhas.push("", nutricionista.trim());
  return linhas.join("\n");
}

/**
 * O endereço que abre o WhatsApp com a mensagem escrita.
 *
 * Sem telefone não há link — e a tela tem que mostrar isso como "falta o
 * telefone", e não como um botão que não faz nada quando clicado.
 */
export function linkDoWhatsapp(telefone: string | null, mensagem: string): string | null {
  const numero = (telefone ?? "").replace(/\D/g, "");
  if (numero.length < 10) return null;
  // Sem o 55 na frente, o WhatsApp interpreta como número local de quem
  // clicou — e no telefone dela isso até funciona, o que esconde o defeito.
  const comPais = numero.startsWith("55") ? numero : `55${numero}`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(mensagem)}`;
}
