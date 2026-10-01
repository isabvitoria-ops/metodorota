import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import type { CondutaPendente, EtapaDoModelo, ModeloDeConduta } from "@/central/types/conduta";
import { filtrarPendentes, rotuloDoPrazo, situacaoDoPrazo, type FiltroDePendentes } from "@/central/utils/condutas";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { AreaTexto, Campo, Texto } from "./componentes/Campos";
import { Modal } from "./componentes/Modal";
import { Esqueleto } from "@/central/components/Esqueleto";

/**
 * Mais → Condutas.
 *
 * Duas coisas numa tela só, porque são as duas pontas do mesmo trabalho:
 *   - PENDENTES: o que está aberto em todas as pacientes, com o mais
 *     urgente em cima. É a lista que ela olha de manhã.
 *   - MODELOS: os roteiros que ela repete ("Protocolo SIBO"), com as
 *     etapas e em quantos dias cada uma vence depois de aplicado.
 *
 * Aplicar um modelo é na ficha da paciente, aba Condutas.
 */
export function Condutas() {
  const [parametros, definirParametros] = useSearchParams();
  const ver = parametros.get("ver") === "modelos" ? "modelos" : "pendentes";

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Condutas
      </h1>
      <p className="c-subtitulo">
        As tarefas de cada paciente e os modelos que você repete. Nada disto aparece para a paciente.
      </p>

      <nav className="c-admin-abas c-abas-prontuario" aria-label="Condutas">
        {(
          [
            ["pendentes", "Pendentes"],
            ["modelos", "Modelos"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            className={`c-admin-aba ${ver === valor ? "ativo" : ""}`}
            aria-pressed={ver === valor}
            onClick={() => definirParametros(valor === "pendentes" ? {} : { ver: valor })}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {ver === "pendentes" ? <Pendentes /> : <Modelos />}
    </>
  );
}

function Pendentes() {
  const [lista, definirLista] = useState<CondutaPendente[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [filtro, definirFiltro] = useState<FiltroDePendentes>({ busca: "", status: "todas", soAtrasadas: false });
  const hoje = hojeSaoPaulo();

  const carregar = useCallback(async () => {
    try {
      definirLista(await repositorio.condutasPendentes());
      definirErro(null);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => filtrarPendentes(lista, filtro, hoje), [lista, filtro, hoje]);
  const atrasadas = useMemo(
    () => lista.filter((c) => ["atrasada", "hoje"].includes(situacaoDoPrazo(c, hoje))).length,
    [lista, hoje],
  );

  async function concluir(c: CondutaPendente) {
    try {
      await repositorio.moverConduta(c.id, "concluida");
      await carregar();
    } catch (e) {
      definirErro((e as Error).message);
    }
  }

  return (
    <section className="c-secao">
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-filtros-condutas">
        <input
          className="c-input"
          type="search"
          placeholder="Buscar paciente ou tarefa"
          aria-label="Buscar paciente ou tarefa"
          value={filtro.busca}
          onChange={(e) => definirFiltro((f) => ({ ...f, busca: e.target.value }))}
        />
        <div className="c-chips">
          {(
            [
              ["todas", "Todas"],
              ["a_fazer", "A fazer"],
              ["andamento", "Em andamento"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              className="c-chip"
              aria-pressed={filtro.status === valor}
              onClick={() => definirFiltro((f) => ({ ...f, status: valor }))}
            >
              {rotulo}
            </button>
          ))}
          <button
            type="button"
            className="c-chip"
            aria-pressed={filtro.soAtrasadas}
            onClick={() => definirFiltro((f) => ({ ...f, soAtrasadas: !f.soAtrasadas }))}
          >
            Vencidas e de hoje ({atrasadas})
          </button>
        </div>
      </div>

      {carregando ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 16 }}>
          Nenhuma tarefa aberta. As tarefas nascem na ficha de cada paciente, aba Condutas.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 16 }}>
          Nada com esse filtro.
        </p>
      ) : (
        <ul className="c-lista-condutas">
          {visiveis.map((c) => {
            const situacao = situacaoDoPrazo(c, hoje);
            return (
              <li key={c.id} className={situacao === "atrasada" ? "c-kanban-atrasada" : ""}>
                <div className="c-lista-condutas-texto">
                  <Link to={`${rotas.adminProntuario(c.pacienteId)}?aba=condutas`}>
                    <strong>{c.pacienteNome}</strong>
                  </Link>
                  <span>{c.titulo}</span>
                  <span className="c-dica">
                    {c.status === "andamento" ? "Em andamento" : "A fazer"}
                    {c.modeloNome ? ` · ${c.modeloNome}` : ""}
                  </span>
                </div>
                <div className="c-lista-condutas-acoes">
                  <span
                    className={`c-selo ${
                      situacao === "atrasada" ? "ocasional" : situacao === "hoje" || situacao === "em_breve" ? "boa" : "neutro"
                    }`}
                    title={c.prazo ? dataBonita(c.prazo) : undefined}
                  >
                    {situacao === "no_prazo" ? dataBonita(c.prazo) : rotuloDoPrazo(c, hoje)}
                  </span>
                  <button
                    type="button"
                    className="c-botao c-botao-secundario c-botao-pequeno"
                    onClick={() => void concluir(c)}
                    aria-label={`Concluir "${c.titulo}" de ${c.pacienteNome}`}
                  >
                    Concluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Modelos() {
  const [modelos, definirModelos] = useState<ModeloDeConduta[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [editando, definirEditando] = useState<ModeloDeConduta | "novo" | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirModelos(await repositorio.listarModelosConduta());
      definirErro(null);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section className="c-secao">
      <div className="c-bloco-topo">
        <p className="c-dica" style={{ margin: 0 }}>
          Cada etapa vence em “dia X” contado de quando você aplica o modelo na paciente.
        </p>
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando("novo")}>
          Novo modelo
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <Esqueleto />
      ) : modelos.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 16 }}>
          Nenhum modelo ainda. Exemplo: “Protocolo SIBO” — pedir teste (dia 0), iniciar dieta (dia 7),
          reavaliar sintomas (dia 30).
        </p>
      ) : (
        modelos.map((m) => (
          <article key={m.id} className="c-bloco">
            <div className="c-bloco-topo">
              <h3 style={{ margin: 0 }}>{m.nome}</h3>
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                onClick={() => definirEditando(m)}
              >
                Editar
              </button>
            </div>
            {m.descricao && <p className="c-dica">{m.descricao}</p>}
            <ol style={{ paddingLeft: 20, margin: "8px 0 0" }}>
              {m.etapas.map((e, i) => (
                <li key={e.id ?? i}>
                  <span className="c-dica">Dia {e.dias} · </span>
                  {e.titulo}
                </li>
              ))}
            </ol>
          </article>
        ))
      )}

      {editando && (
        <EditarModelo
          modelo={editando === "novo" ? null : editando}
          aoFechar={() => definirEditando(null)}
          aoSalvar={async () => {
            definirEditando(null);
            await carregar();
          }}
        />
      )}
    </section>
  );
}

const ETAPA_VAZIA: EtapaDoModelo = { titulo: "", descricao: null, dias: 0 };

function EditarModelo({
  modelo,
  aoFechar,
  aoSalvar,
}: {
  modelo: ModeloDeConduta | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [nome, definirNome] = useState(modelo?.nome ?? "");
  const [descricao, definirDescricao] = useState(modelo?.descricao ?? "");
  const [etapas, definirEtapas] = useState<EtapaDoModelo[]>(
    modelo && modelo.etapas.length > 0 ? modelo.etapas : [{ ...ETAPA_VAZIA }],
  );
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const mudar = (i: number, parte: Partial<EtapaDoModelo>) =>
    definirEtapas((l) => l.map((e, j) => (j === i ? { ...e, ...parte } : e)));

  async function salvar() {
    if (!nome.trim()) {
      definirErro("Dê um nome ao modelo.");
      return;
    }
    if (!etapas.some((e) => e.titulo.trim())) {
      definirErro("Escreva pelo menos uma etapa.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.salvarModeloConduta(modelo?.id ?? null, nome.trim(), descricao.trim() || null, etapas);
      await aoSalvar();
    } catch (e) {
      definirErro((e as Error).message);
      definirSalvando(false);
    }
  }

  async function apagar() {
    if (!modelo) return;
    if (!window.confirm(`Apagar o modelo "${modelo.nome}"? As tarefas já aplicadas nas pacientes continuam.`)) return;
    definirSalvando(true);
    try {
      await repositorio.excluirModeloConduta(modelo.id);
      await aoSalvar();
    } catch (e) {
      definirErro((e as Error).message);
      definirSalvando(false);
    }
  }

  return (
    <Modal titulo={modelo ? "Editar modelo" : "Novo modelo"} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Ex.: Protocolo SIBO" />
      </Campo>
      <Campo rotulo="Para que serve (opcional)">
        <AreaTexto valor={descricao} aoMudar={definirDescricao} linhas={2} />
      </Campo>

      <h3 style={{ marginBottom: 4 }}>Etapas</h3>
      <p className="c-dica" style={{ marginTop: 0 }}>
        “Dia” é quantos dias depois de aplicar. Dia 0 = no mesmo dia.
      </p>
      <ol className="c-aplicar-lista">
        {etapas.map((e, i) => (
          <li key={i}>
            <input
              className="c-input"
              value={e.titulo}
              placeholder="O que fazer"
              aria-label={`Etapa ${i + 1}`}
              onChange={(ev) => mudar(i, { titulo: ev.target.value })}
            />
            <label className="c-dia-da-etapa">
              <span>Dia</span>
              <input
                className="c-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                value={Number.isFinite(e.dias) ? e.dias : 0}
                aria-label={`Dia da etapa ${i + 1}`}
                onChange={(ev) => mudar(i, { dias: Math.max(0, Math.min(3650, Math.round(Number(ev.target.value) || 0))) })}
              />
            </label>
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              onClick={() => definirEtapas((l) => (l.length === 1 ? [{ ...ETAPA_VAZIA }] : l.filter((_, j) => j !== i)))}
              aria-label={`Tirar a etapa ${i + 1}`}
            >
              Tirar
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        onClick={() =>
          definirEtapas((l) => [...l, { ...ETAPA_VAZIA, dias: l.length ? (l[l.length - 1]?.dias ?? 0) + 7 : 0 }])
        }
      >
        + Etapa
      </button>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-modal-acoes">
        {modelo && (
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
