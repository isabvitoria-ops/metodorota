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

      <details className="hs-accordion" open>
        <summary>Proteínas</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Frango (peito, coxa, sobrecoxa)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Peixe (tilápia, salmão, atum em lata ao natural)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Ovos</span>
            <span className="c-chip" style={{ cursor: "default" }}>Carne bovina magra (patinho, alcatra, músculo)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Carne suína (lombo)</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Carboidratos</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Arroz branco ou integral</span>
            <span className="c-chip" style={{ cursor: "default" }}>Batata inglesa</span>
            <span className="c-chip" style={{ cursor: "default" }}>Aipim / mandioca</span>
            <span className="c-chip" style={{ cursor: "default" }}>Cuscuz de milho</span>
            <span className="c-chip" style={{ cursor: "default" }}>Tapioca (goma)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Macarrão de arroz</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Gorduras boas</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Azeite de oliva extravirgem</span>
            <span className="c-chip" style={{ cursor: "default" }}>Óleo de coco</span>
            <span className="c-chip" style={{ cursor: "default" }}>Manteiga ghee</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Vegetais</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Abobrinha</span>
            <span className="c-chip" style={{ cursor: "default" }}>Cenoura</span>
            <span className="c-chip" style={{ cursor: "default" }}>Chuchu</span>
            <span className="c-chip" style={{ cursor: "default" }}>Vagem</span>
            <span className="c-chip" style={{ cursor: "default" }}>Pepino</span>
            <span className="c-chip" style={{ cursor: "default" }}>Beterraba</span>
            <span className="c-chip" style={{ cursor: "default" }}>Abóbora</span>
            <span className="c-chip" style={{ cursor: "default" }}>Tomate (sem semente e sem casca)</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Frutas (permitidas na fase de repouso)</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Banana</span>
            <span className="c-chip" style={{ cursor: "default" }}>Maçã (sem casca)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Morango</span>
            <span className="c-chip" style={{ cursor: "default" }}>Melão</span>
            <span className="c-chip" style={{ cursor: "default" }}>Kiwi</span>
            <span className="c-chip" style={{ cursor: "default" }}>Mamão</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Temperos e ervas</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Sal</span>
            <span className="c-chip" style={{ cursor: "default" }}>Pimenta-do-reino</span>
            <span className="c-chip" style={{ cursor: "default" }}>Salsinha, coentro</span>
            <span className="c-chip" style={{ cursor: "default" }}>Manjericão</span>
            <span className="c-chip" style={{ cursor: "default" }}>Cúrcuma</span>
            <span className="c-chip" style={{ cursor: "default" }}>Gengibre</span>
            <span className="c-chip" style={{ cursor: "default" }}>Limão</span>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Extras</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            <span className="c-chip" style={{ cursor: "default" }}>Café (coado, moderado)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Chás (camomila, erva-doce, hortelã)</span>
            <span className="c-chip" style={{ cursor: "default" }}>Água de coco (sem açúcar)</span>
          </div>
        </div>
      </details>

      <div className="c-secao" style={{ marginTop: 28 }}>
        <h2 className="c-secao-titulo">Dicas no Supermercado</h2>

        <div className="hs-regra"><span className="hs-regra-num">1</span><span>Comece pelas frutas e vegetais — isso ocupa o carrinho de coisas boas primeiro</span></div>
        <div className="hs-regra"><span className="hs-regra-num">2</span><span>Evite corredores de biscoitos, salgadinhos e doces — se não comprar, não come</span></div>
        <div className="hs-regra"><span className="hs-regra-num">3</span><span>Prefira produtos com lista de ingredientes curta e legível</span></div>
        <div className="hs-regra"><span className="hs-regra-num">4</span><span>Leve uma lista e siga ela — supermercado com fome é cilada</span></div>
      </div>
    </div>
  );
}
