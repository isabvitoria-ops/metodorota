/**
 * Receitas da DEMONSTRAÇÃO (modo sem banco). São exemplos; as de verdade são
 * as que a nutricionista cadastra em /admin/receitas. Os números foram
 * calculados pela TACO 4ª ed. a partir dos gramas (ver utils/receitas.ts).
 */
import type { Receita } from "@/central/types/receita";

export const RECEITAS_DEMO: Receita[] = [
  {
    "id": "receita-demo-1",
    "titulo": "Omelete de espinafre com queijo",
    "categoria": "cafe",
    "minutos": 10,
    "porcoes": 1,
    "tags": [
      "Rápida",
      "Sem glúten"
    ],
    "ingredientes": [
      {
        "texto": "2 ovos",
        "alimentoId": "taco:489",
        "alimentoNome": "Ovo, de galinha, inteiro, cru",
        "fonte": "taco",
        "gramas": 100
      },
      {
        "texto": "1 xícara de espinafre cru picado",
        "alimentoId": "taco:119",
        "alimentoNome": "Espinafre, Nova Zelândia, cru",
        "fonte": "taco",
        "gramas": 30
      },
      {
        "texto": "1 fatia média de queijo minas frescal",
        "alimentoId": "taco:461",
        "alimentoNome": "Queijo, minas, frescal",
        "fonte": "taco",
        "gramas": 30
      },
      {
        "texto": "3 rodelas de tomate",
        "alimentoId": "taco:157",
        "alimentoNome": "Tomate, com semente, cru",
        "fonte": "taco",
        "gramas": 40
      },
      {
        "texto": "1 colher de chá rasa de azeite",
        "alimentoId": "taco:260",
        "alimentoNome": "Azeite, de oliva, extra virgem",
        "fonte": "taco",
        "gramas": 3
      }
    ],
    "preparo": [
      "Bata os ovos com uma pitada de sal.",
      "Aqueça o azeite e murche o espinafre por 1 minuto.",
      "Despeje os ovos, junte o queijo e o tomate e tampe.",
      "Dobre ao meio quando firmar embaixo."
    ],
    "dica": "Sobrou espinafre? Congele picado em porções, ele vai direto na frigideira.",
    "numeros": {
      "total": {
        "energia_kcal": 259.9,
        "proteina": 19.3,
        "carboidrato": 4.6,
        "lipideos": 18.1,
        "fibra_alimentar": 1.1
      },
      "faltando": {},
      "fontes": [
        "taco"
      ],
      "calculadoEm": "2026-11-18T12:00:00.000Z"
    },
    "publicada": true,
    "atualizadoEm": "2026-11-18T12:00:00.000Z"
  },
  {
    "id": "receita-demo-2",
    "titulo": "Iogurte com morango e aveia",
    "categoria": "lanche",
    "minutos": 3,
    "porcoes": 1,
    "tags": [
      "Rápida",
      "Leve"
    ],
    "ingredientes": [
      {
        "texto": "1 pote de iogurte natural",
        "alimentoId": "taco:448",
        "alimentoNome": "Iogurte, natural",
        "fonte": "taco",
        "gramas": 170
      },
      {
        "texto": "6 morangos médios",
        "alimentoId": "taco:239",
        "alimentoNome": "Morango, cru",
        "fonte": "taco",
        "gramas": 100
      },
      {
        "texto": "1 colher de sopa de aveia em flocos",
        "alimentoId": "taco:7",
        "alimentoNome": "Aveia, flocos, crua",
        "fonte": "taco",
        "gramas": 15
      },
      {
        "texto": "1 colher de chá de mel",
        "alimentoId": "taco:507",
        "alimentoNome": "Mel, de abelha",
        "fonte": "taco",
        "gramas": 5
      }
    ],
    "preparo": [
      "Pique os morangos.",
      "Monte em camadas: iogurte, morango e aveia.",
      "Finalize com o mel."
    ],
    "dica": "Monte de véspera num pote com tampa: a aveia amolece e fica cremosa.",
    "numeros": {
      "total": {
        "energia_kcal": 192.2,
        "proteina": 9.9,
        "carboidrato": 24.3,
        "lipideos": 6.8,
        "fibra_alimentar": 3.1
      },
      "faltando": {},
      "fontes": [
        "taco"
      ],
      "calculadoEm": "2026-11-18T12:00:00.000Z"
    },
    "publicada": true,
    "atualizadoEm": "2026-11-18T12:00:00.000Z"
  },
  {
    "id": "receita-demo-3",
    "titulo": "Frango com abobrinha e cenoura",
    "categoria": "almoco_jantar",
    "minutos": 20,
    "porcoes": 2,
    "tags": [
      "Sem glúten",
      "Sem lactose"
    ],
    "ingredientes": [
      {
        "texto": "Peito de frango em cubos",
        "alimentoId": "taco:409",
        "alimentoNome": "Frango, peito, sem pele, cru",
        "fonte": "taco",
        "gramas": 240
      },
      {
        "texto": "1 abobrinha média",
        "alimentoId": "taco:71",
        "alimentoNome": "Abobrinha, italiana, crua",
        "fonte": "taco",
        "gramas": 200
      },
      {
        "texto": "1 cenoura média",
        "alimentoId": "taco:110",
        "alimentoNome": "Cenoura, crua",
        "fonte": "taco",
        "gramas": 100
      },
      {
        "texto": "½ cebola",
        "alimentoId": "taco:107",
        "alimentoNome": "Cebola, crua",
        "fonte": "taco",
        "gramas": 40
      },
      {
        "texto": "1 dente de alho",
        "alimentoId": "taco:82",
        "alimentoNome": "Alho, cru",
        "fonte": "taco",
        "gramas": 5
      },
      {
        "texto": "2 colheres de chá de azeite",
        "alimentoId": "taco:260",
        "alimentoNome": "Azeite, de oliva, extra virgem",
        "fonte": "taco",
        "gramas": 10
      }
    ],
    "preparo": [
      "Doure o frango no azeite e reserve.",
      "Na mesma panela, refogue cebola e alho.",
      "Junte a cenoura, depois a abobrinha, por 5 minutos.",
      "Volte o frango, acerte o sal e sirva."
    ],
    "dica": "Rende 2 porções: uma vai para a marmita de amanhã.",
    "numeros": {
      "total": {
        "energia_kcal": 468.5,
        "proteina": 56.3,
        "carboidrato": 21.0,
        "lipideos": 17.7,
        "fibra_alimentar": 7.0
      },
      "faltando": {},
      "fontes": [
        "taco"
      ],
      "calculadoEm": "2026-11-18T12:00:00.000Z"
    },
    "publicada": true,
    "atualizadoEm": "2026-11-18T12:00:00.000Z"
  },
  {
    "id": "receita-demo-4",
    "titulo": "Banana amassada com aveia e canela",
    "categoria": "doce",
    "minutos": 5,
    "porcoes": 1,
    "tags": [
      "Rápida",
      "Sem lactose"
    ],
    "ingredientes": [
      {
        "texto": "1 banana prata grande",
        "alimentoId": "taco:182",
        "alimentoNome": "Banana, prata, crua",
        "fonte": "taco",
        "gramas": 100
      },
      {
        "texto": "1 colher de sopa de aveia em flocos",
        "alimentoId": "taco:7",
        "alimentoNome": "Aveia, flocos, crua",
        "fonte": "taco",
        "gramas": 15
      },
      {
        "texto": "Canela em pó a gosto (não entra na conta)",
        "alimentoId": null,
        "alimentoNome": null,
        "fonte": null,
        "gramas": null
      }
    ],
    "preparo": [
      "Amasse a banana com um garfo.",
      "Misture a aveia.",
      "Polvilhe canela e leve 30 segundos ao micro-ondas, se quiser morna."
    ],
    "dica": "Fica ótima gelada, como sobremesa.",
    "numeros": {
      "total": {
        "energia_kcal": 157.3,
        "proteina": 3.4,
        "carboidrato": 36.0,
        "lipideos": 1.3,
        "fibra_alimentar": 3.4
      },
      "faltando": {},
      "fontes": [
        "taco"
      ],
      "calculadoEm": "2026-11-18T12:00:00.000Z"
    },
    "publicada": true,
    "atualizadoEm": "2026-11-18T12:00:00.000Z"
  }
];
