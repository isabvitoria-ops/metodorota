import { Link } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Marca } from "@/central/components/Marca";

export function HotSlimHome() {
  const { acesso } = useSessao();
  const diaAtual = acesso.hotslimDiaAtual ?? 1;
  const progresso = Math.min(100, Math.round((diaAtual / 21) * 100));

  return (
    <div className="hs-pagina">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Marca altura={28} />
        <h1 className="hs-titulo" style={{ marginTop: 12 }}>Método Rota — 21 Dias</h1>
        <p className="hs-texto" style={{ maxWidth: 340, margin: "4px auto 0" }}>
          21 dias para desinchar, regular o intestino e se sentir leve
        </p>
      </div>

      <div className="hs-progresso">
        <div className="hs-progresso-label">
          <span>Dia {diaAtual} de 21</span>
          <span className="hs-tag hs-tag-accent">{progresso}%</span>
        </div>
        <div className="hs-progresso-barra">
          <div className="hs-progresso-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div className="hs-progresso-dias">
          <span>Início</span>
          <span>{diaAtual <= 6 ? "Repouso" : diaAtual <= 14 ? "Teste" : "Autonomia"}</span>
          <span>Fim</span>
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Seus 21 dias</h2>
        <div className="hs-cronograma">
          {Array.from({ length: 21 }, (_, i) => {
            const dia = i + 1;
            const classe = dia < diaAtual ? "concluido" : dia === diaAtual ? "ativo" : "";
            const fase = dia <= 6 ? "Repouso" : dia <= 14 ? "Teste" : "Auto";
            return (
              <div key={dia} className={`hs-dia ${classe}`}>
                <span className="hs-dia-num">{dia}</span>
                {fase}
              </div>
            );
          })}
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Acesso rápido</h2>
        <div className="hs-atalhos">
          <Link to="/hotslim/protocolo" className="hs-atalho">Método Rota</Link>
          <Link to="/hotslim/checklist" className="hs-atalho">Checklist do dia</Link>
          <Link to="/hotslim/lista-compras" className="hs-atalho">Lista de Compras</Link>
          <Link to="/hotslim/cardapio" className="hs-atalho">Cardápio</Link>
          <Link to="/hotslim/reintroducao" className="hs-atalho">Reintrodução</Link>
          <Link to="/hotslim/metas" className="hs-atalho">Minhas Metas</Link>
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Como funciona</h2>
        <div className="c-card" style={{ padding: 18 }}>
          <ul className="hs-lista">
            <li>
              <span className="hs-lista-num">1</span>
              <span><strong>Dias 1–6:</strong> Repouso digestivo — alimentos de fácil digestão</span>
            </li>
            <li>
              <span className="hs-lista-num">2</span>
              <span><strong>Dias 7–14:</strong> Teste — reintrodução guiada de alimentos</span>
            </li>
            <li>
              <span className="hs-lista-num">3</span>
              <span><strong>Dias 15–21:</strong> Autonomia — consolidação dos resultados</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
