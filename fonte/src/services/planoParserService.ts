import type { OpcaoRascunho, PlanoRascunhoItem, RefeicaoRascunho } from "@/types";
import { TACO } from "@/data/taco";
import { buscarAlimentos, tokensDe } from "@/utils/buscaAlimento";

/**
 * Parser do texto colado do Notion — porte literal do protótipo do painel
 * (função `parsePlano`). Formato esperado:
 *
 *   REFEIÇÃO HH:MM
 *   - Alimento: quantidade
 *     ou Alimento substituto: quantidade
 *   OPÇÃO Nome da opção
 *   VEGETAIS (regra livre)
 *   Obs: observação da refeição
 *
 * Cada item/substituição já sai com sugestões da base TACO; um item "forte"
 * (pontuação de busca alta o bastante) já vem pré-vinculado, mas a
 * publicação continua exigindo confirmação humana em qualquer item fraco —
 * o parser nunca vincula sozinho quando a confiança é baixa.
 */
function resolverItem(escrito: string, quantidadeTexto: string): PlanoRascunhoItem {
  const achados = buscarAlimentos(TACO, escrito, 5);
  const forte = achados.length > 0 && achados[0]!.pontos >= tokensDe(escrito).length * 1.6;

  const quantidadeMatch = quantidadeTexto.match(/^([\d.]+)\s*(.*)$/);
  const valor = quantidadeMatch ? parseFloat(quantidadeMatch[1]!) : 1;
  const unidade = quantidadeMatch ? quantidadeMatch[2]!.trim() : quantidadeTexto;

  return {
    escrito,
    quantidade: { valor, unidade },
    alimentoCodigoTaco: forte ? achados[0]!.alimento.codigoTaco : null,
    sugestoesCodigoTaco: achados.map((a) => a.alimento.codigoTaco),
    substituicoes: [],
  };
}

export function parsearTextoDePlano(texto: string): RefeicaoRascunho[] {
  const refeicoes: RefeicaoRascunho[] = [];
  let refeicaoAtual: RefeicaoRascunho | null = null;
  let opcaoAtual: OpcaoRascunho | null = null;
  let ultimoItem: PlanoRascunhoItem | null = null;

  texto.split("\n").forEach((linhaBruta) => {
    const linha = linhaBruta.trim();
    if (!linha) return;

    const cabecalho = linha.match(/^(.+?)\s+(\d{1,2}[:h]\d{2})$/);
    const opcaoMatch = linha.match(/^op[çc][ãa]o[:\s]+(.+)$/i);
    const substituicaoMatch = linha.match(/^ou\s+(.+?)\s*:\s*(.+)$/i);
    const itemMatch = linha.match(/^[-•*]\s*(.+?)\s*:\s*(.+)$/);
    const observacaoMatch = linha.match(/^obs\.?:?\s*(.+)$/i);
    const vegetais = /^vegetais/i.test(linha);

    if (observacaoMatch && refeicaoAtual) {
      refeicaoAtual.observacao = observacaoMatch[1]!.trim();
    } else if (cabecalho) {
      refeicaoAtual = {
        nome: cabecalho[1]!.trim(),
        horario: cabecalho[2]!.replace("h", ":"),
        opcoes: [],
        regraVegetaisAtiva: false,
      };
      refeicoes.push(refeicaoAtual);
      opcaoAtual = null;
      ultimoItem = null;
    } else if (opcaoMatch && refeicaoAtual) {
      opcaoAtual = { nome: opcaoMatch[1]!.trim(), itens: [] };
      refeicaoAtual.opcoes.push(opcaoAtual);
      ultimoItem = null;
    } else if (substituicaoMatch && ultimoItem) {
      ultimoItem.substituicoes.push(resolverItem(substituicaoMatch[1]!.trim(), substituicaoMatch[2]!.trim()));
    } else if (itemMatch && refeicaoAtual) {
      if (!opcaoAtual) {
        opcaoAtual = { itens: [] };
        refeicaoAtual.opcoes.push(opcaoAtual);
      }
      const novoItem = resolverItem(itemMatch[1]!.trim(), itemMatch[2]!.trim());
      opcaoAtual.itens.push(novoItem);
      ultimoItem = novoItem;
    } else if (vegetais && refeicaoAtual) {
      refeicaoAtual.regraVegetaisAtiva = true;
      ultimoItem = null;
    }
  });

  return refeicoes;
}

export function todosOsItensRascunho(refeicoes: RefeicaoRascunho[]): PlanoRascunhoItem[] {
  return refeicoes.flatMap((r) => r.opcoes.flatMap((o) => o.itens.flatMap((i) => [i, ...i.substituicoes])));
}

export const TEXTO_EXEMPLO_IMPORTACAO = `CAFÉ DA MANHÃ 07:00
- Pão de forma: 50g
  ou Pão de sal: 1 unidade
  ou Tapioca: 50g
- Frango desfiado: 70g
  ou Atum enlatado: 80g
  ou Queijo minas padrão: 45g
- Salada de frutas: 120g
  ou Banana prata: 1 unidade média
  ou Morango: 200g
Obs: café preto pode ser adoçado com stévia ou taumatina

ALMOÇO 12:30
- Arroz tipo 1 cozido: 120g
  ou Macarrão trigo cozido: 120g
  ou Batata inglesa cozida: 200g
  ou Mandioca cozida: 120g
- Peito de frango grelhado: 100g
  ou Merluza filé assado: 120g
  ou Patinho grelhado: 90g
VEGETAIS mínimo 100g

JANTAR 20:00
OPÇÃO Comida
- Arroz tipo 1 cozido: 120g
  ou Batata inglesa cozida: 200g
- Peito de frango grelhado: 100g
  ou Merluza filé assado: 100g
OPÇÃO Hambúrguer caseiro
- Pão de hambúrguer: 70g
- Patinho grelhado: 90g
- Queijo mussarela: 15g
VEGETAIS mínimo 100g`;
