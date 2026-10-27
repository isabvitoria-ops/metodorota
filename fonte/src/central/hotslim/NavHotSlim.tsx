import { NavLink } from "react-router-dom";

const ITENS = [
  { rota: "/hotslim", rotulo: "Início", emoji: "🏠", fim: true },
  { rota: "/hotslim/protocolo", rotulo: "Protocolo", emoji: "🧬" },
  { rota: "/hotslim/checklist", rotulo: "Checklist", emoji: "✅" },
  { rota: "/hotslim/reintroducao", rotulo: "Reintro", emoji: "🔄" },
  { rota: "/hotslim/mais", rotulo: "Mais", emoji: "📚" },
];

export function NavHotSlim() {
  return (
    <nav className="hs-nav" aria-label="Navegação do desafio">
      {ITENS.map((item) => (
        <NavLink
          key={item.rota}
          to={item.rota}
          end={item.fim}
          className={({ isActive }) => `${isActive ? "ativo" : ""}`}
        >
          <span className="hs-nav-icon">{item.emoji}</span>
          <span>{item.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}
