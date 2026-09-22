import { useCallback, useEffect, useState } from "react";
import type { MeuQuestionario, RespostaEnviada } from "@/central/types/questionario";
import { repositorio } from "@/central/dados/repositorio";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

/**
 * Onde a paciente responde o check-in da semana e os questionários.
 *
 * O QUE ESTA TELA NÃO FAZ, e é a parte que importa:
 *
 * Ela NÃO mostra pontuação. A nota existe para a nutricionista ler a
 * evolução entre consultas; devolvida para quem responde, ela vira placar —
 * e um placar muda a resposta da semana seguinte. Quem responde pensando na
 * nota deixa de responder o que sentiu.
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

  return (
    <>
      <CabecalhoPagina
        titulo="Seus questionários"
        descricao="O que a sua nutricionista quer saber de você. Leva poucos minutos."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        {carregando && <p className="c-contagem">Carregando…</p>}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="status">
            <span>{erro}</span>
          </div>
        )}
        {!carregando && !erro && lista.length === 0 && (
          <p className="c-dica">
            Nada para responder agora. Quando sua nutricionista enviar um questionário, ele
            aparece aqui.
          </p>
        )}
        {lista.map((q) => (
          <FormularioDoQuestionario key={q.id} questionario={q} aoEnviar={() => void carregar()} />
        ))}
      </div>
    </>
  );
}

function FormularioDoQuestionario({
  questionario,
  aoEnviar,
}: {
  questionario: MeuQuestionario;
  aoEnviar: () => void;
}) {
  const jaEnviado = questionario.enviados.find((e) => e.periodo === questionario.periodo);

  // Começa com o que ela já respondeu nesta semana, se respondeu: reabrir o
  // check-in e achar tudo em branco pareceria que a resposta se perdeu.
  const [valores, definirValores] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const r of jaEnviado?.respostas ?? []) {
      inicial[r.perguntaId] = r.numero !== null ? String(r.numero) : (r.texto ?? "");
    }
    return inicial;
  });
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [enviado, definirEnviado] = useState(false);

  function definir(perguntaId: string, valor: string) {
    definirValores({ ...valores, [perguntaId]: valor });
    definirEnviado(false);
  }

  const faltando = questionario.perguntas.filter(
    (p) => p.obrigatoria && (valores[p.id] ?? "").trim() === "",
  );

  async function enviar() {
    if (faltando.length > 0) {
      definirErro(
        faltando.length === 1
          ? "Falta responder uma pergunta."
          : `Faltam ${faltando.length} perguntas.`,
      );
      return;
    }
    definirEnviando(true);
    definirErro(null);
    try {
      const respostas: RespostaEnviada[] = questionario.perguntas.map((p) => {
        const bruto = (valores[p.id] ?? "").trim();
        const numerico = p.tipo === "escala" || p.tipo === "sim_nao" || p.tipo === "numero";
        return {
          perguntaId: p.id,
          numero: numerico && bruto !== "" ? Number(bruto.replace(",", ".")) : null,
          texto: numerico ? null : bruto || null,
        };
      });
      await repositorio.responderQuestionario(questionario.id, respostas);
      definirEnviado(true);
      aoEnviar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <div className="c-bloco" style={{ marginTop: 16 }}>
      <h2 className="c-secao-titulo" style={{ marginTop: 0 }}>
        {questionario.titulo}
      </h2>
      {questionario.descricao && <p className="c-dica">{questionario.descricao}</p>}
      {questionario.periodicidade === "semanal" && (
        <p className="c-dica">
          {questionario.pendente
            ? "Esta semana ainda está em aberto."
            : "Você já respondeu esta semana. Pode mudar suas respostas até domingo."}
        </p>
      )}

      {questionario.perguntas.map((p) => (
        <div key={p.id} className="c-pergunta">
          <p className="c-pergunta-texto">
            {p.texto}
            {!p.obrigatoria && <span className="c-dica"> (opcional)</span>}
          </p>

          {p.tipo === "escala" && (
            <div className="c-escala" role="group" aria-label={p.texto}>
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  className="c-escala-numero"
                  aria-pressed={(valores[p.id] ?? "") === String(n)}
                  onClick={() => definir(p.id, String(n))}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "sim_nao" && (
            <div className="c-chips">
              {[
                { v: "1", r: "Sim" },
                { v: "0", r: "Não" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className="c-chip"
                  aria-pressed={(valores[p.id] ?? "") === o.v}
                  onClick={() => definir(p.id, o.v)}
                >
                  {o.r}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "escolha" && (
            <div className="c-chips">
              {p.opcoes.map((o) => (
                <button
                  key={o}
                  type="button"
                  className="c-chip"
                  aria-pressed={(valores[p.id] ?? "") === o}
                  onClick={() => definir(p.id, o)}
                >
                  {o}
                </button>
              ))}
            </div>
          )}

          {p.tipo === "numero" && (
            <input
              className="c-campo"
              type="text"
              inputMode="decimal"
              value={valores[p.id] ?? ""}
              onChange={(e) => definir(p.id, e.target.value)}
            />
          )}

          {p.tipo === "texto" && (
            <textarea
              className="c-campo"
              rows={3}
              value={valores[p.id] ?? ""}
              onChange={(e) => definir(p.id, e.target.value)}
            />
          )}
        </div>
      ))}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      {enviado && !erro && (
        // Confirmação, e não elogio: ela precisa saber que chegou, não ouvir
        // que foi bem. Check-in é registro, não prova.
        <div className="c-aviso c-aviso-ok" role="status">
          <span>Respostas enviadas.</span>
        </div>
      )}

      <button
        type="button"
        className="c-botao"
        onClick={() => void enviar()}
        disabled={enviando}
      >
        {enviando ? "Enviando…" : jaEnviado ? "Atualizar respostas" : "Enviar"}
      </button>
    </div>
  );
}
