import type { GuiaDeViagem } from "@/central/types/viagem";

/**
 * O guia de viagem da DEMONSTRAÇÃO.
 *
 * Não é de paciente nenhuma e não traz orientação clínica: existe para a
 * demonstração ter o que mostrar, e para cada tipo de bloco aparecer uma vez.
 * O guia de verdade é escrito pela nutricionista, por paciente, e mora no banco.
 */
export const GUIA_DE_VIAGEM_DEMO: GuiaDeViagem = {
  chamada: "Seu intestino, em qualquer destino.",
  destinos: "Destino de exemplo",
  periodo: "3 dias de exemplo",
  dataInicio: "2026-01-10",
  dataFim: "2026-01-12",
  secoes: [
    {
      id: "estrategia",
      rotulo: "Estratégia",
      titulo: "Estratégia da viagem",
      blocos: [
        { tipo: "texto", texto: "Este é um guia de **exemplo**. O texto de cada paciente é você quem escreve, na ficha dela." },
        {
          tipo: "lista",
          estilo: "numerada",
          itens: [
            { titulo: "Primeiro combinado.", texto: "Escreva aqui o que vale para a viagem inteira." },
            { titulo: "Segundo combinado.", texto: "Um item por linha, com um título curto." },
          ],
        },
        { tipo: "destaque", tom: "dica", titulo: "Dica:", texto: "os destaques chamam atenção para uma frase." },
      ],
    },
    {
      id: "guia",
      rotulo: "Guia",
      titulo: "Guia alimentar da viagem",
      blocos: [
        {
          tipo: "semaforo",
          grupos: [
            { cor: "verde", titulo: "O que ajuda", itens: [{ titulo: "Grupo de exemplo", texto: "Alimentos que você indicar." }] },
            { cor: "amarelo", titulo: "Coma, mas observe como se sente", itens: [{ titulo: "Grupo de exemplo", texto: "Com as condições que você escrever." }] },
            { cor: "vermelho", titulo: "Vale evitar", itens: [{ titulo: "Grupo de exemplo", texto: "O que fica de fora nesta viagem." }] },
          ],
        },
      ],
    },
    {
      id: "pedir",
      rotulo: "Pedir",
      titulo: "O que pedir",
      blocos: [
        {
          tipo: "abas",
          abas: [
            {
              rotulo: "País A",
              blocos: [{ tipo: "lista", estilo: "cartoes", itens: [{ titulo: "Almoço e jantar", texto: "Sugestões para este país." }] }],
            },
            {
              rotulo: "País B",
              blocos: [{ tipo: "cartao", texto: "Um cartão para mostrar ao garçom.", destaques: ["A frase mais importante fica em destaque."] }],
            },
          ],
        },
        { tipo: "tabela", colunas: ["Português", "Outro idioma"], linhas: [["Sem cebola", "Tradução de exemplo"]] },
      ],
    },
    {
      id: "alerta",
      rotulo: "Alerta",
      titulo: "Sinais de alerta",
      blocos: [
        { tipo: "destaque", tom: "alerta", titulo: "Procure atendimento se houver:", itens: ["os sinais que você listar para esta paciente."] },
        { tipo: "subtitulo", texto: "Ficha de saúde" },
        { tipo: "ficha" },
      ],
    },
    {
      id: "diario",
      rotulo: "Diário",
      titulo: "Diário da viagem",
      blocos: [
        { tipo: "texto", texto: "O que a paciente preenche aqui aparece para você na ficha dela, na aba Viagem." },
        { tipo: "diario" },
      ],
    },
  ],
};
