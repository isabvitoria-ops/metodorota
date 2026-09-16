import type { PostFeed } from "@/types";
import { NUTRICIONISTA_ID } from "./ids";

/** Portado do protótipo (constante `FEED`). */
export const POSTS_FEED: PostFeed[] = [
  {
    id: "post-1", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-08-04T07:00:00.000Z", atualizadoEm: "2026-08-04T07:00:00.000Z",
    autorTipo: "nutricionista", tipo: "Receita", corId: "sage",
    titulo: "Panqueca de aveia sem leite",
    texto: "Três ingredientes, dez minutos, e cabe no lanche da tarde de quem está na fase 1. Aveia, ovo e banana bem amassada. Frigideira antiaderente, fogo baixo.",
    destino: { tipo: "todos" },
    publicadoEm: "2026-08-04T07:00:00.000Z",
  },
  {
    id: "post-2", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-08-04T04:00:00.000Z", atualizadoEm: "2026-08-04T04:00:00.000Z",
    autorTipo: "paciente", autorApelido: "014", tipo: "Conquista", corId: "gold",
    titulo: "21 dias de check-in seguidos",
    texto: "Nunca imaginei que anotar isso todo dia fosse mudar alguma coisa. Mas na consulta a gente viu que meus piores dias eram sempre depois do fim de semana.",
    destino: { tipo: "todos" },
    publicadoEm: "2026-08-04T04:00:00.000Z",
  },
  {
    id: "post-3", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-08-03T09:00:00.000Z", atualizadoEm: "2026-08-03T09:00:00.000Z",
    autorTipo: "nutricionista", tipo: "Aviso", corId: "plum",
    titulo: "Por que a distensão piora à noite",
    texto: "Não é a última refeição sozinha. Ao longo do dia o gás vai se acumulando e a parede abdominal relaxa. Por isso a barriga de segunda de manhã é diferente da barriga de segunda à noite.",
    destino: { tipo: "todos" },
    publicadoEm: "2026-08-03T09:00:00.000Z",
  },
  {
    id: "post-4", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-08-02T09:00:00.000Z", atualizadoEm: "2026-08-02T09:00:00.000Z",
    autorTipo: "paciente", autorApelido: "007", tipo: "Foto", corId: "clay",
    titulo: "Meu almoço de hoje",
    texto: "Arroz, frango e abobrinha refogada só no azeite. Simples e não me deu nada.",
    destino: { tipo: "todos" },
    publicadoEm: "2026-08-02T09:00:00.000Z",
  },
];

export const CURTIDAS_BASE: Record<string, number> = {
  "post-1": 24,
  "post-2": 41,
  "post-3": 67,
  "post-4": 18,
};
