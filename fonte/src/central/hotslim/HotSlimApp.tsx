import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavHotSlim } from "./NavHotSlim";
import { HotSlimHome } from "./pages/HotSlimHome";
import { HotSlimProtocolo } from "./pages/HotSlimProtocolo";
import { HotSlimListaCompras } from "./pages/HotSlimListaCompras";
import { HotSlimCardapio } from "./pages/HotSlimCardapio";
import { HotSlimReintroducao } from "./pages/HotSlimReintroducao";
import { HotSlimChecklist } from "./pages/HotSlimChecklist";
import { HotSlimMetas } from "./pages/HotSlimMetas";
import { HotSlimFaq } from "./pages/HotSlimFaq";
import { HotSlimMais } from "./pages/HotSlimMais";
import "./hotslim.css";

export function HotSlimApp() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="hotslim">
      <div className="hs-casca">
        <Routes>
          <Route index element={<HotSlimHome />} />
          <Route path="protocolo" element={<HotSlimProtocolo />} />
          <Route path="lista-compras" element={<HotSlimListaCompras />} />
          <Route path="cardapio" element={<HotSlimCardapio />} />
          <Route path="reintroducao" element={<HotSlimReintroducao />} />
          <Route path="checklist" element={<HotSlimChecklist />} />
          <Route path="metas" element={<HotSlimMetas />} />
          <Route path="faq" element={<HotSlimFaq />} />
          <Route path="mais" element={<HotSlimMais />} />
          <Route path="*" element={<Navigate to="/hotslim" replace />} />
        </Routes>
      </div>
      <NavHotSlim />
    </div>
  );
}
