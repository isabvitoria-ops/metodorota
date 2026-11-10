import { Link } from "react-router-dom";
import { Icone, type NomeIcone } from "@/central/components/Icone";
import { rotas } from "@/central/rotas";

const ITENS: { rota: string; icone: NomeIcone; titulo: string; desc: string }[] = [
  { rota: "/hotslim/lista-compras", icone: "mercado", titulo: "Lista de Compras", desc: "O que levar do supermercado" },
  { rota: "/hotslim/cardapio", icone: "almoco", titulo: "Cardápio Sugestivo", desc: "Ideias de refeições" },
  { rota: "/hotslim/metas", icone: "evolucao", titulo: "Minhas Metas", desc: "Objetivos semanais" },
  { rota: "/hotslim/faq", icone: "info", titulo: "Dúvidas Frequentes", desc: "Perguntas sobre o desafio" },
  { rota: rotas.home, icone: "voltar", titulo: "Voltar ao app", desc: "Protocolo, trocas e o resto do acompanhamento" },
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
              <span className="hs-atalho-icone">
                <Icone nome={item.icone} tamanho={18} />
              </span>
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
