import { Link } from "react-router-dom";

const ITENS = [
  { rota: "/hotslim/lista-compras", emoji: "🛒", titulo: "Lista de Compras", desc: "O que levar do supermercado" },
  { rota: "/hotslim/cardapio", emoji: "🍽️", titulo: "Cardápio Sugestivo", desc: "Ideias de refeições" },
  { rota: "/hotslim/metas", emoji: "🎯", titulo: "Minhas Metas", desc: "Objetivos semanais" },
  { rota: "/hotslim/faq", emoji: "❓", titulo: "Dúvidas Frequentes", desc: "Perguntas sobre o desafio" },
];

export function HotSlimMais() {
  return (
    <div className="hs-pagina">
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div className="hs-emoji">📚</div>
        <h1 className="hs-titulo">Mais</h1>
        <p className="hs-texto">Todo o conteúdo do desafio</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ITENS.map((item) => (
          <Link
            key={item.rota}
            to={item.rota}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="hs-card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 0 }}>
              <span style={{ fontSize: 32 }}>{item.emoji}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{item.titulo}</div>
                <div className="hs-texto" style={{ margin: 0, fontSize: 13 }}>{item.desc}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--hs-fg-soft)", fontSize: 18 }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
