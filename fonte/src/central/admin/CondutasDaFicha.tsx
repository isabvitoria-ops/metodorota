import { useCallback, useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import {
  COLUNAS_DO_KANBAN,
  type Conduta,
  type ModeloDeConduta,
  type StatusDaConduta,
  type TarefaParaAplicar,
} from "@/central/types/conduta";
import { porColuna, rotuloDoPrazo, situacaoDoPrazo, tarefasDoModelo } from "@/central/utils/condutas";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { AreaTexto, Campo, Selecao, Texto } from "./componentes/Campos";
import { Modal } from "./componentes/Modal";
import { Esqueleto } from "@/central/components/Esqueleto";

/**
 * A aba "Condutas" da ficha: o Kanban da paciente.
 *
 * Três colunas (A fazer, Em andamento, Concluída). No computador dá para
 * arrastar o cartão; no celular, arrastar com o dedo numa lista que rola é
 * receita de mover sem querer — então cada cartão tem também os botões de
 * avançar e voltar, que funcionam nos dois.
 *
 * Nada daqui aparece para a paciente.
 */
export function CondutasDaFicha({ pacienteId }: { pacienteId: string }) {
  const [condutas, definirCondutas] = useState<Conduta[]>([]);
  const [modelos, definirModelos] = useState<ModeloDeConduta[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [editando, definirEditando] = useState<Conduta | "nova" | null>(null);
  const [aplicando, definirAplicando] = useState(false);
  const [arrastada, definirArrastada] = useState<string | null>(null);
  const hoje = hojeSaoPaulo();

  const carregar = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        repositorio.condutasDe(pacienteId),
        repositorio.listarModelosConduta(),
      ]);
      definirCondutas(c);
      definirModelos(m);
      definirErro(null);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const colunas = useMemo(() => porColuna(condutas), [condutas]);

  async function mover(id: string, status: StatusDaConduta) {
    const antes = condutas;
    // Muda na tela na hora; se o banco recusar, volta e avisa.
    definirCondutas((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await repositorio.moverConduta(id, status);
      await carregar();
    } catch (e) {
      definirCondutas(antes);
      definirErro((e as Error).message);
    }
  }

  return (
    <section className="c-secao">
      <div className="c-bloco-topo" style={{ flexWrap: "wrap" }}>
        <h2 className="c-secao-titulo" style={{ margin: 0 }}>
          Condutas
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando("nova")}>
            Nova tarefa
          </button>
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={() => definirAplicando(true)}
          >
            Aplicar modelo
          </button>
        </div>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <Esqueleto />
      ) : condutas.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 12 }}>
          Nenhuma conduta ainda. Crie uma tarefa solta ou aplique um modelo — os
          modelos ficam em Mais → Condutas.
        </p>
      ) : (
        <div className="c-kanban">
          {COLUNAS_DO_KANBAN.map(({ status, titulo }, indice) => (
            <div
              key={status}
              className={`c-kanban-coluna ${arrastada ? "c-kanban-alvo" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastada;
                definirArrastada(null);
                const c = condutas.find((x) => x.id === id);
                if (c && c.status !== status) void mover(c.id, status);
              }}
            >
              <h3 className="c-kanban-titulo">
                {titulo} <span className="c-kanban-conta">{colunas[status].length}</span>
              </h3>
              {colunas[status].length === 0 && <p className="c-dica c-kanban-vazia">Nada aqui.</p>}
              {colunas[status].map((c) => {
                const situacao = situacaoDoPrazo(c, hoje);
                const anterior = COLUNAS_DO_KANBAN[indice - 1];
                const proxima = COLUNAS_DO_KANBAN[indice + 1];
                return (
                  <article
                    key={c.id}
                    className={`c-kanban-cartao ${situacao === "atrasada" ? "c-kanban-atrasada" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      definirArrastada(c.id);
                    }}
                    onDragEnd={() => definirArrastada(null)}
                  >
                    <button type="button" className="c-kanban-abrir" onClick={() => definirEditando(c)}>
                      <strong>{c.titulo}</strong>
                      {c.descricao && <span className="c-kanban-descricao">{c.descricao}</span>}
                    </button>
                    <div className="c-kanban-rodape">
                      <span className={`c-selo ${tomDoPrazo(situacao)}`} title={c.prazo ? dataBonita(c.prazo) : undefined}>
                        {situacao === "concluida" || situacao === "sem_prazo" || situacao === "no_prazo"
                          ? c.prazo
                            ? dataBonita(c.prazo)
                            : "Sem prazo"
                          : rotuloDoPrazo(c, hoje)}
                      </span>
                      {c.modeloNome && <span className="c-dica">{c.modeloNome}</span>}
                    </div>
                    <div className="c-kanban-mover">
                      {anterior && (
                        <button
                          type="button"
                          className="c-botao c-botao-secundario c-botao-pequeno"
                          onClick={() => void mover(c.id, anterior.status)}
                          aria-label={`Voltar "${c.titulo}" para ${anterior.titulo}`}
                        >
                          ← {anterior.titulo}
                        </button>
                      )}
                      {proxima && (
                        <button
                          type="button"
                          className="c-botao c-botao-pequeno"
                          onClick={() => void mover(c.id, proxima.status)}
                          aria-label={`Levar "${c.titulo}" para ${proxima.titulo}`}
                        >
                          {proxima.titulo} →
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {editando && (
        <EditarConduta
          pacienteId={pacienteId}
          conduta={editando === "nova" ? null : editando}
          aoFechar={() => definirEditando(null)}
          aoSalvar={async () => {
            definirEditando(null);
            await carregar();
          }}
        />
      )}

      {aplicando && (
        <AplicarModelo
          pacienteId={pacienteId}
          modelos={modelos}
          aoFechar={() => definirAplicando(false)}
          aoAplicar={async () => {
            definirAplicando(false);
            await carregar();
          }}
        />
      )}
    </section>
  );
}

function tomDoPrazo(s: ReturnType<typeof situacaoDoPrazo>): string {
  if (s === "atrasada") return "ocasional";
  if (s === "hoje" || s === "em_breve") return "boa";
  if (s === "concluida") return "melhor";
  return "neutro";
}

function EditarConduta({
  pacienteId,
  conduta,
  aoFechar,
  aoSalvar,
}: {
  pacienteId: string;
  conduta: Conduta | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [titulo, definirTitulo] = useState(conduta?.titulo ?? "");
  const [descricao, definirDescricao] = useState(conduta?.descricao ?? "");
  const [prazo, definirPrazo] = useState(conduta?.prazo ?? "");
  const [status, definirStatus] = useState<StatusDaConduta>(conduta?.status ?? "a_fazer");
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function salvar() {
    if (!titulo.trim()) {
      definirErro("Escreva o que precisa ser feito.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.salvarConduta(
        conduta?.id ?? null,
        pacienteId,
        titulo.trim(),
        descricao.trim() || null,
        prazo || null,
        status,
      );
      await aoSalvar();
    } catch (e) {
      definirErro((e as Error).message);
      definirSalvando(false);
    }
  }

  async function apagar() {
    if (!conduta || !window.confirm(`Apagar a tarefa "${conduta.titulo}"?`)) return;
    definirSalvando(true);
    try {
      await repositorio.excluirConduta(conduta.id);
      await aoSalvar();
    } catch (e) {
      definirErro((e as Error).message);
      definirSalvando(false);
    }
  }

  return (
    <Modal titulo={conduta ? "Editar tarefa" : "Nova tarefa"} aoFechar={aoFechar}>
      <div>
        <Campo rotulo="O que precisa ser feito">
          <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Ex.: pedir teste respiratório" />
        </Campo>
        <Campo rotulo="Detalhes (opcional)">
          <AreaTexto valor={descricao} aoMudar={definirDescricao} linhas={3} />
        </Campo>
        <Campo rotulo="Prazo (opcional)">
          <Texto tipo="date" valor={prazo} aoMudar={definirPrazo} />
        </Campo>
        <Campo rotulo="Situação">
          <Selecao
            valor={status}
            aoMudar={definirStatus}
            opcoes={COLUNAS_DO_KANBAN.map((c) => ({ valor: c.status, rotulo: c.titulo }))}
          />
        </Campo>
        {conduta?.modeloNome && <p className="c-dica">Veio do modelo “{conduta.modeloNome}”.</p>}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}
      </div>
      <div className="c-modal-acoes">
        {conduta && (
          <button type="button" className="c-botao c-botao-perigo" onClick={() => void apagar()} disabled={salvando}>
            Apagar
          </button>
        )}
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function AplicarModelo({
  pacienteId,
  modelos,
  aoFechar,
  aoAplicar,
}: {
  pacienteId: string;
  modelos: ModeloDeConduta[];
  aoFechar: () => void;
  aoAplicar: () => Promise<void>;
}) {
  const [modeloId, definirModeloId] = useState(modelos[0]?.id ?? "");
  const [inicio, definirInicio] = useState(hojeSaoPaulo());
  const [tarefas, definirTarefas] = useState<TarefaParaAplicar[]>([]);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const modelo = modelos.find((m) => m.id === modeloId) ?? null;

  // Trocar o modelo ou a data de início recalcula tudo. Uma data editada à
  // mão se perde nesse caso — é o esperado: ela mudou a base da conta.
  useEffect(() => {
    definirTarefas(modelo && inicio ? tarefasDoModelo(modelo, inicio) : []);
  }, [modelo, inicio]);

  async function aplicar() {
    if (!modelo) return;
    const validas = tarefas.filter((t) => t.titulo.trim());
    if (validas.length === 0) {
      definirErro("Nenhuma tarefa para aplicar.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.aplicarModeloConduta(pacienteId, modelo.id, validas);
      await aoAplicar();
    } catch (e) {
      definirErro((e as Error).message);
      definirSalvando(false);
    }
  }

  if (modelos.length === 0) {
    return (
      <Modal titulo="Aplicar modelo" aoFechar={aoFechar}>
        <div>
          <p>
            Você ainda não tem modelos. Crie em <strong>Mais → Condutas → Modelos</strong> (por
            exemplo, “Protocolo SIBO” com as etapas e os dias de cada uma) e volte aqui.
          </p>
        </div>
        <div className="c-modal-acoes">
          <button type="button" className="c-botao" onClick={aoFechar}>
            Entendi
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Aplicar modelo" aoFechar={aoFechar}>
      <div>
        <Campo rotulo="Modelo">
          <Selecao
            valor={modeloId}
            aoMudar={definirModeloId}
            opcoes={modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))}
          />
        </Campo>
        <Campo rotulo="Começa em" dica="Os prazos são contados a partir deste dia. Dá para ajustar cada um abaixo.">
          <Texto tipo="date" valor={inicio} aoMudar={definirInicio} />
        </Campo>

        {tarefas.length === 0 ? (
          <p className="c-dica">Este modelo não tem etapas.</p>
        ) : (
          <ol className="c-aplicar-lista">
            {tarefas.map((t, i) => (
              <li key={i}>
                <input
                  className="c-input"
                  value={t.titulo}
                  aria-label={`Tarefa ${i + 1}`}
                  onChange={(e) =>
                    definirTarefas((l) => l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))
                  }
                />
                <input
                  className="c-input"
                  type="date"
                  value={t.prazo ?? ""}
                  aria-label={`Prazo da tarefa ${i + 1}`}
                  onChange={(e) =>
                    definirTarefas((l) => l.map((x, j) => (j === i ? { ...x, prazo: e.target.value || null } : x)))
                  }
                />
                <button
                  type="button"
                  className="c-botao c-botao-secundario c-botao-pequeno"
                  onClick={() => definirTarefas((l) => l.filter((_, j) => j !== i))}
                  aria-label={`Tirar a tarefa ${i + 1}`}
                >
                  Tirar
                </button>
              </li>
            ))}
          </ol>
        )}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}
      </div>
      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="c-botao"
          onClick={() => void aplicar()}
          disabled={salvando || tarefas.length === 0}
        >
          {salvando ? "Aplicando…" : `Criar ${tarefas.length} ${tarefas.length === 1 ? "tarefa" : "tarefas"}`}
        </button>
      </div>
    </Modal>
  );
}
