export function HotSlimProtocolo() {
  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo">Método Rota</h1>
      <p className="hs-texto">Repouso digestivo — 6 dias</p>

      <div className="hs-dica" style={{ marginTop: 16 }}>
        <strong>Importante:</strong> Este protocolo é a base do Método Rota. Siga com atenção
        durante os 6 primeiros dias — é o período mais importante para o seu intestino se recuperar.
      </div>

      <p className="hs-texto" style={{ marginTop: 16 }}>
        São 6 dias de repouso digestivo. Durante esse período, você consome apenas alimentos de
        fácil digestão para permitir que o intestino se regenere. Depois, começa a reintrodução
        guiada dos alimentos, semana a semana.
      </p>

      <details className="hs-accordion" open>
        <summary>Como funciona</summary>
        <div className="hs-accordion-body">
          <ul className="hs-lista">
            <li><span className="hs-lista-num">1</span><span>6 dias de repouso digestivo completo</span></li>
            <li><span className="hs-lista-num">2</span><span>4 refeições por dia: café, almoço, lanche e jantar</span></li>
            <li><span className="hs-lista-num">3</span><span><strong>Sem beliscar</strong> entre refeições</span></li>
            <li><span className="hs-lista-num">4</span><span>Cafeína limitada a 150mg/dia (1 xícara de café coado)</span></li>
            <li><span className="hs-lista-num">5</span><span>Preferir alimentos cozidos, assados ou na airfryer</span></li>
            <li><span className="hs-lista-num">6</span><span>Evitar crus nos primeiros dias</span></li>
          </ul>
        </div>
      </details>

      <details className="hs-accordion" open>
        <summary>Montando suas refeições</summary>
        <div className="hs-accordion-body">
          <div className="c-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Café da manhã</div>
            <p className="hs-texto">Proteína (ovo) + carboidrato (tapioca, cuscuz) + fruta permitida</p>
          </div>
          <div className="c-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Almoço e Jantar</div>
            <p className="hs-texto">1 proteína + 1 carboidrato + vegetais + gordura boa (azeite)</p>
          </div>
          <div className="c-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Lanche</div>
            <p className="hs-texto">Fruta permitida + proteína leve</p>
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Temperos permitidos</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            {["Sal", "Pimenta-do-reino", "Salsinha", "Coentro", "Manjericão", "Alecrim",
              "Hortelã", "Orégano", "Páprica", "Cominho", "Azeite extravirgem",
              "Limão / Lima", "Cúrcuma", "Gengibre",
            ].map((t) => (
              <span key={t} className="c-chip" style={{ cursor: "default" }}>{t}</span>
            ))}
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Temperos proibidos</summary>
        <div className="hs-accordion-body">
          <div className="c-chips">
            {["Alho", "Cebola", "Alho-poró", "Cebolinha", "Temperos prontos / industrializados",
              "Shoyu / molho de soja", "Ketchup", "Mostarda", "Maionese", "Molhos prontos",
              "Caldos de carne / galinha em cubo", "Pimenta em conserva",
            ].map((t) => (
              <span
                key={t}
                className="c-chip"
                style={{ cursor: "default", borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </details>

      <details className="hs-accordion" open>
        <summary>Regras de ouro</summary>
        <div className="hs-accordion-body">
          <div className="hs-regra"><span className="hs-regra-num">1</span><span>Não belisque entre refeições — respeite as 4 janelas alimentares.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">2</span><span>Cafeína ≤ 150mg: prefira café coado, evite espresso duplo.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">3</span><span>Coma devagar, mastigue bem cada garfada.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">4</span><span>Pare de comer quando satisfeita, não quando estufada.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">5</span><span>Beba água entre as refeições, não durante.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">6</span><span>Durma pelo menos 7h — o intestino descansa enquanto você dorme.</span></div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Métodos de preparo</summary>
        <div className="hs-accordion-body">
          <div className="c-secao-titulo" style={{ marginTop: 0 }}>Recomendados</div>
          <div className="c-chips">
            {["Cozido", "Assado", "Grelhado", "Airfryer", "Vapor"].map((m) => (
              <span key={m} className="c-chip" style={{ cursor: "default" }}>{m}</span>
            ))}
          </div>
          <div className="c-secao-titulo" style={{ marginTop: 16 }}>Evitar</div>
          <div className="c-chips">
            {["Frituras", "Empanados", "Refogados pesados"].map((m) => (
              <span
                key={m}
                className="c-chip"
                style={{ cursor: "default", borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
