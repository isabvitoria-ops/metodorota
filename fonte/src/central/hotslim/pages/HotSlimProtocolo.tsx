export function HotSlimProtocolo() {
  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo">Método Rota</h1>
      <p className="hs-texto">Protocolo de repouso digestivo — 21 dias</p>

      <div className="hs-dica" style={{ marginTop: 16 }}>
        <strong>O que é o Método Rota?</strong> Um protocolo de 21 dias dividido em fases para
        identificar quais alimentos causam desconforto no seu intestino. Nos primeiros 6 dias
        fazemos um repouso digestivo — você consome apenas alimentos de fácil digestão para
        permitir que o intestino se regenere. Depois, começa a reintrodução guiada dos alimentos,
        semana a semana, observando como o seu corpo reage.
      </div>

      <details className="hs-accordion" open>
        <summary>Como funciona</summary>
        <div className="hs-accordion-body">
          <ul className="hs-lista">
            <li><span className="hs-lista-num">1</span><span><strong>Dias 1–6 (Repouso):</strong> Apenas alimentos de fácil digestão. Nada de FODMAPs altos, industrializados ou alimentos irritantes.</span></li>
            <li><span className="hs-lista-num">2</span><span><strong>Dias 7–14 (Teste 1):</strong> Reintrodução guiada — você testa um grupo de alimentos por vez e observa sintomas.</span></li>
            <li><span className="hs-lista-num">3</span><span><strong>Dias 15–21 (Teste 2):</strong> Continuação da reintrodução, testando os grupos restantes.</span></li>
          </ul>
          <p style={{ fontSize: 13, color: "var(--hs-fg-soft)", marginTop: 12 }}>
            O objetivo não é restringir para sempre — é descobrir o que funciona para o seu corpo.
          </p>
        </div>
      </details>

      <details className="hs-accordion" open>
        <summary>Estrutura das refeições</summary>
        <div className="hs-accordion-body">
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            São <strong>4 refeições por dia</strong>: café da manhã, almoço, lanche da tarde e jantar.
            <strong> Não belisque entre as refeições</strong> — o intestino precisa de pausas para funcionar bem.
          </p>
          <div className="c-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Café da manhã</div>
            <p className="hs-texto">Proteína (ovo) + carboidrato (tapioca, cuscuz) + fruta permitida</p>
          </div>
          <div className="c-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Almoço e Jantar</div>
            <p className="hs-texto">1 proteína + 1 carboidrato + vegetais cozidos + gordura boa (azeite)</p>
          </div>
          <div className="c-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Lanche da tarde</div>
            <p className="hs-texto">Fruta permitida + proteína leve (ovo, frango desfiado)</p>
          </div>
        </div>
      </details>

      <div className="hs-list-section" style={{ marginTop: 20 }}>
        <div className="hs-list-header">Temperos permitidos</div>
        <div className="hs-list-card">
          {["Sal", "Pimenta-do-reino", "Salsinha", "Coentro", "Manjericão", "Alecrim",
            "Hortelã", "Orégano", "Páprica", "Páprica defumada", "Cominho",
            "Azeite extravirgem", "Limão / Lima", "Cúrcuma", "Gengibre",
            "Cebolinha (parte verde)", "Louro", "Tomilho", "Noz-moscada",
            "Chimichurri caseiro (sem cebola e alho)",
          ].map((t) => (
            <div key={t} className="hs-list-item static">
              <span className="hs-list-item-name">{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hs-dica" style={{ borderColor: "var(--hs-gold)", background: "var(--hs-gold-soft)" }}>
        <strong style={{ color: "var(--hs-gold)" }}>Atenção com frutanos:</strong> Alho e cebola são
        ricos em frutanos (um tipo de FODMAP) e costumam causar gases, inchaço e desconforto.
        Durante o repouso digestivo, evite-os completamente. Eles serão reintroduzidos de forma
        controlada na fase de teste.
      </div>

      <details className="hs-accordion" open>
        <summary>Chás recomendados</summary>
        <div className="hs-accordion-body">
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Os chás são grandes aliados do protocolo. Tome ao longo do dia, sem açúcar.
            Eles ajudam na digestão, reduzem gases e acalmam o intestino.
          </p>
          <div className="hs-list-card">
            {[
              { nome: "Hortelã", dica: "Alivia gases e cólicas" },
              { nome: "Camomila", dica: "Anti-inflamatório e calmante" },
              { nome: "Erva-doce", dica: "Reduz inchaço abdominal" },
              { nome: "Gengibre", dica: "Estimula a digestão" },
              { nome: "Capim-limão", dica: "Relaxante e digestivo" },
              { nome: "Boldo", dica: "Auxilia o fígado" },
            ].map((c) => (
              <div key={c.nome} className="hs-list-item static">
                <span className="hs-list-item-name">{c.nome}</span>
                <span className="hs-list-item-detail">{c.dica}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="hs-accordion" open>
        <summary>Regras de ouro</summary>
        <div className="hs-accordion-body">
          <div className="hs-regra"><span className="hs-regra-num">1</span><span>Não belisque entre refeições — respeite as 4 janelas alimentares.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">2</span><span>Cafeína ≤ 150mg/dia: prefira café coado, evite espresso duplo.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">3</span><span>Coma devagar, mastigue bem cada garfada.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">4</span><span>Pare de comer quando satisfeita, não quando estufada.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">5</span><span>Beba água entre as refeições, não durante.</span></div>
          <div className="hs-regra"><span className="hs-regra-num">6</span><span>Durma pelo menos 7h — o intestino descansa enquanto você dorme.</span></div>
        </div>
      </details>

      <div className="hs-list-section" style={{ marginTop: 20 }}>
        <div className="hs-list-header">Métodos de preparo recomendados</div>
        <div className="hs-list-card">
          {["Cozido", "Assado", "Grelhado", "Airfryer", "Vapor"].map((m) => (
            <div key={m} className="hs-list-item static">
              <span className="hs-list-item-name">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
