const LIMITE = 16384;
const CARIMBO = /<meta name="versao-do-site" content="([^"]*)"/;

/**
 * Lê só o começo do index.html no servidor, onde está o carimbo de versão, e
 * para de baixar assim que o acha (o arquivo inteiro passa de 4 MB). Pede o
 * trecho com `Range`, e se o servidor ignorar o pedido a leitura é cortada do
 * mesmo jeito. O `?v-site=` faz o service worker deixar a consulta passar
 * direto para a rede, em vez de devolver a cópia guardada.
 *
 * Devolve `null` quando não deu para saber (sem rede, resposta estranha): quem
 * chama trata isso como "nada a dizer", nunca como versão nova.
 */
export async function versaoPublicada(base: string): Promise<string | null> {
  const controle = new AbortController();
  try {
    const resposta = await fetch(`${base}?v-site=${Date.now()}`, {
      cache: "no-store",
      headers: { Range: `bytes=0-${LIMITE - 1}` },
      signal: controle.signal,
    });
    if (!resposta.ok || !resposta.body) return null;

    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let texto = "";
    while (texto.length < LIMITE) {
      const { value, done } = await leitor.read();
      if (done) break;
      texto += decodificador.decode(value, { stream: true });
      const achou = CARIMBO.exec(texto);
      if (achou) {
        controle.abort();
        return achou[1]?.trim() || null;
      }
    }
    controle.abort();
    return null;
  } catch {
    return null;
  }
}
