import { useCallback, useEffect, useState } from "react";
import type { Paciente } from "@/central/types";
import type {
  Questionario,
  PerguntaQuestionario,
  PeriodicidadeQuestionario,
  TipoDePergunta,
} from "@/central/types/questionario";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto, AreaTexto } from "@/central/admin/componentes/Campos";
import { alternar, todas, moverRecolhidas, removerRecolhida } from "@/central/utils/recolherRefeicoes";

/**
 * Questionários e check-in semanal — área da nutricionista.
 *
 * UMA TELA SÓ PARA OS DOIS, porque um check-in semanal É um questionário
 * que volta toda segunda. Ver o cabeçalho da migração 0041.
 *
 * NÃO HÁ QUESTIONÁRIO PRONTO nesta tela, pelo mesmo motivo das metas: uma
 * lista fixa é sempre a lista que faltou no dia em que ela precisou de
 * outra coisa. Ela escreve as perguntas.
 *
 * O PESO E A INVERSÃO só aparecem aqui, e nunca para a paciente. São a
 * régua com que a pontuação é contada, e saber que uma pergunta "vale mais"
 * muda a resposta de quem responde.
 */

const TIPOS: { valor: TipoDePergunta; rotulo: string }[] = [
  { valor: "escala", rotulo: "Escala de 0 a 10" },
  { valor: "sim_nao", rotulo: "Sim ou não" },
  { valor: "numero", rotulo: "Número" },
  { valor: "texto", rotulo: "Texto livre" },
  { valor: "escolha", rotulo: "Escolha entre opções" },
];

function perguntaVazia(): PerguntaQuestionario {
  return {
    id: null,
    texto: "",
    tipo: "escala",
    obrigatoria: true,
    opcoes: [],
    peso: 1,
    invertida: false,
    respondida: false,
  };
}

export function Questionarios() {
  const [lista, definirLista] = useState<Questionario[]>([]);
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [editando, definirEditando] = useState<Questionario | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      const [qs, ps] = await Promise.all([
        repositorio.listarQuestionarios(),
        repositorio.listarPacientes(),
      ]);
      definirLista(qs);
      definirPacientes(ps);
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar os questionários.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function novo(periodicidade: PeriodicidadeQuestionario) {
    definirEditando({
      id: "",
      titulo: periodicidade === "semanal" ? "Check-in da semana" : "",
      descricao: null,
      periodicidade,
      ativo: true,
      criadoEm: "",
      pacientes: 0,
      respostas: 0,
      perguntas: [perguntaVazia()],
    });
  }

  if (editando) {
    return (
      <EditorDeQuestionario
        questionario={editando}
        pacientes={pacientes}
        aoFechar={() => {
          definirEditando(null);
          void carregar();
        }}
      />
    );
  }

  return (
    <>
      <h1 className="c-titulo">Questionários</h1>
      <p className="c-dica">
        Um check-in semanal volta toda segunda-feira; um questionário de vez única é
        respondido uma vez só. As perguntas são suas — não existe lista pronta aqui.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      <div className="c-barra-recolher" style={{ justifyContent: "flex-start", gap: 12 }}>
        <button type="button" className="c-botao" onClick={() => novo("semanal")}>
          + Check-in semanal
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={() => novo("unica")}>
          + Questionário de vez única
        </button>
      </div>

      {carregando && <p className="c-contagem">Carregando…</p>}

      {!carregando && lista.length === 0 && (
        <p className="c-dica">
          Nenhum questionário ainda. Comece pelo check-in semanal: três ou quatro perguntas
          curtas já dão uma série que mostra a evolução de semana a semana.
        </p>
      )}

      <div className="c-lista" style={{ marginTop: 16 }}>
        {lista.map((q) => (
          <button
            key={q.id}
            type="button"
            className="c-lista-item c-meta-clicavel"
            onClick={() => definirEditando(q)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="c-lista-item-nome">{q.titulo}</span>
              <span className="c-lista-item-apoio">
                {q.periodicidade === "semanal" ? "Check-in semanal" : "Vez única"} ·{" "}
                {q.perguntas.length}{" "}
                {q.perguntas.length === 1 ? "pergunta" : "perguntas"} · {q.pacientes}{" "}
                {q.pacientes === 1 ? "paciente" : "pacientes"} ·{" "}
                {/* Zero respostas diz "nenhuma resposta", e não "0": ela está
                    lendo uma lista, não um relatório. */}
                {q.respostas === 0
                  ? "nenhuma resposta"
                  : `${q.respostas} ${q.respostas === 1 ? "resposta" : "respostas"}`}
              </span>
            </span>
            {!q.ativo && (
              <span className="c-lista-item-direita">
                <span className="c-selo ocasional">desligado</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

function EditorDeQuestionario({
  questionario,
  pacientes,
  aoFechar,
}: {
  questionario: Questionario;
  pacientes: Paciente[];
  aoFechar: () => void;
}) {
  const novoQuestionario = questionario.id === "";
  const [titulo, definirTitulo] = useState(questionario.titulo);
  const [descricao, definirDescricao] = useState(questionario.descricao ?? "");
  const [ativo, definirAtivo] = useState(questionario.ativo);
  const [perguntas, definirPerguntas] = useState<PerguntaQuestionario[]>(questionario.perguntas);
  // Mesmo recurso do montador de protocolo, pela mesma razão: dez perguntas
  // abertas viram uma página inteira de campos.
  const [recolhidas, definirRecolhidas] = useState<ReadonlySet<number>>(new Set<number>());
  const [atribuidas, definirAtribuidas] = useState<Set<string>>(new Set());
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    if (novoQuestionario) return;
    // Quem responde este questionário hoje. Uma ida por paciente é
    // aceitável no tamanho da lista dela (dezenas, não milhares).
    let vivo = true;
    void (async () => {
      const marcadas = new Set<string>();
      for (const p of pacientes) {
        try {
          const qs = await repositorio.questionariosDoPaciente(p.id);
          if (qs.some((q) => q.id === questionario.id && q.atribuido)) marcadas.add(p.id);
        } catch {
          /* uma paciente que não carregou não pode derrubar a tela inteira */
        }
      }
      if (vivo) definirAtribuidas(marcadas);
    })();
    return () => {
      vivo = false;
    };
  }, [novoQuestionario, pacientes, questionario.id]);

  function trocar(i: number, nova: PerguntaQuestionario) {
    definirPerguntas(perguntas.map((p, j) => (j === i ? nova : p)));
  }

  async function salvar() {
    if (!titulo.trim()) {
      definirErro("O questionário precisa de um título.");
      return;
    }
    const limpas = perguntas.filter((p) => p.texto.trim() !== "");
    if (limpas.length === 0) {
      definirErro("Escreva pelo menos uma pergunta.");
      return;
    }
    definirSalvando(true);
    definirErro(null);
    try {
      await repositorio.salvarQuestionario(
        novoQuestionario ? null : questionario.id,
        titulo.trim(),
        descricao.trim() || null,
        questionario.periodicidade,
        ativo,
        limpas,
      );
      aoFechar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
      definirSalvando(false);
    }
  }

  async function alternarPaciente(pacienteId: string) {
    const ligar = !atribuidas.has(pacienteId);
    try {
      const estado = await repositorio.definirQuestionarioDoPaciente(
        questionario.id,
        pacienteId,
        ligar,
      );
      // O estado GRAVADO, não o que o clique pediu.
      const proximo = new Set(atribuidas);
      if (estado) proximo.add(pacienteId);
      else proximo.delete(pacienteId);
      definirAtribuidas(proximo);
      definirAviso(estado ? "Questionário ligado para esta paciente." : "Desligado para esta paciente.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar a atribuição.");
    }
  }

  return (
    <>
      <button type="button" className="c-link" onClick={aoFechar}>
        ← Voltar aos questionários
      </button>

      <h1 className="c-titulo" style={{ marginTop: 8 }}>
        {questionario.periodicidade === "semanal" ? "Check-in semanal" : "Questionário"}
      </h1>

      <Campo rotulo="Título">
        <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Check-in da semana" />
      </Campo>
      <Campo rotulo="Descrição (opcional)" dica="Aparece para a paciente acima das perguntas.">
        <AreaTexto valor={descricao} aoMudar={definirDescricao} linhas={2} />
      </Campo>

      <label className="c-acesso-linha">
        <input type="checkbox" checked={ativo} onChange={(e) => definirAtivo(e.target.checked)} />
        <span>
          Ligado
          <span className="c-dica" style={{ display: "block" }}>
            Desligado, ele some da tela de todas as pacientes — mas as respostas já
            enviadas continuam guardadas.
          </span>
        </span>
      </label>

      <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Perguntas
      </h2>
      {questionario.periodicidade === "semanal" && (
        <p className="c-dica" style={{ marginTop: 0 }}>
          A pontuação da semana sai das perguntas de <strong>escala</strong> e{" "}
          <strong>sim/não</strong>, pelo peso de cada uma. Peso zero tira da conta sem tirar
          da tela.
        </p>
      )}

      {perguntas.length > 1 && (
        <div className="c-barra-recolher">
          <button
            type="button"
            className="c-link"
            onClick={() => definirRecolhidas(todas(perguntas.length))}
            disabled={recolhidas.size === perguntas.length}
          >
            Minimizar todas
          </button>
          <button
            type="button"
            className="c-link"
            onClick={() => definirRecolhidas(new Set<number>())}
            disabled={recolhidas.size === 0}
          >
            Abrir todas
          </button>
        </div>
      )}

      {perguntas.map((pergunta, i) => (
        <BlocoDaPergunta
          key={i}
          pergunta={pergunta}
          numero={i + 1}
          semanal={questionario.periodicidade === "semanal"}
          primeira={i === 0}
          ultima={i === perguntas.length - 1}
          recolhida={recolhidas.has(i)}
          aoRecolher={() => definirRecolhidas(alternar(recolhidas, i))}
          aoTrocar={(nova) => trocar(i, nova)}
          aoRemover={() => {
            definirRecolhidas(removerRecolhida(recolhidas, i));
            definirPerguntas(perguntas.filter((_, j) => j !== i));
          }}
          aoMover={(passo) => {
            const destino = i + passo;
            if (destino < 0 || destino >= perguntas.length) return;
            const copia = [...perguntas];
            const aqui = copia[i];
            const la = copia[destino];
            if (!aqui || !la) return;
            copia[i] = la;
            copia[destino] = aqui;
            definirRecolhidas(moverRecolhidas(recolhidas, i, destino));
            definirPerguntas(copia);
          }}
        />
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario"
        style={{ marginTop: 12 }}
        onClick={() => definirPerguntas([...perguntas, perguntaVazia()])}
      >
        + Acrescentar pergunta
      </button>

      {(aviso || erro) && (
        <div className={`c-aviso ${erro ? "c-aviso-erro" : "c-aviso-ok"}`} role="status">
          <span>{erro ?? aviso}</span>
        </div>
      )}

      <button
        type="button"
        className="c-botao"
        style={{ marginTop: 16 }}
        onClick={() => void salvar()}
        disabled={salvando}
      >
        {salvando ? "Salvando…" : "Salvar questionário"}
      </button>

      {!novoQuestionario && (
        <>
          <h2 className="c-secao-titulo" style={{ marginTop: 26 }}>
            Quem responde
          </h2>
          <p className="c-dica" style={{ marginTop: 0 }}>
            Desligar para uma paciente é “pare de perguntar”, e não “esqueça o que ela
            disse”: as respostas dela continuam no prontuário.
          </p>
          {pacientes.length === 0 && <p className="c-dica">Nenhuma paciente cadastrada ainda.</p>}
          {pacientes.map((p) => (
            <label key={p.id} className="c-acesso-linha">
              <input
                type="checkbox"
                checked={atribuidas.has(p.id)}
                onChange={() => void alternarPaciente(p.id)}
              />
              <span>{p.nome}</span>
            </label>
          ))}
        </>
      )}
    </>
  );
}

function BlocoDaPergunta({
  pergunta,
  numero,
  semanal,
  primeira,
  ultima,
  recolhida,
  aoRecolher,
  aoTrocar,
  aoRemover,
  aoMover,
}: {
  pergunta: PerguntaQuestionario;
  numero: number;
  semanal: boolean;
  primeira: boolean;
  ultima: boolean;
  recolhida: boolean;
  aoRecolher: () => void;
  aoTrocar: (nova: PerguntaQuestionario) => void;
  aoRemover: () => void;
  aoMover: (passo: -1 | 1) => void;
}) {
  const idConteudo = `pergunta-${numero}`;
  const pontua = pergunta.tipo === "escala" || pergunta.tipo === "sim_nao";

  return (
    <div className={`c-bloco${recolhida ? " c-bloco-recolhido" : ""}`}>
      <div className="c-bloco-topo">
        <button
          type="button"
          className="c-recolher"
          onClick={aoRecolher}
          aria-expanded={!recolhida}
          aria-controls={idConteudo}
          title={recolhida ? "Abrir esta pergunta" : "Minimizar esta pergunta"}
        >
          <span aria-hidden="true">{recolhida ? "▸" : "▾"}</span>
          <span className="c-so-leitor">
            {recolhida ? "Abrir esta pergunta" : "Minimizar esta pergunta"}
          </span>
        </button>
        <Texto
          valor={pergunta.texto}
          aoMudar={(v) => aoTrocar({ ...pergunta, texto: v })}
          placeholder={`Pergunta ${numero}`}
        />
        <span className="c-acoes-refeicao">
          <button type="button" className="c-link" disabled={primeira} onClick={() => aoMover(-1)}>
            ↑
          </button>
          <button type="button" className="c-link" disabled={ultima} onClick={() => aoMover(1)}>
            ↓
          </button>
          {/* Pergunta já respondida não pode sumir: a resposta iria junto.
              O botão some, em vez de aparecer e recusar depois do clique. */}
          {!pergunta.respondida && (
            <button type="button" className="c-link" onClick={aoRemover}>
              Remover
            </button>
          )}
        </span>
      </div>

      {recolhida && (
        <p className="c-resumo-recolhido">
          {TIPOS.find((t) => t.valor === pergunta.tipo)?.rotulo ?? pergunta.tipo}
          {semanal && pontua && ` · peso ${pergunta.peso}`}
          {semanal && pontua && pergunta.invertida && " · invertida"}
        </p>
      )}

      <div id={idConteudo} hidden={recolhida}>
        <Campo rotulo="Tipo de resposta">
          <Selecao
            valor={pergunta.tipo}
            aoMudar={(v) => aoTrocar({ ...pergunta, tipo: v })}
            opcoes={TIPOS.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
          />
        </Campo>

        {pergunta.tipo === "escolha" && (
          <Campo rotulo="Opções" dica="Separe por ponto e vírgula. Exemplo: Nunca; Às vezes; Sempre">
            <Texto
              valor={pergunta.opcoes.join("; ")}
              aoMudar={(v) =>
                aoTrocar({
                  ...pergunta,
                  opcoes: v
                    .split(";")
                    .map((x) => x.trim())
                    .filter((x) => x !== ""),
                })
              }
            />
          </Campo>
        )}

        {semanal && pontua && (
          <div className="c-duas-colunas">
            <Campo
              rotulo="Peso na pontuação"
              dica="1 é o normal. 0 tira da conta sem tirar a pergunta da tela."
            >
              <Texto
                valor={String(pergunta.peso)}
                aoMudar={(v) => {
                  const n = Number(v.replace(",", "."));
                  aoTrocar({ ...pergunta, peso: Number.isFinite(n) && n >= 0 ? n : pergunta.peso });
                }}
              />
            </Campo>
            <Campo rotulo=" ">
              <label className="c-acesso-linha">
                <input
                  type="checkbox"
                  checked={pergunta.invertida}
                  onChange={(e) => aoTrocar({ ...pergunta, invertida: e.target.checked })}
                />
                <span>
                  10 é ruim
                  <span className="c-dica" style={{ display: "block" }}>
                    Marque em perguntas como “quanta dor você sentiu”. Sem isto, a semana
                    pior aumentaria a pontuação.
                  </span>
                </span>
              </label>
            </Campo>
          </div>
        )}

        <label className="c-acesso-linha">
          <input
            type="checkbox"
            checked={pergunta.obrigatoria}
            onChange={(e) => aoTrocar({ ...pergunta, obrigatoria: e.target.checked })}
          />
          <span>Obrigatória</span>
        </label>

        {pergunta.respondida && (
          <p className="c-dica">
            Alguém já respondeu esta pergunta. Você pode corrigir o texto — as respostas
            continuam guardadas —, mas não dá para apagá-la sem perder o que já foi dito.
          </p>
        )}
      </div>
    </div>
  );
}
