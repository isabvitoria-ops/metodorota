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

const ABAS = ["Participantes", "Checklist"] as const;
type Aba = (typeof ABAS)[number];

const CAMPOS_CHECKLIST = [
  { campo: "intestino_regulou", emoji: "🚽", texto: "Intestino" },
  { campo: "sem_gases", emoji: "💨", texto: "Sem gases" },
  { campo: "dormiu_bem", emoji: "😴", texto: "Sono" },
  { campo: "barriga_desinchada", emoji: "🫄", texto: "Barriga" },
  { campo: "sem_compulsao", emoji: "🍫", texto: "Compulsão" },
  { campo: "energia_boa", emoji: "⚡", texto: "Energia" },
  { campo: "humor_estavel", emoji: "😊", texto: "Humor" },
] as const;

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
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar.");
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

  return (
    <>
      <div className="c-admin-topo-linha" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="c-titulo" style={{ fontSize: 28 }}>🔥 Hot Slim</h1>
          <p className="c-subtitulo">
            Gerenciar participantes do desafio de 10 dias
          </p>
        </div>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => definirEditando("novo")}
        >
          Nova participante
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-numeros" style={{ marginTop: 12 }}>
        <Numero rotulo="Total" valor={participantes.length} />
        <Numero rotulo="Ativas" valor={ativas.length} />
        <Numero rotulo="Em andamento" valor={emAndamento.length} destaque={emAndamento.length > 0} />
      </div>

      <div className="c-admin-abas" style={{ marginTop: 16 }}>
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

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`c-numero ${destaque ? "destaque" : ""}`}>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
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

  function situacao(p: ParticipanteHotSlim): { texto: string; classe: string } {
    if (!p.ativo) return { texto: "Inativa", classe: "c-selo-sem-acesso" };
    if (p.data_inicio > hoje) return { texto: "Aguardando", classe: "c-selo-proximo" };
    if (p.data_fim < hoje) return { texto: "Encerrado", classe: "c-selo-parada" };
    const dia = Math.max(1, diasEntre(p.data_inicio, hoje) + 1);
    return { texto: `Dia ${dia} de 10`, classe: "c-selo-em-dia" };
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
        <div className="c-acoes">
          {participantes.map((p) => {
            const sit = situacao(p);
            return (
              <article className="c-acao" key={p.id}>
                <div className="c-acao-topo">
                  <span className="c-acao-texto">
                    <strong>{p.nome}</strong>
                    <span className="c-acao-descricao">
                      {p.email}
                      {p.telefone ? ` · ${p.telefone}` : ""}
                    </span>
                    <span className="c-acao-descricao">
                      {dataBonita(p.data_inicio)} — {dataBonita(p.data_fim)}
                    </span>
                  </span>
                  <span className={`c-selo ${sit.classe}`}>{sit.texto}</span>
                </div>

                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {TODAS_FASES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`c-chip`}
                      aria-pressed={p.fases_liberadas.includes(f)}
                      disabled={ocupado === p.id}
                      onClick={() => void liberarFase(p, f)}
                      title={p.fases_liberadas.includes(f) ? `Bloquear fase ${f}` : `Liberar fase ${f}`}
                    >
                      {p.fases_liberadas.includes(f) ? "🔓" : "🔒"} Fase {f}
                    </button>
                  ))}
                </div>

                <div className="c-acao-estado" style={{ marginTop: 8 }}>
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
                    disabled={ocupado === p.id}
                    onClick={() => void alternarAtivo(p)}
                  >
                    {p.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </article>
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
          <p className="c-contagem" style={{ marginBottom: 12 }}>
            {checklist.length} {checklist.length === 1 ? "dia" : "dias"} registrados por {participanteNome}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="c-tabela" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Dia</th>
                  {CAMPOS_CHECKLIST.map((c) => (
                    <th key={c.campo} title={c.texto} style={{ textAlign: "center", minWidth: 36 }}>
                      {c.emoji}
                    </th>
                  ))}
                  <th style={{ textAlign: "center" }}>Total</th>
                  <th style={{ textAlign: "left" }}>Notas</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((dia) => {
                  const total = contarMarcadosChecklist(dia);
                  return (
                    <tr key={dia.dia}>
                      <td>
                        {new Date(dia.dia + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      {CAMPOS_CHECKLIST.map((c) => (
                        <td key={c.campo} style={{ textAlign: "center" }}>
                          {dia[c.campo as keyof ChecklistResumo] ? "✅" : "—"}
                        </td>
                      ))}
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: total >= 5 ? "var(--c-sucesso, #16a34a)" : total >= 3 ? "var(--c-alerta, #ca8a04)" : undefined,
                        }}
                      >
                        {total}/7
                      </td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {dia.notas || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
  const daquiDez = somarDiasISO(hoje, 10);

  const [nome, definirNome] = useState(participante?.nome ?? "");
  const [email, definirEmail] = useState(participante?.email ?? "");
  const [telefone, definirTelefone] = useState(participante?.telefone ?? "");
  const [dataInicio, definirDataInicio] = useState(participante?.data_inicio ?? hoje);
  const [dataFim, definirDataFim] = useState(participante?.data_fim ?? daquiDez);
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
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
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
