import { useState } from "react";

type Secao = "refeicoes" | "listas";

/* ═══════════════════════════════════════════════════════
   CAFÉ DA MANHÃ
   ═══════════════════════════════════════════════════════ */

const CAFE_CARBS = [
  "Biscoito de arroz",
  "Tapioca",
  "Flocão de milho",
  "Frutas (conferir lista)",
  "Geleia 100% fruta",
];

const CAFE_PROTEINAS = [
  "Ovo",
  "Peito de frango",
  "Atum",
  "Colágeno",
  "Bebida vegetal (amêndoas)",
];

const CAFE_ACRESCENTAR = [
  "Tomate",
  "Espinafre ou Couve",
  "Levedura Nutricional",
  "Temperos permitidos",
];

const CAFE_SUGESTOES = [
  "Biscoito de arroz + Ovos mexidos com tomate + Fruta",
  "Crepioca (ovos + tapioca) + Fruta",
  "Bolinho ou panqueca de cuscuz (ovos + flocão de milho) + Fruta",
  "Biscoito de arroz + Geleia 100% + Bebida vegetal com Colágeno",
  "Tapioca recheada com frango ou atum + Fruta",
  "Biscoito de arroz + Frango com tomate + Fruta",
  "Tapioca + Ovos com couve ou espinafre + Fruta",
];

/* ═══════════════════════════════════════════════════════
   ALMOÇO E JANTAR
   ═══════════════════════════════════════════════════════ */

const ALMOCO_CARBS = [
  "Arroz branco ou integral",
  "Batata inglesa",
  "Batata baroa",
  "Mandioca",
  "Macarrão de arroz",
  "Abóbora cabotiá",
  "Quinoa",
  "Milho",
];

const ALMOCO_PROTEINAS = [
  "Frango (peito ou sobrecoxa sem pele)",
  "Peixes (todos os tipos)",
  "Frutos do mar (camarão, polvo, lula…)",
];

const ALMOCO_LEGUMES = [
  "Abobrinha",
  "Berinjela",
  "Cenoura",
  "Tomate",
  "Pimentão",
  "Couve ou Espinafre",
];

const ALMOCO_SUGESTOES = [
  "Frango grelhado + Arroz + Abobrinha refogada + Azeite",
  "Peixe assado + Batata inglesa cozida + Cenoura no vapor + Azeite",
  "Frutos do mar + Macarrão de arroz + Tomate cozido + Azeite",
  "Frango + Quinoa + Espinafre refogado + Azeite",
  "Peixe grelhado + Abóbora assada + Pimentão cozido + Azeite",
];

/* ═══════════════════════════════════════════════════════
   LANCHE DA TARDE
   ═══════════════════════════════════════════════════════ */

const LANCHE_CARBS = [
  "Frutas (conferir lista)",
  "Milho para pipoca",
  "Tapioca",
  "Biscoito de arroz",
  "Flocão de milho",
  "Geleia 100% fruta",
];

const LANCHE_PROTEINAS = [
  "Colágeno",
  "Chia",
  "Pasta de amendoim (só amendoim)",
  "Granola low carb ou Mix de nuts (sem castanha de caju ou pistache)",
  "Ovo",
  "Bebida vegetal (amêndoas)",
  "Peito de frango",
  "Atum",
];

const LANCHE_ACRESCENTAR = [
  "Canela em pó",
  "Cacau 100%",
  "Tomate",
  "Levedura Nutricional",
];

const LANCHE_SUGESTOES = [
  "Pipoca + Creminho de colágeno com cacau, uva e granola low carb",
  "Panqueca ou bolinho de banana (ovo + banana + cacau + canela) — sem fermento",
  "Overnight (bebida de amêndoas + chia + maçã cozida com canela + pasta de amendoim)",
  "Smoothie (fruta congelada + bebida vegetal + colágeno) com granola ou pasta de amendoim",
];

/* ═══════════════════════════════════════════════════════
   FRUTAS PERMITIDAS
   ═══════════════════════════════════════════════════════ */

const FRUTAS = [
  { nome: "Abacaxi", porcao: "160g" },
  { nome: "Banana", porcao: "1 unid. (80g)" },
  { nome: "Blueberry / Mirtilo", porcao: "140g" },
  { nome: "Framboesa", porcao: "120g" },
  { nome: "Kiwi", porcao: "2 unid. (180g)" },
  { nome: "Laranja", porcao: "1 unid. (200g)" },
  { nome: "Limão", porcao: "livre (para temperar)" },
  { nome: "Maçã (sem casca ou cozida)", porcao: "1 unid. (130g)" },
  { nome: "Mamão", porcao: "200g" },
  { nome: "Maracujá", porcao: "130g" },
  { nome: "Melão", porcao: "270g" },
  { nome: "Mexerica", porcao: "1 unid. (140g)" },
  { nome: "Morango", porcao: "300g" },
  { nome: "Uva", porcao: "150g" },
];

/* ═══════════════════════════════════════════════════════
   CHÁS, TEMPEROS, BEBIDAS
   ═══════════════════════════════════════════════════════ */

const CHAS = [
  { nome: "Hortelã", dica: "Alivia gases" },
  { nome: "Camomila", dica: "Calmante" },
  { nome: "Erva-doce", dica: "Reduz inchaço" },
  { nome: "Gengibre", dica: "Digestivo" },
  { nome: "Capim-limão", dica: "Relaxante" },
  { nome: "Boldo", dica: "Auxilia o fígado" },
];

const TEMPEROS_LIBERADOS = [
  "Sal", "Cúrcuma", "Açafrão", "Páprica doce e picante",
  "Orégano", "Manjericão", "Alecrim", "Cominho", "Coentro",
  "Salsinha", "Sálvia", "Hortelã", "Curry (sem farinha de trigo)",
  "Pimenta-do-reino", "Pimenta calabresa", "Gengibre", "Limão",
  "Vinagre de arroz e maçã (puro)",
];

const TEMPEROS_PROIBIDOS = [
  "Alho", "Cebola", "Cebolinha", "Alho-poró",
  "Páprica defumada", "Fumaça / defumados", "Manteiga",
  "Temperos prontos industrializados",
];

const BEBIDAS_PROIBIDAS = [
  "Água com gás",
  "Café (mais de 100mg por dia)",
  "Chás prontos (garrafa) — comum e zero",
  "Refrigerante — comum e zero",
  "Qualquer bebida alcoólica",
  "Água de coco (FODMAPs)",
  "Água tônica — comum e zero",
];

/* ═══════════════════════════════════════════════════════
   COMPONENTES
   ═══════════════════════════════════════════════════════ */

function ListaNomes({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="hs-list-section">
      <div className="hs-list-header">{titulo}</div>
      <div className="hs-list-card">
        {itens.map((item) => (
          <div key={item} className="hs-list-item static">
            <span className="hs-list-item-name">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sugestoes({ opcoes }: { opcoes: string[] }) {
  return (
    <div className="hs-list-section" style={{ marginTop: 8 }}>
      <div className="hs-list-header">Sugestões de montagem</div>
      <div className="hs-list-card" style={{ border: "none" }}>
        {opcoes.map((op, j) => (
          <div className="hs-list-item static" key={j}>
            <span className="hs-label" style={{ flexShrink: 0 }}>Opção {j + 1}</span>
            <span className="hs-list-item-name" style={{ fontSize: 14 }}>{op}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════ */

export function HotSlimCardapio() {
  const [secao, setSecao] = useState<Secao>("refeicoes");

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Cardápio — Etapa 1</h1>
        <p className="hs-texto">Alimentos permitidos durante o repouso digestivo (dias 1–6)</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setSecao("refeicoes")}
          className={`hs-btn ${secao === "refeicoes" ? "hs-btn-accent" : "hs-btn-outline"}`}
          style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
        >
          Refeições
        </button>
        <button
          onClick={() => setSecao("listas")}
          className={`hs-btn ${secao === "listas" ? "hs-btn-accent" : "hs-btn-outline"}`}
          style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
        >
          Listas de referência
        </button>
      </div>

      {secao === "refeicoes" ? (
        <>
          {/* ─── Café da Manhã ─── */}
          <details className="hs-accordion" open>
            <summary>Café da Manhã</summary>
            <div className="hs-accordion-body">
              <ListaNomes titulo="Carboidratos" itens={CAFE_CARBS} />
              <ListaNomes titulo="Proteínas / Gorduras" itens={CAFE_PROTEINAS} />
              <ListaNomes titulo="Pode acrescentar" itens={CAFE_ACRESCENTAR} />
              <Sugestoes opcoes={CAFE_SUGESTOES} />
            </div>
          </details>

          {/* ─── Almoço e Jantar ─── */}
          <details className="hs-accordion" open>
            <summary>Almoço e Jantar</summary>
            <div className="hs-accordion-body">
              <ListaNomes titulo="Carboidratos" itens={ALMOCO_CARBS} />
              <ListaNomes titulo="Proteínas" itens={ALMOCO_PROTEINAS} />

              <div className="hs-list-section">
                <div className="hs-list-header">Legumes — todos COZIDOS</div>
                <div className="hs-list-card">
                  {ALMOCO_LEGUMES.map((item) => (
                    <div key={item} className="hs-list-item static">
                      <span className="hs-list-item-name">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hs-dica" style={{ marginTop: 8, borderColor: "var(--hs-warn)", background: "var(--hs-warn-soft)" }}>
                <strong style={{ color: "var(--hs-warn)" }}>Importante:</strong>{" "}
                Todos os vegetais devem ser cozidos na Etapa 1. Folhas e legumes crus só na segunda etapa.
                Finalize com azeite extravirgem — use para temperar, não para fritar.
              </div>

              <Sugestoes opcoes={ALMOCO_SUGESTOES} />
            </div>
          </details>

          {/* ─── Lanche da Tarde ─── */}
          <details className="hs-accordion" open>
            <summary>Lanche da Tarde</summary>
            <div className="hs-accordion-body">
              <ListaNomes titulo="Carboidratos" itens={LANCHE_CARBS} />
              <ListaNomes titulo="Proteínas / Gorduras" itens={LANCHE_PROTEINAS} />
              <ListaNomes titulo="Pode acrescentar" itens={LANCHE_ACRESCENTAR} />
              <Sugestoes opcoes={LANCHE_SUGESTOES} />
            </div>
          </details>

          <div className="hs-dica" style={{ marginTop: 16 }}>
            <strong>Dica:</strong> Use os temperos permitidos (veja aba Listas de referência).
            Use azeite para finalizar, não para fritar.
          </div>
        </>
      ) : (
        <>
          {/* ─── Frutas Permitidas ─── */}
          <div className="hs-list-section">
            <div className="hs-list-header">Frutas permitidas</div>
            <div className="hs-list-card">
              {FRUTAS.map((f) => (
                <div key={f.nome} className="hs-list-item static">
                  <span className="hs-list-item-name">{f.nome}</span>
                  <span className="hs-list-item-detail">{f.porcao}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Chás ─── */}
          <div className="hs-dica" style={{ marginTop: 8, borderColor: "var(--hs-green)", background: "var(--hs-green-soft)" }}>
            <strong style={{ color: "var(--hs-green)" }}>Chás — tome ao longo do dia!</strong>{" "}
            Sem açúcar. Ajudam na digestão, reduzem gases e acalmam o intestino.
          </div>
          <div className="hs-list-section" style={{ marginTop: 4 }}>
            <div className="hs-list-card">
              {CHAS.map((c) => (
                <div key={c.nome} className="hs-list-item static">
                  <span className="hs-list-item-name">{c.nome}</span>
                  <span className="hs-list-item-detail">{c.dica}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Temperos Liberados ─── */}
          <div className="hs-list-section">
            <div className="hs-list-header" style={{ color: "var(--hs-green)" }}>Temperos liberados</div>
            <div className="hs-list-card">
              {TEMPEROS_LIBERADOS.map((t) => (
                <div key={t} className="hs-list-item static">
                  <span className="hs-list-item-name">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Temperos Proibidos ─── */}
          <div className="hs-list-section">
            <div className="hs-list-header" style={{ color: "var(--hs-accent-red, #c0392b)" }}>Temperos proibidos</div>
            <div className="hs-list-card">
              {TEMPEROS_PROIBIDOS.map((t) => (
                <div key={t} className="hs-list-item static evitar">
                  <span className="hs-list-item-name">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Bebidas Proibidas ─── */}
          <div className="hs-list-section">
            <div className="hs-list-header">Bebidas proibidas</div>
            <div className="hs-list-card">
              {BEBIDAS_PROIBIDAS.map((b) => (
                <div key={b} className="hs-list-item static evitar">
                  <span className="hs-list-item-name">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hs-dica" style={{ marginTop: 12 }}>
            <strong>Leite vegetal:</strong> Leite de amêndoas é permitido.
            Evite leite de soja durante o repouso.
          </div>
        </>
      )}
    </div>
  );
}
