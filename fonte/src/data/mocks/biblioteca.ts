import type { ArtigoBiblioteca } from "@/types";
import { NUTRICIONISTA_ID } from "./ids";

const agora = "2026-06-01T09:00:00.000Z";

/** Portado do protótipo (constante `BIBLIOTECA`). */
export const ARTIGOS_BIBLIOTECA: ArtigoBiblioteca[] = [
  {
    id: "b1", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Entender", minutosLeitura: 4,
    titulo: "Por que a distensão piora à noite",
    resumo: "O gás vai se acumulando ao longo do dia e a parede abdominal relaxa. A barriga de manhã e a de fim de tarde não são a mesma barriga.",
    corpo:
      "O texto completo deste artigo vem do seu sistema, escrito por você. Aqui ele chega " +
      "formatado, com tempo de leitura calculado e ligado aos sintomas que o paciente registra — " +
      "é por isso que ele apareceu no topo da lista dela hoje.",
    ligadoASintomas: ["distensao"],
  },
  {
    id: "b2", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Entender", minutosLeitura: 5,
    titulo: "O que é fermentação e por que ela incomoda você",
    resumo: "Fermentar é normal e até bom. O problema aparece quando o intestino é sensível ao volume de gás produzido.",
    corpo: "",
    ligadoASintomas: ["gases"],
  },
  {
    id: "b3", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Na prática", minutosLeitura: 3,
    titulo: "Como deixar o feijão mais leve",
    resumo: "Molho de 12 horas, água descartada e cozimento longo. Três passos que mudam bastante como você se sente depois.",
    corpo: "",
    ligadoASintomas: ["gases", "distensao"],
  },
  {
    id: "b4", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Na prática", minutosLeitura: 4,
    titulo: "Comer fora sem sabotar a fase 1",
    resumo: "O que pedir, o que evitar e como perguntar ao garçom sem constrangimento.",
    corpo: "",
    ligadoASintomas: [],
  },
  {
    id: "b5", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Entender", minutosLeitura: 6,
    titulo: "Estresse e intestino falam a mesma língua",
    resumo: "Não é frescura nem \"só emocional\". Existe uma comunicação real entre cérebro e intestino, e ela muda seu trânsito.",
    corpo: "",
    ligadoASintomas: ["dor"],
  },
  {
    id: "b6", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "Na prática", minutosLeitura: 3,
    titulo: "Água: por que espalhar durante o dia importa",
    resumo: "Beber tudo de uma vez não hidrata melhor e ainda atrapalha quem tem refluxo.",
    corpo: "",
    ligadoASintomas: [],
  },
  {
    id: "b7", nutricionistaId: NUTRICIONISTA_ID, criadoEm: agora, atualizadoEm: agora,
    categoria: "O caminho", minutosLeitura: 5,
    titulo: "O que acontece na fase 2",
    resumo: "A reintrodução é a parte mais importante do protocolo — é nela que a gente descobre o que é seu gatilho de verdade.",
    corpo: "",
    ligadoASintomas: [],
  },
];
