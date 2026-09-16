import { NavLink } from "react-router-dom";
import { Icone, type NomeIcone } from "./Icone";
import { rotas } from "@/central/rotas";

/**
 * Navegação principal (§19).
 *
 * Uma estrutura só para os dois formatos: no celular ela é a barra fixa de
 * baixo (respeitando a área segura do aparelho), no desktop o CSS a
 * transforma em coluna lateral. Nada aqui sabe qual dos dois está em uso.
 */
const ITENS: { rota: string; rotulo: string; icone: NomeIcone; fim?: boolean }[] = [
  { rota: rotas.home, rotulo: "Início", icone: "inicio", fim: true },
  { rota: rotas.desafio, rotulo: "Desafio", icone: "relogio" },
  { rota: rotas.trocas, rotulo: "Trocas", icone: "troca" },
  { rota: rotas.comerFora, rotulo: "Comer fora", icone: "comerFora" },
  { rota: rotas.guias, rotulo: "Guias", icone: "guias" },
  { rota: rotas.salvos, rotulo: "Salvos", icone: "salvos" },
];

export function NavPrincipal() {
  return (
    <nav className="c-nav" aria-label="Navegação principal">
      <div className="c-nav-marca" aria-hidden="true" />
      {ITENS.map((item) => (
        <NavLink
          key={item.rota}
          to={item.rota}
          end={item.fim}
          className={({ isActive }) => `c-nav-item ${isActive ? "ativo" : ""}`}
        >
          <Icone nome={item.icone} tamanho={21} />
          <span>{item.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}
