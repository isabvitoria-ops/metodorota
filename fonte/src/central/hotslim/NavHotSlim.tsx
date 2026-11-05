import { NavLink } from "react-router-dom";

const ITENS = [
  { rota: "/hotslim", rotulo: "Início", fim: true },
  { rota: "/hotslim/protocolo", rotulo: "Método", fim: false },
  { rota: "/hotslim/checklist", rotulo: "Checklist", fim: false },
  { rota: "/hotslim/reintroducao", rotulo: "Fases", fim: false },
  { rota: "/hotslim/mais", rotulo: "Mais", fim: false },
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
          <span>{item.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}
