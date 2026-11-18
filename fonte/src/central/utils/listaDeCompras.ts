/**
 * Mercado da semana: soma o plano por 7 dias.
 *
 * O que entra na conta: a PRIMEIRA opção de cada refeição (a padrão), uma vez
 * por dia. A quantidade é o texto livre que ela escreveu no protocolo
 * ("2 fatias - 50g", "150g", "1 unidade"); quando há gramas (ou ml) no texto,
 * vale o peso; senão, a contagem em unidade, fatia ou pote. Quantidade que
 * não dá para somar ("à vontade", "1 colher de sopa") não é inventada: o item
 * vai para "conforme o plano", sem número.
 *
 * O peso é o do alimento como está no plano (arroz cozido é arroz cozido).
 * Converter para cru pediria um fator por alimento que ninguém conferiu —
 * fica de fora de propósito.
 */
import type { ConteudoProtocolo } from "@/central/types/protocolo";

export interface ItemDaLista {
  nome: string;
  /** "por dia: 150 g no almoço + 150 g no jantar" */
  conta: string;
  /** "2,1 kg" */
  total: string;
}

export interface ListaDeCompras {
  secoes: { titulo: string; itens: ItemDaLista[] }[];
  /** Itens cuja quantidade não dá para somar. */
  semConta: string[];
}

type Unidade = "g" | "ml" | "unidade" | "fatia" | "pote";

export interface QuantidadeLida {
  valor: number;
  unidade: Unidade;
}

const numeroBr = (t: string) => Number(t.replace(",", "."));

/** Lê "2 fatias - 50g", "150 g", "1 unidade", "200ml", "1,5 kg". Nulo se não der. */
export function lerQuantidade(texto: string): QuantidadeLida | null {
  const t = texto.toLowerCase();
  const peso = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gramas?|ml|l|litros?)\b/);
  if (peso) {
    const v = numeroBr(peso[1] as string);
    const u = peso[2] as string;
    if (!(v > 0)) return null;
    if (u === "kg") return { valor: v * 1000, unidade: "g" };
    if (u === "l" || u.startsWith("litro")) return { valor: v * 1000, unidade: "ml" };
    if (u === "ml") return { valor: v, unidade: "ml" };
    return { valor: v, unidade: "g" };
  }
  const conta = t.match(/(\d+(?:[.,]\d+)?)\s*(unidades?|fatias?|potes?)\b/);
  if (conta) {
    const v = numeroBr(conta[1] as string);
    if (!(v > 0)) return null;
    const u = (conta[2] as string).replace(/s$/, "").replace(/^unidade$/, "unidade") as Unidade;
    return { valor: v, unidade: u };
  }
  return null;
}

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

export function textoDaQuantidade(valor: number, unidade: Unidade): string {
  if (unidade === "g") return valor >= 1000 ? `${fmt(valor / 1000, 2)} kg` : `${fmt(valor, 0)} g`;
  if (unidade === "ml") return valor >= 1000 ? `${fmt(valor / 1000, 2)} L` : `${fmt(valor, 0)} ml`;
  const plural = valor > 1 ? "s" : "";
  return `${fmt(valor)} ${unidade}${plural}`;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Só para organizar a lista por corredor. Não muda conta nenhuma. */
const CORREDORES: { titulo: string; palavras: RegExp }[] = [
  { titulo: "Açougue e peixaria", palavras: /\b(?:frango|carne|patinho|bife|boi|porco|lombo|peixe|tilapia|salmao|atum|sardinha|file|frango|peru|alcatra|acem|musculo|costela|camarao|hamburguer de carne)/ },
  { titulo: "Ovos e laticínios", palavras: /\b(?:ovo|leite|iogurte|queijo|mussarela|muçarela|requeijao|ricota|cottage|kefir|manteiga|creme de leite|coalhada)/ },
  { titulo: "Padaria", palavras: /\b(?:pao|torrada|bisnaguinha|wrap|rap10|tortilha|bolo)/ },
  {
    titulo: "Hortifrúti",
    palavras:
      /\b(?:banana|macas?\b|mamao|morango|uva|laranja|abacaxi|melao|melancia|manga|pera|kiwi|abacate|limao|tomate|alface|cenoura|abobrinha|abobora|brocolis|couve|espinafre|batata|mandioca|aipim|inhame|cebola|alho|pepino|beterraba|chuchu|vagem|legume|verdura|fruta|salada)/,
  },
];

function corredor(nome: string): string {
  const n = semAcento(nome);
  return CORREDORES.find((c) => c.palavras.test(n))?.titulo ?? "Mercearia";
}

const DIAS = 7;

export function montarListaDeCompras(conteudo: ConteudoProtocolo | null): ListaDeCompras {
  const somas = new Map<string, { nome: string; unidade: Unidade; porDia: { refeicao: string; valor: number }[] }>();
  const semConta = new Map<string, string>();
  for (const refeicao of conteudo?.refeicoes ?? []) {
    const opcao = refeicao.opcoes[0];
    if (!opcao) continue;
    for (const item of opcao.itens) {
      const nome = item.alimento.trim();
      if (!nome) continue;
      const q = lerQuantidade(item.quantidade ?? "");
      if (!q) {
        const chave = semAcento(nome);
        if (!semConta.has(chave)) semConta.set(chave, item.quantidade?.trim() ? `${nome} (${item.quantidade.trim()})` : nome);
        continue;
      }
      const chave = `${semAcento(nome)}|${q.unidade}`;
      const atual = somas.get(chave) ?? { nome, unidade: q.unidade, porDia: [] };
      atual.porDia.push({ refeicao: refeicao.nome.toLowerCase(), valor: q.valor });
      somas.set(chave, atual);
    }
  }
  const porSecao = new Map<string, ItemDaLista[]>();
  for (const s of somas.values()) {
    const diaria = s.porDia.reduce((t, p) => t + p.valor, 0);
    const conta =
      "por dia: " +
      s.porDia.map((p) => `${textoDaQuantidade(p.valor, s.unidade)} no ${p.refeicao}`).join(" + ").replace(/ no ceia/g, " na ceia");
    const item = { nome: s.nome, conta, total: textoDaQuantidade(diaria * DIAS, s.unidade) };
    const titulo = corredor(s.nome);
    porSecao.set(titulo, [...(porSecao.get(titulo) ?? []), item]);
  }
  const ordem = [...CORREDORES.map((c) => c.titulo), "Mercearia"];
  return {
    secoes: ordem
      .filter((t) => porSecao.has(t))
      .map((titulo) => ({
        titulo,
        itens: (porSecao.get(titulo) as ItemDaLista[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      })),
    semConta: [...semConta.values()],
  };
}
