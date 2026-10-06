import { useCallback, useEffect, useState } from "react";
import type { Paciente } from "@/central/types";
import type {
  Questionario,
  PerguntaQuestionario,
  PeriodicidadeQuestionario,
  TipoDePergunta,
  EixoCheckin,
  AlertaPendente,
  CheckinPendente,
} from "@/central/types/questionario";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto, AreaTexto } from "@/central/admin/componentes/Campos";
import { alternar, todas, moverRecolhidas, removerRecolhida } from "@/central/utils/recolherRefeicoes";
import { numeroDeTexto } from "@/central/utils/numero";
import { Esqueleto } from "@/central/components/Esqueleto";
import { MODELOS_ANAMNESE, type ModeloDeAnamnese } from "@/central/dados/sementes/anamnese";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { linkDoWhatsapp, mensagemDeCheckin } from "@/central/utils/cobranca";

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
 * CADA CHECK-IN É UM MODELO. Ela monta uma vez, salva e libera para quantas
 * pacientes quiser; paciente nova que "se encaixa" naquele modelo recebe o
 * mesmo com um clique (aqui, em "Liberar para", ou no prontuário dela).
 * Quer um parecido mas diferente? "Duplicar" copia as perguntas para um
 * modelo novo, sem mexer no original nem em quem já responde o original.
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

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function perguntaVazia(): PerguntaQuestionario {
  return {
    id: null,
    texto: "",
    tipo: "escala",
    obrigatoria: true,
    opcoes: [],
    peso: 1,
    invertida: false,
    eixoId: null,
    pontosOpcoes: [],
    respondida: false,
    codigo: null,
    cadencia: "semanal",
    regraExibicao: null,
    modulo: null,
    versoes: null,
    explicacaoOpcoes: [],
    textoAjuda: null,
    notasPorFaixa: null,
    alertasOpcoes: [],
    ativa: true,
  };
}

const STATUS_ALERTA: { valor: string; rotulo: string }[] = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "visto", rotulo: "Visto" },
  { valor: "contatado", rotulo: "Contatado" },
  { valor: "resolvido", rotulo: "Resolvido" },
];

function PainelDePendentes({
  pendentes,
  nomeCentral,
}: {
  pendentes: CheckinPendente[];
  nomeCentral: string;
}) {
  const [aberto, definirAberto] = useState(true);

  const porQuestionario = pendentes.reduce<Record<string, { titulo: string; pacientes: CheckinPendente[] }>>(
    (acc, p) => {
      if (!acc[p.questionarioId]) {
        acc[p.questionarioId] = { titulo: p.questionarioTitulo, pacientes: [] };
      }
      acc[p.questionarioId]!.pacientes.push(p);
      return acc;
    },
    {},
  );

  return (
    <div className="c-painel-alertas" style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="c-painel-alertas-cabecalho"
        onClick={() => definirAberto(!aberto)}
        aria-expanded={aberto}
      >
        <span className="c-painel-alertas-titulo">
          <span className="c-painel-alertas-indicador" aria-hidden="true">📋</span>
          Pendentes da semana
          <span className="c-painel-alertas-contagem">{pendentes.length}</span>
        </span>
        <span className="c-painel-alertas-seta" aria-hidden="true">
          {aberto ? "▲" : "▼"}
        </span>
      </button>

      {aberto && (
        <div className="c-painel-alertas-corpo">
          {Object.entries(porQuestionario).map(([qId, grupo]) => (
            <div key={qId} className="c-painel-alertas-grupo">
              <p className="c-painel-alertas-grupo-titulo">
                {grupo.titulo} — {grupo.pacientes.length}{" "}
                {grupo.pacientes.length === 1 ? "pendente" : "pendentes"}
              </p>
              {grupo.pacientes.map((p) => {
                const msg = mensagemDeCheckin(p.nome, grupo.titulo, nomeCentral);
                const whats = linkDoWhatsapp(p.telefone, msg);
                return (
                  <div key={p.pacienteId + p.questionarioId} className="c-cartao-alerta" style={{ gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>{p.nome}</strong>
                      {!p.telefone && (
                        <span className="c-dica" style={{ marginLeft: 8 }}>sem telefone</span>
                      )}
                    </span>
                    {whats ? (
                      <a
                        href={whats}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="c-chip c-chip-cobrar"
                      >
                        Lembrar
                      </a>
                    ) : (
                      <span className="c-dica">sem WhatsApp</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PainelDeAlertas({
  alertas,
  aoAtualizar,
}: {
  alertas: AlertaPendente[];
  aoAtualizar: () => void;
}) {
  const [aberto, definirAberto] = useState(true);
  const [salvando, definirSalvando] = useState<Set<string>>(new Set());
  const [notaAberta, definirNotaAberta] = useState<string | null>(null);
  const [textoNota, definirTextoNota] = useState("");
  const [erro, definirErro] = useState<string | null>(null);

  const vermelhos = alertas.filter((a) => a.nivel === "vermelho");
  const amarelos = alertas.filter((a) => a.nivel === "amarelo");

  function marcarSalvando(id: string) {
    definirSalvando((prev) => new Set(prev).add(id));
  }
  function desmarcarSalvando(id: string) {
    definirSalvando((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function mudarStatus(alerta: AlertaPendente, novoStatus: string) {
    marcarSalvando(alerta.id);
    definirErro(null);
    try {
      await repositorio.atualizarAlerta(alerta.id, novoStatus);
      aoAtualizar();
    } catch {
      definirErro("Não consegui salvar o status. Tente de novo.");
    } finally {
      desmarcarSalvando(alerta.id);
    }
  }

  async function salvarNota(alerta: AlertaPendente) {
    marcarSalvando(alerta.id);
    definirErro(null);
    try {
      await repositorio.atualizarAlerta(alerta.id, alerta.status, textoNota);
      definirNotaAberta(null);
      definirTextoNota("");
      aoAtualizar();
    } catch {
      definirErro("Não consegui salvar a nota. Tente de novo.");
    } finally {
      desmarcarSalvando(alerta.id);
    }
  }

  function abrirNota(alerta: AlertaPendente) {
    definirNotaAberta(alerta.id);
    definirTextoNota(alerta.notaNutri ?? "");
  }

  return (
    <div className="c-painel-alertas">
      <button
        type="button"
        className="c-painel-alertas-cabecalho"
        onClick={() => definirAberto(!aberto)}
        aria-expanded={aberto}
      >
        <span className="c-painel-alertas-titulo">
          <span className="c-painel-alertas-indicador" aria-hidden="true">
            {vermelhos.length > 0 ? "⚠" : "●"}
          </span>
          Alertas clínicos
          <span className="c-painel-alertas-contagem">
            {alertas.length}
          </span>
        </span>
        <span className="c-painel-alertas-seta" aria-hidden="true">
          {aberto ? "▲" : "▼"}
        </span>
      </button>

      {aberto && (
        <div className="c-painel-alertas-corpo">
          {erro && <p className="c-erro" role="alert">{erro}</p>}
          {vermelhos.length > 0 && (
            <div className="c-painel-alertas-grupo">
              <p className="c-painel-alertas-grupo-titulo c-painel-alertas-grupo--vermelho">
                Urgentes ({vermelhos.length})
              </p>
              {vermelhos.map((a) => (
                <CartaoAlerta
                  key={a.id}
                  alerta={a}
                  salvando={salvando.has(a.id)}
                  notaAberta={notaAberta === a.id}
                  textoNota={textoNota}
                  aoMudarStatus={mudarStatus}
                  aoAbrirNota={abrirNota}
                  aoMudarTextoNota={definirTextoNota}
                  aoSalvarNota={salvarNota}
                  aoFecharNota={() => definirNotaAberta(null)}
                />
              ))}
            </div>
          )}
          {amarelos.length > 0 && (
            <div className="c-painel-alertas-grupo">
              <p className="c-painel-alertas-grupo-titulo c-painel-alertas-grupo--amarelo">
                Atenção ({amarelos.length})
              </p>
              {amarelos.map((a) => (
                <CartaoAlerta
                  key={a.id}
                  alerta={a}
                  salvando={salvando.has(a.id)}
                  notaAberta={notaAberta === a.id}
                  textoNota={textoNota}
                  aoMudarStatus={mudarStatus}
                  aoAbrirNota={abrirNota}
                  aoMudarTextoNota={definirTextoNota}
                  aoSalvarNota={salvarNota}
                  aoFecharNota={() => definirNotaAberta(null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartaoAlerta({
  alerta,
  salvando,
  notaAberta,
  textoNota,
  aoMudarStatus,
  aoAbrirNota,
  aoMudarTextoNota,
  aoSalvarNota,
  aoFecharNota,
}: {
  alerta: AlertaPendente;
  salvando: boolean;
  notaAberta: boolean;
  textoNota: string;
  aoMudarStatus: (a: AlertaPendente, s: string) => void;
  aoAbrirNota: (a: AlertaPendente) => void;
  aoMudarTextoNota: (t: string) => void;
  aoSalvarNota: (a: AlertaPendente) => void;
  aoFecharNota: () => void;
}) {
  const dataFormatada = alerta.criadoEm
    ? new Date(alerta.criadoEm).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`c-cartao-alerta c-cartao-alerta--${alerta.nivel}`}>
      <div className="c-cartao-alerta-topo">
        <span className="c-cartao-alerta-paciente">{alerta.pacienteNome}</span>
        <span className="c-cartao-alerta-data">{dataFormatada}</span>
      </div>
      <p className="c-cartao-alerta-descricao">{alerta.descricao}</p>
      <div className="c-cartao-alerta-acoes">
        <select
          className="c-select c-cartao-alerta-select"
          value={alerta.status}
          disabled={salvando}
          onChange={(e) => aoMudarStatus(alerta, e.target.value)}
        >
          {STATUS_ALERTA.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="c-botao-texto"
          onClick={() => (notaAberta ? aoFecharNota() : aoAbrirNota(alerta))}
          disabled={salvando}
        >
          {alerta.notaNutri ? "Editar nota" : "Anotar"}
        </button>
      </div>
      {notaAberta && (
        <div className="c-cartao-alerta-nota">
          <textarea
            className="c-input"
            rows={2}
            value={textoNota}
            onChange={(e) => aoMudarTextoNota(e.target.value)}
            placeholder="Anotação sobre o alerta..."
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              className="c-botao c-botao-pequeno"
              disabled={salvando}
              onClick={() => aoSalvarNota(alerta)}
            >
              Salvar
            </button>
            <button
              type="button"
              className="c-botao-texto"
              onClick={aoFecharNota}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Questionarios() {
  const { configuracoes } = useSessao();
  const [lista, definirLista] = useState<Questionario[]>([]);
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [editando, definirEditando] = useState<Questionario | null>(null);
  const [escolhendoModelo, definirEscolhendoModelo] = useState(false);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [alertas, definirAlertas] = useState<AlertaPendente[]>([]);
  const [pendentes, definirPendentes] = useState<CheckinPendente[]>([]);
  const [mostrarArquivados, definirMostrarArquivados] = useState(false);

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
    try {
      definirAlertas(await repositorio.listarAlertasPendentes());
    } catch {
      definirAlertas([]);
    }
    try {
      definirPendentes(await repositorio.listarCheckinPendentes());
    } catch {
      definirPendentes([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const [avisoDoEditor, definirAvisoDoEditor] = useState<string | null>(null);

  function novo(periodicidade: PeriodicidadeQuestionario) {
    definirAvisoDoEditor(null);
    definirEditando({
      id: "",
      titulo: periodicidade === "semanal" ? "Check-in da semana" : "",
      descricao: null,
      periodicidade,
      ativo: true,
      mostraPontuacao: false,
      criadoEm: "",
      pacientes: 0,
      respostas: 0,
      perguntas: [perguntaVazia()],
    });
  }

  function novoDeModelo(modelo: ModeloDeAnamnese) {
    definirEscolhendoModelo(false);
    definirAvisoDoEditor(
      "Modelo carregado. Mude o que quiser antes de salvar — o modelo é só o ponto de partida.",
    );
    definirEditando({
      id: "",
      titulo: modelo.titulo,
      descricao: modelo.descricao,
      periodicidade: "unica",
      ativo: true,
      mostraPontuacao: false,
      criadoEm: "",
      pacientes: 0,
      respostas: 0,
      perguntas: modelo.perguntas.map((p) => ({
        id: null,
        texto: p.texto,
        tipo: p.tipo,
        obrigatoria: p.obrigatoria,
        opcoes: p.opcoes,
        peso: 1,
        invertida: p.invertida,
        eixoId: null,
        pontosOpcoes: [],
        respondida: false,
        codigo: null,
        cadencia: "semanal" as const,
        regraExibicao: null,
        modulo: null,
        versoes: null,
        explicacaoOpcoes: [],
        textoAjuda: null,
        notasPorFaixa: null,
        alertasOpcoes: [],
        ativa: true,
      })),
    });
  }

  /**
   * Cópia com as mesmas perguntas, pesos e inversões — mas SEM id, sem
   * respostas e sem ninguém liberado: é um modelo novo, e quem responde o
   * original continua respondendo o original.
   */
  function duplicar(base: Questionario) {
    definirAvisoDoEditor(
      "Esta é uma cópia, ainda não salva. Mude o que quiser, salve e depois escolha para quem liberar.",
    );
    definirEditando({
      ...base,
      id: "",
      titulo: `${base.titulo} (cópia)`,
      criadoEm: "",
      pacientes: 0,
      respostas: 0,
      ativo: true,
      perguntas: base.perguntas.map((p) => ({ ...p, id: null, respondida: false })),
    });
  }

  if (escolhendoModelo) {
    return (
      <EscolherModelo
        aoEscolher={novoDeModelo}
        aoEmBranco={() => {
          definirEscolhendoModelo(false);
          novo("unica");
        }}
        aoFechar={() => definirEscolhendoModelo(false)}
      />
    );
  }

  if (editando) {
    return (
      <EditorDeQuestionario
        key={editando.id || "novo"}
        questionario={editando}
        pacientes={pacientes}
        avisoInicial={avisoDoEditor}
        aoDuplicar={duplicar}
        aoSalvarNovo={async (id) => {
          // Modelo novo continua aberto, agora com "Liberar para" à vista:
          // o passo seguinte a criar é escolher quem responde, e voltar à
          // lista para abrir de novo seria um caminho a mais.
          try {
            const qs = await repositorio.listarQuestionarios();
            definirLista(qs);
            const salvo = qs.find((q) => q.id === id);
            definirAvisoDoEditor("Modelo salvo. Agora marque para quem liberar, logo abaixo.");
            definirEditando(salvo ?? null);
          } catch {
            definirEditando(null);
            void carregar();
          }
        }}
        aoFechar={() => {
          definirAvisoDoEditor(null);
          definirEditando(null);
          void carregar();
        }}
      />
    );
  }

  return (
    <>
      <h1 className="c-titulo">Check-in e questionários</h1>
      <p className="c-dica">
        Cada check-in é um <strong>modelo</strong>: você monta uma vez, salva e libera para
        quantas pacientes quiser. Paciente nova que se encaixa num modelo? Abra o modelo e
        marque o nome dela — ou marque no prontuário dela. Para um parecido mas diferente,
        abra e toque em <strong>Duplicar</strong>.
      </p>

      {alertas.length > 0 && (
        <PainelDeAlertas alertas={alertas} aoAtualizar={carregar} />
      )}

      {pendentes.length > 0 && (
        <PainelDePendentes
          pendentes={pendentes}
          nomeCentral={configuracoes?.nomeCentral ?? ""}
        />
      )}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      <div className="c-barra-recolher" style={{ justifyContent: "flex-start", gap: 12 }}>
        <button type="button" className="c-botao" onClick={() => novo("semanal")}>
          + Novo modelo de check-in
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={() => definirEscolhendoModelo(true)}>
          + Anamnese / questionário único
        </button>
      </div>

      {carregando && <Esqueleto />}

      {!carregando && lista.length === 0 && (
        <p className="c-dica">
          Nenhum modelo ainda. Comece por um check-in semanal: três ou quatro perguntas
          curtas já dão uma série que mostra a evolução de semana a semana.
        </p>
      )}

      <div className="c-lista" style={{ marginTop: 16 }}>
        {lista.filter((q) => q.ativo).map((q) => (
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
                {q.respostas === 0
                  ? "nenhuma resposta"
                  : `${q.respostas} ${q.respostas === 1 ? "resposta" : "respostas"}`}
              </span>
            </span>
          </button>
        ))}
      </div>
      {(() => {
        const arquivados = lista.filter((q) => !q.ativo);
        if (arquivados.length === 0) return null;
        return (
          <>
            <button
              type="button"
              className="c-chip"
              style={{ marginTop: 12 }}
              onClick={() => definirMostrarArquivados((v) => !v)}
            >
              {mostrarArquivados ? "Esconder arquivados" : `${arquivados.length} arquivado${arquivados.length > 1 ? "s" : ""}`}
            </button>
            {mostrarArquivados && (
              <div className="c-lista" style={{ marginTop: 8, opacity: 0.7 }}>
                {arquivados.map((q) => (
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
                        {q.perguntas.length === 1 ? "pergunta" : "perguntas"} ·{" "}
                        {q.respostas}{" "}
                        {q.respostas === 1 ? "resposta" : "respostas"}
                      </span>
                    </span>
                    <span className="c-lista-item-direita">
                      <span className="c-selo ocasional">desligado</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        );
      })()}
    </>
  );
}

function EditorDeQuestionario({
  questionario,
  pacientes,
  avisoInicial,
  aoDuplicar,
  aoSalvarNovo,
  aoFechar,
}: {
  questionario: Questionario;
  pacientes: Paciente[];
  avisoInicial: string | null;
  aoDuplicar: (base: Questionario) => void;
  aoSalvarNovo: (id: string) => Promise<void>;
  aoFechar: () => void;
}) {
  const novoQuestionario = questionario.id === "";
  const [titulo, definirTitulo] = useState(questionario.titulo);
  const [descricao, definirDescricao] = useState(questionario.descricao ?? "");
  const [ativo, definirAtivo] = useState(questionario.ativo);
  const [mostraPontuacao, definirMostraPontuacao] = useState(questionario.mostraPontuacao);
  const [perguntas, definirPerguntas] = useState<PerguntaQuestionario[]>(questionario.perguntas);
  const [eixos, definirEixos] = useState<EixoCheckin[]>([]);

  useEffect(() => {
    let vivo = true;
    void repositorio
      .listarEixosCheckin()
      .then((es) => vivo && definirEixos(es))
      .catch(() => {
        /* sem eixos a tela ainda funciona; a pergunta fica "Sem eixo" */
      });
    return () => {
      vivo = false;
    };
  }, []);
  // Mesmo recurso do montador de protocolo, pela mesma razão: dez perguntas
  // abertas viram uma página inteira de campos.
  const [recolhidas, definirRecolhidas] = useState<ReadonlySet<number>>(new Set<number>());
  const [atribuidas, definirAtribuidas] = useState<Set<string>>(new Set());
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(avisoInicial);
  const [erro, definirErro] = useState<string | null>(null);
  const [busca, definirBusca] = useState("");
  const [carregouAtribuidas, definirCarregouAtribuidas] = useState(novoQuestionario);

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
      if (vivo) {
        definirAtribuidas(marcadas);
        definirCarregouAtribuidas(true);
      }
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
      const id = await repositorio.salvarQuestionario(
        novoQuestionario ? null : questionario.id,
        titulo.trim(),
        descricao.trim() || null,
        questionario.periodicidade,
        ativo,
        limpas,
        mostraPontuacao,
      );
      if (novoQuestionario) await aoSalvarNovo(id);
      else aoFechar();
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
      const nome = pacientes.find((p) => p.id === pacienteId)?.nome ?? "esta paciente";
      definirErro(null);
      definirAviso(estado ? `Liberado para ${nome}.` : `Desligado para ${nome}.`);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar a atribuição.");
    }
  }

  return (
    <>
      <div className="c-barra-recolher" style={{ justifyContent: "space-between" }}>
        <button type="button" className="c-link" onClick={aoFechar}>
          ← Voltar aos modelos
        </button>
        {!novoQuestionario && (
          <button
            type="button"
            className="c-chip"
            onClick={() =>
              aoDuplicar({ ...questionario, titulo: titulo.trim() || questionario.titulo, descricao: descricao.trim() || null, perguntas })
            }
          >
            Duplicar modelo
          </button>
        )}
      </div>

      <h1 className="c-titulo" style={{ marginTop: 8 }}>
        {novoQuestionario
          ? questionario.periodicidade === "semanal"
            ? "Novo modelo de check-in"
            : "Novo questionário"
          : questionario.periodicidade === "semanal"
            ? "Modelo de check-in"
            : "Questionário"}
      </h1>

      {novoQuestionario && aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

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

      <label className="c-acesso-linha">
        <input
          type="checkbox"
          checked={mostraPontuacao}
          onChange={(e) => definirMostraPontuacao(e.target.checked)}
        />
        <span>
          Mostrar a pontuação para a paciente
          <span className="c-dica" style={{ display: "block" }}>
            Desligado (o normal), a nota é só sua. Ligue só quando quiser que a paciente
            veja a própria pontuação.
          </span>
        </span>
      </label>

      <GerenciadorDeEixos eixos={eixos} aoMudar={definirEixos} />

      <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Perguntas
      </h2>
      {questionario.periodicidade === "semanal" && (
        <p className="c-dica" style={{ marginTop: 0 }}>
          A pontuação da semana sai das perguntas de <strong>escala</strong>,{" "}
          <strong>sim/não</strong> e <strong>escolha</strong> (nesta, pelos pontos de cada
          opção), pelo peso de cada uma. Peso zero tira da conta sem tirar da tela.
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
          eixos={eixos}
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

      {(erro || (aviso && !novoQuestionario)) && (
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
        {salvando ? "Salvando…" : novoQuestionario ? "Salvar modelo" : "Salvar alterações"}
      </button>
      {novoQuestionario && (
        <p className="c-dica">Depois de salvar, aparece a lista para você escolher quem responde.</p>
      )}

      {!novoQuestionario && (
        <>
          <h2 id="liberar-para" className="c-secao-titulo" style={{ marginTop: 26 }}>
            Liberar para
            {carregouAtribuidas && (
              <span className="c-contagem" style={{ marginLeft: 8, fontWeight: 400 }}>
                {atribuidas.size === 0
                  ? "ninguém ainda"
                  : `${atribuidas.size} ${atribuidas.size === 1 ? "paciente" : "pacientes"}`}
              </span>
            )}
          </h2>
          <p className="c-dica" style={{ marginTop: 0 }}>
            Marque quem responde este modelo. Vale na hora, sem precisar salvar. Desmarcar é
            “pare de perguntar”, e não “esqueça o que ela disse”: as respostas continuam no
            prontuário.
          </p>
          {pacientes.length === 0 && <p className="c-dica">Nenhuma paciente cadastrada ainda.</p>}
          {pacientes.length > 8 && (
            <Campo rotulo="Procurar paciente">
              <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
            </Campo>
          )}
          {!carregouAtribuidas && <p className="c-contagem">Carregando quem já responde…</p>}
          {carregouAtribuidas &&
            pacientes
              .filter((p) => semAcento(p.nome).includes(semAcento(busca.trim())))
              .map((p) => (
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
  eixos,
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
  eixos: EixoCheckin[];
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
  // 'escolha' agora também pontua — pelos pontos de cada opção.
  const pontua = pergunta.tipo === "escala" || pergunta.tipo === "sim_nao" || pergunta.tipo === "escolha";
  const escolha = pergunta.tipo === "escolha";

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

        {escolha && (
          <Campo rotulo="Opções" dica="Separe por ponto e vírgula. Exemplo: Nunca; Às vezes; Sempre">
            <Texto
              valor={pergunta.opcoes.join("; ")}
              aoMudar={(v) => {
                const opcoes = v
                  .split(";")
                  .map((x) => x.trim())
                  .filter((x) => x !== "");
                // Mantém os pontos alinhados com as opções: sobra some, falta
                // entra com 0, e o que já existia é preservado pela posição.
                const pontosOpcoes = opcoes.map((_, k) => pergunta.pontosOpcoes[k] ?? 0);
                aoTrocar({ ...pergunta, opcoes, pontosOpcoes });
              }}
            />
          </Campo>
        )}

        {/* Pontos por opção: só na 'escolha' e só quando pontua a semana. */}
        {semanal && escolha && pergunta.opcoes.length > 0 && (
          <Campo
            rotulo="Pontos de cada opção (0 a 10)"
            dica="Quanto cada resposta vale. Ex.: Nunca = 10, Às vezes = 5, Sempre = 0."
          >
            <div className="c-cupons-edicao">
              {pergunta.opcoes.map((opcao, k) => (
                <div key={k} className="c-cupom-edicao-linha">
                  <span style={{ flex: 1 }}>{opcao}</span>
                  <input
                    className="c-input"
                    style={{ width: 80 }}
                    value={String(pergunta.pontosOpcoes[k] ?? 0)}
                    aria-label={`Pontos da opção ${opcao}`}
                    onChange={(e) => {
                      const n = numeroDeTexto(e.target.value);
                      const pontos = [...pergunta.pontosOpcoes];
                      while (pontos.length < pergunta.opcoes.length) pontos.push(0);
                      pontos[k] = n === null ? 0 : Math.min(Math.max(n, 0), 10);
                      aoTrocar({ ...pergunta, pontosOpcoes: pontos });
                    }}
                  />
                </div>
              ))}
            </div>
          </Campo>
        )}

        {semanal && pontua && (
          <>
            <div className="c-duas-colunas">
              <Campo
                rotulo="Peso na pontuação"
                dica="1 é o normal. 0 tira da conta sem tirar a pergunta da tela."
              >
                <Texto
                  valor={String(pergunta.peso)}
                  aoMudar={(v) => {
                    const n = numeroDeTexto(v);
                    aoTrocar({ ...pergunta, peso: n !== null && n >= 0 ? n : pergunta.peso });
                  }}
                />
              </Campo>
              {!escolha && (
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
              )}
            </div>

            <Campo rotulo="Eixo" dica="Agrupa a pergunta para a quebra da nota (intestino, sono…).">
              <Selecao
                valor={pergunta.eixoId ?? ""}
                aoMudar={(v) => aoTrocar({ ...pergunta, eixoId: v === "" ? null : v })}
                opcoes={[
                  { valor: "", rotulo: "Sem eixo" },
                  ...eixos.map((e) => ({ valor: e.id, rotulo: e.nome })),
                ]}
              />
            </Campo>
          </>
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

/**
 * Gerencia a lista de eixos do check-in — a lista que ela cria uma vez e
 * reusa nas perguntas. Recolhido por padrão: quem só quer escrever pergunta
 * não tropeça nele; quem quer organizar por eixo abre e monta.
 */
function EscolherModelo({
  aoEscolher,
  aoEmBranco,
  aoFechar,
}: {
  aoEscolher: (modelo: ModeloDeAnamnese) => void;
  aoEmBranco: () => void;
  aoFechar: () => void;
}) {
  return (
    <>
      <button type="button" className="c-link" onClick={aoFechar}>
        ← Voltar aos modelos
      </button>
      <h1 className="c-titulo" style={{ marginTop: 8 }}>
        Novo questionário de vez única
      </h1>
      <p className="c-dica">
        Comece de um modelo pronto — você pode editar todas as perguntas antes de salvar — ou
        monte do zero.
      </p>

      <div className="c-atalhos" style={{ marginTop: 16 }}>
        {MODELOS_ANAMNESE.map((modelo) => (
          <button
            key={modelo.id}
            type="button"
            className="c-atalho"
            onClick={() => aoEscolher(modelo)}
          >
            <span className="c-atalho-texto">
              <h3>{modelo.titulo}</h3>
              <p>{modelo.descricao}</p>
              <p className="c-contagem" style={{ marginTop: 4 }}>
                {modelo.perguntas.length} perguntas
              </p>
            </span>
            <span className="c-atalho-seta" aria-hidden="true">›</span>
          </button>
        ))}

        <button type="button" className="c-atalho" onClick={aoEmBranco}>
          <span className="c-atalho-texto">
            <h3>Em branco</h3>
            <p>Comece sem nenhuma pergunta e monte o seu.</p>
          </span>
          <span className="c-atalho-seta" aria-hidden="true">›</span>
        </button>
      </div>
    </>
  );
}

function GerenciadorDeEixos({
  eixos,
  aoMudar,
}: {
  eixos: EixoCheckin[];
  aoMudar: (eixos: EixoCheckin[]) => void;
}) {
  const [aberto, definirAberto] = useState(false);
  const [rascunho, definirRascunho] = useState<{ id: string | null; nome: string }[]>([]);
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  function abrir() {
    definirRascunho(eixos.map((e) => ({ id: e.id, nome: e.nome })));
    definirAviso(null);
    definirAberto(true);
  }

  async function salvar() {
    definirSalvando(true);
    definirAviso(null);
    try {
      const limpos = rascunho.map((e) => ({ id: e.id, nome: e.nome.trim() })).filter((e) => e.nome);
      const novos = await repositorio.salvarEixosCheckin(limpos);
      aoMudar(novos);
      definirAviso("Eixos salvos.");
      definirAberto(false);
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar os eixos.");
    } finally {
      definirSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <p className="c-dica" style={{ marginTop: 14 }}>
        {eixos.length === 0
          ? "Nenhum eixo ainda. "
          : `Eixos: ${eixos.map((e) => e.nome).join(", ")}. `}
        <button type="button" className="c-link" onClick={abrir}>
          {eixos.length === 0 ? "Criar eixos" : "Gerenciar eixos"}
        </button>
      </p>
    );
  }

  return (
    <div className="c-bloco" style={{ marginTop: 14 }}>
      <h2 className="c-secao-titulo" style={{ marginTop: 0 }}>
        Eixos do check-in
      </h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Grupos para a quebra da nota (intestino, sono, hidratação…). Você cria aqui e
        escolhe em cada pergunta. Um eixo em uso não é apagado.
      </p>

      <div className="c-cupons-edicao">
        {rascunho.map((eixo, i) => (
          <div key={i} className="c-cupom-edicao-linha">
            <input
              className="c-input"
              value={eixo.nome}
              placeholder="Nome do eixo"
              aria-label={`Nome do eixo ${i + 1}`}
              onChange={(e) =>
                definirRascunho(rascunho.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="c-chip"
              aria-label={`Tirar o eixo ${eixo.nome || i + 1}`}
              onClick={() => definirRascunho(rascunho.filter((_, j) => j !== i))}
            >
              Tirar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="c-chip"
          onClick={() => definirRascunho([...rascunho, { id: null, nome: "" }])}
        >
          + Adicionar eixo
        </button>
      </div>

      {aviso && (
        <div className={`c-aviso ${aviso === "Eixos salvos." ? "c-aviso-ok" : "c-aviso-erro"}`} role="status">
          <span>{aviso}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar eixos"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={() => definirAberto(false)}>
          Fechar
        </button>
      </div>
    </div>
  );
}
