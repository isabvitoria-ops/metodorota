import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EnvioDeQuestionario,
  MeuQuestionario,
  PerguntaParaResponder,
  RespostaEnviada,
} from "@/central/types/questionario";
import { repositorio } from "@/central/dados/repositorio";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

/**
 * Onde a paciente responde o check-in da semana e os questionários.
 *
 * Duas abas, como na referência que a nutricionista mandou: PENDENTES (o que
 * falta responder agora) e HISTÓRICO (o que ela já mandou, para reler). E o
 * formulário é UMA PERGUNTA POR TELA, com "6/15" no alto: quinze perguntas
 * de uma vez numa tela de celular parecem uma prova; uma de cada vez, com o
 * fim à vista, se respondem no ônibus.
 *
 * O QUE ESTA TELA NÃO FAZ, e é a parte que importa:
 *
 * Ela NÃO mostra pontuação. A nota existe para a nutricionista ler a
 * evolução entre consultas; devolvida para quem responde, ela vira placar —
 * e um placar muda a resposta da semana seguinte. Quem responde pensando na
 * nota deixa de responder o que sentiu. O histórico mostra as respostas
 * dela, como ela deu, e nada além.
 *
 * Ela também NÃO mostra peso nem quais perguntas "valem mais" (a função do
 * banco nem devolve esses campos).
 *
 * E não há elogio nem cobrança em lugar nenhum: nem "muito bem!" ao enviar,
 * nem "você está devendo a semana passada". Check-in é registro, não prova.
 */
export function Questionarios() {
  const [lista, definirLista] = useState<MeuQuestionario[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [aba, definirAba] = useState<"pendentes" | "historico">("pendentes");
  const [respondendo, definirRespondendo] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      definirLista(await repositorio.meusQuestionarios());
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aberto = lista.find((q) => q.id === respondendo);
  if (aberto) {
    return (
      <>
        <CabecalhoPagina titulo={aberto.titulo} voltarPara={rotas.home} />
        <div className="c-conteudo">
          <FormularioPassoAPasso
            key={aberto.id}
            questionario={aberto}
            aoSair={() => definirRespondendo(null)}
            aoEnviar={() => {
              definirRespondendo(null);
              // Confirmação, e não elogio: ela precisa saber que chegou, não
              // ouvir que foi bem.
              definirAviso(`Respostas de “${aberto.titulo}” enviadas.`);
              void carregar();
            }}
          />
        </div>
      </>
    );
  }

  const pendentes = lista.filter((q) => q.pendente);
  const comHistorico = lista.filter((q) => q.enviados.length > 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Seus questionários"
        descricao="O que a sua nutricionista quer saber de você. Leva poucos minutos."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        <div className="c-segmentos" role="tablist" aria-label="Questionários">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "pendentes"}
            className="c-segmento"
            onClick={() => definirAba("pendentes")}
          >
            Pendentes
            {pendentes.length > 0 && <span className="c-segmento-conta">{pendentes.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "historico"}
            className="c-segmento"
            onClick={() => definirAba("historico")}
          >
            Histórico
          </button>
        </div>

        {carregando && <p className="c-contagem">Carregando…</p>}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="status">
            <span>{erro}</span>
          </div>
        )}
        {aviso && (
          <div className="c-aviso c-aviso-ok" role="status">
            <span>{aviso}</span>
          </div>
        )}

        {!carregando && !erro && aba === "pendentes" && (
          <>
            {pendentes.length === 0 && (
              <p className="c-dica">
                {lista.length === 0
                  ? "Nada para responder agora. Quando sua nutricionista enviar um questionário, ele aparece aqui."
                  : "Nada pendente agora. O que você já respondeu está no Histórico."}
              </p>
            )}
            {pendentes.map((q) => (
              <div key={q.id} className="c-bloco c-questionario-cartao">
                <h2 className="c-secao-titulo" style={{ marginTop: 0 }}>
                  {q.titulo}
                </h2>
                {q.descricao && <p className="c-dica">{q.descricao}</p>}
                <p className="c-dica">
                  {q.perguntas.length} {q.perguntas.length === 1 ? "pergunta" : "perguntas"}
                  {q.periodicidade === "semanal" && " · check-in desta semana"}
                </p>
                <button
                  type="button"
                  className="c-botao"
                  onClick={() => {
                    definirAviso(null);
                    definirRespondendo(q.id);
                  }}
                >
                  Começar
                </button>
              </div>
            ))}
          </>
        )}

        {!carregando && !erro && aba === "historico" && (
          <>
            {comHistorico.length === 0 && (
              <p className="c-dica">Você ainda não enviou nenhuma resposta.</p>
            )}
            {comHistorico.map((q) => (
              <HistoricoDoQuestionario
                key={q.id}
                questionario={q}
                aoMudar={() => {
                  definirAviso(null);
                  definirRespondendo(q.id);
                }}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function HistoricoDoQuestionario({
  questionario,
  aoMudar,
}: {
  questionario: MeuQuestionario;
  aoMudar: () => void;
}) {
  const semanal = questionario.periodicidade === "semanal";
  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{questionario.titulo}</h2>
      {questionario.enviados.map((envio, i) => {
        // Só a resposta do período de agora ainda pode mudar (até domingo,
        // no check-in); as de antes são registro.
        const editavel = envio.periodo === questionario.periodo;
        return (
          <details key={envio.periodo} className="c-envio" open={i === 0}>
            <summary>
              {semanal ? `Semana de ${diaCurto(envio.periodo)}` : diaCurto(envio.periodo)}
              {editavel && semanal && <span className="c-envio-nota"> · pode mudar até domingo</span>}
            </summary>
            <RespostasDoEnvio perguntas={questionario.perguntas} envio={envio} />
            {editavel && (
              <button type="button" className="c-chip" onClick={aoMudar}>
                Mudar respostas
              </button>
            )}
          </details>
        );
      })}
    </section>
  );
}

/** As respostas dela, como ela deu. Sem carinha, sem nota, sem cor. */
function RespostasDoEnvio({
  perguntas,
  envio,
}: {
  perguntas: PerguntaParaResponder[];
  envio: EnvioDeQuestionario;
}) {
  const porId = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
  return (
    <dl className="c-respostas">
      {perguntas.map((p) => (
        <div key={p.id} className="c-resposta-linha">
          <dt>{p.texto}</dt>
          <dd>{textoDaResposta(p, porId.get(p.id))}</dd>
        </div>
      ))}
    </dl>
  );
}

function textoDaResposta(p: PerguntaParaResponder, r: RespostaEnviada | undefined): string {
  if (!r || (r.numero === null && (r.texto ?? "").trim() === "")) return "—";
  if (p.tipo === "sim_nao") return r.numero !== null && r.numero > 0 ? "Sim" : "Não";
  if (p.tipo === "escala") return `${r.numero ?? "—"} de 10`;
  if (r.numero !== null) return r.numero.toLocaleString("pt-BR");
  return r.texto ?? "—";
}

function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function preenchida(valor: string | undefined): boolean {
  return (valor ?? "").trim() !== "";
}

/**
 * Uma pergunta por tela.
 *
 * Nas perguntas de tocar (0 a 10, sim/não, escolha) a tela avança sozinha
 * logo depois do toque — é o que faz o formulário andar no ritmo do polegar.
 * Nas de escrever, não: avançar no meio da frase seria arrancar o teclado
 * dela. E nunca na última: enviar tem que ser um toque de propósito.
 */
function FormularioPassoAPasso({
  questionario,
  aoSair,
  aoEnviar,
}: {
  questionario: MeuQuestionario;
  aoSair: () => void;
  aoEnviar: () => void;
}) {
  const perguntas = questionario.perguntas;
  const jaEnviado = questionario.enviados.find((e) => e.periodo === questionario.periodo);

  // Começa com o que ela já respondeu neste período, se respondeu: reabrir
  // e achar tudo em branco pareceria que a resposta se perdeu.
  const [valores, definirValores] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const r of jaEnviado?.respostas ?? []) {
      inicial[r.perguntaId] = r.numero !== null ? String(r.numero) : (r.texto ?? "");
    }
    return inicial;
  });
  const [indice, definirIndice] = useState(0);
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const temporizador = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    },
    [],
  );

  const pergunta = perguntas[indice];
  if (!pergunta) {
    return (
      <p className="c-dica">
        Este questionário ainda não tem perguntas.{" "}
        <button type="button" className="c-chip" onClick={aoSair}>
          Voltar
        </button>
      </p>
    );
  }
  const atual: PerguntaParaResponder = pergunta;
  const ultima = indice === perguntas.length - 1;
  const valor = valores[atual.id];
  const respondida = preenchida(valor);

  function cancelarAvanco() {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
  }

  function irPara(novo: number) {
    cancelarAvanco();
    definirErro(null);
    definirIndice(Math.min(Math.max(novo, 0), perguntas.length - 1));
  }

  function tocar(v: string) {
    definirValores((antes) => ({ ...antes, [atual.id]: v }));
    definirErro(null);
    if (ultima) return;
    cancelarAvanco();
    const daqui = indice;
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null;
      definirIndice(daqui + 1);
    }, 350);
  }

  function escrever(v: string) {
    definirValores((antes) => ({ ...antes, [atual.id]: v }));
    definirErro(null);
  }

  async function enviar() {
    const faltando = perguntas.findIndex((p) => p.obrigatoria && !preenchida(valores[p.id]));
    if (faltando >= 0) {
      // Leva até a que falta, em vez de só avisar: com uma pergunta por
      // tela, "falta a 4" obrigaria a voltar contando.
      definirIndice(faltando);
      definirErro("Esta pergunta precisa de resposta.");
      return;
    }
    definirEnviando(true);
    definirErro(null);
    try {
      const respostas: RespostaEnviada[] = perguntas.map((p) => {
        const bruto = (valores[p.id] ?? "").trim();
        const numerico = p.tipo === "escala" || p.tipo === "sim_nao" || p.tipo === "numero";
        return {
          perguntaId: p.id,
          numero: numerico && bruto !== "" ? Number(bruto.replace(",", ".")) : null,
          texto: numerico ? null : bruto || null,
        };
      });
      await repositorio.responderQuestionario(questionario.id, respostas);
      aoEnviar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  const progresso = Math.round(((indice + 1) / perguntas.length) * 100);

  return (
    <div className="c-passo">
      <div className="c-passo-topo">
        <span className="c-passo-conta" aria-live="polite">
          {indice + 1}/{perguntas.length}
        </span>
        <button type="button" className="c-chip" onClick={aoSair}>
          Sair
        </button>
      </div>
      <div
        className="c-progresso"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={perguntas.length}
        aria-valuenow={indice + 1}
        aria-label="Pergunta"
      >
        <div className="c-progresso-barra" style={{ width: `${progresso}%` }} />
      </div>

      <div className="c-pergunta c-passo-pergunta">
        <p className="c-pergunta-texto">
          {atual.texto}
          {!atual.obrigatoria && <span className="c-dica"> (opcional)</span>}
        </p>

        {atual.tipo === "escala" && (
          <>
            <div className="c-escala" role="group" aria-label={atual.texto}>
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  className="c-escala-numero"
                  aria-pressed={valor === String(n)}
                  onClick={() => tocar(String(n))}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="c-escala-pontas" aria-hidden="true">
              <span>0 · nada</span>
              <span>10 · muito</span>
            </div>
          </>
        )}

        {atual.tipo === "sim_nao" && (
          <div className="c-passo-opcoes">
            {[
              { v: "1", r: "Sim" },
              { v: "0", r: "Não" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                className="c-passo-opcao"
                aria-pressed={valor === o.v}
                onClick={() => tocar(o.v)}
              >
                {o.r}
              </button>
            ))}
          </div>
        )}

        {atual.tipo === "escolha" && (
          <div className="c-passo-opcoes">
            {atual.opcoes.map((o) => (
              <button
                key={o}
                type="button"
                className="c-passo-opcao"
                aria-pressed={valor === o}
                onClick={() => tocar(o)}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {atual.tipo === "numero" && (
          <input
            className="c-campo"
            type="text"
            inputMode="decimal"
            aria-label={atual.texto}
            value={valor ?? ""}
            onChange={(e) => escrever(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !ultima) irPara(indice + 1);
            }}
          />
        )}

        {atual.tipo === "texto" && (
          <textarea
            className="c-campo"
            rows={4}
            aria-label={atual.texto}
            value={valor ?? ""}
            onChange={(e) => escrever(e.target.value)}
          />
        )}
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-passo-acoes">
        <button
          type="button"
          className="c-botao c-botao-secundario"
          onClick={() => irPara(indice - 1)}
          disabled={indice === 0}
        >
          Voltar
        </button>
        {ultima ? (
          <button
            type="button"
            className="c-botao"
            onClick={() => void enviar()}
            disabled={enviando}
          >
            {enviando ? "Enviando…" : jaEnviado ? "Atualizar respostas" : "Enviar"}
          </button>
        ) : (
          <button
            type="button"
            className="c-botao"
            onClick={() => {
              if (atual.obrigatoria && !respondida) {
                definirErro("Esta pergunta precisa de resposta.");
                return;
              }
              irPara(indice + 1);
            }}
          >
            {!atual.obrigatoria && !respondida ? "Pular" : "Próxima"}
          </button>
        )}
      </div>
    </div>
  );
}
