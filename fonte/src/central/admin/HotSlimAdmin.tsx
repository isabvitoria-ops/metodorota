import { useCallback, useEffect, useState } from "react";
import {
  repositorioHotSlimAdmin,
  contarMarcadosChecklist,
  type ParticipanteHotSlim,
  type ChecklistResumo,
} from "@/central/hotslim/dados/repositorioHotSlimAdmin";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { Campo, Texto } from "./componentes/Campos";
import { Modal } from "./componentes/Modal";
import { Esqueleto } from "@/central/components/Esqueleto";

const TODAS_FASES = [1, 2, 3, 4];
const FASE_NOMES = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];

const ABAS = ["Participantes", "Checklist"] as const;
type Aba = (typeof ABAS)[number];

const CAMPOS_CHECKLIST = [
  { campo: "intestino_regulou", icone: "🚽", texto: "Intestino regulou" },
  { campo: "sem_gases", icone: "💨", texto: "Sem gases" },
  { campo: "dormiu_bem", icone: "😴", texto: "Dormiu bem" },
  { campo: "barriga_desinchada", icone: "🫄", texto: "Barriga desinchada" },
  { campo: "sem_compulsao", icone: "🍫", texto: "Sem compulsão" },
  { campo: "energia_boa", icone: "⚡", texto: "Energia boa" },
  { campo: "humor_estavel", icone: "😊", texto: "Humor estável" },
] as const;

const CSS = {
  dashboard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
  } as React.CSSProperties,
  statCard: {
    background: "var(--surface, #fff)",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: 14,
    padding: "18px 16px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
    fontFamily: "'Fraunces', Georgia, serif",
  } as React.CSSProperties,
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--fg-soft, #6b7280)",
    marginTop: 4,
  } as React.CSSProperties,
  participantCard: {
    background: "var(--surface, #fff)",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: 14,
    padding: "18px 20px",
    marginBottom: 12,
    transition: "box-shadow .15s",
  } as React.CSSProperties,
  progressBar: {
    height: 6,
    background: "var(--border, #e5e7eb)",
    borderRadius: 3,
    overflow: "hidden" as const,
    marginTop: 10,
    marginBottom: 6,
  } as React.CSSProperties,
  progressFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width .4s ease",
  } as React.CSSProperties,
  phaseChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    border: "1.5px solid var(--border, #e5e7eb)",
    background: "var(--surface-alt, #f9fafb)",
    color: "var(--fg-soft, #6b7280)",
    transition: "all .15s",
    letterSpacing: "0.02em",
  } as React.CSSProperties,
  phaseChipActive: {
    background: "#E4EFE8",
    borderColor: "#3D6650",
    color: "#3D6650",
  } as React.CSSProperties,
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
  } as React.CSSProperties,
  checkDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,
  dayCard: {
    background: "var(--surface, #fff)",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 8,
  } as React.CSSProperties,
  dotRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    alignItems: "center",
  } as React.CSSProperties,
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  } as React.CSSProperties,
} as const;

export function HotSlimAdmin() {
  const [participantes, definirParticipantes] = useState<ParticipanteHotSlim[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [aba, definirAba] = useState<Aba>("Participantes");
  const [busca, definirBusca] = useState("");
  const [editando, definirEditando] = useState<ParticipanteHotSlim | "novo" | null>(null);
  const [selecionada, definirSelecionada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await repositorioHotSlimAdmin.listarParticipantes();
      definirParticipantes(lista);
      definirErro(null);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      definirErro(msg || "Não consegui carregar.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const hoje = hojeSaoPaulo();
  const visiveis = participantes.filter(
    (p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()) || p.email.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const ativas = participantes.filter((p) => p.ativo);
  const emAndamento = ativas.filter((p) => p.data_inicio <= hoje && p.data_fim >= hoje);
  const concluidas = ativas.filter((p) => p.data_fim < hoje);
  const fasesMediana = ativas.length > 0
    ? Math.round(ativas.reduce((s, p) => s + p.fases_liberadas.length, 0) / ativas.length)
    : 0;

  return (
    <>
      <div className="c-admin-topo-linha" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="c-titulo" style={{ fontSize: 28, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400 }}>
            Método Rota — Monitoramento
          </h1>
          <p className="c-subtitulo">
            Acompanhe cada participante dos 21 dias
          </p>
        </div>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => definirEditando("novo")}
        >
          + Nova participante
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div style={CSS.dashboard}>
        <StatCard valor={participantes.length} rotulo="Total" cor="#38546C" />
        <StatCard valor={emAndamento.length} rotulo="Em andamento" cor="#3D6650" destaque={emAndamento.length > 0} />
        <StatCard valor={concluidas.length} rotulo="Concluíram" cor="#8B7A2E" />
        <StatCard valor={fasesMediana} rotulo="Fases (média)" cor="#5A7A8F" sufixo="/4" />
      </div>

      <div className="c-admin-abas" style={{ marginTop: 8 }}>
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            className={`c-admin-aba ${a === aba ? "ativo" : ""}`}
            onClick={() => definirAba(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {carregando ? (
        <Esqueleto />
      ) : (
        <div style={{ marginTop: 14 }}>
          {aba === "Participantes" && (
            <ListaParticipantes
              participantes={visiveis}
              busca={busca}
              aoBuscar={definirBusca}
              aoEditar={(p) => definirEditando(p)}
              aoSelecionar={(id) => {
                definirSelecionada(id);
                definirAba("Checklist");
              }}
              aoRecarregar={carregar}
            />
          )}
          {aba === "Checklist" && (
            <PainelChecklist
              participantes={participantes}
              selecionada={selecionada}
              aoSelecionar={definirSelecionada}
            />
          )}
        </div>
      )}

      {editando && (
        <ModalParticipante
          participante={editando === "novo" ? null : editando}
          aoFechar={() => {
            definirEditando(null);
            void carregar();
          }}
        />
      )}
    </>
  );
}

function StatCard({ valor, rotulo, cor, destaque, sufixo }: {
  valor: number;
  rotulo: string;
  cor: string;
  destaque?: boolean;
  sufixo?: string;
}) {
  return (
    <div style={{
      ...CSS.statCard,
      borderColor: destaque ? cor : undefined,
      boxShadow: destaque ? `0 0 0 1px ${cor}20` : undefined,
    }}>
      <div style={{ ...CSS.statValue, color: cor }}>
        {valor}{sufixo && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--fg-soft, #6b7280)" }}>{sufixo}</span>}
      </div>
      <div style={CSS.statLabel}>{rotulo}</div>
    </div>
  );
}

function ListaParticipantes({
  participantes,
  busca,
  aoBuscar,
  aoEditar,
  aoSelecionar,
  aoRecarregar,
}: {
  participantes: ParticipanteHotSlim[];
  busca: string;
  aoBuscar: (v: string) => void;
  aoEditar: (p: ParticipanteHotSlim) => void;
  aoSelecionar: (id: string) => void;
  aoRecarregar: () => Promise<void>;
}) {
  const [ocupado, definirOcupado] = useState<string | null>(null);
  const hoje = hojeSaoPaulo();

  async function alternarAtivo(p: ParticipanteHotSlim) {
    definirOcupado(p.id);
    try {
      await repositorioHotSlimAdmin.alterarParticipante(p.id, { ativo: !p.ativo });
      await aoRecarregar();
    } catch {
      // silencioso
    } finally {
      definirOcupado(null);
    }
  }

  async function liberarFase(p: ParticipanteHotSlim, fase: number) {
    definirOcupado(p.id);
    try {
      const novas = p.fases_liberadas.includes(fase)
        ? p.fases_liberadas.filter((f) => f !== fase)
        : [...p.fases_liberadas, fase].sort();
      await repositorioHotSlimAdmin.definirFases(p.id, novas);
      await aoRecarregar();
    } catch {
      // silencioso
    } finally {
      definirOcupado(null);
    }
  }

  function infoDia(p: ParticipanteHotSlim): { dia: number; total: number; percentual: number } {
    const dia = Math.max(1, diasEntre(p.data_inicio, hoje) + 1);
    const total = Math.max(1, diasEntre(p.data_inicio, p.data_fim) + 1);
    const percentual = Math.min(100, Math.round((dia / total) * 100));
    return { dia: Math.min(dia, total), total, percentual };
  }

  function situacao(p: ParticipanteHotSlim): { texto: string; cor: string; bg: string } {
    if (!p.ativo) return { texto: "Inativa", cor: "#6b7280", bg: "#f3f4f6" };
    if (p.data_inicio > hoje) return { texto: "Aguardando", cor: "#8B7A2E", bg: "#F5F0DC" };
    if (p.data_fim < hoje) return { texto: "Concluído", cor: "#3D6650", bg: "#E4EFE8" };
    const { dia } = infoDia(p);
    const fase = dia <= 6 ? "Repouso" : "Teste";
    return { texto: `Dia ${dia} · ${fase}`, cor: "#38546C", bg: "#E8EFF5" };
  }

  if (participantes.length === 0 && !busca.trim()) {
    return <p className="c-contagem">Nenhuma participante cadastrada ainda.</p>;
  }

  return (
    <>
      <Campo rotulo="Buscar">
        <Texto valor={busca} aoMudar={aoBuscar} placeholder="Nome ou e-mail" />
      </Campo>

      {participantes.length === 0 ? (
        <p className="c-contagem">Nenhum resultado para "{busca}".</p>
      ) : (
        <div>
          {participantes.map((p) => {
            const sit = situacao(p);
            const prog = infoDia(p);
            const emAndamento = p.ativo && p.data_inicio <= hoje && p.data_fim >= hoje;

            return (
              <div key={p.id} style={CSS.participantCard}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 16 }}>{p.nome}</strong>
                      <span style={{ ...CSS.badge, color: sit.cor, background: sit.bg }}>
                        {sit.texto}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--fg-soft, #6b7280)", marginTop: 4 }}>
                      {p.email}{p.telefone ? ` · ${p.telefone}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-soft, #6b7280)", marginTop: 2 }}>
                      {dataBonita(p.data_inicio)} — {dataBonita(p.data_fim)}
                    </div>
                  </div>
                </div>

                {emAndamento && (
                  <>
                    <div style={CSS.progressBar}>
                      <div style={{
                        ...CSS.progressFill,
                        width: `${prog.percentual}%`,
                        background: `linear-gradient(90deg, #38546C, #5A7A8F)`,
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-soft, #6b7280)" }}>
                      <span>Dia {prog.dia} de {prog.total}</span>
                      <span>{prog.percentual}%</span>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {TODAS_FASES.map((f) => {
                    const ativa = p.fases_liberadas.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        style={{
                          ...CSS.phaseChip,
                          ...(ativa ? CSS.phaseChipActive : {}),
                        }}
                        disabled={ocupado === p.id}
                        onClick={() => void liberarFase(p, f)}
                        title={ativa ? `Bloquear ${FASE_NOMES[f - 1]}` : `Liberar ${FASE_NOMES[f - 1]}`}
                      >
                        <span style={{ fontSize: 12 }}>{ativa ? "✓" : "○"}</span>
                        {FASE_NOMES[f - 1]}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                  <button
                    type="button"
                    className="c-botao c-botao-pequeno"
                    onClick={() => aoSelecionar(p.id)}
                  >
                    Ver checklist
                  </button>
                  <button
                    type="button"
                    className="c-botao c-botao-secundario c-botao-pequeno"
                    onClick={() => aoEditar(p)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="c-link"
                    style={{ marginLeft: "auto", fontSize: 12 }}
                    disabled={ocupado === p.id}
                    onClick={() => void alternarAtivo(p)}
                  >
                    {p.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PainelChecklist({
  participantes,
  selecionada,
  aoSelecionar,
}: {
  participantes: ParticipanteHotSlim[];
  selecionada: string | null;
  aoSelecionar: (id: string | null) => void;
}) {
  const [checklist, definirChecklist] = useState<ChecklistResumo[]>([]);
  const [carregando, definirCarregando] = useState(false);
  const ativas = participantes.filter((p) => p.ativo);

  useEffect(() => {
    if (!selecionada) {
      definirChecklist([]);
      return;
    }
    definirCarregando(true);
    repositorioHotSlimAdmin
      .carregarChecklist(selecionada)
      .then(definirChecklist)
      .catch(() => definirChecklist([]))
      .finally(() => definirCarregando(false));
  }, [selecionada]);

  const participanteNome = participantes.find((p) => p.id === selecionada)?.nome ?? "";

  const totalDias = checklist.length;
  const diasBons = checklist.filter((d) => contarMarcadosChecklist(d) >= 5).length;
  const mediaChecks = totalDias > 0
    ? (checklist.reduce((s, d) => s + contarMarcadosChecklist(d), 0) / totalDias).toFixed(1)
    : "0";

  return (
    <>
      <Campo rotulo="Participante">
        <select
          className="c-select"
          value={selecionada ?? ""}
          onChange={(e) => aoSelecionar(e.target.value || null)}
        >
          <option value="">Escolha a participante</option>
          {ativas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      {!selecionada ? (
        <p className="c-contagem">Selecione uma participante para ver o checklist.</p>
      ) : carregando ? (
        <Esqueleto />
      ) : checklist.length === 0 ? (
        <p className="c-contagem">{participanteNome} ainda não preencheu nenhum checklist.</p>
      ) : (
        <>
          <div style={{ ...CSS.dashboard, gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
            <StatCard valor={totalDias} rotulo="Dias registrados" cor="#38546C" />
            <StatCard valor={diasBons} rotulo="Dias bons (5+/7)" cor="#3D6650" />
            <StatCard valor={Number(mediaChecks)} rotulo="Média diária" cor="#8B7A2E" sufixo="/7" />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {CAMPOS_CHECKLIST.map((c) => (
              <span key={c.campo} style={{ fontSize: 11, color: "var(--fg-soft, #6b7280)", display: "flex", alignItems: "center", gap: 3 }}>
                <span>{c.icone}</span> {c.texto}
              </span>
            ))}
          </div>

          {checklist.map((dia) => {
            const total = contarMarcadosChecklist(dia);
            const corTotal = total >= 5 ? "#3D6650" : total >= 3 ? "#8B7A2E" : "#9B3B30";
            const bgTotal = total >= 5 ? "#E4EFE8" : total >= 3 ? "#F5F0DC" : "#FAE8E5";

            return (
              <div key={dia.dia} style={CSS.dayCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, minWidth: 44 }}>
                    {new Date(dia.dia + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>

                  <div style={CSS.dotRow}>
                    {CAMPOS_CHECKLIST.map((c) => {
                      const marcado = dia[c.campo as keyof ChecklistResumo] as boolean;
                      return (
                        <span
                          key={c.campo}
                          title={`${c.texto}: ${marcado ? "Sim" : "Não"}`}
                          style={{
                            ...CSS.dot,
                            background: marcado ? "#3D6650" : "#e5e7eb",
                          }}
                        />
                      );
                    })}
                  </div>

                  <span style={{
                    ...CSS.badge,
                    color: corTotal,
                    background: bgTotal,
                    marginLeft: "auto",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {total}/7
                  </span>
                </div>

                {dia.notas && (
                  <div style={{
                    fontSize: 13,
                    color: "var(--fg-soft, #6b7280)",
                    paddingLeft: 54,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}>
                    "{dia.notas}"
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function ModalParticipante({
  participante,
  aoFechar,
}: {
  participante: ParticipanteHotSlim | null;
  aoFechar: () => void;
}) {
  const hoje = hojeSaoPaulo();
  const fimPadrao = somarDiasISO(hoje, 20);

  const [nome, definirNome] = useState(participante?.nome ?? "");
  const [email, definirEmail] = useState(participante?.email ?? "");
  const [telefone, definirTelefone] = useState(participante?.telefone ?? "");
  const [dataInicio, definirDataInicio] = useState(participante?.data_inicio ?? hoje);
  const [dataFim, definirDataFim] = useState(participante?.data_fim ?? fimPadrao);
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  async function salvar() {
    definirAviso(null);
    if (!nome.trim()) return definirAviso("Escreva o nome.");
    if (!email.trim() || !email.includes("@")) return definirAviso("Escreva o e-mail.");
    if (dataFim < dataInicio) return definirAviso("A data de fim não pode ser antes da de início.");

    definirSalvando(true);
    try {
      if (participante) {
        await repositorioHotSlimAdmin.alterarParticipante(participante.id, {
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          data_inicio: dataInicio,
          data_fim: dataFim,
        });
      } else {
        await repositorioHotSlimAdmin.cadastrarParticipante({
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || undefined,
          data_inicio: dataInicio,
          data_fim: dataFim,
        });
      }
      aoFechar();
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "";
      definirAviso(msg || "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Modal titulo={participante ? "Editar participante" : "Nova participante"} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Maria Silva" />
      </Campo>
      <Campo rotulo="E-mail" dica={participante ? "O e-mail não pode ser alterado." : "Será enviado um convite por e-mail."}>
        <Texto
          valor={email}
          aoMudar={participante ? () => {} : definirEmail}
          placeholder="maria@email.com"
          tipo="email"
        />
      </Campo>
      <Campo rotulo="WhatsApp (opcional)">
        <Texto valor={telefone} aoMudar={definirTelefone} placeholder="(31) 99999-0000" />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Início do desafio">
          <Texto valor={dataInicio} aoMudar={definirDataInicio} tipo="date" />
        </Campo>
        <Campo rotulo="Fim do desafio">
          <Texto valor={dataFim} aoMudar={definirDataFim} tipo="date" />
        </Campo>
      </div>

      {!participante && (
        <p className="c-dica">
          A participante receberá um e-mail com link de acesso. Se já tiver conta no sistema,
          o papel será atualizado automaticamente.
        </p>
      )}

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}
      <div className="c-modal-acoes">
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

function diasEntre(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T12:00:00");
  const b = new Date(isoB + "T12:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("sv-SE");
}
