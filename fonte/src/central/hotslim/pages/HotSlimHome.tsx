import { Link } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Icone, type NomeIcone } from "@/central/components/Icone";
import { Marca } from "@/central/components/Marca";
import { rotas } from "@/central/rotas";

/**
 * A entrada do desafio de 21 dias.
 *
 * Responde três perguntas de um olhar: em que dia eu estou, em que fase, e o
 * que eu faço agora. O dia e a fase ficam na capa; o "agora" é o checklist de
 * hoje; a jornada inteira aparece embaixo, em três fases, no lugar de vinte e
 * uma caixinhas iguais.
 *
 * As frases de cada fase são as que já estavam nesta tela ("Como funciona");
 * só mudaram de lugar.
 */
const TOTAL = 21;

const FASES = [
  { nome: "Repouso digestivo", curto: "Repouso", de: 1, ate: 6, texto: "Alimentos de fácil digestão." },
  { nome: "Teste", curto: "Teste", de: 7, ate: 14, texto: "Reintrodução guiada de alimentos." },
  { nome: "Autonomia", curto: "Autonomia", de: 15, ate: 21, texto: "Consolidação dos resultados." },
] as const;

const ATALHOS: { rota: string; icone: NomeIcone; titulo: string; apoio: string }[] = [
  { rota: "/hotslim/protocolo", icone: "lista", titulo: "Método Rota", apoio: "Repouso digestivo — 6 dias" },
  { rota: "/hotslim/cardapio", icone: "almoco", titulo: "Cardápio", apoio: "Ideias de refeições" },
  { rota: "/hotslim/lista-compras", icone: "mercado", titulo: "Lista de compras", apoio: "O que levar do supermercado" },
  { rota: "/hotslim/reintroducao", icone: "folha", titulo: "Reintrodução", apoio: "Semana por semana" },
  { rota: "/hotslim/metas", icone: "evolucao", titulo: "Minhas metas", apoio: "Objetivos semanais" },
  { rota: "/hotslim/faq", icone: "info", titulo: "Dúvidas", apoio: "Perguntas sobre o desafio" },
];

export function HotSlimHome() {
  const { acesso } = useSessao();
  const diaAtual = Math.max(1, acesso.hotslimDiaAtual ?? 1);
  const concluido = diaAtual > TOTAL;
  const dia = Math.min(diaAtual, TOTAL);
  const progresso = Math.round((dia / TOTAL) * 100);
  const faseAtual = FASES.find((f) => dia >= f.de && dia <= f.ate) ?? FASES[2];

  return (
    <div className="hs-pagina">
      <div className="hs-topo">
        <Link to={rotas.home} className="hs-voltar">
          <Icone nome="voltar" tamanho={16} />
          Voltar ao app
        </Link>
        <Marca altura={24} />
      </div>

      <section className="hs-capa" aria-label="Onde você está no desafio">
        <p className="hs-capa-sobre">Método Rota · 21 dias</p>
        <p className="hs-capa-dia">
          {concluido ? "Desafio concluído" : <>Dia {dia}<span> de {TOTAL}</span></>}
        </p>
        <p className="hs-capa-fase">
          {concluido ? "Você passou pelos 21 dias." : `${faseAtual.nome} · ${faseAtual.texto}`}
        </p>
        <div
          className="hs-capa-barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TOTAL}
          aria-valuenow={dia}
          aria-label="Dias do desafio"
        >
          <span style={{ width: `${progresso}%` }} />
        </div>
        <Link to="/hotslim/checklist" className="hs-capa-acao">
          <Icone nome="feito" tamanho={17} />
          Checklist de hoje
        </Link>
      </section>

      <section className="c-secao">
        <h2 className="c-secao-titulo">Seus 21 dias</h2>
        <ol className="hs-jornada">
          {FASES.map((fase) => {
            const estado = dia > fase.ate ? "feita" : dia >= fase.de ? "atual" : "depois";
            return (
              <li key={fase.nome} className={`hs-jornada-fase hs-jornada-fase--${estado}`}>
                <div className="hs-jornada-cabeca">
                  <strong>{fase.nome}</strong>
                  <span>
                    Dias {fase.de}–{fase.ate}
                  </span>
                </div>
                <p>{fase.texto}</p>
                <div className="hs-jornada-dias" aria-hidden="true">
                  {Array.from({ length: fase.ate - fase.de + 1 }, (_, i) => {
                    const n = fase.de + i;
                    return (
                      <span key={n} className={n < dia ? "feito" : n === dia && !concluido ? "hoje" : undefined}>
                        {n}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="c-secao">
        <h2 className="c-secao-titulo">Tudo do desafio</h2>
        <div className="hs-atalhos">
          {ATALHOS.map((atalho) => (
            <Link key={atalho.rota} to={atalho.rota} className="hs-atalho">
              <span className="hs-atalho-icone">
                <Icone nome={atalho.icone} tamanho={19} />
              </span>
              <span className="hs-atalho-texto">
                <strong>{atalho.titulo}</strong>
                <span>{atalho.apoio}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
