import { useNavigate } from "react-router-dom";
import { Icone, type NomeIcone } from "@/central/components/Icone";
import { Marca } from "@/central/components/Marca";
import { MinhaMetaDeHoje } from "@/central/components/MinhaMetaDeHoje";
import { OQueMudou } from "@/central/components/OQueMudou";
import { CheckinPendente } from "@/central/components/CheckinPendente";
import { BarraBusca } from "@/central/components/BarraBusca";
import { useState } from "react";
import { rotas } from "@/central/rotas";
import { useDesafio } from "@/central/hooks/useDesafio";
import { useFavoritos } from "@/central/hooks/useFavoritos";
import { useSessao } from "@/central/autenticacao/SessaoContexto";

/**
 * Home — a "Central do Paciente" (§3 e §33).
 *
 * A tela responde à pergunta "o que eu vim fazer aqui?" em um olhar: uma
 * busca no topo, para quem já sabe o que quer, e cinco portas grandes, para
 * quem está só procurando. Nada de conteúdo institucional.
 */
const ATALHOS: { rota: string; icone: NomeIcone; titulo: string; descricao: string }[] = [
  {
    rota: rotas.protocolo,
    icone: "lista",
    titulo: "Protocolo Alimentar",
    descricao: "Seu plano, com as substituições de cada item.",
  },
  {
    rota: rotas.rastreabilidade,
    icone: "folha",
    titulo: "Rastreabilidade",
    descricao: "Registre o que você reintroduziu e como se sentiu.",
  },
  {
    rota: rotas.treino,
    icone: "evolucao",
    titulo: "Minha evolução",
    descricao: "Seu treino registrado, e o que mudou de uma sessão para a outra.",
  },
  {
    rota: rotas.metas,
    icone: "evolucao",
    titulo: "Minhas metas",
    descricao: "O que combinamos, e quanto você já fez.",
  },
  {
    rota: rotas.trocas,
    icone: "troca",
    titulo: "Troca inteligente",
    descricao: "Substitua alimentos mantendo a quantidade adequada.",
  },
  {
    rota: rotas.comerFora,
    icone: "comerFora",
    titulo: "Comer fora",
    descricao: "Estratégias para escolher melhor fora de casa.",
  },
  {
    rota: rotas.documentos,
    icone: "documentos",
    titulo: "Meus documentos",
    descricao: "Protocolo, avaliação e rastreio para imprimir e guardar.",
  },
  {
    rota: rotas.salvos,
    icone: "salvos",
    titulo: "Salvos",
    descricao: "Seus conteúdos guardados.",
  },
];

export function Home() {
  const navegar = useNavigate();
  const [consulta, definirConsulta] = useState("");
  const salvos = useFavoritos((estado) => estado.itens.length);
  const { acesso, configuracoes, sair } = useSessao();

  const primeiroNome = acesso.nome?.trim().split(" ")[0] ?? null;
  const vencendo =
    acesso.diasRestantes !== null && acesso.diasRestantes >= 0 && acesso.diasRestantes <= 7;

  return (
    <>
      <header className="c-cabecalho">
        <div className="c-cabecalho-linha">
          <div>
            {/* A logo no lugar do nome escrito: é a mesma informação, na
                letra da marca. O `nomeCentral` continua valendo para o
                título da aba e para quem usar o app com imagem desligada. */}
            <Marca altura={30} />
            <h1 className="c-titulo">
              {primeiroNome ? `Olá, ${primeiroNome}.` : configuracoes.fraseHome}
            </h1>
            {primeiroNome && <p className="c-subtitulo">{configuracoes.fraseHome}</p>}
          </div>
          <button type="button" className="c-favoritar" aria-label="Sair da conta" onClick={() => void sair()}>
            <Icone nome="voltar" tamanho={17} />
          </button>
        </div>
      </header>

      <div className="c-conteudo">
        <div style={{ marginTop: 22 }}>
          <BarraBusca
            valor={consulta}
            aoMudar={definirConsulta}
            aoEnviar={() => navegar(rotas.busca(consulta))}
            placeholder="O que você está procurando?"
          />
        </div>

        {consulta.trim().length > 0 && (
          <button type="button" className="c-chip" style={{ marginTop: 12 }} onClick={() => navegar(rotas.busca(consulta))}>
            <Icone nome="busca" tamanho={14} />
            Buscar por “{consulta.trim()}”
          </button>
        )}

        {configuracoes.lema && <p className="c-lema">{configuracoes.lema}</p>}

        {vencendo && (
          <div className="c-aviso" role="status">
            <Icone nome="relogio" tamanho={19} />
            <span>
              Seu acesso vai até {acesso.dataFim ? acesso.dataFim.split("-").reverse().join("/") : ""}
              {acesso.diasRestantes === 0
                ? " — termina hoje."
                : ` — faltam ${acesso.diasRestantes} ${acesso.diasRestantes === 1 ? "dia" : "dias"}.`}
            </span>
          </div>
        )}

        {/* Antes da meta de hoje: 'o que ja aconteceu' contextualiza 'o
            que fazer agora'. Invertido, a primeira coisa da tela seria
            uma tarefa. */}
        <OQueMudou />

        <CheckinPendente />

        <MinhaMetaDeHoje />

        <CardDoDesafio />

        <section className="c-secao">
          <div className="c-atalhos">
            {/* A Rastreabilidade é para quem faz o acompanhamento intestinal.
                Para quem não faz, o atalho não existe — em vez de existir e
                abrir uma tela vazia explicando que não é para ela. */}
            {ATALHOS.filter(
              (atalho) =>
                (atalho.rota !== rotas.rastreabilidade || acesso.rastreio) &&
                (atalho.rota !== rotas.protocolo || acesso.protocolo) &&
                // Mesma regra: sem treino ativo e sem nenhuma sessão
                // registrada, a porta não existe — em vez de existir e abrir
                // uma tela de evolução que não tem o que mostrar.
                (atalho.rota !== rotas.treino || acesso.treino) &&
                // Mesma regra de novo: sem meta combinada, a porta não
                // existe. É a terceira vez que esta regra aparece, e é de
                // propósito que ela apareça escrita: cada porta decide a
                // própria existência, e uma lista de exceções num lugar só
                // seria esquecida na próxima porta.
                (atalho.rota !== rotas.metas || acesso.metas),
            ).map((atalho) => (
              <button key={atalho.rota} type="button" className="c-atalho" onClick={() => navegar(atalho.rota)}>
                <span className="c-atalho-icone">
                  <Icone nome={atalho.icone} tamanho={22} />
                </span>
                <span className="c-atalho-texto">
                  <h3>{atalho.titulo}</h3>
                  <p>
                    {atalho.rota === rotas.salvos && salvos > 0
                      ? `${salvos} ${salvos === 1 ? "item guardado" : "itens guardados"}.`
                      : atalho.descricao}
                  </p>
                </span>
                <span className="c-atalho-seta">
                  <Icone nome="seta" tamanho={18} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {acesso.papel === "admin" && (
          <button type="button" className="c-link" style={{ marginTop: 20 }} onClick={() => navegar(rotas.admin)}>
            Abrir a área da nutricionista
          </button>
        )}
      </div>
    </>
  );
}

/**
 * O desafio na Home.
 *
 * Só aparece quando há desafio no ar — e some sozinho quando o mês acaba,
 * porque `meu_desafio()` responde pela data. Mostra o essencial (pontos do mês
 * e posição) e leva para a tela cheia; não repete o checklist aqui para não
 * dominar a Home, que é o que ela pediu no §33.
 */
function CardDoDesafio() {
  const navegar = useNavigate();
  const { dados, carregando } = useDesafio();

  if (carregando || !dados?.temDesafio || !dados.desafio) return null;

  const pontos = dados.pontosNoMes ?? 0;

  return (
    <button type="button" className="c-card-desafio" onClick={() => navegar(rotas.desafio)}>
      <span className="c-card-desafio-numero">{pontos}</span>
      <span className="c-card-desafio-texto">
        <strong>{dados.desafio.nome}</strong>
        <span>
          {pontos === 1 ? "1 ponto neste mês" : `${pontos} pontos neste mês`}
          {dados.posicao != null ? ` · ${dados.posicao}º no ranking` : ""}
        </span>
      </span>
      <Icone nome="seta" tamanho={18} />
    </button>
  );
}
