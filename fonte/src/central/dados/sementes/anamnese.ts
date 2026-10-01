import type { TipoDePergunta } from "@/central/types/questionario";

export interface PerguntaDeModelo {
  texto: string;
  tipo: TipoDePergunta;
  obrigatoria: boolean;
  opcoes: string[];
  invertida: boolean;
}

export interface ModeloDeAnamnese {
  id: string;
  titulo: string;
  descricao: string;
  perguntas: PerguntaDeModelo[];
}

function p(
  texto: string,
  tipo: TipoDePergunta,
  opcoes: string[] = [],
  obrigatoria = true,
  invertida = false,
): PerguntaDeModelo {
  return { texto, tipo, obrigatoria, opcoes, invertida };
}

const GERAL: ModeloDeAnamnese = {
  id: "geral",
  titulo: "Anamnese nutricional",
  descricao: "Histórico geral de saúde, hábitos alimentares e estilo de vida.",
  perguntas: [
    p("Qual a sua idade?", "numero"),
    p("Qual a sua ocupação / profissão?", "texto"),
    p("Qual o seu objetivo principal com o acompanhamento nutricional?", "texto"),
    p("Doenças diagnosticadas (atuais ou anteriores)", "texto", [], false),
    p("Medicamentos em uso contínuo", "texto", [], false),
    p("Cirurgias anteriores", "texto", [], false),
    p("Alergias ou intolerâncias alimentares conhecidas", "texto", [], false),
    p("Histórico familiar de doenças (diabetes, hipertensão, câncer, etc.)", "texto", [], false),
    p("Como você avalia a qualidade do seu sono?", "escala"),
    p("Qual o seu nível de estresse no dia a dia?", "escala", [], true, true),
    p("Pratica atividade física?", "escolha", [
      "Não pratico",
      "1 a 2 vezes por semana",
      "3 a 4 vezes por semana",
      "5 ou mais vezes por semana",
    ]),
    p("Que tipo de atividade física? (pode pular se não pratica)", "texto", [], false),
    p("Quantas refeições faz por dia, em média?", "escolha", [
      "1 a 2",
      "3 a 4",
      "5 a 6",
      "Mais de 6",
    ]),
    p("Quem prepara as suas refeições na maioria dos dias?", "escolha", [
      "Eu mesma",
      "Outra pessoa da casa",
      "Restaurante ou delivery",
    ]),
    p("Com que frequência come fora de casa?", "escolha", [
      "Raramente",
      "1 a 2 vezes por semana",
      "3 a 4 vezes por semana",
      "Quase todos os dias",
    ]),
    p("Quanta água bebe por dia, em média?", "escolha", [
      "Menos de 1 litro",
      "1 a 2 litros",
      "Mais de 2 litros",
      "Não sei dizer",
    ]),
    p("Alimentos que não gosta ou não come", "texto", [], false),
    p("Alimentos preferidos", "texto", [], false),
    p("Consumo de bebida alcoólica", "escolha", [
      "Não bebo",
      "Socialmente",
      "1 a 2 vezes por semana",
      "3 ou mais vezes por semana",
    ]),
    p("Como é o funcionamento do seu intestino?", "escolha", [
      "Regular, todo dia",
      "A cada 2 ou 3 dias",
      "Irregular",
      "Não sei avaliar",
    ]),
    p("Sintomas digestivos frequentes (gases, inchaço, dor, refluxo, etc.)", "texto", [], false),
    p("Já fez dieta restritiva antes?", "escolha", [
      "Nunca",
      "Sim, por conta própria",
      "Sim, com acompanhamento profissional",
    ]),
    p("Observações ou algo que gostaria de contar", "texto", [], false),
  ],
};

const GASTROINTESTINAL: ModeloDeAnamnese = {
  id: "gastrointestinal",
  titulo: "Anamnese gastrointestinal",
  descricao: "Avaliação detalhada de sintomas digestivos, hábitos intestinais e histórico de dietas de eliminação.",
  perguntas: [
    p("Qual a queixa principal que motivou a consulta?", "texto"),
    p("Há quanto tempo tem os sintomas?", "escolha", [
      "Menos de 1 mês",
      "1 a 6 meses",
      "6 a 12 meses",
      "Mais de 1 ano",
    ]),
    p("Distensão abdominal (barriga inchada)", "escala", [], true, true),
    p("Dor ou desconforto abdominal", "escala", [], true, true),
    p("Gases / flatulência", "escala", [], true, true),
    p("Náusea", "escala", [], true, true),
    p("Refluxo ou azia", "escala", [], true, true),
    p("Frequência de evacuação", "escolha", [
      "Mais de 3 vezes por dia",
      "1 a 2 vezes por dia",
      "A cada 2 ou 3 dias",
      "Menos de 1 vez por semana",
    ]),
    p("Consistência predominante das fezes", "escolha", [
      "Endurecidas ou ressecadas",
      "Em bolinhas separadas",
      "Formada e lisa",
      "Pastosa",
      "Líquida",
      "Varia muito",
    ]),
    p("Urgência para evacuar", "escolha", [
      "Nunca",
      "Raramente",
      "Às vezes",
      "Frequentemente",
      "Sempre",
    ]),
    p("Sensação de evacuação incompleta", "escolha", [
      "Nunca",
      "Às vezes",
      "Frequentemente",
      "Sempre",
    ]),
    p("Alimentos que você percebe que pioram os sintomas", "texto", [], false),
    p("Alimentos que você percebe que melhoram", "texto", [], false),
    p("Já retirou glúten ou lactose por conta própria? Sentiu diferença?", "texto", [], false),
    p("Já fez dieta de eliminação (ex. FODMAP)?", "escolha", [
      "Nunca",
      "Sim, por conta própria",
      "Sim, com acompanhamento profissional",
    ]),
    p("Nível de estresse no dia a dia", "escala", [], true, true),
    p("Os sintomas pioram quando você está estressada?", "escolha", [
      "Não percebo relação",
      "Um pouco",
      "Bastante",
      "Muito",
    ]),
    p("Medicamentos em uso para o intestino (laxantes, antiespasmódicos, probióticos, etc.)", "texto", [], false),
    p("Exames digestivos realizados recentemente", "texto", [], false),
    p("Diagnósticos digestivos (SII, DRGE, gastrite, intolerância, etc.)", "texto", [], false),
  ],
};

const ESPORTIVA: ModeloDeAnamnese = {
  id: "esportiva",
  titulo: "Anamnese esportiva",
  descricao: "Rotina de treinos, alimentação periférica ao exercício, suplementação e metas de composição corporal.",
  perguntas: [
    p("Modalidade(s) de treino", "texto"),
    p("Frequência semanal de treinos", "escolha", [
      "1 a 2 vezes",
      "3 a 4 vezes",
      "5 a 6 vezes",
      "Todos os dias",
    ]),
    p("Duração média de cada treino", "escolha", [
      "Até 45 minutos",
      "45 a 60 minutos",
      "60 a 90 minutos",
      "Mais de 90 minutos",
    ]),
    p("Em que horário costuma treinar?", "escolha", [
      "Manhã (antes das 10h)",
      "Meio do dia",
      "Tarde",
      "Noite (após 19h)",
      "Varia",
    ]),
    p("Há quanto tempo treina regularmente?", "escolha", [
      "Menos de 3 meses",
      "3 a 6 meses",
      "6 a 12 meses",
      "Mais de 1 ano",
      "Mais de 3 anos",
    ]),
    p("Objetivo principal com o treino", "escolha", [
      "Emagrecimento",
      "Ganho de massa muscular",
      "Saúde e bem-estar",
      "Performance ou competição",
      "Reabilitação",
    ]),
    p("O que costuma comer antes do treino?", "texto"),
    p("O que costuma comer depois do treino?", "texto"),
    p("Come ou bebe algo durante o treino?", "texto", [], false),
    p("Hidratação durante o treino", "escolha", [
      "Pouca água",
      "Água suficiente",
      "Isotônico ou bebida esportiva",
      "Não bebo nada durante",
    ]),
    p("Como avalia seu nível de energia durante o treino?", "escala"),
    p("Como avalia sua recuperação entre um treino e outro?", "escala"),
    p("Como avalia a qualidade do seu sono?", "escala"),
    p("Suplementos em uso atualmente", "texto", [], false),
    p("Já usou outros suplementos antes? Quais?", "texto", [], false),
    p("Sentiu algum efeito colateral com suplemento?", "texto", [], false),
    p("Desconforto gastrointestinal durante o treino?", "escolha", [
      "Nunca",
      "Raramente",
      "Às vezes",
      "Frequentemente",
    ]),
    p("Meta de composição corporal (ex. ganhar 3 kg de massa, perder gordura abdominal)", "texto", [], false),
    p("Compete em alguma modalidade?", "escolha", [
      "Não",
      "Sim, de forma amadora",
      "Sim, de forma competitiva",
    ]),
    p("Observações sobre sua alimentação e treino", "texto", [], false),
  ],
};

export const MODELOS_ANAMNESE: ModeloDeAnamnese[] = [GERAL, GASTROINTESTINAL, ESPORTIVA];
