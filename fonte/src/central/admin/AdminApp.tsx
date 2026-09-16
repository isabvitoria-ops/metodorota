import { useEffect, useRef } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icone } from "@/central/components/Icone";
import { FaixaDemonstracao } from "@/central/components/FaixaDemonstracao";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import { Painel } from "./Painel";
import { Pacientes } from "./Pacientes";
import { Alimentos } from "./Alimentos";
import { Equivalencias } from "./Equivalencias";
import { Conteudos } from "./Conteudos";
import { ConfiguracoesAdmin } from "./Configuracoes";
import { Desafios } from "./Desafios";
import { RastreabilidadeAdmin } from "./Rastreabilidade";

/**
 * Área da nutricionista.
 *
 * Mesma identidade visual da Central, com densidade maior: aqui a tarefa é
 * gerenciar, não consultar. As abas em vez de menu lateral porque isto
 * também vai ser aberto no celular entre um atendimento e outro.
 */
const ABAS = [
  { rota: rotas.admin, rotulo: "Painel", fim: true },
  { rota: rotas.adminPacientes, rotulo: "Pacientes" },
  { rota: rotas.adminAlimentos, rotulo: "Alimentos" },
  { rota: rotas.adminEquivalencias, rotulo: "Equivalências" },
  { rota: rotas.adminConteudos, rotulo: "Conteúdos" },
  { rota: rotas.adminDesafios, rotulo: "Desafio" },
  { rota: rotas.adminRastreabilidade, rotulo: "Rastreabilidade" },
  { rota: rotas.adminConfiguracoes, rotulo: "Configurações" },
];

export function AdminApp() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { acesso, sair, configuracoes } = useSessao();
  const barraDeAbas = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // A régua de abas rola de lado no celular, e não cabe inteira: com sete
  // abas, estando em "Rastreabilidade" ou "Configurações" a aba ativa ficava
  // fora da tela. A régua mostrava "Painel" no começo, e não havia como saber
  // em que seção ela estava. Trazer a ativa para o centro resolve, e no
  // computador — onde tudo cabe — não muda nada.
  useEffect(() => {
    const ativa = barraDeAbas.current?.querySelector(".ativo");
    ativa?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="central">
      <div className="c-admin">
        <FaixaDemonstracao />
        <header className="c-admin-topo">
          <div className="c-admin-topo-linha">
            <div>
              <p className="c-marca">{configuracoes.nomeCentral}</p>
              <strong style={{ fontSize: 15 }}>Área da nutricionista</strong>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                onClick={() => navegar(rotas.home)}
              >
                Ver a Central
              </button>
              <button type="button" className="c-favoritar" aria-label="Sair" onClick={() => void sair()}>
                <Icone nome="voltar" tamanho={17} />
              </button>
            </div>
          </div>
          <nav className="c-admin-abas" aria-label="Seções administrativas" ref={barraDeAbas}>
            {ABAS.map((aba) => (
              <NavLink
                key={aba.rota}
                to={aba.rota}
                end={aba.fim}
                className={({ isActive }) => `c-admin-aba ${isActive ? "ativo" : ""}`}
              >
                {aba.rotulo}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="c-admin-conteudo">
          {acesso.papel !== "admin" ? (
            <Navigate to={rotas.home} replace />
          ) : (
            <Routes>
              <Route index element={<Painel />} />
              <Route path="pacientes" element={<Pacientes />} />
              <Route path="pacientes/:pacienteId" element={<Pacientes />} />
              <Route path="alimentos" element={<Alimentos />} />
              <Route path="equivalencias" element={<Equivalencias />} />
              <Route path="conteudos" element={<Conteudos />} />
              <Route path="desafios" element={<Desafios />} />
              <Route path="rastreabilidade" element={<RastreabilidadeAdmin />} />
              <Route path="configuracoes" element={<ConfiguracoesAdmin />} />
              <Route path="*" element={<Navigate to={rotas.admin} replace />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}
