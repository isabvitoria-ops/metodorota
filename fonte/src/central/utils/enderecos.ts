/**
 * Endereço absoluto de uma rota do app.
 *
 * Existe porque `window.location.origin + "/definir-senha"` só está certo
 * quando o app mora na raiz do domínio. No GitHub Pages ele mora numa
 * subpasta (`/metodorota/`), e no build de prévia as rotas ainda vão por
 * hash — nos dois casos aquele endereço apontaria para uma página que não
 * existe, e o link do convite morreria no clique.
 *
 * `BASE_URL` é preenchido pelo Vite com o `--base` do build, então a mesma
 * função acerta em qualquer um dos três formatos sem saber onde está.
 */
export function urlDaRota(rota: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const raiz = `${window.location.origin}${base}`.replace(/\/+$/, "");
  return import.meta.env.VITE_ROTEADOR === "hash" ? `${raiz}/#${rota}` : `${raiz}${rota}`;
}
