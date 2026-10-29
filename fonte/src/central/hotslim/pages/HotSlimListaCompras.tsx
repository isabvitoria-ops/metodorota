interface SecaoLista {
  titulo: string;
  itens: string[];
}

const SECOES: SecaoLista[] = [
  {
    titulo: "Proteínas",
    itens: [
      "Frango (peito ou sobrecoxa sem pele)",
      "Peixes variados (tilápia, salmão, merluza…)",
      "Frutos do mar (camarão, polvo, lula…)",
      "Ovos",
      "Atum em lata (ao natural)",
    ],
  },
  {
    titulo: "Carboidratos",
    itens: [
      "Arroz branco ou integral",
      "Batata inglesa",
      "Batata baroa",
      "Mandioca / Aipim",
      "Macarrão de arroz",
      "Abóbora cabotiá",
      "Quinoa",
      "Milho",
      "Tapioca (goma)",
      "Flocão de milho",
      "Biscoito de arroz",
      "Milho para pipoca",
    ],
  },
  {
    titulo: "Legumes (para cozinhar)",
    itens: [
      "Abobrinha",
      "Berinjela",
      "Cenoura",
      "Tomate",
      "Pimentão",
      "Couve ou Espinafre",
    ],
  },
  {
    titulo: "Frutas",
    itens: [
      "Banana",
      "Morango",
      "Uva",
      "Maçã",
      "Mamão",
      "Melão",
      "Laranja",
      "Abacaxi",
      "Kiwi",
      "Mexerica",
      "Blueberry / Mirtilo",
      "Framboesa",
      "Maracujá",
      "Limão",
    ],
  },
  {
    titulo: "Gorduras e extras para lanche",
    itens: [
      "Azeite de oliva extravirgem",
      "Pasta de amendoim (só amendoim)",
      "Chia",
      "Colágeno",
      "Bebida vegetal de amêndoas",
      "Granola low carb ou Mix de nuts (sem castanha de caju/pistache)",
      "Geleia 100% fruta",
    ],
  },
  {
    titulo: "Temperos",
    itens: [
      "Sal",
      "Cúrcuma / Açafrão",
      "Orégano",
      "Manjericão",
      "Alecrim",
      "Cominho",
      "Salsinha e Coentro",
      "Pimenta-do-reino",
      "Pimenta calabresa",
      "Gengibre",
      "Limão",
      "Vinagre de arroz ou maçã",
    ],
  },
  {
    titulo: "Extras",
    itens: [
      "Cacau 100%",
      "Canela em pó",
      "Levedura Nutricional",
      "Chás (camomila, hortelã, erva-doce, gengibre, capim-limão, boldo)",
    ],
  },
];

const DICAS = [
  "Comece pelas frutas e vegetais — isso ocupa o carrinho de coisas boas primeiro",
  "Evite corredores de biscoitos, salgadinhos e doces — se não comprar, não come",
  "Prefira produtos com lista de ingredientes curta e legível",
  "Leve uma lista e siga ela — supermercado com fome é cilada",
];

export function HotSlimListaCompras() {
  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Lista de Compras</h1>
        <p className="hs-texto">O que levar do supermercado para a Etapa 1</p>
      </div>

      <div className="hs-dica">
        <strong>Dica:</strong> Leia sempre os ingredientes dos produtos! Se tiver mais de 5
        ingredientes ou nomes que você não reconhece, devolva pra prateleira.
      </div>

      {SECOES.map((secao) => (
        <div className="hs-list-section" key={secao.titulo}>
          <div className="hs-list-header">{secao.titulo}</div>
          <div className="hs-list-card">
            {secao.itens.map((item) => (
              <div className="hs-list-item static" key={item}>
                <span className="hs-list-item-name">{item}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="hs-list-section">
        <div className="hs-list-header">Dicas no Supermercado</div>
        <div className="hs-list-card">
          {DICAS.map((dica, i) => (
            <div className="hs-list-item static" key={i}>
              <span className="hs-regra-num" style={{ width: 20, height: 20, fontSize: 11 }}>{i + 1}</span>
              <span className="hs-list-item-name">{dica}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
