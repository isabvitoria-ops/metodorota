import { NavLink } from "react-router-dom";
import { Icone, type NomeIcone } from "./Icone";
import { rotas } from "@/central/rotas";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { areaLigada } from "@/central/utils/areas";

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
];

export function NavPrincipal() {
  const { acesso } = useSessao();
  // O que a nutricionista desligou some da barra também (utils/areas.ts). O
  // desafio tem interruptor próprio; ausente na cópia antiga = participa.
  const itens = ITENS.filter(
    (item) =>
      (item.rota !== rotas.desafio || acesso.papel === "admin" || acesso.desafio !== false) &&
      (item.rota !== rotas.trocas || areaLigada(acesso, "trocas")) &&
      (item.rota !== rotas.comerFora || areaLigada(acesso, "comer_fora")),
  );
  // Só "Início" na barra é uma barra que não leva a lugar nenhum.
  if (itens.length <= 1) return null;
  return (
    <nav className="c-nav" aria-label="Navegação principal">
      <div className="c-nav-marca" aria-hidden="true" />
      {itens.map((item) => (
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
