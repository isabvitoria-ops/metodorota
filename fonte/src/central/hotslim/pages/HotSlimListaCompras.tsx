export function HotSlimListaCompras() {
  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo hs-titulo-gradient">🛒 Lista de Compras</h1>
        <p className="hs-texto">O que levar do supermercado para o desafio</p>
      </div>

      <div className="hs-dica">
        <strong>💡 Dica:</strong> Leia sempre os ingredientes dos produtos! Se tiver mais de 5 ingredientes ou nomes que você não reconhece, devolva pra prateleira.
      </div>

      {/* Proteínas */}
      <details className="hs-accordion" open>
        <summary>🥩 Proteínas</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🍗 Frango (peito, coxa, sobrecoxa)</span>
            <span className="hs-alimento">🐟 Peixe (tilápia, salmão, atum em lata ao natural)</span>
            <span className="hs-alimento">🥚 Ovos</span>
            <span className="hs-alimento">🥩 Carne bovina magra (patinho, alcatra, músculo)</span>
            <span className="hs-alimento">🐖 Carne suína (lombo)</span>
          </div>
        </div>
      </details>

      {/* Carboidratos */}
      <details className="hs-accordion">
        <summary>🍚 Carboidratos</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🍚 Arroz branco ou integral</span>
            <span className="hs-alimento">🥔 Batata inglesa</span>
            <span className="hs-alimento">🫘 Aipim / mandioca</span>
            <span className="hs-alimento">🌽 Cuscuz de milho</span>
            <span className="hs-alimento">🫓 Tapioca (goma)</span>
            <span className="hs-alimento">🍜 Macarrão de arroz</span>
          </div>
        </div>
      </details>

      {/* Gorduras boas */}
      <details className="hs-accordion">
        <summary>🥑 Gorduras boas</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🫒 Azeite de oliva extravirgem</span>
            <span className="hs-alimento">🥥 Óleo de coco</span>
            <span className="hs-alimento">🧈 Manteiga ghee</span>
          </div>
        </div>
      </details>

      {/* Vegetais */}
      <details className="hs-accordion">
        <summary>🥬 Vegetais</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🥒 Abobrinha</span>
            <span className="hs-alimento">🥕 Cenoura</span>
            <span className="hs-alimento">🟢 Chuchu</span>
            <span className="hs-alimento">🫛 Vagem</span>
            <span className="hs-alimento">🥒 Pepino</span>
            <span className="hs-alimento">🟣 Beterraba</span>
            <span className="hs-alimento">🎃 Abóbora</span>
            <span className="hs-alimento">🍅 Tomate (sem semente e sem casca)</span>
          </div>
        </div>
      </details>

      {/* Frutas */}
      <details className="hs-accordion">
        <summary>🍌 Frutas (permitidas no GUTCODE)</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🍌 Banana</span>
            <span className="hs-alimento">🍎 Maçã (sem casca)</span>
            <span className="hs-alimento">🍓 Morango</span>
            <span className="hs-alimento">🍈 Melão</span>
            <span className="hs-alimento">🥝 Kiwi</span>
            <span className="hs-alimento">🥭 Mamão</span>
          </div>
        </div>
      </details>

      {/* Temperos e ervas */}
      <details className="hs-accordion">
        <summary>🌿 Temperos e ervas</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🧂 Sal</span>
            <span className="hs-alimento">🫚 Pimenta-do-reino</span>
            <span className="hs-alimento">🌿 Salsinha, coentro</span>
            <span className="hs-alimento">🌱 Manjericão</span>
            <span className="hs-alimento">🟡 Cúrcuma</span>
            <span className="hs-alimento">🫚 Gengibre</span>
            <span className="hs-alimento">🍋 Limão</span>
          </div>
        </div>
      </details>

      {/* Extras */}
      <details className="hs-accordion">
        <summary>☕ Extras</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">☕ Café (coado, moderado)</span>
            <span className="hs-alimento">🍵 Chás (camomila, erva-doce, hortelã)</span>
            <span className="hs-alimento">🥥 Água de coco (sem açúcar)</span>
          </div>
        </div>
      </details>

      {/* Dicas no supermercado */}
      <div className="hs-secao" style={{ marginTop: 28 }}>
        <h2 className="hs-secao-titulo">🏪 Dicas no Supermercado</h2>

        <div className="hs-regra">
          <span>🥦</span>
          <span>Comece pelas frutas e vegetais — isso ocupa o carrinho de coisas boas primeiro</span>
        </div>
        <div className="hs-regra">
          <span>🚫</span>
          <span>Evite corredores de biscoitos, salgadinhos e doces — se não comprar, não come</span>
        </div>
        <div className="hs-regra">
          <span>📋</span>
          <span>Prefira produtos com lista de ingredientes curta e legível</span>
        </div>
        <div className="hs-regra">
          <span>📝</span>
          <span>Leve uma lista e siga ela — supermercado com fome é cilada 🔥</span>
        </div>
      </div>
    </div>
  );
}
