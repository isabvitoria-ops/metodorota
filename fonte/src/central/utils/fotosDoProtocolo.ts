import type { ConteudoProtocolo } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";

/**
 * As fotinhas do protocolo, prontas para o PDF.
 *
 * O PDF sai da folha de impressão do navegador, que imprime o que já está
 * carregado: uma foto que ainda está baixando sai como um buraco. Por isso
 * as fotos são resolvidas e BAIXADAS antes de o documento ser montado, e o
 * documento recebe o mapa `caminho → endereço`.
 *
 * Foto que não abre (link vencido, sem rede) fica de fora do mapa e o
 * documento sai sem ela, em vez de a impressão travar esperando. O prazo é
 * curto de propósito: quem aperta "Gerar PDF" não espera meio minuto.
 */
const PRAZO_MS = 8000;

export async function fotosDoProtocolo(conteudo: ConteudoProtocolo | null): Promise<Record<string, string>> {
  if (!conteudo) return {};
  const caminhos = new Set<string>();
  for (const refeicao of conteudo.refeicoes)
    for (const opcao of refeicao.opcoes)
      for (const item of opcao.itens) if (item.imagem) caminhos.add(item.imagem);
  if (caminhos.size === 0) return {};

  const mapa: Record<string, string> = {};
  await Promise.all(
    [...caminhos].map(async (caminho) => {
      try {
        const url = /^https?:\/\//.test(caminho) ? caminho : await repositorio.enderecoFotoProtocolo(caminho);
        await baixar(url);
        mapa[caminho] = url;
      } catch {
        /* sem a foto, o resto do documento sai igual */
      }
    }),
  );
  return mapa;
}

function baixar(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const prazo = window.setTimeout(() => reject(new Error("demorou")), PRAZO_MS);
    imagem.onload = () => {
      window.clearTimeout(prazo);
      resolve();
    };
    imagem.onerror = () => {
      window.clearTimeout(prazo);
      reject(new Error("falhou"));
    };
    imagem.src = url;
  });
}
