import type { ItemIndice } from "@/central/types";
import { rotas } from "@/central/rotas";
import { catalogo } from "./catalogo";

/**
 * Índice da busca global (§20 do briefing).
 *
 * Montado a partir do catálogo já carregado — quem cadastra um alimento, uma
 * categoria ou um guia não precisa lembrar de indexar nada. Como o catálogo
 * só muda quando o app recarrega, o índice é construído uma vez e guardado.
 */
let cache: ItemIndice[] | null = null;

export function invalidarIndice(): void {
  cache = null;
}

export function indiceBusca(): ItemIndice[] {
  if (cache) return cache;

  const itens: ItemIndice[] = [
    {
      id: "ferramenta:trocas",
      tipo: "ferramenta",
      titulo: "Troca inteligente",
      subtitulo: "Calcule a quantidade equivalente de outro alimento",
      rota: rotas.trocas,
      palavras: ["troca", "trocar", "substituir", "equivalencia", "calculadora", "quantidade"],
    },
    {
      id: "ferramenta:comer-fora",
      tipo: "ferramenta",
      titulo: "Comer fora",
      subtitulo: "Estratégias para escolher fora de casa",
      rota: rotas.comerFora,
      palavras: ["comer fora", "restaurante", "delivery", "rua", "pedido"],
    },
    {
      id: "ferramenta:protocolo",
      tipo: "ferramenta",
      titulo: "Protocolo Alimentar",
      subtitulo: "Seu plano, com as substituições de cada item",
      rota: rotas.protocolo,
      palavras: ["protocolo", "dieta", "plano", "cardapio", "refeicao", "alimentar"],
    },
    {
      id: "ferramenta:salvos",
      tipo: "ferramenta",
      titulo: "Salvos",
      subtitulo: "Seus conteúdos favoritos",
      rota: rotas.salvos,
      palavras: ["salvo", "favorito", "guardado"],
    },
  ];

  for (const alimento of catalogo.alimentos()) {
    const grupo = catalogo.grupo(alimento.grupoId);
    itens.push({
      id: `alimento:${alimento.id}`,
      tipo: "alimento",
      titulo: alimento.nome,
      subtitulo: grupo ? grupo.nome : null,
      rota: rotas.trocaCom(alimento.id),
      palavras: [...alimento.tags, grupo?.nome ?? ""],
    });
  }

  for (const categoria of catalogo.categoriasComerFora()) {
    itens.push({
      id: `categoria:${categoria.id}`,
      tipo: "categoria",
      titulo: categoria.nome,
      subtitulo: categoria.resumo,
      rota: rotas.categoria(categoria.id),
      palavras: categoria.tags,
    });
    // As casas entram na busca pelo nome da marca: quem procura "mcdonalds"
    // quer cair no McDonald's, não na categoria Hambúrguer.
    for (const casa of categoria.estabelecimentos) {
      itens.push({
        id: `casa:${categoria.id}:${casa.id}`,
        tipo: "categoria",
        titulo: casa.nome,
        subtitulo: casa.resumo ?? categoria.nome,
        rota: rotas.estabelecimento(categoria.id, casa.id),
        palavras: [categoria.nome, casa.grupo ?? ""].filter(Boolean),
      });
      for (const opcao of casa.opcoes) {
        itens.push({
          id: `opcao:${categoria.id}:${casa.id}:${opcao.id}`,
          tipo: "opcao",
          titulo: opcao.titulo,
          subtitulo: `${categoria.nome} · ${casa.nome}`,
          rota: rotas.estabelecimento(categoria.id, casa.id),
          palavras: [...opcao.tags, categoria.nome, casa.nome],
        });
      }
    }
    for (const decisao of categoria.decisoes) {
      for (const opcao of decisao.opcoes) {
        itens.push({
          id: `opcao:${categoria.id}:${opcao.id}`,
          tipo: "opcao",
          titulo: opcao.titulo,
          subtitulo: `${categoria.nome} · ${decisao.titulo}`,
          rota: rotas.opcao(categoria.id, opcao.id),
          palavras: [...opcao.tags, categoria.nome],
        });
      }
    }
  }

  // Os guias saíram da Central a pedido dela, e por isso saem do índice
  // também: um resultado de busca que abre numa rota que não existe mais
  // manda a paciente para a tela inicial sem dizer por quê. O conteúdo
  // continua no banco, e volta junto se a aba voltar.

  cache = itens;
  return itens;
}
