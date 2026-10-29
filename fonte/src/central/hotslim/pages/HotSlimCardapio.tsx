import { useState } from "react";

type Secao = "alimentos" | "sugestoes";

const CARBOIDRATOS = [
  { nome: "Arroz branco", porcao: "100g (4 col. sopa)" },
  { nome: "Batata inglesa", porcao: "145g (1 unid. média)" },
  { nome: "Batata-doce", porcao: "100g (1 unid. pequena)" },
  { nome: "Inhame / Cará", porcao: "100g" },
  { nome: "Mandioca / Aipim", porcao: "100g" },
  { nome: "Tapioca", porcao: "50g (2 col. sopa)" },
  { nome: "Cuscuz de milho", porcao: "90g" },
  { nome: "Macarrão de arroz", porcao: "80g (seco)" },
  { nome: "Abóbora / Moranga", porcao: "150g" },
];

const PROTEINAS = [
  { nome: "Frango (peito ou coxa)", porcao: "120g" },
  { nome: "Peixe branco (tilápia, merluza)", porcao: "120g" },
  { nome: "Salmão", porcao: "120g" },
  { nome: "Ovo", porcao: "2 unid. (100g)" },
  { nome: "Carne bovina magra (patinho, alcatra)", porcao: "120g" },
  { nome: "Atum em lata (natural)", porcao: "1 lata" },
  { nome: "Sardinha em lata", porcao: "1 lata" },
];

const VEGETAIS = [
  { nome: "Abobrinha", porcao: "à vontade" },
  { nome: "Cenoura", porcao: "à vontade" },
  { nome: "Chuchu", porcao: "à vontade" },
  { nome: "Vagem", porcao: "à vontade" },
  { nome: "Pepino", porcao: "à vontade" },
  { nome: "Espinafre", porcao: "à vontade" },
  { nome: "Alface", porcao: "à vontade" },
  { nome: "Berinjela", porcao: "à vontade" },
  { nome: "Tomate (sem sementes)", porcao: "à vontade" },
  { nome: "Broto de feijão", porcao: "à vontade" },
];

const ACRESCENTAR = [
  { nome: "Azeite extravirgem", porcao: "5–10ml (1 col. sopa)" },
  { nome: "Ghee (manteiga clarificada)", porcao: "5g" },
  { nome: "Óleo de coco", porcao: "5ml" },
  { nome: "Sal, pimenta-do-reino" },
  { nome: "Ervas frescas e secas" },
];

const FRUTAS = [
  { nome: "Banana", porcao: "1 unid. média (70g)" },
  { nome: "Morango", porcao: "8 unid. (115g)" },
  { nome: "Mamão papaia", porcao: "½ unid. (170g)" },
  { nome: "Maçã sem casca", porcao: "½ unid. (80g)" },
  { nome: "Melão", porcao: "1 fatia (150g)" },
  { nome: "Uva", porcao: "10 unid. (100g)" },
  { nome: "Kiwi", porcao: "1 unid. (75g)" },
  { nome: "Laranja (sem bagaço)", porcao: "1 unid. (130g)" },
  { nome: "Abacaxi", porcao: "1 fatia (80g)" },
];

const CHAS = [
  { nome: "Hortelã", dica: "Alivia gases" },
  { nome: "Camomila", dica: "Calmante" },
  { nome: "Erva-doce", dica: "Reduz inchaço" },
  { nome: "Gengibre", dica: "Digestivo" },
  { nome: "Capim-limão", dica: "Relaxante" },
  { nome: "Boldo", dica: "Auxilia o fígado" },
];

const BEBIDAS_PROIBIDAS = [
  "Refrigerante (normal e zero)",
  "Suco de caixinha / industrializado",
  "Leite e bebidas lácteas",
  "Álcool",
  "Energéticos",
  "Café em excesso (máx. 1 xícara/dia coado)",
  "Chá mate e chá preto em excesso",
];

interface SugestaoRefeicao {
  titulo: string;
  opcoes: string[];
}

const SUGESTOES: SugestaoRefeicao[] = [
  {
    titulo: "Café da Manhã",
    opcoes: [
      "2 ovos mexidos + tapioca (50g) + banana (70g)",
      "Omelete com salsinha + cuscuz (90g) + mamão (170g)",
      "Ovo cozido + batata inglesa amassada (145g) + morango (115g)",
    ],
  },
  {
    titulo: "Almoço",
    opcoes: [
      "Frango grelhado (120g) + arroz (100g) + abobrinha refogada + azeite",
      "Peixe assado (120g) + batata cozida (145g) + cenoura no vapor + azeite",
      "Carne magra (120g) + arroz (100g) + chuchu cozido + azeite",
    ],
  },
  {
    titulo: "Lanche da Tarde",
    opcoes: [
      "Banana (70g) + ovo cozido",
      "Maçã sem casca (80g) + tapioca com ovo",
      "Mamão (170g) + cuscuz com ovo",
    ],
  },
  {
    titulo: "Jantar",
    opcoes: [
      "Frango desfiado (120g) + abóbora assada + azeite",
      "Omelete (100g) + vagem no vapor + azeite",
      "Peixe grelhado (120g) + cenoura + pepino",
    ],
  },
];

function ListaAlimentos({ titulo, itens }: { titulo: string; itens: { nome: string; porcao?: string }[] }) {
  return (
    <div className="hs-list-section">
      <div className="hs-list-header">{titulo}</div>
      <div className="hs-list-card">
        {itens.map((item) => (
          <div key={item.nome} className="hs-list-item static">
            <span className="hs-list-item-name">{item.nome}</span>
            {item.porcao && <span className="hs-list-item-detail">{item.porcao}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HotSlimCardapio() {
  const [secao, setSecao] = useState<Secao>("alimentos");

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Cardápio — Etapa 1</h1>
        <p className="hs-texto">Alimentos permitidos durante o repouso digestivo (dias 1–6)</p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setSecao("alimentos")}
          className={`hs-btn ${secao === "alimentos" ? "hs-btn-accent" : "hs-btn-outline"}`}
          style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
        >
          Alimentos
        </button>
        <button
          onClick={() => setSecao("sugestoes")}
          className={`hs-btn ${secao === "sugestoes" ? "hs-btn-accent" : "hs-btn-outline"}`}
          style={{ flex: 1, padding: "10px 12px", fontSize: 13 }}
        >
          Ideias de montagem
        </button>
      </div>

      {secao === "alimentos" ? (
        <>
          <ListaAlimentos titulo="Carboidratos" itens={CARBOIDRATOS} />
          <ListaAlimentos titulo="Proteínas" itens={PROTEINAS} />
          <ListaAlimentos titulo="Vegetais" itens={VEGETAIS} />
          <ListaAlimentos titulo="Pode acrescentar" itens={ACRESCENTAR} />
          <ListaAlimentos titulo="Frutas permitidas" itens={FRUTAS} />

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
            <strong>Aveia:</strong> Se não contiver glúten (aveia certificada sem glúten), pode usar em pequena
            quantidade. Na dúvida, evite — a maioria das aveias tem contaminação cruzada.
          </div>

          <div className="hs-dica">
            <strong>Leite vegetal:</strong> Leite de coco e de arroz são permitidos.
            Evite leite de soja, amêndoas e castanhas durante o repouso.
          </div>
        </>
      ) : (
        <>
          <p className="hs-texto" style={{ marginBottom: 16 }}>
            Monte suas refeições combinando alimentos da lista. Estas são apenas sugestões —
            você pode variar como preferir dentro do que é permitido.
          </p>
          {SUGESTOES.map((ref, i) => (
            <details className="hs-accordion" key={i} open>
              <summary>{ref.titulo}</summary>
              <div className="hs-accordion-body">
                <div className="hs-list-card" style={{ border: "none" }}>
                  {ref.opcoes.map((op, j) => (
                    <div className="hs-list-item static" key={j}>
                      <span className="hs-label" style={{ flexShrink: 0 }}>Opção {j + 1}</span>
                      <span className="hs-list-item-name" style={{ fontSize: 14 }}>{op}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}

          <div className="hs-dica" style={{ marginTop: 16 }}>
            <strong>Dica:</strong> Prepare tudo com os temperos permitidos (veja a aba Método).
            Use azeite para finalizar, não para fritar.
          </div>
        </>
      )}
    </div>
  );
}
