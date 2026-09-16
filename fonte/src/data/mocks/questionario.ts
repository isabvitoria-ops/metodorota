import type { QuestionarioTemplate } from "@/types";
import { NUTRICIONISTA_ID } from "./ids";

/** Portado do protótipo (constante `QUESTIONARIO`) — agora um template entre outros possíveis (briefing §14). */
export const TEMPLATE_MENSAL: QuestionarioTemplate = {
  id: "template-mensal-v1",
  nutricionistaId: NUTRICIONISTA_ID,
  criadoEm: "2026-01-01T09:00:00.000Z",
  atualizadoEm: "2026-01-01T09:00:00.000Z",
  titulo: "Como foi o seu mês",
  introducao:
    "Seis perguntas sobre as últimas quatro semanas. Sua nutri usa isso para comparar com o mês anterior e decidir os próximos passos.",
  versao: 1,
  periodicidade: "mensal",
  perguntas: [
    { id: "q1", tipo: "escala", texto: "O quanto o desconforto abdominal atrapalhou seus dias?", rotuloEsquerda: "Nada", rotuloDireita: "Muito" },
    { id: "q2", tipo: "escala", texto: "E a distensão — o quanto ela incomodou?", rotuloEsquerda: "Nada", rotuloDireita: "Muito" },
    {
      id: "q3", tipo: "escolha_unica", texto: "Em quantos dos últimos 30 dias você sentiu dor?",
      opcoes: ["Nenhum", "1 a 5 dias", "6 a 15 dias", "16 a 25 dias", "Quase todos"],
    },
    { id: "q4", tipo: "escala", texto: "O quanto você ficou satisfeita com o funcionamento do intestino?", rotuloEsquerda: "Nada", rotuloDireita: "Muito", invertida: true },
    { id: "q5", tipo: "escala", texto: "O quanto isso interferiu na sua vida — trabalho, sono, sair de casa?", rotuloEsquerda: "Nada", rotuloDireita: "Muito" },
    { id: "q6", tipo: "texto", texto: "Tem algo que você quer que sua nutri saiba antes da próxima consulta?" },
  ],
};
