/**
 * Como a abertura do app distingue "a internet falhou" de "o servidor disse
 * não". Fica separado da tela para dar para testar sem navegador.
 */
/**
 * A pergunta não chegou ao servidor (sem internet, sinal fraco, conexão que
 * caiu no meio). É diferente de o servidor responder "não": nesse caso a
 * resposta vale e a paciente não pode entrar com o que está guardado.
 */
export function pareceFalhaDeRede(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const { name, message, status } = erro as { name?: unknown; message?: unknown; status?: unknown };
  if (name === "AuthRetryableFetchError") return true;
  if (status === 0) return true;
  const texto = typeof message === "string" ? message.toLowerCase() : "";
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|timed out|timeout|aborted|err_internet|err_network|err_connection/.test(texto);
}

/** O servidor recusou porque o login daquele pedido já tinha vencido. */
export function pareceLoginVencido(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (code === "PGRST301" || code === "PGRST303") return true;
  return typeof message === "string" && /jwt expired/i.test(message);
}

/**
 * Qual conta continua logada neste aparelho, lida direto do que o Supabase
 * guarda — mesmo quando o login venceu e não deu para renovar sem internet.
 * Ao sair da conta essa anotação é apagada, então ela nunca devolve quem saiu.
 */
export function idDaContaGuardadaNoAparelho(armazenamento: Storage | undefined = globalThis.localStorage): string | null {
  try {
    if (!armazenamento) return null;
    for (let i = 0; i < armazenamento.length; i++) {
      const chave = armazenamento.key(i);
      if (!chave || !/^sb-.+-auth-token$/.test(chave)) continue;
      const guardado = JSON.parse(armazenamento.getItem(chave) ?? "null") as { user?: { id?: unknown } } | null;
      const id = guardado?.user?.id;
      if (typeof id === "string" && id) return id;
    }
  } catch {
    /* armazenamento bloqueado ou corrompido: trata como sem conta */
  }
  return null;
}

/**
 * Espera a promessa até o prazo. Devolve a resposta, ou `null` se o prazo
 * acabou antes — a promessa continua correndo e pode ser aguardada depois.
 */
export function dentroDoPrazo<T>(promessa: Promise<T>, prazoMs: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const relogio = setTimeout(() => resolve(null), prazoMs);
    promessa.then(
      (valor) => {
        clearTimeout(relogio);
        resolve(valor);
      },
      (erro: unknown) => {
        clearTimeout(relogio);
        reject(erro);
      },
    );
  });
}
