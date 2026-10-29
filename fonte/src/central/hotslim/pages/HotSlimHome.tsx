import { Link } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Marca } from "@/central/components/Marca";
import { Icone, type NomeIcone } from "@/central/components/Icone";

const ATALHOS: { rota: string; rotulo: string; icone: NomeIcone }[] = [
  { rota: "/hotslim/protocolo", rotulo: "Método Rota", icone: "guias" },
  { rota: "/hotslim/checklist", rotulo: "Checklist", icone: "documentos" },
  { rota: "/hotslim/lista-compras", rotulo: "Lista de Compras", icone: "carrinho" },
  { rota: "/hotslim/cardapio", rotulo: "Cardápio", icone: "lista" },
  { rota: "/hotslim/reintroducao", rotulo: "Reintrodução", icone: "folha" },
  { rota: "/hotslim/metas", rotulo: "Minhas Metas", icone: "evolucao" },
  { rota: "/hotslim/faq", rotulo: "Dúvidas", icone: "conversa" },
];

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ProgressoCircular({ dia, total = 21 }: { dia: number; total?: number }) {
  const raio = 52;
  const circ = 2 * Math.PI * raio;
  const progresso = Math.min(1, dia / total);
  const offset = circ * (1 - progresso);

  return (
    <div className="hs-ring">
      <svg viewBox="0 0 120 120" className="hs-ring-svg">
        <circle cx="60" cy="60" r={raio} className="hs-ring-track" />
        <circle
          cx="60" cy="60" r={raio}
          className="hs-ring-fill"
          style={{ strokeDasharray: circ, strokeDashoffset: offset }}
        />
      </svg>
      <div className="hs-ring-label">
        <span className="hs-ring-dia">{dia}</span>
        <span className="hs-ring-total">de {total}</span>
      </div>
    </div>
  );
}

export function HotSlimHome() {
  const { acesso, sair } = useSessao();
  const diaAtual = acesso.hotslimDiaAtual ?? 1;

  return (
    <div className="hs-pagina">
      <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
        <button
          type="button"
          className="hs-btn-sair"
          aria-label="Sair da conta"
          onClick={() => void sair()}
        >
          <Icone nome="voltar" tamanho={17} />
        </button>
        <Marca altura={28} />
        <p className="hs-greeting" style={{ marginTop: 12, marginBottom: 0 }}>
          {saudacao()}
        </p>
        <h1 className="hs-titulo" style={{ marginTop: 4 }}>Método Rota — 21 Dias</h1>
        <p className="hs-texto" style={{ maxWidth: 340, margin: "4px auto 0" }}>
          21 dias para desinchar, regular o intestino e se sentir leve
        </p>
      </div>

      <ProgressoCircular dia={diaAtual} />
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div className="hs-phase-badge">
          {diaAtual <= 6 ? "Repouso digestivo" : "Teste de reintrodução"}
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Seus 21 dias</h2>
        <div className="hs-cronograma">
          {Array.from({ length: 21 }, (_, i) => {
            const dia = i + 1;
            const classe = dia < diaAtual ? "concluido" : dia === diaAtual ? "ativo" : "";
            const fase = dia <= 6 ? "Repouso" : "Teste";
            return (
              <div key={dia} className={`hs-dia ${classe}`}>
                <span className="hs-dia-num">{dia}</span>
                {dia < diaAtual ? <span className="hs-dia-check">✓</span> : fase}
              </div>
            );
          })}
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Acesso rápido</h2>
        <div className="hs-atalhos">
          {ATALHOS.map((a) => (
            <Link key={a.rota} to={a.rota} className="hs-atalho">
              <span className="hs-atalho-icone">
                <Icone nome={a.icone} tamanho={20} />
              </span>
              {a.rotulo}
            </Link>
          ))}
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
              <span><strong>Dias 15–21:</strong> Teste — consolidação dos resultados</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
