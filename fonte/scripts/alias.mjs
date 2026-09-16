/**
 * Hook de resolução para rodar os testes com o runner nativo do Node.
 *
 * Faz duas coisas que o Vite já faz no app e o Node não faz sozinho:
 * traduz o atalho "@/" para src/ e completa a extensão ".ts" dos imports
 * relativos. Existe para que os testes não precisem de nenhuma dependência
 * nova (§27 do briefing).
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RAIZ_SRC = new URL("../src/", import.meta.url);

function comExtensao(url) {
  const caminho = fileURLToPath(url);
  if (existsSync(caminho) && !caminho.endsWith("/")) return url.href;
  for (const sufixo of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(caminho + sufixo)) return url.href + sufixo;
  }
  return url.href;
}

export async function resolve(especificador, contexto, proximo) {
  if (especificador.startsWith("@/")) {
    return proximo(comExtensao(new URL(especificador.slice(2), RAIZ_SRC)), contexto);
  }
  if (especificador.startsWith(".") && contexto.parentURL) {
    return proximo(comExtensao(new URL(especificador, contexto.parentURL)), contexto);
  }
  return proximo(especificador, contexto);
}
