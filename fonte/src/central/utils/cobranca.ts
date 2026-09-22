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

/* -------------------------------------------------------------------------
   O livro-caixa
   ------------------------------------------------------------------------- */

import type { FormaDePagamento, MesDoBalanco } from "@/central/types/financeiro";

const FORMAS: Record<FormaDePagamento, string> = {
  pix: "PIX",
  cartao: "Cartão",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  outro: "Outro",
};

export function textoDaForma(f: FormaDePagamento): string {
  return FORMAS[f] ?? f;
}

export const FORMAS_DE_PAGAMENTO = Object.entries(FORMAS).map(([valor, rotulo]) => ({
  valor: valor as FormaDePagamento,
  rotulo,
}));

/** "out/26" — curto o bastante para caber embaixo de uma barra no celular. */
export function mesCurto(iso: string): string {
  const [ano, mes] = iso.split("-");
  const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const i = Number(mes) - 1;
  return NOMES[i] && ano ? `${NOMES[i]}/${ano.slice(2)}` : iso;
}

/**
 * A comparação do mês com o anterior.
 *
 * `null` quando o mês passado foi zero: "subiu 100%" a partir de nada é
 * um número que impressiona e não informa. E com zero nos dois, não houve
 * variação nenhuma para relatar.
 */
export function variacaoDoMes(
  noMes: number,
  mesPassado: number,
): { diferenca: number; porcentagem: number | null } {
  const diferenca = noMes - mesPassado;
  return {
    diferenca,
    porcentagem: mesPassado > 0 ? Math.round((diferenca / mesPassado) * 100) : null,
  };
}

/**
 * A frase da variação — sem veredito, como no resto do sistema.
 *
 * "R$ 300,00 a mais que o mês passado" e nunca "ótimo mês". Um mês menor
 * pode ser férias, pode ser escolha, pode ser sazonalidade do consultório;
 * quem sabe é ela.
 */
export function textoDaVariacaoMensal(noMes: number, mesPassado: number): string {
  const { diferenca, porcentagem } = variacaoDoMes(noMes, mesPassado);
  if (mesPassado === 0 && noMes === 0) return "sem entradas neste mês nem no anterior";
  if (mesPassado === 0) return "primeiro mês com entradas";
  if (diferenca === 0) return "igual ao mês passado";
  const sinal = diferenca > 0 ? "a mais" : "a menos";
  const pct = porcentagem === null ? "" : ` (${Math.abs(porcentagem)}%)`;
  return `${reais(Math.abs(diferenca))} ${sinal} que o mês passado${pct}`;
}

/**
 * A altura de cada barra, de 0 a 100.
 *
 * Com todos os meses zerados, todas as barras ficam em zero — e não em
 * 100% cada uma, que é o que uma divisão por zero mal tratada produziria.
 */
export function alturasDasBarras(meses: MesDoBalanco[]): number[] {
  const maior = Math.max(...meses.map((m) => m.total), 0);
  if (maior <= 0) return meses.map(() => 0);
  return meses.map((m) => Math.round((m.total / maior) * 100));
}
