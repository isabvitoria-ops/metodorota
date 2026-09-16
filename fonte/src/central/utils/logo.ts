/**
 * Logos de marca, guardados como data URI dentro do próprio cadastro.
 *
 * Por que não um bucket de arquivos: a logo precisa aparecer também na versão
 * de arquivo único, que roda sem rede nenhuma, e um endereço externo quebraria
 * ali — além de exigir configurar armazenamento no Supabase antes de a
 * nutricionista conseguir subir a primeira imagem. Reduzida a 128 px, uma logo
 * fica na casa de poucos kB, que cabe folgado numa coluna de texto.
 *
 * O limite existe por isso: sem ele, uma foto de 4 MB vinda do celular entra
 * inteira no banco e volta em toda leitura do catálogo, para toda paciente.
 */
export const LADO_MAXIMO = 128;
export const BYTES_MAXIMOS = 96 * 1024;

export type ResultadoLogo = { ok: true; dataUri: string } | { ok: false; erro: string };

const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

/**
 * SVG entra como está: já é vetor, redesenhá-lo num canvas só perderia
 * qualidade. Os demais passam pelo canvas e saem em PNG de 128 px.
 */
export async function prepararLogo(arquivo: File): Promise<ResultadoLogo> {
  if (!TIPOS.includes(arquivo.type)) {
    return { ok: false, erro: "Formato não aceito. Use PNG, JPG, WEBP ou SVG." };
  }

  if (arquivo.type === "image/svg+xml") {
    const texto = await arquivo.text();
    // Um SVG é executável no navegador. O que entra aqui vem da nutricionista,
    // mas ela pode ter baixado o arquivo de qualquer lugar — então script e
    // manipulador de evento não passam.
    if (/<script|\son\w+\s*=/i.test(texto)) {
      return { ok: false, erro: "Este SVG tem script dentro e não pode ser usado. Envie um PNG." };
    }
    const uri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(texto)))}`;
    if (uri.length > BYTES_MAXIMOS) {
      return { ok: false, erro: "Este SVG é grande demais. Envie um PNG de até 128 px." };
    }
    return { ok: true, dataUri: uri };
  }

  const bitmap = await carregar(arquivo);
  if (!bitmap) return { ok: false, erro: "Não consegui ler esta imagem." };

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) return { ok: false, erro: "Não consegui preparar esta imagem." };
  pincel.drawImage(bitmap, 0, 0, largura, altura);

  const uri = tela.toDataURL("image/png");
  if (uri.length > BYTES_MAXIMOS) {
    return { ok: false, erro: "A imagem ficou grande demais mesmo reduzida. Tente outra." };
  }
  return { ok: true, dataUri: uri };
}

function carregar(arquivo: File): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolver(null);
    };
    img.src = url;
  });
}

/** Inicial para o círculo que substitui a logo ausente. */
export function inicialDe(nome: string): string {
  const limpo = nome.trim();
  return limpo ? limpo[0]!.toUpperCase() : "?";
}
