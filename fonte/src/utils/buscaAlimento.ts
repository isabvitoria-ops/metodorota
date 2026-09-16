import type { Alimento, GrupoAlimento } from "@/types";

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Grafias do dia a dia que não batem com o nome da TACO. A nutricionista
 * escreve "mussarela" (a forma corrente) e a base registra "mozarela" — sem
 * isto a busca devolvia zero sugestões e o item ficava impossível de
 * vincular pela tela, travando a publicação do plano inteiro.
 */
const SINONIMOS: Record<string, string> = {
  mussarela: "mozarela",
  muzzarela: "mozarela",
  mozzarella: "mozarela",
  mucarela: "mozarela",
  iogurte: "iogurte",
  aipim: "mandioca",
  macaxeira: "mandioca",
  tangerina: "mexerica",
  bergamota: "mexerica",
};

function tokens(s: string): string[] {
  return semAcento(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => SINONIMOS[t] ?? t);
}

export interface ResultadoBusca {
  pontos: number;
  alimento: Alimento;
}

/**
 * Prefixo curto demais junta palavras que não têm nada a ver: com 3 letras,
 * "sal" (de "Manteiga, com sal") casava o núcleo "salada". Exigir 4 ainda
 * cobre plural e flexão ("cozida"/"cozido", "grelhado"/"grelhada").
 */
const MIN_PREFIXO = 4;

function casa(token: string, tokensDoNome: string[]): boolean {
  return tokensDoNome.some(
    (x) =>
      x === token ||
      (x.startsWith(token) && token.length >= MIN_PREFIXO) ||
      (token.startsWith(x) && x.length >= MIN_PREFIXO),
  );
}

/**
 * Busca por sobreposição de palavras — aguenta "arroz branco cozido" virar
 * "Arroz, tipo 1, cozido". Portada do protótipo do painel (função `buscar`),
 * parametrizada para receber a base em vez de usar uma constante global.
 *
 * Ao contrário do protótipo, um candidato só entra se o **substantivo-núcleo**
 * da consulta aparecer nele. Tanto o nome da TACO ("Atum, conserva em óleo")
 * quanto o que a nutricionista escreve ("Atum enlatado") começam pelo
 * alimento e seguem com qualificadores, então casar só um qualificador não
 * diz nada: por pontuação bruta, "Atum enlatado"→"Atum, conserva em óleo"
 * (casou "atum") e "Peixe branco"→"Repolho, branco, cru" (casou "branco")
 * empatavam em 1,85. O primeiro é o acerto que ela quer; o segundo era a
 * *única* opção oferecida para peixe — um toque distraído mandava a ficha de
 * repolho para a paciente. Sem núcleo em comum é melhor não sugerir nada: a
 * tela já diz "Nada parecido na TACO. Corrija o nome ou cadastre o alimento."
 */
export function buscarAlimentos(
  base: Alimento[],
  consulta: string,
  limite = 8,
  grupo: GrupoAlimento | null = null,
): ResultadoBusca[] {
  const tq = tokens(consulta);
  if (!tq.length) return [];
  const nucleo = tq[0]!;
  return base
    .filter((a) => !grupo || a.grupo === grupo)
    .map((a) => {
      const tn = tokens(a.nome);
      let pontos = 0;
      tq.forEach((t) => {
        if (tn.includes(t)) pontos += 2;
        else if (tn.some((x) => x.startsWith(t) || t.startsWith(x))) pontos += 1;
      });
      // Empurra para cima quem também tem o núcleo na frente ("Atum, ..."
      // ganha de "Salada de atum" para a consulta "Atum enlatado").
      if (tn[0] === nucleo) pontos += 0.5;
      return { alimento: a, pontos: pontos - Math.abs(tn.length - tq.length) * 0.15, temNucleo: casa(nucleo, tn) };
    })
    .filter((x) => x.temNucleo && x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map(({ alimento, pontos }) => ({ alimento, pontos }));
}

export function tokensDe(s: string): string[] {
  return tokens(s);
}

/** Equivalência calculada — ferramenta de apoio só para a nutricionista (regra #3). */
export function equivalenteNutriente(
  de: Alimento,
  gramasDe: number,
  para: Alimento,
  nutriente: keyof Alimento,
): number | null {
  const a = de[nutriente] as number;
  const b = para[nutriente] as number;
  if (!a || !b) return null;
  return (gramasDe * a) / b;
}
