/**
 * As áreas do app que a nutricionista liga e desliga por paciente (0096).
 *
 * Guardado como a lista do que está DESLIGADO (`pacientes.areas_desligadas`):
 * tudo nasce ligado, então nenhuma paciente que já usa o app perde nada no
 * dia em que isto entra no ar.
 *
 * Fica de fora o Protocolo (todo mundo tem) e o que já tinha interruptor
 * próprio antes — treino, desafio, restrições, FODMAP, rastreio e o guia de
 * viagem. Esses continuam onde estavam; a tela de acessos mostra todos juntos.
 *
 * Esconder é na tela: atalho, barra de baixo, cartão e o endereço digitado.
 * Nenhuma destas áreas guarda dado da paciente que precise de trava no banco
 * (são catálogos e ferramentas); as que guardam já tinham a trava delas.
 */
import type { Acesso } from "@/central/types";

export type ChaveArea =
  | "trocas"
  | "comer_fora"
  | "cozinha"
  | "documentos"
  | "avaliacao"
  | "metas"
  | "hidratacao"
  | "habitos"
  | "diario"
  | "checkin"
  | "busca"
  | "aviso_viagem";

export const AREAS: { chave: ChaveArea; rotulo: string; descricao: string }[] = [
  { chave: "trocas", rotulo: "Troca inteligente", descricao: "A calculadora de trocas, na barra de baixo e na tela inicial." },
  { chave: "comer_fora", rotulo: "Comer fora", descricao: "Os guias de restaurante, na barra de baixo e na tela inicial." },
  { chave: "cozinha", rotulo: "Cozinha", descricao: "Todas as receitas publicadas, e o atalho de receita em cada refeição do protocolo." },
  { chave: "documentos", rotulo: "Meus documentos", descricao: "Os PDFs (plano, trocas, mercado, avaliação) e os exames guardados." },
  { chave: "avaliacao", rotulo: "Avaliação física", descricao: "As medidas e a evolução entre as consultas." },
  { chave: "metas", rotulo: "Metas", descricao: "As metas combinadas e o cartão da meta de hoje." },
  { chave: "checkin", rotulo: "Check-in", descricao: "Os questionários e o aviso de check-in pendente." },
  { chave: "hidratacao", rotulo: "Hidratação", descricao: "O registro de água do dia." },
  { chave: "habitos", rotulo: "Hábitos e intestino", descricao: "Sono, estresse, exercício e o que afeta o intestino." },
  { chave: "diario", rotulo: "Diário de fotos", descricao: "As fotos das refeições." },
  { chave: "busca", rotulo: "Busca da tela inicial", descricao: "O campo “O que você está procurando?”." },
  { chave: "aviso_viagem", rotulo: "Aviso de viagem", descricao: "O cartão “Tem alguma viagem programada?” (o guia de viagem tem interruptor próprio)." },
];

const CHAVES = new Set<string>(AREAS.map((a) => a.chave));

export function ehArea(chave: string): chave is ChaveArea {
  return CHAVES.has(chave);
}

/** Ligada, salvo se ela desligou. A nutricionista vê tudo (é quem confere a tela). */
export function areaLigada(acesso: Pick<Acesso, "papel" | "areasDesligadas">, chave: ChaveArea): boolean {
  if (acesso.papel === "admin") return true;
  return !(acesso.areasDesligadas ?? []).includes(chave);
}

/** A área dona de um endereço do app, para filtrar o que leva a área desligada (busca). */
export function areaDaRota(rota: string): ChaveArea | null {
  const caminho = rota.split("?")[0] ?? "";
  const pares: [string, ChaveArea][] = [
    ["/trocas", "trocas"],
    ["/substituicoes", "trocas"],
    ["/comer-fora", "comer_fora"],
    ["/cozinha", "cozinha"],
    ["/documentos", "documentos"],
    ["/avaliacao", "avaliacao"],
    ["/metas", "metas"],
    ["/questionarios", "checkin"],
    ["/hidratacao", "hidratacao"],
    ["/agua", "hidratacao"],
    ["/habitos", "habitos"],
    ["/diario", "diario"],
  ];
  return pares.find(([p]) => caminho === p || caminho.startsWith(`${p}/`))?.[1] ?? null;
}
