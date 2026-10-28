import { Link } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";

export function HotSlimHome() {
  const { acesso } = useSessao();
  const diaAtual = acesso.hotslimDiaAtual ?? 1;
  const progresso = Math.min(100, Math.round((diaAtual / 21) * 100));

  return (
    <div className="hs-pagina">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔥</div>
        <h1 className="hs-titulo hs-titulo-gradient">Desafio Hot Slim</h1>
        <p className="hs-texto" style={{ maxWidth: 340, margin: "4px auto 0" }}>
          21 dias para desinchar, regular o intestino e se sentir leve
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="hs-progresso">
        <div className="hs-progresso-label">
          <span>🔥 Dia {diaAtual} de 21</span>
          <span className="hs-tag hs-tag-accent">{progresso}%</span>
        </div>
        <div className="hs-progresso-barra">
          <div className="hs-progresso-fill" style={{ width: `${progresso}%` }} />
        </div>
        <div className="hs-progresso-dias">
          <span>Início</span>
          <span>{diaAtual <= 6 ? "Repouso" : diaAtual <= 14 ? "Teste" : "Autonomia"}</span>
          <span>Fim 🎉</span>
        </div>
      </div>

      {/* Cronograma dos 21 dias */}
      <div className="hs-secao">
        <h2 className="hs-secao-titulo">📅 Seus 21 dias</h2>
        <div className="hs-cronograma">
          {Array.from({ length: 21 }, (_, i) => {
            const dia = i + 1;
            const classe = dia < diaAtual ? "concluido" : dia === diaAtual ? "ativo" : "";
            const fase = dia <= 6 ? "GUT" : dia <= 14 ? "Teste" : "Auto";
            return (
              <div key={dia} className={`hs-dia ${classe}`}>
                <span className="hs-dia-num">{dia}</span>
                {fase}
              </div>
            );
          })}
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="hs-secao">
        <h2 className="hs-secao-titulo">⚡ Acesso rápido</h2>
        <div className="hs-atalhos">
          <Link to="/hotslim/protocolo" className="hs-atalho">
            <span className="hs-atalho-emoji">🧬</span>
            Protocolo GUTCODE
          </Link>
          <Link to="/hotslim/checklist" className="hs-atalho">
            <span className="hs-atalho-emoji">✅</span>
            Checklist do dia
          </Link>
          <Link to="/hotslim/lista-compras" className="hs-atalho">
            <span className="hs-atalho-emoji">🛒</span>
            Lista de Compras
          </Link>
          <Link to="/hotslim/cardapio" className="hs-atalho">
            <span className="hs-atalho-emoji">🍽️</span>
            Cardápio
          </Link>
          <Link to="/hotslim/reintroducao" className="hs-atalho">
            <span className="hs-atalho-emoji">🔄</span>
            Reintrodução
          </Link>
          <Link to="/hotslim/metas" className="hs-atalho">
            <span className="hs-atalho-emoji">🎯</span>
            Minhas Metas
          </Link>
        </div>
      </div>

      {/* Regras do desafio */}
      <div className="hs-secao">
        <h2 className="hs-secao-titulo">📋 Como funciona</h2>
        <div className="hs-card">
          <ul className="hs-lista">
            <li>
              <span className="hs-lista-icon">1️⃣</span>
              <span><strong>Semana 1 (Dias 1–7):</strong> Repouso digestivo — alimentos de fácil digestão</span>
            </li>
            <li>
              <span className="hs-lista-icon">2️⃣</span>
              <span><strong>Semana 2 (Dias 8–14):</strong> Teste — reintrodução guiada de alimentos</span>
            </li>
            <li>
              <span className="hs-lista-icon">3️⃣</span>
              <span><strong>Semana 3 (Dias 15–21):</strong> Autonomia — consolidação dos resultados</span>
            </li>
            <li>
              <span className="hs-lista-icon">✅</span>
              <span><strong>Todo dia:</strong> Preencha o checklist para acompanhar sua evolução</span>
            </li>
            <li>
              <span className="hs-lista-icon">💬</span>
              <span><strong>Suporte:</strong> Dúvidas pelo grupo do WhatsApp</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Dica motivacional */}
      <div className="hs-dica">
        <strong>💪 Você consegue!</strong> Cada dia completado é um passo para se sentir mais leve, com mais energia e com o intestino regulado. Confie no processo! 🔥
      </div>
    </div>
  );
}
