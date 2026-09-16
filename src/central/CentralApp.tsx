import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavPrincipal } from "./components/NavPrincipal";
import { Home } from "./pages/Home";
import { TrocaInteligente } from "./pages/TrocaInteligente";
import { Substituicoes } from "./pages/Substituicoes";
import { GrupoDetalhe } from "./pages/GrupoDetalhe";
import { ComerFora } from "./pages/ComerFora";
import { CategoriaDetalhe } from "./pages/CategoriaDetalhe";
import { EstabelecimentoDetalhe } from "./pages/EstabelecimentoDetalhe";
import { Guias } from "./pages/Guias";
import { GuiaDetalhe } from "./pages/GuiaDetalhe";
import { Desafio } from "./pages/Desafio";
import { Rastreabilidade } from "./pages/Rastreabilidade";
import { Salvos } from "./pages/Salvos";
import { Busca } from "./pages/Busca";
import { FaixaDemonstracao } from "./components/FaixaDemonstracao";
import { FaixaAdmin } from "./components/FaixaAdmin";
import { rotas } from "./rotas";

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
          <Route path="trocas" element={<TrocaInteligente />} />
          <Route path="substituicoes" element={<Substituicoes />} />
          <Route path="substituicoes/:grupoId" element={<GrupoDetalhe />} />
          <Route path="comer-fora" element={<ComerFora />} />
          <Route path="comer-fora/:categoriaId" element={<CategoriaDetalhe />} />
          <Route
            path="comer-fora/:categoriaId/:estabelecimentoId"
            element={<EstabelecimentoDetalhe />}
          />
          <Route path="guias" element={<Guias />} />
          <Route path="guias/:guiaId" element={<GuiaDetalhe />} />
          <Route path="desafio" element={<Desafio />} />
          <Route path="rastreabilidade" element={<Rastreabilidade />} />
          <Route path="salvos" element={<Salvos />} />
          <Route path="busca" element={<Busca />} />
          <Route path="*" element={<Navigate to={rotas.home} replace />} />
        </Routes>
        <NavPrincipal />
      </div>
    </div>
  );
}
