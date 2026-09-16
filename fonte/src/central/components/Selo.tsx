import type { NivelEscolha, SituacaoPaciente } from "@/central/types";
import { rotuloSituacao, tomSituacao } from "@/central/utils/situacao";

/**
 * Classificação das escolhas (§15).
 *
 * A linguagem é de contexto, não de permissão: "melhor escolha", "boa
 * opção", "mais ocasional". Em nenhum lugar aparece "pode"/"não pode" nem
 * "bom"/"ruim" — a ideia é ensinar a decidir, não autorizar.
 */
const ROTULOS: Record<NivelEscolha, string> = {
  melhor: "Melhor escolha",
  boa: "Boa opção",
  ocasional: "Mais ocasional",
};

export function Selo({ nivel }: { nivel: NivelEscolha }) {
  return <span className={`c-selo ${nivel}`}>{ROTULOS[nivel]}</span>;
}

export function SeloNeutro({ children }: { children: React.ReactNode }) {
  return <span className="c-selo neutro">{children}</span>;
}

/**
 * Situação de acesso de um paciente.
 *
 * Existe separado do `Selo` porque as duas coisas só parecem iguais: as
 * cores são as mesmas, o vocabulário não. `Selo` fala de comida —
 * "Melhor escolha", "Boa opção" — e a área administrativa chegou a mostrar
 * isso no lugar de "Ativo", porque reaproveitava o componente passando só a
 * cor. Um paciente vencido aparecia como "Mais ocasional".
 *
 * Separando, o compilador passa a impedir a troca: aqui entra uma situação,
 * lá entra um nível de escolha, e não há como confundir de novo.
 */
export function SeloSituacao({ situacao }: { situacao: SituacaoPaciente }) {
  return <span className={`c-selo ${tomSituacao(situacao)}`}>{rotuloSituacao(situacao)}</span>;
}
