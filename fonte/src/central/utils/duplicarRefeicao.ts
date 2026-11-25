import type { ConteudoProtocolo, RefeicaoProtocolo } from "@/central/types/protocolo";

/**
 * Duplica a refeição `i` logo abaixo dela, para quando duas refeições do
 * plano são iguais (o lanche da manhã igual ao da tarde). A cópia leva todas
 * as opções, itens, substituições, notas, fotos e receitas, sem dividir nada
 * com a original: mexer numa não muda a outra.
 *
 * O nome ganha "(cópia)" para ela lembrar de renomear, e o horário fica em
 * branco: refeição igual em outro horário é o motivo de duplicar.
 */
export function duplicarRefeicao(conteudo: ConteudoProtocolo, i: number): ConteudoProtocolo {
  const original = conteudo.refeicoes[i];
  if (!original) return conteudo;
  const copia: RefeicaoProtocolo = structuredClone(original);
  copia.nome = `${original.nome} (cópia)`;
  delete copia.horario;
  const refeicoes = [...conteudo.refeicoes];
  refeicoes.splice(i + 1, 0, copia);
  return { ...conteudo, refeicoes };
}
