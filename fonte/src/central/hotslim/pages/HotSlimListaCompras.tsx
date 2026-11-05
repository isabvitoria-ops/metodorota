interface SecaoLista {
  titulo: string;
  itens: string[];
}

const SECOES: SecaoLista[] = [
  {
    titulo: "Proteínas",
    itens: [
      "Frango (peito, coxa, sobrecoxa)",
      "Peixe (tilápia, salmão, atum em lata ao natural)",
      "Ovos",
      "Carne bovina magra (patinho, alcatra, músculo)",
      "Carne suína (lombo)",
    ],
  },
  {
    titulo: "Carboidratos",
    itens: [
      "Arroz branco ou integral",
      "Batata inglesa",
      "Aipim / mandioca",
      "Cuscuz de milho",
      "Tapioca (goma)",
      "Macarrão de arroz",
    ],
  },
  {
    titulo: "Gorduras boas",
    itens: [
      "Azeite de oliva extravirgem",
      "Óleo de coco",
      "Manteiga ghee",
    ],
  },
  {
    titulo: "Vegetais",
    itens: [
      "Abobrinha",
      "Cenoura",
      "Chuchu",
      "Vagem",
      "Pepino",
      "Beterraba",
      "Abóbora",
      "Tomate (sem semente e sem casca)",
    ],
  },
  {
    titulo: "Frutas",
    itens: [
      "Banana",
      "Maçã (sem casca)",
      "Morango",
      "Melão",
      "Kiwi",
      "Mamão",
    ],
  },
  {
    titulo: "Temperos e ervas",
    itens: [
      "Sal",
      "Pimenta-do-reino",
      "Salsinha, coentro",
      "Manjericão",
      "Cúrcuma",
      "Gengibre",
      "Limão",
    ],
  },
  {
    titulo: "Extras",
    itens: [
      "Café (coado, moderado)",
      "Chás (camomila, erva-doce, hortelã)",
      "Água de coco (sem açúcar)",
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
        <p className="hs-texto">O que levar do supermercado para o desafio</p>
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
