/**
 * Colinha por utensílio: junta, para cada utensílio (colher de sopa, concha,
 * copo americano…), quanto ele pesa em cada alimento da base.
 *
 * Nenhum número nasce aqui: cada linha é uma medida que já existe na base da
 * página Cálculos (planilhas dela, IBGE, UFG, USDA) ou que ela criou. O peso
 * muda com o alimento, por isso a colinha lista alimento por alimento dentro
 * do utensílio, e não um peso único.
 *
 * As medidas do USDA vêm em inglês e são dos utensílios dos EUA; ficam num
 * grupo separado, marcado, para não se misturarem com as brasileiras. Medida
 * com número na frente ("2 tbsp", "0.5 cup") fica de fora: dividir seria
 * criar um número que a fonte não deu.
 */

export interface UtensilioDaColinha {
  chave: string;
  nome: string;
  /** true para os utensílios dos EUA (medidas do USDA). */
  eua: boolean;
}

const LISTA: (UtensilioDaColinha & { teste: RegExp })[] = [
  { chave: "colher-cafe", nome: "Colher de café", eua: false, teste: /^colher de caf[eé](?!\p{L})/u },
  { chave: "colher-cha", nome: "Colher de chá", eua: false, teste: /^colher de ch[aá](?!\p{L})/u },
  { chave: "colher-sobremesa", nome: "Colher de sobremesa", eua: false, teste: /^colher de sobremesa(?!\p{L})/u },
  { chave: "colher-sopa", nome: "Colher de sopa", eua: false, teste: /^colher de sopa(?!\p{L})/u },
  { chave: "colher-servir", nome: "Colher de servir", eua: false, teste: /^colher de (servir|arroz)(?!\p{L})/u },
  { chave: "concha", nome: "Concha", eua: false, teste: /^concha(?!\p{L})/u },
  { chave: "escumadeira", nome: "Escumadeira", eua: false, teste: /^escumadeira(?!\p{L})/u },
  { chave: "pegador", nome: "Pegador", eua: false, teste: /^pegador(?!\p{L})/u },
  { chave: "copo-americano", nome: "Copo americano", eua: false, teste: /^copo americano(?!\p{L})/u },
  { chave: "copo-requeijao", nome: "Copo de requeijão", eua: false, teste: /^copo (de requeij[aã]o|duplo)(?!\p{L})/u },
  { chave: "xicara-cafe", nome: "Xícara de café", eua: false, teste: /^x[ií]cara de caf[eé](?!\p{L})/u },
  { chave: "xicara-cha", nome: "Xícara de chá", eua: false, teste: /^x[ií]cara(?!\p{L})/u },
  { chave: "ponta-faca", nome: "Ponta de faca", eua: false, teste: /^ponta de faca(?!\p{L})/u },
  { chave: "eua-tsp", nome: "Colher de chá dos EUA (tsp)", eua: true, teste: /^(tsp|teaspoon)(?!\p{L})/u },
  { chave: "eua-tbsp", nome: "Colher de sopa dos EUA (tbsp)", eua: true, teste: /^(tbsp|tablespoon)(?!\p{L})/u },
  { chave: "eua-cup", nome: "Xícara dos EUA (cup)", eua: true, teste: /^cup(?!\p{L})/u },
];

/** O utensílio de uma medida, ou null se não for utensílio (unidade, fatia, filé…). */
export function utensilioDaMedida(nome: string): UtensilioDaColinha | null {
  const n = String(nome ?? "").trim().toLowerCase();
  const achado = LISTA.find((u) => u.teste.test(n));
  return achado ? { chave: achado.chave, nome: achado.nome, eua: achado.eua } : null;
}

export interface LinhaDoUtensilio {
  alimentoId: string;
  alimento: string;
  /** O nome da medida como está na base ("colher de sopa cheia"). */
  medida: string;
  gramas: number;
  origem: string;
}

export interface GrupoDoUtensilio extends UtensilioDaColinha {
  linhas: LinhaDoUtensilio[];
}

export interface EntradaDoAlimento {
  id: string;
  nome: string;
  medidas: { nome: string; gramas: number; ref?: string }[];
}

const ORIGEM_PROPRIA = "Medida criada por você em Cálculos";

/** Agrupa as medidas de todos os alimentos por utensílio, na ordem da lista acima. */
export function colinhaPorUtensilio(alimentos: EntradaDoAlimento[]): GrupoDoUtensilio[] {
  const grupos = new Map<string, LinhaDoUtensilio[]>();
  for (const a of alimentos) {
    for (const m of a.medidas) {
      const gramas = Number(m.gramas);
      if (!(gramas > 0)) continue;
      const u = utensilioDaMedida(m.nome);
      if (!u) continue;
      const lista = grupos.get(u.chave) ?? [];
      lista.push({ alimentoId: a.id, alimento: a.nome, medida: m.nome, gramas, origem: m.ref || ORIGEM_PROPRIA });
      grupos.set(u.chave, lista);
    }
  }
  return LISTA.filter((u) => grupos.has(u.chave)).map((u) => ({
    chave: u.chave,
    nome: u.nome,
    eua: u.eua,
    linhas: grupos
      .get(u.chave)!
      .sort((x, y) => x.alimento.localeCompare(y.alimento, "pt-BR") || x.medida.localeCompare(y.medida, "pt-BR")),
  }));
}
