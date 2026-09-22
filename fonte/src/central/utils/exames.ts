/**
 * As regras de arquivo dos exames.
 *
 * Elas existem NOS DOIS LADOS: aqui, para a tela recusar cedo e explicar o
 * porquê, e no balde do Supabase, que é quem realmente tranca. A daqui é
 * cortesia; a de lá é a fechadura.
 */

/** 10 MB — o mesmo do balde. */
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/** O plano grátis do Supabase. Serve para a tela avisar antes de acabar. */
export const ESPACO_DO_PLANO_GRATIS = 1024 * 1024 * 1024;

export const TIPOS_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;

export function tamanhoBonito(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Diz por que o arquivo não serve, ou `null` se serve.
 *
 * A frase é para quem mandou, e não para quem programou: "Este arquivo tem
 * 14,2 MB e o limite é 10 MB" em vez de "invalid file size".
 */
export function porQueNaoServe(arquivo: { name: string; size: number; type: string }): string | null {
  if (arquivo.size === 0) return "Este arquivo está vazio.";
  if (arquivo.size > TAMANHO_MAXIMO) {
    return `Este arquivo tem ${tamanhoBonito(arquivo.size)} e o limite é ${tamanhoBonito(TAMANHO_MAXIMO)}. Se for uma foto, tire de novo com qualidade menor.`;
  }
  // Alguns navegadores não informam o tipo; aí a extensão é o que sobra, e
  // o balde confere de novo do outro lado.
  const tipo = arquivo.type || tipoPelaExtensao(arquivo.name);
  if (!(TIPOS_ACEITOS as readonly string[]).includes(tipo)) {
    return "Só dá para guardar PDF ou foto (JPG, PNG, HEIC, WEBP).";
  }
  return null;
}

export function tipoPelaExtensao(nome: string): string {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  const mapa: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
  };
  return mapa[ext] ?? "";
}

/**
 * O caminho do arquivo dentro do balde.
 *
 * A PRIMEIRA PASTA É A PACIENTE, e não é organização: é o que a política do
 * balde olha para separar uma pessoa da outra. O nome do arquivo é
 * higienizado porque acento e espaço em endereço de arquivo quebram de
 * formas difíceis de achar depois.
 */
export function caminhoDoExame(pacienteId: string, nomeOriginal: string): string {
  const limpo = nomeOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-60);
  // O carimbo de tempo evita que dois arquivos de mesmo nome se
  // sobrescrevam — e sobrescrever exame seria perder exame.
  return `${pacienteId}/${Date.now()}-${limpo || "exame"}`;
}
