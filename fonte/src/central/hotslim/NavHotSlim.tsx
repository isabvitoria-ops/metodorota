import { NavLink } from "react-router-dom";
import { Icone, type NomeIcone } from "@/central/components/Icone";

const ITENS: { rota: string; rotulo: string; icone: NomeIcone; fim: boolean }[] = [
  { rota: "/hotslim", rotulo: "Início", icone: "inicio", fim: true },
  { rota: "/hotslim/protocolo", rotulo: "Método", icone: "lista", fim: false },
  { rota: "/hotslim/checklist", rotulo: "Checklist", icone: "feito", fim: false },
  { rota: "/hotslim/reintroducao", rotulo: "Fases", icone: "folha", fim: false },
  { rota: "/hotslim/mais", rotulo: "Mais", icone: "documentos", fim: false },
];

export function NavHotSlim() {
  return (
    <nav className="hs-nav" aria-label="Navegação do desafio">
      {ITENS.map((item) => (
        <NavLink key={item.rota} to={item.rota} end={item.fim} className={({ isActive }) => `${isActive ? "ativo" : ""}`}>
          <Icone nome={item.icone} tamanho={21} />
          <span>{item.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}
