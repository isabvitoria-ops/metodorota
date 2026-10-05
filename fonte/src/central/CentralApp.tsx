import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavPrincipal } from "./components/NavPrincipal";
import { Home } from "./pages/Home";
import { TrocaInteligente } from "./pages/TrocaInteligente";
import { ComerFora } from "./pages/ComerFora";
import { CategoriaDetalhe } from "./pages/CategoriaDetalhe";
import { EstabelecimentoDetalhe } from "./pages/EstabelecimentoDetalhe";
import { Desafio } from "./pages/Desafio";
import { Rastreabilidade } from "./pages/Rastreabilidade";
import { FodmapSemaforo } from "./pages/FodmapSemaforo";
import { CalculadoraAgua } from "./pages/CalculadoraAgua";
import { Bristol } from "./pages/Bristol";
import { Habitos } from "./pages/Habitos";
import { DiarioDeFotosPagina } from "@/central/pages/DiarioDeFotos";
import { Protocolo } from "./pages/Protocolo";
import { Avaliacao } from "./pages/Avaliacao";
import { Metas } from "./pages/Metas";
import { Treino } from "./pages/Treino";
import { Documentos } from "./pages/Documentos";
import { Busca } from "./pages/Busca";
import { FaixaDemonstracao } from "./components/FaixaDemonstracao";
import { FaixaAdmin } from "./components/FaixaAdmin";
import { rotas } from "./rotas";
import { Questionarios } from "@/central/pages/Questionarios";
import { InstalarPagina } from "@/central/pages/InstalarPagina";

/**
 * A Central do paciente — a casca.
 *
 * Monta a navegação e as rotas; nenhuma regra de negócio passa por aqui. As
 * telas ficam em `pages/`, os dados em `dados/` e as contas em `utils/`.
 */
export function CentralApp() {
  const { pathname } = useLocation();

  // Navegar entre telas começa no topo, como num app — sem isto o celular
  // mantém a rolagem da tela anterior e a nova parece cortada.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="central">
      <div className="c-casca">
        <FaixaDemonstracao />
        <FaixaAdmin />
        <Routes>
          <Route index element={<Home />} />
          <Route path="protocolo" element={<Protocolo />} />
          <Route path="avaliacao" element={<Avaliacao />} />
          <Route path="evolucao" element={<Treino />} />
          <Route path="metas" element={<Metas />} />
          <Route path="questionarios" element={<Questionarios />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="trocas" element={<TrocaInteligente />} />
          {/* A tabela de substituições saiu da Central: a Troca Inteligente faz
              o mesmo trabalho e duas portas para a mesma coisa confundiam. O
              caminho fica de pé para não quebrar link já enviado nem item que
              a paciente tenha guardado. */}
          <Route path="substituicoes" element={<Navigate to={rotas.trocas} replace />} />
          <Route path="substituicoes/:grupoId" element={<Navigate to={rotas.trocas} replace />} />
          <Route path="comer-fora" element={<ComerFora />} />
          <Route path="comer-fora/:categoriaId" element={<CategoriaDetalhe />} />
          <Route
            path="comer-fora/:categoriaId/:estabelecimentoId"
            element={<EstabelecimentoDetalhe />}
          />
          <Route path="desafio" element={<Desafio />} />
          <Route path="rastreabilidade" element={<Rastreabilidade />} />
          <Route path="fodmap" element={<FodmapSemaforo />} />
          <Route path="agua" element={<CalculadoraAgua />} />
          <Route path="fibras" element={<Navigate to={rotas.habitos} replace />} />
          <Route path="bristol" element={<Bristol />} />
          <Route path="habitos" element={<Habitos />} />
          <Route path="diario" element={<DiarioDeFotosPagina />} />
          <Route path="busca" element={<Busca />} />
          <Route path="instalar" element={<InstalarPagina />} />
          <Route path="*" element={<Navigate to={rotas.home} replace />} />
        </Routes>
        <NavPrincipal />
      </div>
    </div>
  );
}
