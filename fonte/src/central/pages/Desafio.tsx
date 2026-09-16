import { useState } from "react";
import type { AcaoDoDesafio, IndicacaoDaPaciente } from "@/central/types";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
import { useDesafio } from "@/central/hooks/useDesafio";
import { repositorio } from "@/central/dados/repositorio";
import { fraseDoProgresso, periodoDaSemana } from "@/central/utils/desafio";
import { dataBonita } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";

/**
 * Desafio do Mês — Ponto de Virada.
 *
 * O que a tela faz: mostra o que o banco respondeu e manda de volta "eu fiz
 * isso". O que ela NÃO faz: somar ponto, decidir posição, saber a regra. Se a
 * paciente abrir o console e mexer em qualquer número daqui, ela muda o que
 * está desenhado na tela dela e nada mais — o saldo vem da função a cada
 * leitura.
 *
 * A ordem da página é a que ela pediu: pontos do mês em destaque, acumulado
 * menor logo abaixo, checklist, ranking, e o Ponto de Virada no fim.
 */
export function Desafio() {
  const { dados, carregando, erro, ocupado, festejando, comRecarga } = useDesafio();

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Desafio do mês" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <p className="c-contagem">Carregando…</p>
        </div>
      </>
    );
  }

  if (!dados?.temDesafio || !dados.desafio) {
    return (
      <>
        <CabecalhoPagina titulo="Desafio do mês" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <EstadoVazio
            icone="relogio"
            titulo="Nenhum desafio no ar"
            descricao="Assim que sua nutricionista abrir o desafio do mês, ele aparece aqui."
          />
          {dados && dados.previa && <AvisoDePrevia />}
          {dados && dados.saldoAcumulado > 0 && (
            <PontoDeVirada saldo={dados.saldoAcumulado} recompensas={dados.recompensas} />
          )}
          {dados && (
            <EscadaDeIndicacao
              beneficios={dados.beneficiosIndicacao}
              validadas={dados.indicacoesValidadas}
              indicacoes={dados.indicacoes ?? []}
            />
          )}
        </div>
      </>
    );
  }

  const { desafio, acoes = [], ranking = [], recompensas = [] } = dados;
  const pontosNoMes = dados.pontosNoMes ?? 0;
  const semana = desafio.semanaAtual ?? 1;
  const faixa = periodoDaSemana(desafio.dataInicio, desafio.dataFim, semana);
  const temPendente = acoes.some((a) => a.envios.some((e) => e.status === "enviado"));
  const semanais = acoes.filter((a) => a.periodicidade === "semanal");
  const extras = acoes.filter((a) => a.periodicidade !== "semanal");

  return (
    <>
      <CabecalhoPagina
        titulo={desafio.nome}
        descricao={`${dataBonita(desafio.dataInicio)} — ${dataBonita(desafio.dataFim)}`}
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {desafio.lema && <p className="c-desafio-lema">{desafio.lema}</p>}

        {dados.previa && <AvisoDePrevia />}

        {festejando && (
          <div className="c-festejo" role="status">
            {festejando}
          </div>
        )}

        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}

        {/* Pontos do mês grandes; acumulado menor embaixo — a hierarquia que
            ela pediu, e que separa as duas contagens de um olhar. */}
        <section className="c-placar">
          <div className="c-placar-mes">
            <strong>{pontosNoMes}</strong>
            <span>{pontosNoMes === 1 ? "ponto neste mês" : "pontos neste mês"}</span>
          </div>
          {dados.posicao != null && (
            <div className="c-placar-posicao">
              <span>Sua posição</span>
              <strong>#{dados.posicao}</strong>
            </div>
          )}
        </section>

        <p className="c-placar-acumulado">
          Saldo acumulado no Ponto de Virada: <strong>{dados.saldoAcumulado}</strong>{" "}
          {dados.saldoAcumulado === 1 ? "ponto" : "pontos"}
        </p>

        <p className="c-desafio-frase">{fraseDoProgresso(pontosNoMes, temPendente)}</p>

        {dados.pontosParaProxima != null && dados.pontosParaProxima > 0 && (
          <p className="c-contagem">
            Faltam {dados.pontosParaProxima}{" "}
            {dados.pontosParaProxima === 1 ? "ponto" : "pontos"} para a próxima posição.
          </p>
        )}

        {/* ------------------------------------------------------ checklist */}
        <section className="c-secao">
          <h2 className="c-secao-titulo">
            Semana {semana} de {desafio.totalDeSemanas} · {dataBonita(faixa.inicio)} —{" "}
            {dataBonita(faixa.fim)}
          </h2>
          <div className="c-acoes">
            {semanais.map((acao) => (
              <CartaoAcao key={acao.id} acao={acao} ocupado={ocupado} aoMudar={comRecarga} />
            ))}
          </div>
        </section>

        {extras.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Ações extras</h2>
            <div className="c-acoes">
              {extras.map((acao) => (
                <CartaoAcao key={acao.id} acao={acao} ocupado={ocupado} aoMudar={comRecarga} />
              ))}
            </div>
          </section>
        )}

        {/* -------------------------------------------------------- ranking */}
        {ranking.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Ranking</h2>
            <div className="c-ranking">
              {ranking.map((linha) => (
                <div
                  key={`${linha.posicao}-${linha.nome}`}
                  className={`c-ranking-linha ${linha.souEu ? "eu" : ""} ${
                    linha.posicao <= 3 ? "destaque" : ""
                  }`}
                >
                  <span className="c-ranking-posicao">{linha.posicao}º</span>
                  <span className="c-ranking-nome">{linha.souEu ? "Você" : linha.nome}</span>
                  <span className="c-ranking-pontos">{linha.pontos} pts</span>
                </div>
              ))}
            </div>
            <p className="c-dica">
              O ranking mostra sua constância no desafio, não o seu valor nem o seu resultado
              corporal.
            </p>
          </section>
        )}

        <PontoDeVirada saldo={dados.saldoAcumulado} recompensas={recompensas} />

        <EscadaDeIndicacao
          beneficios={dados.beneficiosIndicacao}
          validadas={dados.indicacoesValidadas}
          indicacoes={dados.indicacoes ?? []}
        />

        {desafio.regras && (
          <section className="c-secao c-prosa">
            <h2 className="c-secao-titulo">Como funciona</h2>
            <p>{desafio.regras}</p>
          </section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- uma ação

const ESTADOS: Record<string, { rotulo: string; classe: string }> = {
  enviado: { rotulo: "Enviado para conferência", classe: "pendente" },
  aprovado: { rotulo: "Pontos recebidos", classe: "aprovado" },
  recusado: { rotulo: "Não confirmado", classe: "recusado" },
};

function CartaoAcao({
  acao,
  ocupado,
  aoMudar,
}: {
  acao: AcaoDoDesafio;
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>, celebracao?: string) => Promise<boolean>;
}) {
  const [abrindoIndicacao, definirAbrindoIndicacao] = useState(false);
  const [nomeIndicada, definirNomeIndicada] = useState("");

  const ehIndicacao = acao.chave === "indicacao";
  // Uma ação de duas vezes por semana tem dois estados ao mesmo tempo: pode
  // ter uma aprovada e outra ainda em conferência. Por isso o cartão mostra
  // uma linha por envio, e não um estado só.
  const valendo = acao.envios.filter((e) => e.status !== "recusado");
  const cabeMais = acao.podeMarcar;
  const classe = valendo.some((e) => e.status === "aprovado")
    ? "aprovado"
    : valendo.length > 0
      ? "pendente"
      : "";

  async function marcar() {
    if (ehIndicacao) {
      definirAbrindoIndicacao(true);
      return;
    }
    await aoMudar(
      () => repositorio.enviarAcao(acao.id),
      "Recebi. Assim que eu conferir, os pontos entram.",
    );
  }

  async function registrar() {
    if (!nomeIndicada.trim()) return;
    const deuCerto = await aoMudar(
      () => repositorio.registrarIndicacao(nomeIndicada.trim()),
      "Indicação registrada. Os pontos entram quando ela começar.",
    );
    if (deuCerto) {
      definirNomeIndicada("");
      definirAbrindoIndicacao(false);
    }
  }

  return (
    <article className={`c-acao ${classe}`}>
      <div className="c-acao-topo">
        <span className="c-acao-texto">
          <strong>{acao.nome}</strong>
          {acao.descricao && <span className="c-acao-descricao">{acao.descricao}</span>}
        </span>
        <span className="c-acao-pontos">+{acao.pontos}</span>
      </div>

      {/* O contador só aparece onde há mais de uma vez para marcar: no
          diário alimentar, que vale duas. Nas outras seria ruído. */}
      {acao.periodicidade === "semanal" && acao.maxPorSemana > 1 && (
        <p className="c-dica">
          {valendo.length} de {acao.maxPorSemana} nesta semana.
        </p>
      )}

      {acao.envios.map((envio) => {
        const estado = ESTADOS[envio.status];
        if (!estado) return null;
        return (
          <div className="c-acao-estado" key={envio.id}>
            <span
              className={`c-selo ${
                estado.classe === "aprovado"
                  ? "melhor"
                  : estado.classe === "recusado"
                    ? "ocasional"
                    : "neutro"
              }`}
            >
              {estado.rotulo}
            </span>
            {envio.status === "enviado" && (
              <button
                type="button"
                className="c-link"
                disabled={ocupado}
                onClick={() => void aoMudar(() => repositorio.cancelarEnvio(envio.id))}
              >
                Desfazer
              </button>
            )}
            {envio.motivoRecusa && <p className="c-dica">{envio.motivoRecusa}</p>}
          </div>
        );
      })}

      {cabeMais &&
        (abrindoIndicacao ? (
          <div className="c-acao-estado">
            <input
              className="c-campo"
              value={nomeIndicada}
              onChange={(e) => definirNomeIndicada(e.target.value)}
              placeholder="Nome de quem você indicou"
              aria-label="Nome de quem você indicou"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="c-botao c-botao-pequeno"
                disabled={ocupado || !nomeIndicada.trim()}
                onClick={() => void registrar()}
              >
                Registrar
              </button>
              <button
                type="button"
                className="c-link"
                onClick={() => definirAbrindoIndicacao(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            disabled={ocupado}
            onClick={() => void marcar()}
          >
            <Icone nome="salvos" tamanho={15} /> Marcar como feito
          </button>
        ))}

      {acao.aprovadas > 0 && (
        <p className="c-dica">
          Já rendeu pontos {acao.aprovadas} {acao.aprovadas === 1 ? "vez" : "vezes"} neste desafio.
        </p>
      )}
    </article>
  );
}

// ------------------------------------------------- a nutricionista espiando

/**
 * A nutricionista não tem cadastro de paciente, então não há para onde lançar
 * ponto nenhum. Ela vê a tela inteira, e o banco já devolve `podeMarcar`
 * falso em tudo — a faixa aqui só explica por que os botões sumiram.
 */
function AvisoDePrevia() {
  return (
    <div className="c-aviso" role="status">
      <span>
        Você está vendo a tela como sua paciente vê. Por aqui você não marca nem pontua — quem
        confere os envios é a aba Desafio do mês, na sua área.
      </span>
    </div>
  );
}

// ------------------------------------------------------- escada de indicação

/**
 * Quanto mais ela indica, mais ganha. O total não zera no fim do mês: é a
 * mesma regra dos pontos, que também não expiram.
 */
const SITUACAO_INDICACAO: Record<IndicacaoDaPaciente["status"], string> = {
  registrada: "Aguardando ela começar",
  iniciou: "Começou o acompanhamento",
  validada: "Confirmada",
  recusada: "Não confirmada",
};

function EscadaDeIndicacao({
  beneficios,
  validadas,
  indicacoes,
}: {
  beneficios: { nivel: number; texto: string; alcancado: boolean }[];
  validadas: number;
  indicacoes: IndicacaoDaPaciente[];
}) {
  if (beneficios.length === 0) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Quanto mais você indica, mais você ganha</h2>
      <p className="c-contagem">
        {validadas === 0
          ? "Você ainda não tem nenhuma indicação confirmada."
          : `Você já tem ${validadas} ${validadas === 1 ? "indicação confirmada" : "indicações confirmadas"}.`}{" "}
        As indicações não zeram no fim do mês: vão somando ao longo do tempo, como os pontos.
      </p>

      <div className="c-recompensas">
        {beneficios.map((b) => (
          <div key={b.nivel} className={`c-recompensa ${b.alcancado ? "alcancada" : ""}`}>
            <span className="c-recompensa-pontos">{b.nivel}</span>
            <span className="c-recompensa-texto">
              <strong>
                {b.nivel} {b.nivel === 1 ? "indicação" : "indicações"}
              </strong>
              <span>{b.texto}</span>
            </span>
            {b.alcancado && <span className="c-selo melhor">Alcançado</span>}
          </div>
        ))}
      </div>

      {/* Sem esta lista a indicação sumia depois de registrada: a paciente
          escrevia o nome da amiga e a tela não guardava sinal nenhum. */}
      {indicacoes.length > 0 && (
        <div className="c-ranking" style={{ marginTop: 14 }}>
          {indicacoes.map((i) => (
            <div key={i.id} className="c-ranking-linha">
              <span className="c-ranking-nome">{i.nome}</span>
              <span className="c-ranking-pontos">
                {SITUACAO_INDICACAO[i.status]}
                {i.pontos > 0 ? ` · +${i.pontos}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- recompensas

function PontoDeVirada({
  saldo,
  recompensas,
}: {
  saldo: number;
  recompensas: { id: string; pontos: number; nome: string; descricao: string | null; alcancada: boolean }[];
}) {
  if (recompensas.length === 0) return null;
  const proxima = recompensas.find((r) => !r.alcancada);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Ponto de Virada</h2>
      <p className="c-contagem">
        Seu saldo acumulado: <strong>{saldo}</strong> {saldo === 1 ? "ponto" : "pontos"}. Os pontos
        não expiram.
      </p>

      {proxima && (
        <div className="c-progresso">
          <div
            className="c-progresso-barra"
            style={{ width: `${Math.min(100, Math.round((saldo / proxima.pontos) * 100))}%` }}
          />
        </div>
      )}
      {proxima && (
        <p className="c-dica">
          Faltam {proxima.pontos - saldo} {proxima.pontos - saldo === 1 ? "ponto" : "pontos"} para{" "}
          {proxima.nome.toLowerCase()}.
        </p>
      )}

      <div className="c-recompensas">
        {recompensas.map((r) => (
          <div key={r.id} className={`c-recompensa ${r.alcancada ? "alcancada" : ""}`}>
            <span className="c-recompensa-pontos">{r.pontos}</span>
            <span className="c-recompensa-texto">
              <strong>{r.nome}</strong>
              {r.descricao && <span>{r.descricao}</span>}
            </span>
            {r.alcancada && <span className="c-selo melhor">Alcançada</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
