import { normalizar } from "./texto.ts";

/**
 * Qual desenho ilustra uma categoria do Comer fora, e a busca da tela.
 *
 * O desenho é escolhido pelo NOME da categoria, não pelo id: as categorias
 * são cadastradas pela nutricionista, e o id de uma criada amanhã ninguém
 * conhece hoje. Nome que não bate com nada cai no prato genérico — nunca num
 * desenho errado.
 */
export type DesenhoComerFora =
  | "hamburguer"
  | "japonesa"
  | "massa"
  | "pizza"
  | "acai"
  | "doce"
  | "bar"
  | "cinema"
  | "cafe"
  | "salada"
  | "churrasco"
  | "restaurante"
  | "delivery"
  | "prato";

const PISTAS: [DesenhoComerFora, RegExp][] = [
  ["hamburguer", /hamburg|lanche|burger|sanduich/],
  ["japonesa", /japon|sushi|temak|oriental/],
  ["massa", /mass|macarr|italian/],
  ["pizza", /pizz/],
  ["acai", /acai|sorvet|gelat/],
  ["doce", /doce|sobremesa|bolo|confeit/],
  ["bar", /bar|boteco|drink|bebida|happy/],
  ["cinema", /cinema|pipoca/],
  ["cafe", /cafe|padaria|cafeteria|brunch/],
  ["salada", /salad|saudavel|poke|natural/],
  ["churrasco", /churras|carne|grelhad|parrilla/],
  ["delivery", /delivery|entrega|aplicativo|ifood/],
  ["restaurante", /restaurant|self|buffet|quilo|almoco|jantar/],
];

export function desenhoDaCategoria(nome: string): DesenhoComerFora {
  const texto = normalizar(nome);
  for (const [desenho, pista] of PISTAS) if (pista.test(texto)) return desenho;
  return "prato";
}

/** O que a busca do Comer fora devolve: uma categoria ou uma casa dentro dela. */
export interface AchadoComerFora {
  tipo: "categoria" | "casa";
  categoriaId: string;
  casaId: string | null;
  nome: string;
  /** "Hambúrguer" embaixo de "McDonald's"; nulo para a própria categoria. */
  onde: string | null;
  logo: string | null;
}

interface CategoriaParaBusca {
  id: string;
  nome: string;
  status: string;
  logo: string | null;
  estabelecimentos: { id: string; nome: string; logo: string | null }[];
}

/**
 * Procura por nome de casa e de categoria, sem acento e sem caixa.
 *
 * Só no que está publicado: achar "Delivery" e abrir uma tela de "em
 * preparação" seria uma porta que não leva a lugar nenhum. Quem começa com
 * o termo vem antes de quem só o contém; casa antes de categoria no empate,
 * porque quem digita "mc" está na frente do balcão.
 */
export function buscarNoComerFora(categorias: CategoriaParaBusca[], consulta: string, limite = 8): AchadoComerFora[] {
  const termo = normalizar(consulta);
  if (termo.length < 2) return [];
  const achados: (AchadoComerFora & { peso: number })[] = [];
  for (const categoria of categorias) {
    if (categoria.status !== "publicado") continue;
    const nomeCategoria = normalizar(categoria.nome);
    if (nomeCategoria.includes(termo)) {
      achados.push({
        tipo: "categoria",
        categoriaId: categoria.id,
        casaId: null,
        nome: categoria.nome,
        onde: null,
        logo: categoria.logo,
        peso: nomeCategoria.startsWith(termo) ? 1 : 3,
      });
    }
    // Categoria de uma casa só abre direto nela: listar a casa seria repetir.
    if (categoria.estabelecimentos.length < 2) continue;
    for (const casa of categoria.estabelecimentos) {
      const nomeCasa = normalizar(casa.nome);
      if (!nomeCasa.includes(termo)) continue;
      achados.push({
        tipo: "casa",
        categoriaId: categoria.id,
        casaId: casa.id,
        nome: casa.nome,
        onde: categoria.nome,
        logo: casa.logo,
        peso: nomeCasa.startsWith(termo) ? 0 : 2,
      });
    }
  }
  return achados
    .sort((a, b) => a.peso - b.peso || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite)
    .map(({ peso: _peso, ...achado }) => achado);
}
