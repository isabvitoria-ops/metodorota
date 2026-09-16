import type { FichaEducativaAlimento } from "@/types";

/**
 * Conteúdo educativo por alimento, portado literalmente do protótipo
 * (constante `FICHAS`). Códigos TACO escolhidos pelo nome mais próximo
 * disponível na base (ex.: "leite" aponta para leite em pó integral — a
 * base não tem leite fluido integral cadastrado nesta edição).
 */
export const FICHAS_ALIMENTO: FichaEducativaAlimento[] = [
  {
    alimentoCodigoTaco: 561, // Feijão, carioca, cozido
    tags: ["Fermenta"],
    titulo: "O feijão pode fermentar no intestino",
    corpo:
      "Ele tem carboidratos que o intestino grosso fermenta. Isso é normal e até saudável — mas em quem tem intestino sensível pode virar gás e distensão.",
    dicas: [
      "Deixe de molho por 12 h e jogue a água fora antes de cozinhar",
      "Cozinhe bem, até ficar bem macio",
      "Comece com a quantidade prescrita, sem repetir",
    ],
  },
  {
    alimentoCodigoTaco: 3, // Arroz, tipo 1, cozido
    tags: ["Bem tolerado"],
    titulo: "Costuma ser bem tolerado",
    corpo:
      "É uma das fontes de carboidrato que menos causa sintoma em intestino sensível. Por isso aparece bastante no seu plano nesta fase.",
    dicas: ["Se sobrar, esfrie na geladeira antes de requentar", "Evite reaquecer mais de uma vez"],
  },
  {
    alimentoCodigoTaco: 91, // Batata, inglesa, cozida
    tags: ["Bem tolerada"],
    titulo: "Opção leve para o intestino",
    corpo: "Sem os carboidratos que costumam fermentar. Boa substituta do arroz quando quiser variar.",
    dicas: ["Cozida ou assada, sem casca nesta fase", "Evite fritura — gordura em excesso piora refluxo"],
  },
  {
    alimentoCodigoTaco: 53, // Pão, trigo, francês
    tags: ["Contém glúten", "Fermenta"],
    titulo: "Contém glúten e pode fermentar",
    corpo:
      "O trigo tem frutanos, que fermentam bastante. Na maioria dos casos não é sobre o glúten em si — é sobre o frutano.",
    dicas: ["Pão de fermentação natural costuma incomodar menos", "Torrar ajuda algumas pessoas"],
  },
  {
    alimentoCodigoTaco: 459, // Leite, de vaca, integral, pó
    tags: ["Contém lactose"],
    titulo: "Contém lactose",
    corpo:
      "A lactose precisa de uma enzima para ser digerida. Quando falta, ela chega ao intestino grosso e fermenta — gás, cólica, às vezes diarreia.",
    dicas: ["Versão sem lactose costuma resolver", "Iogurte e queijos curados têm menos lactose"],
  },
  {
    alimentoCodigoTaco: 222, // Maçã, Fuji, com casca, crua
    tags: ["Rica em FODMAP"],
    titulo: "Rica em FODMAP",
    corpo:
      "Tem frutose e sorbitol em quantidade alta. Nesta fase do seu protocolo ela sai do cardápio — volta depois, na reintrodução.",
    dicas: ["Nesta fase, prefira banana, mamão ou laranja", "Vamos testar a maçã na fase 2"],
  },
  {
    alimentoCodigoTaco: 182, // Banana, prata, crua
    tags: ["Bem tolerada"],
    titulo: "Boa escolha para esta fase",
    corpo: "Madura na medida certa, é bem tolerada. Muito madura, a quantidade de frutose sobe.",
    dicas: ["Prefira a que ainda tem a ponta esverdeada", "Uma unidade média por vez"],
  },
  {
    alimentoCodigoTaco: 488, // Ovo, de galinha, inteiro, cozido/10minutos
    tags: ["Bem tolerado"],
    titulo: "Proteína tranquila para o intestino",
    corpo:
      "Não fermenta e não tem lactose nem glúten. Uma das proteínas mais seguras nesta fase.",
    dicas: ["Cozido ou mexido com pouco óleo", "Frito em muita gordura pode piorar refluxo"],
  },
  {
    alimentoCodigoTaco: 410, // Frango, peito, sem pele, grelhado
    tags: ["Bem tolerado"],
    titulo: "Proteína de fácil digestão",
    corpo:
      "Sem carboidrato fermentável. O que importa aqui é o preparo: quanto menos gordura, melhor para o refluxo.",
    dicas: ["Grelhado, assado ou cozido", "Evite molhos prontos com alho e cebola"],
  },
  {
    alimentoCodigoTaco: 7, // Aveia, flocos, crua
    tags: ["Fibra solúvel"],
    titulo: "Fibra que ajuda a regular",
    corpo:
      "A fibra solúvel da aveia forma um gel que dá consistência às fezes. Ajuda tanto em prisão de ventre quanto em fezes muito moles.",
    dicas: ["Aumente devagar, junto com a água do dia", "Deixar de molho na véspera facilita"],
  },
  {
    alimentoCodigoTaco: 72, // Abobrinha, italiana, refogada
    tags: ["Livre"],
    titulo: "Pode comer à vontade",
    corpo: "Vegetal bem tolerado nesta fase. Não precisa de quantidade marcada — coma até se sentir satisfeita.",
    dicas: ["Refogue só no azeite, sem alho e sem cebola", "Bem cozida incomoda menos que crua"],
  },
  {
    alimentoCodigoTaco: 109, // Cenoura, cozida
    tags: ["Livre"],
    titulo: "Pode comer à vontade",
    corpo: "Vegetal seguro para esta fase, e cozido fica mais fácil de digerir do que cru.",
    dicas: ["Cozinhe até ficar macia", "Vai bem junto com a abobrinha"],
  },
  {
    alimentoCodigoTaco: 260, // Azeite, de oliva, extra virgem
    tags: ["Gordura boa"],
    titulo: "Gordura que cabe no plano",
    corpo:
      "Boa opção para temperar. Em excesso, qualquer gordura retarda o esvaziamento do estômago e pode piorar refluxo.",
    dicas: ["Prefira usar depois de cozinhar, não para fritar", "Uma colher de sopa por refeição"],
  },
];

export function fichaPorCodigo(codigo: number): FichaEducativaAlimento | undefined {
  return FICHAS_ALIMENTO.find((f) => f.alimentoCodigoTaco === codigo);
}

/** Códigos TACO usados nos mocks — atalho nomeado para não espalhar "números mágicos" pelos outros fixtures. */
export const COD = {
  arroz: 3,
  batata: 91,
  pao: 53,
  leite: 459,
  maca: 222,
  banana: 182,
  ovo: 488,
  frango: 410,
  aveia: 7,
  abobrinha: 72,
  cenoura: 109,
  azeite: 260,
  feijao: 561,
} as const;
