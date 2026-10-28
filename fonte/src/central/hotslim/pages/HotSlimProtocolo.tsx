export function HotSlimProtocolo() {
  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo hs-titulo-gradient">🧬 Protocolo GUTCODE</h1>
      <p className="hs-texto">Repouso Digestivo de 6 dias</p>

      <div className="hs-dica">
        <strong>💡 Dica:</strong> Este protocolo é a base do Desafio Hot Slim. Siga com atenção
        durante os 6 primeiros dias — é o período mais importante para o seu intestino se recuperar.
      </div>

      <p className="hs-texto" style={{ marginTop: 16 }}>
        O GUTCODE é um protocolo de 6 dias de repouso digestivo. Durante esse período, você consome
        apenas alimentos de fácil digestão para permitir que o intestino se regenere. Depois, começa
        a reintrodução guiada dos alimentos, semana a semana.
      </p>

      {/* ── Como funciona ──────────────────────────────────── */}
      <details className="hs-accordion" open>
        <summary>🔥 Como funciona</summary>
        <div className="hs-accordion-body">
          <ul className="hs-lista">
            <li><span className="hs-lista-icon">🗓️</span> 6 dias de repouso digestivo completo</li>
            <li><span className="hs-lista-icon">🍽️</span> 4 refeições por dia: café, almoço, lanche e jantar</li>
            <li><span className="hs-lista-icon">🚫</span> <strong>SEM beliscar</strong> entre refeições</li>
            <li><span className="hs-lista-icon">☕</span> Cafeína limitada a 150mg/dia (≈ 1 xícara de café coado)</li>
            <li><span className="hs-lista-icon">🍳</span> Preferir alimentos cozidos, assados ou na airfryer</li>
            <li><span className="hs-lista-icon">🥗</span> Evitar crus nos primeiros dias</li>
          </ul>
        </div>
      </details>

      {/* ── Montando suas refeições ────────────────────────── */}
      <details className="hs-accordion" open>
        <summary>🍽️ Montando suas refeições</summary>
        <div className="hs-accordion-body">
          <div className="hs-card" style={{ marginBottom: 10 }}>
            <div className="hs-card-header">
              <span className="hs-emoji">☀️</span>
              <span className="hs-subtitulo" style={{ margin: 0 }}>Café da manhã</span>
            </div>
            <p className="hs-texto">Proteína (ovo) + carboidrato (tapioca, cuscuz) + fruta permitida</p>
          </div>
          <div className="hs-card" style={{ marginBottom: 10 }}>
            <div className="hs-card-header">
              <span className="hs-emoji">🥘</span>
              <span className="hs-subtitulo" style={{ margin: 0 }}>Almoço e Jantar</span>
            </div>
            <p className="hs-texto">1 proteína + 1 carboidrato + vegetais + gordura boa (azeite)</p>
          </div>
          <div className="hs-card">
            <div className="hs-card-header">
              <span className="hs-emoji">🍌</span>
              <span className="hs-subtitulo" style={{ margin: 0 }}>Lanche</span>
            </div>
            <p className="hs-texto">Fruta permitida + proteína leve</p>
          </div>
        </div>
      </details>

      {/* ── Temperos Permitidos ─────────────────────────────── */}
      <details className="hs-accordion">
        <summary>✅ Temperos Permitidos</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            <span className="hs-alimento">🧂 Sal</span>
            <span className="hs-alimento">⚫ Pimenta-do-reino</span>
            <span className="hs-alimento">🌿 Salsinha</span>
            <span className="hs-alimento">🌿 Coentro</span>
            <span className="hs-alimento">🌿 Manjericão</span>
            <span className="hs-alimento">🌿 Alecrim</span>
            <span className="hs-alimento">🌿 Hortelã</span>
            <span className="hs-alimento">🌿 Orégano</span>
            <span className="hs-alimento">🟠 Páprica</span>
            <span className="hs-alimento">🟤 Cominho</span>
            <span className="hs-alimento">🫒 Azeite extravirgem</span>
            <span className="hs-alimento">🍋 Limão / Lima</span>
            <span className="hs-alimento">🟡 Cúrcuma</span>
            <span className="hs-alimento">🫚 Gengibre</span>
          </div>
        </div>
      </details>

      {/* ── Temperos Proibidos ──────────────────────────────── */}
      <details className="hs-accordion">
        <summary>🚫 Temperos Proibidos</summary>
        <div className="hs-accordion-body">
          <div className="hs-alimentos">
            {[
              "Alho",
              "Cebola",
              "Alho-poró",
              "Cebolinha",
              "Temperos prontos / industrializados",
              "Shoyu / molho de soja",
              "Ketchup",
              "Mostarda",
              "Maionese",
              "Molhos prontos",
              "Caldos de carne / galinha em cubo",
              "Pimenta em conserva",
            ].map((t) => (
              <span
                key={t}
                className="hs-alimento"
                style={{ borderColor: "var(--hs-accent)", color: "var(--hs-accent)" }}
              >
                ❌ {t}
              </span>
            ))}
          </div>
        </div>
      </details>

      {/* ── Regras de Ouro ─────────────────────────────────── */}
      <details className="hs-accordion" open>
        <summary>⭐ Regras de Ouro</summary>
        <div className="hs-accordion-body">
          <div className="hs-regra">
            <span>🍽️</span>
            <span>Não belisque entre refeições — respeite as 4 janelas alimentares.</span>
          </div>
          <div className="hs-regra">
            <span>☕</span>
            <span>Cafeína ≤ 150mg: prefira café coado, evite espresso duplo.</span>
          </div>
          <div className="hs-regra">
            <span>🦷</span>
            <span>Coma devagar, mastigue bem cada garfada.</span>
          </div>
          <div className="hs-regra">
            <span>🛑</span>
            <span>Pare de comer quando satisfeita, não quando &ldquo;estufada&rdquo;.</span>
          </div>
          <div className="hs-regra">
            <span>💧</span>
            <span>Beba água entre as refeições, não durante.</span>
          </div>
          <div className="hs-regra">
            <span>😴</span>
            <span>Durma pelo menos 7h — o intestino descansa enquanto você dorme.</span>
          </div>
        </div>
      </details>

      {/* ── Métodos de preparo ─────────────────────────────── */}
      <details className="hs-accordion">
        <summary>👩‍🍳 Métodos de preparo</summary>
        <div className="hs-accordion-body">
          <div className="hs-secao-titulo">✅ Recomendados</div>
          <div className="hs-alimentos">
            <span className="hs-alimento">🍲 Cozido</span>
            <span className="hs-alimento">🔥 Assado</span>
            <span className="hs-alimento">♨️ Grelhado</span>
            <span className="hs-alimento">🌀 Airfryer</span>
            <span className="hs-alimento">💨 Vapor</span>
          </div>
          <div className="hs-secao-titulo" style={{ marginTop: 16 }}>❌ Evitar</div>
          <div className="hs-alimentos">
            {["Frituras", "Empanados", "Refogados pesados"].map((m) => (
              <span
                key={m}
                className="hs-alimento"
                style={{ borderColor: "var(--hs-accent)", color: "var(--hs-accent)" }}
              >
                🚫 {m}
              </span>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
