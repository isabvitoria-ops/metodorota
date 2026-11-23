/**
 * As regras do aviso "Atualização disponível" (pedido dela em 23/11/2026:
 * aparecia "até quando não tem" e o Atualizar às vezes não atualizava).
 */

/**
 * Só é versão nova se for MAIS NOVA do que a aberta. O carimbo é
 * "AAAA-MM-DD HH:MM UTC", e texto nesse formato se compara como data. Uma
 * cópia mais velha (o servidor do GitHub às vezes ainda entrega a anterior
 * logo depois de publicar) não é atualização.
 */
export function ehMaisNova(publicada: string | null, aberta: string): boolean {
  if (!publicada) return false;
  const formato = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
  if (!formato.test(publicada) || !formato.test(aberta)) return false;
  return publicada > aberta;
}

/**
 * Antes de recarregar, baixa a página nova e guarda no lugar da cópia do
 * celular. Sem isso, com internet lenta o app reabria a cópia velha e o aviso
 * voltava na hora. Se algo falhar aqui, só recarrega como antes.
 */
export async function buscarVersaoNovaERecarregar(base: string): Promise<void> {
  try {
    const resposta = await fetch(`${base}index.html?v-site=${Date.now()}`, { cache: "no-store" });
    if (resposta.ok && "caches" in window) {
      const corpo = await resposta.blob();
      const nomes = (await caches.keys()).filter((n) => n.startsWith("marvia-"));
      for (const nome of nomes) {
        const cache = await caches.open(nome);
        const cabecalhos = { "Content-Type": "text/html; charset=utf-8" };
        await cache.put(`${base}index.html`, new Response(corpo, { headers: cabecalhos }));
        await cache.put(base, new Response(corpo, { headers: cabecalhos }));
        await cache.put(window.location.pathname, new Response(corpo, { headers: cabecalhos }));
      }
    }
  } catch {
    // segue para o recarregar
  }
  window.location.reload();
}
