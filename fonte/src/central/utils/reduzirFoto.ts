import { LADO_MAXIMO, tamanhoReduzido } from "./diarioDeFotos";

/**
 * Reduz a foto no próprio aparelho antes de enviar.
 *
 * Uma foto de celular tem uns 3–5 MB; o plano grátis do Supabase tem 1 GB no
 * total, e a paciente vai mandar várias por dia. Reduzida, cada foto fica em
 * torno de 200–400 KB e continua boa para ver o prato.
 *
 * Também gira a foto conforme o celular estava (`from-image`) e converte
 * qualquer formato que o navegador abra em JPEG.
 */
export async function reduzirFoto(arquivo: File, maximo = LADO_MAXIMO, qualidade = 0.8): Promise<Blob> {
  let origem: ImageBitmap;
  try {
    origem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Não consegui abrir esta foto. Tente tirar de novo pelo botão da câmera, ou escolha outra imagem (JPG ou PNG).",
    );
  }
  const { largura, altura } = tamanhoReduzido(origem.width, origem.height, maximo);
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("Seu navegador não conseguiu preparar a foto.");
  contexto.drawImage(origem, 0, 0, largura, altura);
  origem.close();
  return new Promise<Blob>((resolver, recusar) => {
    tela.toBlob(
      (blob) => (blob ? resolver(blob) : recusar(new Error("Não consegui preparar a foto para enviar."))),
      "image/jpeg",
      qualidade,
    );
  });
}
