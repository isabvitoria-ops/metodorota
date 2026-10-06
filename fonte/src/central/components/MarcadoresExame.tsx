import { useCallback, useEffect, useState } from "react";
import type {
  GrupoDeMarcadores,
  MarcadorParaSalvar,
  PontoEvolucao,
} from "@/central/types/exame";
import { repositorio } from "@/central/dados/repositorio";
import {
  classificarValor,
  gruposDoCatalogo,
  marcadorDoCatalogo,
} from "@/central/utils/marcadoresExame";
import { numeroDeTexto } from "@/central/utils/numero";
import { Esqueleto } from "@/central/components/Esqueleto";
import { GraficoLinha } from "@/central/components/GraficoLinha";

function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

function corDoStatus(status: "baixo" | "normal" | "alto" | "desconhecido"): string {
  if (status === "baixo") return "var(--azul-600, #2563eb)";
  if (status === "alto") return "var(--vermelho-500, #ef4444)";
  if (status === "normal") return "var(--verde-600, #16a34a)";
  return "var(--cinza-500, #6b7280)";
}

function numero(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

interface LinhaFormulario {
  codigo: string;
  valorTexto: string;
}

export function MarcadoresExame({ pacienteId }: { pacienteId: string }) {
  const [grupos, definirGrupos] = useState<GrupoDeMarcadores[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);

  const [formularioAberto, definirFormularioAberto] = useState(false);
  const [dataExame, definirDataExame] = useState("");
  const [linhas, definirLinhas] = useState<LinhaFormulario[]>([]);
  const [personalizadoCodigo, definirPersonalizadoCodigo] = useState("");
  const [personalizadoNome, definirPersonalizadoNome] = useState("");
  const [personalizadoUnidade, definirPersonalizadoUnidade] = useState("");
  const [personalizadoValor, definirPersonalizadoValor] = useState("");
  const [enviando, definirEnviando] = useState(false);

  const [evolucaoCodigo, definirEvolucaoCodigo] = useState<string | null>(null);
  const [evolucaoNome, definirEvolucaoNome] = useState("");
  const [evolucaoUnidade, definirEvolucaoUnidade] = useState("");
  const [evolucaoDados, definirEvolucaoDados] = useState<PontoEvolucao[]>([]);
  const [carregandoEvolucao, definirCarregandoEvolucao] = useState(false);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      definirGrupos(await repositorio.marcadoresDoPaciente(pacienteId));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao carregar marcadores.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => { void carregar(); }, [carregar]);

  function abrirFormulario() {
    definirFormularioAberto(true);
    definirLinhas([]);
    definirDataExame("");
    definirAviso(null);
    definirErro(null);
  }

  function alterarValor(codigo: string, valorTexto: string) {
    definirLinhas((prev) => {
      const existe = prev.find((l) => l.codigo === codigo);
      if (existe) {
        return prev.map((l) => l.codigo === codigo ? { ...l, valorTexto } : l);
      }
      return [...prev, { codigo, valorTexto }];
    });
  }

  function adicionarPersonalizado() {
    if (!personalizadoCodigo.trim() || !personalizadoNome.trim() || !personalizadoValor.trim()) return;
    const val = numeroDeTexto(personalizadoValor);
    if (val == null || isNaN(val)) {
      definirErro("O valor personalizado precisa ser um número.");
      return;
    }
    definirLinhas((prev) => [
      ...prev.filter((l) => l.codigo !== personalizadoCodigo.trim().toUpperCase()),
      { codigo: personalizadoCodigo.trim().toUpperCase(), valorTexto: personalizadoValor },
    ]);
    definirPersonalizadoCodigo("");
    definirPersonalizadoNome("");
    definirPersonalizadoUnidade("");
    definirPersonalizadoValor("");
  }

  async function salvar() {
    if (!dataExame) {
      definirErro("Informe a data do exame.");
      return;
    }
    const marcadores: MarcadorParaSalvar[] = [];
    for (const l of linhas) {
      if (!l.valorTexto.trim()) continue;
      const val = numeroDeTexto(l.valorTexto);
      if (val == null || isNaN(val)) {
        definirErro(`Valor inválido para ${l.codigo}.`);
        return;
      }
      const cat = marcadorDoCatalogo(l.codigo);
      const ehPersonalizado = !cat && l.codigo === personalizadoCodigo;
      marcadores.push({
        codigo: l.codigo,
        nome: cat?.nome ?? (ehPersonalizado ? personalizadoNome : l.codigo),
        valor: val,
        unidade: cat?.unidade ?? (ehPersonalizado ? personalizadoUnidade : ""),
        refMin: cat?.refMin ?? null,
        refMax: cat?.refMax ?? null,
      });
    }
    if (marcadores.length === 0) {
      definirErro("Preencha ao menos um marcador.");
      return;
    }

    definirEnviando(true);
    definirErro(null);
    try {
      await repositorio.registrarMarcadores(pacienteId, dataExame, marcadores);
      definirFormularioAberto(false);
      definirAviso(`${marcadores.length} marcador${marcadores.length > 1 ? "es" : ""} registrado${marcadores.length > 1 ? "s" : ""}.`);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      definirEnviando(false);
    }
  }

  async function abrirEvolucao(codigo: string, nome: string, unidade: string) {
    definirEvolucaoCodigo(codigo);
    definirEvolucaoNome(nome);
    definirEvolucaoUnidade(unidade);
    definirCarregandoEvolucao(true);
    try {
      definirEvolucaoDados(await repositorio.evolucaoMarcador(pacienteId, codigo));
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao carregar evolução.");
    } finally {
      definirCarregandoEvolucao(false);
    }
  }

  async function apagarGrupo(data: string) {
    try {
      await repositorio.apagarMarcadoresDaData(pacienteId, data);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao apagar.");
    }
  }

  const gruposCatalogo = gruposDoCatalogo();

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Marcadores laboratoriais</h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Registre os valores dos exames para acompanhar a evolução ao longo do tempo. Os marcadores ficam separados do PDF &mdash; você digita os que importam.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      {aviso && !erro && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      {!formularioAberto && (
        <button
          type="button"
          className="c-botao c-botao-primario"
          onClick={abrirFormulario}
        >
          Registrar marcadores
        </button>
      )}

      {formularioAberto && (
        <div className="c-bloco" style={{ padding: "16px" }}>
          <label className="c-campo-rotulo">
            Data do exame
            <input
              className="c-campo"
              type="date"
              value={dataExame}
              onChange={(e) => definirDataExame(e.target.value)}
            />
          </label>

          {gruposCatalogo.map(({ grupo, marcadores }) => (
            <details key={grupo} className="c-marcador-grupo">
              <summary className="c-marcador-grupo-titulo">{grupo}</summary>
              <div className="c-grade-marcadores">
                {marcadores.map((m) => {
                  const l = linhas.find((x) => x.codigo === m.codigo);
                  return (
                    <label key={m.codigo} className="c-campo-rotulo c-campo-marcador">
                      <span className="c-marcador-nome">
                        {m.nome}
                        {m.unidade && <span className="c-marcador-unidade"> ({m.unidade})</span>}
                      </span>
                      <input
                        className="c-campo"
                        type="text"
                        inputMode="decimal"
                        placeholder={
                          m.refMin != null && m.refMax != null
                            ? `${numero(m.refMin)}–${numero(m.refMax)}`
                            : m.refMax != null
                              ? `≤ ${numero(m.refMax)}`
                              : m.refMin != null
                                ? `≥ ${numero(m.refMin)}`
                                : ""
                        }
                        value={l?.valorTexto ?? ""}
                        onChange={(e) => alterarValor(m.codigo, e.target.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </details>
          ))}

          <details className="c-marcador-grupo">
            <summary className="c-marcador-grupo-titulo">Outro marcador</summary>
            <div className="c-grade-marcadores">
              <label className="c-campo-rotulo c-campo-marcador">
                <span className="c-marcador-nome">Código</span>
                <input
                  className="c-campo"
                  type="text"
                  value={personalizadoCodigo}
                  onChange={(e) => definirPersonalizadoCodigo(e.target.value)}
                  placeholder="Ex: IGE"
                />
              </label>
              <label className="c-campo-rotulo c-campo-marcador">
                <span className="c-marcador-nome">Nome</span>
                <input
                  className="c-campo"
                  type="text"
                  value={personalizadoNome}
                  onChange={(e) => definirPersonalizadoNome(e.target.value)}
                  placeholder="Ex: IgE total"
                />
              </label>
              <label className="c-campo-rotulo c-campo-marcador">
                <span className="c-marcador-nome">Unidade</span>
                <input
                  className="c-campo"
                  type="text"
                  value={personalizadoUnidade}
                  onChange={(e) => definirPersonalizadoUnidade(e.target.value)}
                  placeholder="Ex: UI/mL"
                />
              </label>
              <label className="c-campo-rotulo c-campo-marcador">
                <span className="c-marcador-nome">Valor</span>
                <input
                  className="c-campo"
                  type="text"
                  inputMode="decimal"
                  value={personalizadoValor}
                  onChange={(e) => definirPersonalizadoValor(e.target.value)}
                />
              </label>
            </div>
            {personalizadoCodigo && personalizadoNome && personalizadoValor && (
              <button type="button" className="c-chip" onClick={adicionarPersonalizado}>
                Adicionar
              </button>
            )}
          </details>

          {linhas.filter((l) => l.valorTexto.trim()).length > 0 && (
            <p className="c-contagem">
              {linhas.filter((l) => l.valorTexto.trim()).length} marcador{linhas.filter((l) => l.valorTexto.trim()).length > 1 ? "es" : ""} preenchido{linhas.filter((l) => l.valorTexto.trim()).length > 1 ? "s" : ""}
            </p>
          )}

          <div className="c-chips" style={{ marginTop: "12px" }}>
            <button
              type="button"
              className="c-botao c-botao-primario"
              onClick={() => void salvar()}
              disabled={enviando}
            >
              {enviando ? "Salvando…" : "Salvar marcadores"}
            </button>
            <button
              type="button"
              className="c-chip"
              onClick={() => definirFormularioAberto(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {carregando && <Esqueleto />}

      {evolucaoCodigo && (
        <div className="c-bloco" style={{ padding: "16px", marginTop: "12px" }}>
          <div className="c-bloco-topo">
            <span className="c-lista-item-nome">
              Evolução: {evolucaoNome}
            </span>
            <button
              type="button"
              className="c-chip"
              onClick={() => definirEvolucaoCodigo(null)}
            >
              Fechar
            </button>
          </div>
          {carregandoEvolucao ? (
            <Esqueleto />
          ) : evolucaoDados.length < 2 ? (
            <p className="c-dica">Precisa de ao menos 2 registros para desenhar o gráfico.</p>
          ) : (
            <>
              <GraficoLinha
                serie={evolucaoDados.map((p) => ({ data: p.data, valor: p.valor }))}
                unidade={evolucaoUnidade}
              />
              {evolucaoDados[0]?.refMin != null || evolucaoDados[0]?.refMax != null ? (
                <p className="c-dica" style={{ marginTop: "4px" }}>
                  Referência: {evolucaoDados[0].refMin != null ? numero(evolucaoDados[0].refMin) : "?"}{"–"}{evolucaoDados[0].refMax != null ? numero(evolucaoDados[0].refMax) : "?"} {evolucaoUnidade}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}

      {!carregando && grupos.length === 0 && !formularioAberto && (
        <p className="c-dica" style={{ marginTop: "12px" }}>
          Nenhum marcador registrado para esta paciente ainda.
        </p>
      )}

      {grupos.map((g) => (
        <div className="c-bloco" key={g.data} style={{ marginTop: "12px" }}>
          <div className="c-bloco-topo">
            <span className="c-lista-item-nome">{diaCurto(g.data)}</span>
            <span className="c-lista-item-apoio">
              {g.marcadores.length} marcador{g.marcadores.length > 1 ? "es" : ""}
            </span>
          </div>
          <div className="c-grade-marcadores c-marcadores-lista">
            {g.marcadores.map((m) => {
              const status = classificarValor(m.valor, m.refMin, m.refMax);
              return (
                <button
                  type="button"
                  key={m.id}
                  className="c-marcador-resultado"
                  onClick={() => void abrirEvolucao(m.codigo, m.nome, m.unidade)}
                  title="Ver evolução"
                >
                  <span className="c-marcador-resultado-nome">{m.nome}</span>
                  <span
                    className="c-marcador-resultado-valor"
                    style={{ color: corDoStatus(status) }}
                  >
                    {numero(m.valor)}
                    {m.unidade && <span className="c-marcador-unidade"> {m.unidade}</span>}
                  </span>
                  {(m.refMin != null || m.refMax != null) && (
                    <span className="c-marcador-resultado-ref">
                      ref: {m.refMin != null ? numero(m.refMin) : "?"}{"–"}{m.refMax != null ? numero(m.refMax) : "?"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="c-chips" style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="c-chip"
              onClick={() => void apagarGrupo(g.data)}
            >
              Apagar esta data
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
