/**
 * Configurações do app (§46, §47 do briefing).
 *
 * O número de WhatsApp não pode estar espalhado pelo código: ele mora aqui e,
 * em produção, na tabela `configuracoes` do banco — trocar é editar um campo
 * no painel, não caçar string por arquivo.
 */
export interface Configuracao {
  chave: string;
  valor: unknown;
  descricao: string;
}

export const CONFIGURACOES: Configuracao[] = [
  {
    chave: "nome_central",
    valor: "Central do Paciente",
    descricao: "Nome exibido no topo do app.",
  },
  {
    chave: "frase_home",
    valor: "Facilite suas escolhas no dia a dia.",
    descricao: "Frase da tela inicial.",
  },
  {
    chave: "lema",
    // Frase de identidade da Central. Está aqui, e não no código, porque é
    // a parte mais provável de mudar: trocar é editar um campo na tela.
    valor: "Na sexta o cardápio muda — mas o plano continua.",
    descricao: "Frase curta de identidade, exibida na tela inicial. Deixe em branco para não mostrar.",
  },
  {
    chave: "comer_fora_introducao",
    // Estava na aba "Refeição livre", que saiu do ar a pedido dela. A conta
    // não é de uma categoria só — vale para a seção inteira —, então virou
    // configuração: aparece no topo de Comer fora e ela edita pelo painel.
    valor:
      "Duas meias refeições equivalem a uma completa. Uma completa mais uma meia equivalem a uma refeição e meia.",
    descricao: "Frase no topo de Comer fora. Deixe em branco para não mostrar.",
  },
  {
    chave: "whatsapp",
    valor: "5531994503318",
    descricao: "Número do WhatsApp da nutricionista, só dígitos com DDI e DDD (ex.: 5511999999999).",
  },
  {
    chave: "nome_nutricionista",
    valor: "Isabela Marçal",
    descricao: "Nome que aparece nos textos de contato.",
  },
  {
    chave: "alerta_vencimento_dias",
    valor: 15,
    descricao: "A partir de quantos dias antes do fim o paciente entra em 'próximo do vencimento'.",
  },
];
