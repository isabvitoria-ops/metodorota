/**
 * Hot Slim — textos de apoio da Etapa 1: rotina, sintomas comuns e dúvidas.
 *
 * Escritos do zero para o Método Rota. Os números (cafeína, água, jejum)
 * vêm de regras.ts, para nunca divergirem do Protocolo.
 */

import { AGUA_ML_POR_KG, CAFE_ATE, CAFEINA_MAX_MG, JEJUM_NOTURNO_H } from "./regras.ts";

export interface SecaoRotina {
  titulo: string;
  itens: string[];
}

export const ROTINA: SecaoRotina[] = [
  {
    titulo: "Ao acordar",
    itens: [
      "Um copo de água antes de qualquer coisa.",
      "Luz do dia nos primeiros minutos: abra a janela ou vá até a varanda. Ajuda a acertar o relógio do corpo, e o intestino segue esse relógio.",
      "Reserve um horário fixo para ir ao banheiro com calma, de preferência depois do café da manhã, quando o intestino é naturalmente mais ativo.",
    ],
  },
  {
    titulo: "As 4 refeições",
    itens: [
      "Café da manhã, almoço, lanche e jantar, com 3 a 5 horas entre uma e outra.",
      "Coma sentada, devagar, mastigando bem. Pressa e ar engolido aumentam a distensão.",
      "Entre as refeições: água e chá puro, sem adoçante, leite ou ghee. Nada que tenha caloria.",
    ],
  },
  {
    titulo: "Jejum noturno (jejum metabólico)",
    itens: [
      `Do jantar até o café da manhã, deixe de ${JEJUM_NOTURNO_H.de} a ${JEJUM_NOTURNO_H.ate} horas. Exemplo: jantar às 20h, café às 7h ou 8h.`,
      "Isto não é jejum intermitente. No jejum intermitente se pula refeição para encurtar a janela de comer (16 horas ou mais). No Hot Slim ninguém pula refeição: o jejum é só a noite de sono mais o tempo depois do jantar.",
      "Por que importa: só em jejum o intestino delgado faz as ondas de limpeza chamadas complexo motor migratório. Elas varrem restos de alimento e bactérias em direção ao intestino grosso e param assim que você come. Beliscar o dia todo interrompe essas ondas; refeições espaçadas e uma noite sem comer dão espaço para elas.",
      "É essa a lógica do repouso digestivo: comida simples e cozida durante o dia, e intervalos de verdade entre as refeições.",
    ],
  },
  {
    titulo: "Movimento",
    itens: [
      "Todo dia, de 20 a 30 minutos: treino, caminhada, bicicleta. Atividade regular encurta o tempo que o alimento leva para atravessar o intestino.",
      "Intensidade leve a moderada é a que mais ajuda o intestino. Treino muito longo ou muito intenso pode piorar cólica e distensão nos primeiros dias.",
      "Treina cedo e o rendimento cai em jejum? Faça o café da manhã antes do treino, em vez de acrescentar uma refeição.",
      "Depois do almoço ou do jantar, 10 minutos de caminhada leve ajudam na sensação de estufamento.",
    ],
  },
  {
    titulo: "Café e chás",
    itens: [
      `Cafeína: até ${CAFEINA_MAX_MG} mg por dia, que é cerca de 1 xícara de café coado. Último café até as ${CAFE_ATE}.`,
      "Chá verde e chá preto também têm cafeína e entram nessa conta.",
      "Chá de camomila e de erva-doce ficam fora do desafio: são ricos em frutanos.",
    ],
  },
  {
    titulo: "Água",
    itens: [
      `${AGUA_ML_POR_KG} ml por kg de peso ao longo do dia. Exemplo: 60 kg × ${AGUA_ML_POR_KG} = ${(60 * AGUA_ML_POR_KG) / 1000} litros.`,
      "Distribua o dia inteiro. Se grandes volumes durante a refeição te estufam, beba mais nos intervalos.",
    ],
  },
  {
    titulo: "À noite",
    itens: [
      "Jantar até as 20h, ou pelo menos 2 horas antes de deitar.",
      "Telas mais fracas e luz baixa na última hora. Dormir de 7 a 9 horas faz parte do protocolo: sono curto aumenta fome e piora o intestino.",
    ],
  },
];

export interface Sintoma {
  titulo: string;
  porque: string;
  oQueFazer: string[];
  /** Quando procurar atendimento em vez de seguir sozinha. */
  procurar?: string;
}

export const SINTOMAS: Sintoma[] = [
  {
    titulo: "Dor de cabeça nos primeiros dias",
    porque: "O mais comum é a redução da cafeína e do açúcar. Costuma passar em 2 a 4 dias.",
    oQueFazer: [
      "Beba a sua meta de água.",
      `Mantenha a sua dose de cafeína até ${CAFEINA_MAX_MG} mg, sem cortar de uma vez.`,
      "Não pule refeição.",
    ],
  },
  {
    titulo: "Intestino preso",
    porque: "Mudança de rotina e de fibras pode deixar o intestino mais lento na primeira semana.",
    oQueFazer: [
      "Prefira as opções com kiwi (2 unidades por dia têm efeito comprovado no hábito intestinal), chia e aveia.",
      "Água: confira se chegou nos 50 ml por kg.",
      "Movimento todo dia e horário fixo para ir ao banheiro, com os pés apoiados num banquinho.",
    ],
    procurar: "Mais de 3 dias sem evacuar com dor ou barriga muito dura: fale com a nutri pelo grupo.",
  },
  {
    titulo: "Gases e distensão",
    porque: "Nos primeiros dias o intestino ainda está se ajustando às novas fibras. Volume grande de uma vez e ar engolido também pesam.",
    oQueFazer: [
      "Respeite as porções: no low FODMAP, a quantidade muda tudo.",
      "Coma devagar e sem canudo. Chiclete e água com gás ficam de fora.",
      "Caminhada leve de 10 minutos depois da refeição.",
    ],
  },
  {
    titulo: "Fome entre as refeições",
    porque: "Costuma ser pouca proteína ou pouco legume na refeição anterior, ou sono curto.",
    oQueFazer: [
      "Não deixe de comer a proteína da opção, ela é a que mais segura a fome.",
      "Cenoura, chuchu, pimentão, couve e espinafre cozidos podem ser repetidos no almoço e no jantar.",
      "Chá puro ou água no intervalo.",
    ],
  },
  {
    titulo: "Cansaço ou treino rendendo menos",
    porque: "Déficit calórico e menos cafeína. O corpo se adapta em alguns dias.",
    oQueFazer: [
      "Coma o carboidrato da refeição antes do treino.",
      "Treino leve a moderado na Etapa 1.",
      "Durma 7 horas ou mais.",
    ],
  },
  {
    titulo: "Sinais de alerta",
    porque: "Não são reação esperada do desafio.",
    oQueFazer: [
      "Sangue nas fezes, febre, vômitos que não param, dor forte, perda de peso sem explicação ou acordar à noite para evacuar.",
    ],
    procurar: "Procure atendimento médico e avise a nutri.",
  },
];

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export const FAQ: Pergunta[] = [
  { pergunta: "Posso beliscar entre as refeições?", resposta: "Não. Entre as refeições, só água e chá puro. Cada beliscada interrompe o complexo motor migratório, as ondas de limpeza que o intestino só faz em jejum." },
  { pergunta: "Chá quebra o jejum?", resposta: "Chá puro, sem adoçante, leite ou ghee, não tem caloria e pode ser tomado nos intervalos e no jejum da noite. Os liberados estão no Protocolo." },
  { pergunta: "Posso pular uma refeição?", resposta: "Não. O Hot Slim não é jejum intermitente. São 4 refeições por dia, e o único jejum é o da noite, de 10 a 12 horas." },
  { pergunta: "Quanto café posso tomar?", resposta: `Até ${CAFEINA_MAX_MG} mg de cafeína por dia, cerca de 1 xícara de café coado, até as ${CAFE_ATE}. Chá verde, chá preto e pré-treino entram na conta.` },
  { pergunta: "Qual adoçante posso usar?", resposta: "Só stevia ou taumatina, puras. Confira o rótulo: muitas misturas de stevia levam eritritol, que fica de fora." },
  { pergunta: "Leite sem lactose pode?", resposta: "Não. Na Etapa 1 saem todos os laticínios, inclusive os sem lactose, a manteiga e o ghee. Para o mingau e o chocolate quente, use bebida de amêndoas. A lactose é testada depois, na reintrodução." },
  { pergunta: "Posso comer fruta crua?", resposta: "Sim, na porção indicada no cardápio. O que fica cozido na Etapa 1 são os legumes e as folhas." },
  { pergunta: "Posso usar whey?", resposta: "Não durante o desafio. O colágeno pode, sem sabor ou adoçado só com stevia ou taumatina." },
  { pergunta: "E os outros suplementos?", resposta: "Os que você já usa com prescrição, mantenha. Se tiverem sabor, confira se não levam polióis nem açúcar." },
  { pergunta: "Posso treinar em jejum?", resposta: "Se você já treina assim e se sente bem, pode. Se o rendimento cair, faça o café da manhã antes do treino." },
  { pergunta: "E se eu precisar comer fora?", resposta: "Na Etapa 1, prefira levar a sua refeição. Se não der: proteína grelhada, arroz branco e legumes cozidos, sem molho e pedindo para não usar alho e cebola." },
  { pergunta: "Posso beber álcool?", resposta: "Não durante os 21 dias." },
  { pergunta: "Saí do protocolo. E agora?", resposta: "Recalcule a rota: volte na próxima refeição, sem compensar comendo menos e sem desistir do dia. Anote no checklist o que comeu e como o intestino respondeu, porque isso também é informação." },
];
