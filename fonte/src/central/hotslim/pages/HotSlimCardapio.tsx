import { useState } from "react";

interface Opcao {
  nome: string;
  itens: string;
}

interface Refeicao {
  titulo: string;
  opcoes: Opcao[];
}

const REFEICOES: Refeicao[] = [
  {
    titulo: "Café da Manhã",
    opcoes: [
      { nome: "Opção 1", itens: "2 ovos mexidos (100g) + tapioca (50g) + 1 banana (70g)" },
      { nome: "Opção 2", itens: "Omelete com salsinha (100g) + cuscuz (90g) + mamão (170g)" },
      { nome: "Opção 3", itens: "Ovo cozido (50g) + batata inglesa cozida amassada (145g) + morango (115g)" },
    ],
  },
  {
    titulo: "Almoço",
    opcoes: [
      { nome: "Opção 1", itens: "Frango grelhado (120g) + arroz (100g) + abobrinha refogada + azeite (5ml)" },
      { nome: "Opção 2", itens: "Peixe assado (120g) + batata cozida (145g) + cenoura no vapor + azeite (5ml)" },
      { nome: "Opção 3", itens: "Frango desfiado (120g) + arroz (100g) + chuchu cozido + azeite (5ml)" },
    ],
  },
  {
    titulo: "Lanche da Tarde",
    opcoes: [
      { nome: "Opção 1", itens: "1 banana (70g) + ovo cozido (50g)" },
      { nome: "Opção 2", itens: "Maçã sem casca (80g) + tapioca com ovo (50g + 50g)" },
      { nome: "Opção 3", itens: "Mamão (170g) + cuscuz com ovo (90g + 50g)" },
    ],
  },
  {
    titulo: "Jantar",
    opcoes: [
      { nome: "Opção 1", itens: "Frango desfiado (120g) + abóbora assada + azeite (5ml)" },
      { nome: "Opção 2", itens: "Omelete (100g) + vagem no vapor + azeite (5ml)" },
      { nome: "Opção 3", itens: "Peixe grelhado (120g) + cenoura + pepino (se tolerar cru)" },
    ],
  },
];

const PODE_USAR = [
  "Atum em lata (natural)",
  "Macarrão de arroz",
  "Tapioca",
  "Cuscuz",
  "Ghee",
];

const EVITAR = [
  "Leite e derivados",
  "Glúten (pão, macarrão, bolos)",
  "Açúcar refinado",
  "Ultraprocessados",
  "Refrigerante",
  "Álcool",
  "Adoçante artificial",
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
        <h1 className="hs-titulo">Cardápio Sugestivo</h1>
        <p className="hs-texto">Ideias de refeições para a fase de repouso digestivo</p>
      </div>

      {REFEICOES.map((ref, i) => (
        <div className="hs-refeicao" key={i}>
          <div className="hs-refeicao-header" onClick={() => alternar(i)}>
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

      <div className="c-secao">
        <h2 className="c-secao-titulo">Pode usar</h2>
        <div className="c-chips">
          {PODE_USAR.map((item) => (
            <span className="c-chip" style={{ cursor: "default" }} key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Evitar durante a fase de repouso</h2>
        <div className="c-chips">
          {EVITAR.map((item) => (
            <span
              className="c-chip"
              key={item}
              style={{ cursor: "default", borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
