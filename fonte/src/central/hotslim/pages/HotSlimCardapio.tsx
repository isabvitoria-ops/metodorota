import { useState } from "react";

interface Opcao {
  nome: string;
  itens: string;
}

interface Refeicao {
  emoji: string;
  titulo: string;
  opcoes: Opcao[];
}

const REFEICOES: Refeicao[] = [
  {
    emoji: "☀️",
    titulo: "Café da Manhã",
    opcoes: [
      { nome: "Opção 1", itens: "2 ovos mexidos + tapioca + banana" },
      { nome: "Opção 2", itens: "Omelete com salsinha + cuscuz + mamão" },
      { nome: "Opção 3", itens: "Ovo cozido + batata inglesa cozida amassada + morango" },
    ],
  },
  {
    emoji: "🌞",
    titulo: "Almoço",
    opcoes: [
      { nome: "Opção 1", itens: "Frango grelhado + arroz + abobrinha refogada + azeite" },
      { nome: "Opção 2", itens: "Peixe assado + batata cozida + cenoura no vapor + azeite" },
      { nome: "Opção 3", itens: "Frango desfiado + arroz + chuchu cozido + azeite" },
    ],
  },
  {
    emoji: "🌅",
    titulo: "Lanche da Tarde",
    opcoes: [
      { nome: "Opção 1", itens: "Banana + ovo cozido" },
      { nome: "Opção 2", itens: "Maçã sem casca + tapioca com ovo" },
      { nome: "Opção 3", itens: "Mamão + cuscuz com ovo" },
    ],
  },
  {
    emoji: "🌙",
    titulo: "Jantar",
    opcoes: [
      { nome: "Opção 1", itens: "Frango desfiado + abóbora assada + azeite" },
      { nome: "Opção 2", itens: "Omelete + vagem no vapor + azeite" },
      { nome: "Opção 3", itens: "Peixe grelhado + cenoura + pepino (se tolerar cru)" },
    ],
  },
];

const PODE_USAR = [
  { emoji: "🐟", nome: "Atum em lata (natural)" },
  { emoji: "🍜", nome: "Macarrão de arroz" },
  { emoji: "🫓", nome: "Tapioca" },
  { emoji: "🌽", nome: "Cuscuz" },
  { emoji: "🧈", nome: "Ghee" },
];

const EVITAR = [
  { emoji: "🥛", nome: "Leite e derivados" },
  { emoji: "🍞", nome: "Glúten (pão, macarrão, bolos)" },
  { emoji: "🍬", nome: "Açúcar refinado" },
  { emoji: "🚫", nome: "Ultraprocessados" },
  { emoji: "🥤", nome: "Refrigerante" },
  { emoji: "🍷", nome: "Álcool" },
  { emoji: "⚠️", nome: "Adoçante artificial" },
];

export function HotSlimCardapio() {
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(REFEICOES.map((_, i) => i)));

  function alternar(idx: number) {
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx);
      else novo.add(idx);
      return novo;
    });
  }

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">🍽️ Cardápio Sugestivo</h1>
        <p className="hs-texto">Ideias de refeições para a fase de repouso digestivo (GUTCODE)</p>
      </div>

      <div className="hs-dica">
        <strong>💡 Dica:</strong> Estas são sugestões — adapte ao seu gosto e ao que tiver disponível. O importante é respeitar as regras do protocolo GUTCODE.
      </div>

      {REFEICOES.map((ref, i) => (
        <div className="hs-refeicao" key={i}>
          <div className="hs-refeicao-header" onClick={() => alternar(i)}>
            <span>{ref.emoji}</span>
            <span>{ref.titulo}</span>
            <span style={{ marginLeft: "auto", color: "var(--hs-fg-soft)", fontSize: 14 }}>
              {abertos.has(i) ? "▾" : "▸"}
            </span>
          </div>
          {abertos.has(i) && (
            <div className="hs-refeicao-body">
              <div className="hs-card-grid" style={{ gap: 8 }}>
                {ref.opcoes.map((op, j) => (
                  <div className="hs-card-sm" key={j}>
                    <div className="hs-label" style={{ marginBottom: 4 }}>{op.nome}</div>
                    <div style={{ fontSize: 14 }}>{op.itens}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="hs-divider" />

      <div className="hs-secao">
        <h2 className="hs-secao-titulo">✅ Pode usar!</h2>
        <div className="hs-alimentos">
          {PODE_USAR.map((item) => (
            <span className="hs-alimento" key={item.nome}>
              {item.emoji} {item.nome}
            </span>
          ))}
        </div>
      </div>

      <div className="hs-secao">
        <h2 className="hs-secao-titulo">🚫 Evitar durante o GUTCODE</h2>
        <div className="hs-alimentos">
          {EVITAR.map((item) => (
            <span className="hs-alimento" key={item.nome} style={{ borderColor: "var(--hs-accent)", opacity: 0.85 }}>
              {item.emoji} {item.nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
