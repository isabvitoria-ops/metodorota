import { diasPendentes, lerDiarioLocal } from "./diarioDeViagem.ts";

/**
 * O que sai do aparelho quando ela sai da conta.
 *
 * O protocolo e o guia de viagem ficam copiados no aparelho para abrir sem
 * internet. São cópias: o original está no banco. Ao sair da conta — num
 * celular emprestado, no computador da família — a cópia não pode ficar
 * para trás, porque o guia leva a ficha dela.
 *
 * O diário de viagem é diferente: ele nasce no aparelho e sobe depois. Só é
 * apagado quando já subiu inteiro; o que ainda não subiu fica guardado e
 * segue para a nutricionista na próxima vez que ela entrar.
 */
// O rascunho do check-in também sai: é resposta de saúde pela metade, e quem
// sai da conta de propósito não espera encontrá-la no aparelho depois.
const COPIAS = ["central:protocolo:v1:", "central:viagem-guia:v1:", "central:checkin-rascunho:v1:"];
const DIARIO_ATUAL = "central:viagem-diario:v2:";
const DIARIO_ANTIGO = "central:viagem-diario:v1:";

export function chavesParaApagarAoSair(guardado: Record<string, string | null>): string[] {
  const chaves = Object.keys(guardado);
  return chaves.filter((chave) => {
    if (COPIAS.some((prefixo) => chave.startsWith(prefixo))) return true;
    if (chave.startsWith(DIARIO_ATUAL)) {
      return diasPendentes(lerDiarioLocal(guardado[chave] ?? null)).length === 0;
    }
    if (chave.startsWith(DIARIO_ANTIGO)) {
      // O formato antigo nunca subiu sozinho: só sai se já foi passado para o novo.
      return chaves.includes(DIARIO_ATUAL + chave.slice(DIARIO_ANTIGO.length));
    }
    return false;
  });
}

/** Apaga as cópias deste aparelho. Nunca lança: sem armazenamento, não há o que apagar. */
export function apagarCopiasDoAparelho(): void {
  try {
    const guardado: Record<string, string | null> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const chave = window.localStorage.key(i);
      if (chave?.startsWith("central:")) guardado[chave] = window.localStorage.getItem(chave);
    }
    for (const chave of chavesParaApagarAoSair(guardado)) window.localStorage.removeItem(chave);
  } catch {
    /* armazenamento bloqueado */
  }
}
