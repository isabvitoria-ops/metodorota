import { EQUACOES, equacaoPorId } from "./equacoes.mjs";
import { totalDeAtividades } from "./met.mjs";
import { avisosDaEquacao, avisosDoResultado } from "./guardas.mjs";
import { fmt } from "./formato.mjs";
import { fatorFao } from "../calculos.mjs";

/**
 * O gasto energético total (GET), com UMA regra para a atividade:
 *
 *   modo "fa"  — a atividade é UM fator categórico (equações de GEB: GET = GEB ×
 *                FA; equações que já são TEE/EER: o nível `pa` dentro da
 *                fórmula). Sem MET.
 *   modo "met" — a base é SEDENTÁRIA (GEB × 1,2, ou o nível sedentário da
 *                fórmula) E o exercício entra por MET líquido, somado. O seletor
 *                de fator some: ter os dois seria contar a atividade duas vezes,
 *                que é o defeito que o DietSystem tem.
 *
 * O fator sedentário de 1,2 já inclui o movimento do dia a dia (andar pela
 * casa, trabalho sentado): o MET entra só para o exercício de verdade.
 */
export const FA_SEDENTARIO = 1.2;

export function calcularGasto(equacaoOuId, entrada, atividade = {}) {
  const equacao = typeof equacaoOuId === "string" ? equacaoPorId(equacaoOuId) : equacaoOuId;
  if (!equacao) return { ok: false, motivo: "Equação desconhecida." };
  if (equacao.status === "aguardando_fonte") {
    return { ok: false, aguardando: true, motivo: equacao.motivo, equacao };
  }

  const faltando = [];
  const precisa = new Set(equacao.entradas);
  if (precisa.has("peso") && !(entrada.peso > 0)) faltando.push("peso");
  if (precisa.has("altura") && !(entrada.alturaCm > 0)) faltando.push("altura");
  if (precisa.has("idade") && !(entrada.idade > 0)) faltando.push("idade");
  if (precisa.has("sexo") && !entrada.sexo) faltando.push("sexo");
  if (precisa.has("massaMagra") && !(entrada.massaMagra > 0)) faltando.push("massa magra");
  if (faltando.length) return { ok: false, faltando, motivo: `Preencha: ${faltando.join(", ")}.`, equacao };
  const impedimento = equacao.validar?.(entrada);
  if (impedimento) return { ok: false, motivo: impedimento, equacao };

  const modo = atividade.modo === "met" ? "met" : "fa";
  const liquido = atividade.liquido !== false;
  const avisos = avisosDaEquacao(equacao, entrada);

  // O nível dentro da fórmula (equações que já devolvem o total).
  const pa = modo === "met" ? "sedentario" : (atividade.pa ?? "sedentario");
  const bruto = equacao.calcular({ ...entrada, pa });
  const geb = bruto.valor;

  const met = totalDeAtividades(atividade.exercicios ?? [], entrada.peso, liquido);
  const kcalMet = modo === "met" ? met.total : 0;

  let fator = null;
  let get;
  const passos = [{ rotulo: "Fórmula", texto: bruto.formula }, { rotulo: "Com os números", texto: `${bruto.substituicao} = ${fmt(geb, 1)} kcal` }];

  if (equacao.resultado === "get") {
    get = geb + kcalMet;
    passos.push({
      rotulo: "Atividade",
      texto:
        modo === "met"
          ? `Base no nível sedentário da fórmula (${fmt(geb, 0)} kcal) + exercícios pelo MET líquido (${fmt(kcalMet, 0)} kcal).`
          : `O nível "${pa}" já está dentro da fórmula; não se multiplica de novo.`,
    });
  } else {
    if (modo === "met") fator = FA_SEDENTARIO;
    else if (equacao.atividade?.tipo === "fao") fator = fatorFao(atividade.fao ?? "leve", entrada.idade, entrada.sexo);
    else fator = Number.isFinite(atividade.fa) && atividade.fa > 0 ? atividade.fa : 1;
    get = geb * (fator ?? 1) + kcalMet;
    passos.push({
      rotulo: "Gasto total",
      texto:
        modo === "met"
          ? `GET = GEB × ${fmt(fator)} (sedentário) + exercícios (MET) = ${fmt(geb, 1)} × ${fmt(fator)} + ${fmt(kcalMet, 1)} = ${fmt(get, 1)} kcal`
          : `GET = GEB × FA = ${fmt(geb, 1)} × ${fmt(fator)} = ${fmt(get, 1)} kcal`,
    });
  }

  if (modo === "met" && met.linhas.length && met.linhas.some((l) => l.kcal === null)) {
    avisos.push("Alguma atividade ficou sem MET, minutos ou vezes por semana e não entrou na conta.");
  }
  avisos.push(...avisosDoResultado(get));

  return {
    ok: true,
    equacao,
    modo,
    liquido,
    geb,
    fator,
    kcalMet,
    atividades: met.linhas,
    get,
    passos,
    avisos,
    extra: bruto.extra ?? null,
  };
}

/** Calcula todas as equações aplicáveis, para a tabela de comparação. */
export function compararEquacoes(entrada, atividade = {}) {
  return EQUACOES.filter((e) => e.status !== "aguardando_fonte")
    .map((e) => ({ equacao: e, resultado: calcularGasto(e, entrada, atividade) }))
    .filter((x) => x.resultado.ok);
}
