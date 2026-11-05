import { Link } from "react-router-dom";

const ITENS = [
  { rota: "/hotslim/lista-compras", titulo: "Lista de Compras", desc: "O que levar do supermercado" },
  { rota: "/hotslim/cardapio", titulo: "Cardápio Sugestivo", desc: "Ideias de refeições" },
  { rota: "/hotslim/metas", titulo: "Minhas Metas", desc: "Objetivos semanais" },
  { rota: "/hotslim/faq", titulo: "Dúvidas Frequentes", desc: "Perguntas sobre o desafio" },
];

export function HotSlimMais() {
  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Mais</h1>
        <p className="hs-texto">Todo o conteúdo do desafio</p>
      </div>

      <div className="hs-list-card">
        {ITENS.map((item) => (
          <Link
            key={item.rota}
            to={item.rota}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="hs-list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{item.titulo}</div>
                <div style={{ fontSize: 13, color: "var(--hs-fg-soft)", marginTop: 1 }}>{item.desc}</div>
              </div>
              <span style={{ color: "var(--hs-border-strong)", fontSize: 18, flexShrink: 0 }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
