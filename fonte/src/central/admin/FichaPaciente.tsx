import { useEffect, useState } from "react";
import type { EventoHistorico, Paciente, Plano } from "@/central/types";
import { usePacientes } from "@/central/hooks/usePacientes";
import { SeloSituacao } from "@/central/components/Selo";
import { dataBonita, hojeSaoPaulo, somarDias } from "@/central/utils/situacao";
import { Modal } from "./componentes/Modal";
import { AreaTexto, Campo, Selecao, Texto } from "./componentes/Campos";

/**
 * A ficha de um paciente: renovar, suspender, reativar, reenviar convite,
 * editar e excluir (§24, §31 a §33 do briefing).
 *
 * Três coisas diferentes que costumam ser confundidas estão separadas aqui
 * de propósito:
 *   renovar   — muda o período, o cadastro continua
 *   suspender — bloqueia agora, o cadastro continua
 *   excluir   — apaga de vez, e só isso pede confirmação
 *
 * Expirar não é nenhuma das três: acontece sozinho, pela data.
 */
const ROTULOS_EVENTO: Record<string, string> = {
  paciente_cadastrado: "Paciente cadastrado",
  convite_enviado: "Convite enviado",
  conta_ativada: "Conta ativada",
  conta_vinculada: "Conta vinculada ao cadastro",
  renovado: "Acesso renovado",
  suspenso: "Acesso suspenso",
  reativado: "Acesso reativado",
  status_alterado: "Situação alterada",
};

export function FichaPaciente({
  paciente,
  planos,
  aoFechar,
}: {
  paciente: Paciente;
  planos: Plano[];
  aoFechar: () => void;
}) {
  const { alterar, excluir, convidar, historico } = usePacientes();
  const [aba, definirAba] = useState<"resumo" | "renovar" | "editar">("resumo");
  const [eventos, definirEventos] = useState<EventoHistorico[]>([]);
  const [confirmandoExclusao, definirConfirmando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  useEffect(() => {
    void historico(paciente.id).then(definirEventos);
  }, [historico, paciente.id]);

  const suspenso = paciente.status === "suspenso";

  async function executar(acao: () => Promise<void>, mensagem: string) {
    definirOcupado(true);
    await acao();
    definirAviso(mensagem);
    definirOcupado(false);
  }

  return (
    <Modal titulo={paciente.nome} aoFechar={aoFechar}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <SeloSituacao situacao={paciente.situacao} />
        <span className="c-dica" style={{ marginTop: 0 }}>{paciente.email}</span>
      </div>

      <div className="c-chips" style={{ marginTop: 16 }}>
        <button type="button" className="c-chip" aria-pressed={aba === "resumo"} onClick={() => definirAba("resumo")}>
          Resumo
        </button>
        <button type="button" className="c-chip" aria-pressed={aba === "renovar"} onClick={() => definirAba("renovar")}>
          Renovar
        </button>
        <button type="button" className="c-chip" aria-pressed={aba === "editar"} onClick={() => definirAba("editar")}>
          Editar
        </button>
      </div>

      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      {aba === "resumo" && (
        <>
          <div className="c-bloco">
            <Linha rotulo="Plano" valor={paciente.planoNome ?? "Sem plano"} />
            <Linha rotulo="Início" valor={dataBonita(paciente.dataInicio)} />
            <Linha rotulo="Fim" valor={dataBonita(paciente.dataFim)} />
            <Linha
              rotulo="Dias restantes"
              valor={
                paciente.diasRestantes === null
                  ? "—"
                  : paciente.diasRestantes < 0
                    ? `Venceu há ${Math.abs(paciente.diasRestantes)} dias`
                    : `${paciente.diasRestantes}`
              }
            />
            <Linha
              rotulo="Último acesso"
              valor={paciente.ultimoAcesso ? dataBonita(paciente.ultimoAcesso.slice(0, 10)) : "Ainda não entrou"}
            />
            <Linha
              rotulo="Conta"
              valor={paciente.perfilId ? "Criada" : "Ainda não criada (convite pendente)"}
            />
            <Linha
              rotulo="Convite"
              valor={paciente.conviteEnviadoEm ? `Enviado em ${dataBonita(paciente.conviteEnviadoEm.slice(0, 10))}` : "Não enviado"}
            />
            {paciente.observacoes && <Linha rotulo="Observações" valor={paciente.observacoes} />}
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="c-botao c-botao-secundario"
              disabled={ocupado}
              onClick={() =>
                void executar(
                  () => convidar(paciente.id, paciente.email),
                  "Convite enviado. A pessoa recebe um link para criar a senha.",
                )
              }
            >
              {paciente.conviteEnviadoEm ? "Reenviar convite" : "Enviar convite"}
            </button>

            {suspenso ? (
              <button
                type="button"
                className="c-botao c-botao-secundario"
                disabled={ocupado}
                onClick={() =>
                  void executar(
                    () => alterar(paciente.id, { status: "ativo" }),
                    "Acesso reativado. Se o período ainda valer, já está liberado.",
                  )
                }
              >
                Reativar acesso
              </button>
            ) : (
              <button
                type="button"
                className="c-botao c-botao-secundario"
                disabled={ocupado || !paciente.perfilId}
                onClick={() =>
                  void executar(
                    () => alterar(paciente.id, { status: "suspenso" }),
                    "Acesso suspenso. O cadastro continua aqui.",
                  )
                }
              >
                Suspender acesso
              </button>
            )}

            {confirmandoExclusao ? (
              <div className="c-bloco" style={{ borderColor: "var(--danger)" }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                  Excluir apaga o cadastro, o histórico e os salvos desta pessoa. Não dá para
                  desfazer. Para só tirar o acesso, use <strong>Suspender</strong>.
                </p>
                <div className="c-modal-acoes">
                  <button type="button" className="c-botao c-botao-secundario" onClick={() => definirConfirmando(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="c-botao c-botao-perigo"
                    disabled={ocupado}
                    onClick={async () => {
                      definirOcupado(true);
                      await excluir(paciente.id);
                      aoFechar();
                    }}
                  >
                    Excluir de vez
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="c-link" onClick={() => definirConfirmando(true)}>
                Excluir paciente
              </button>
            )}
          </div>

          <section style={{ marginTop: 22 }}>
            <h3 className="c-secao-titulo">Histórico</h3>
            {eventos.length === 0 ? (
              <p className="c-dica">Sem registros ainda.</p>
            ) : (
              <div className="c-lista">
                {eventos.map((evento) => (
                  <div key={evento.id} className="c-lista-item">
                    <span>
                      <span className="c-lista-item-nome">
                        {ROTULOS_EVENTO[evento.evento] ?? evento.evento}
                      </span>
                      <span className="c-lista-item-apoio">
                        {dataBonita(evento.criadoEm.slice(0, 10))}
                        {detalheLegivel(evento) ? ` · ${detalheLegivel(evento)}` : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {aba === "renovar" && (
        // `key` força o formulário a recalcular a sugestão depois de uma
        // renovação: sem isso ele continuaria mostrando as datas antigas.
        <AbaRenovar
          key={`${paciente.dataInicio}-${paciente.dataFim}`}
          paciente={paciente}
          planos={planos}
          aoConcluir={definirAviso}
        />
      )}
      {aba === "editar" && <AbaEditar paciente={paciente} aoConcluir={definirAviso} />}
    </Modal>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "6px 0", fontSize: 14.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{rotulo}</span>
      <strong style={{ fontWeight: 600, textAlign: "right" }}>{valor}</strong>
    </div>
  );
}

function detalheLegivel(evento: EventoHistorico): string {
  const d = evento.detalhe;
  if (evento.evento === "renovado" && d.fim) return `até ${dataBonita(String(d.fim))}`;
  return "";
}

/**
 * Renovação (§31): mesma pessoa, período estendido. Nunca cria paciente novo —
 * histórico e salvos continuam de pé.
 *
 * A sugestão de datas segue o que a nutricionista faria na mão:
 *
 *   ainda dentro do prazo  → mantém o início e soma a duração ao fim atual,
 *                            para não abrir um buraco de acesso no meio
 *   já vencido             → recomeça hoje
 *
 * O primeiro caso é o que importa: renovar quem ainda tem vinte dias não pode
 * empurrar o início para o futuro — isso trancaria a pessoa para fora até lá.
 */
function AbaRenovar({
  paciente,
  planos,
  aoConcluir,
}: {
  paciente: Paciente;
  planos: Plano[];
  aoConcluir: (mensagem: string) => void;
}) {
  const { alterar } = usePacientes();
  const hoje = hojeSaoPaulo();
  const vigente = paciente.dataFim >= hoje;

  const [planoId, definirPlanoId] = useState(paciente.planoId ?? planos[0]?.id ?? "");
  const duracaoInicial = planos.find((p) => p.id === (paciente.planoId ?? planos[0]?.id))?.duracaoDias ?? 30;

  const [dataInicio, definirDataInicio] = useState(vigente ? paciente.dataInicio : hoje);
  const [dataFim, definirDataFim] = useState(
    somarDias(vigente ? paciente.dataFim : hoje, duracaoInicial),
  );
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  function escolherPlano(id: string) {
    definirPlanoId(id);
    const plano = planos.find((p) => p.id === id);
    if (plano) definirDataFim(somarDias(vigente ? paciente.dataFim : dataInicio, plano.duracaoDias));
  }

  async function renovar() {
    definirErro(null);
    if (dataFim < dataInicio) {
      definirErro("A data de fim não pode ser antes da de início.");
      return;
    }
    if (dataFim < hoje) {
      definirErro("Essa data de fim já passou. O acesso continuaria bloqueado.");
      return;
    }
    definirSalvando(true);
    await alterar(paciente.id, {
      planoId,
      dataInicio,
      dataFim,
      // Renovar quem estava suspenso também tira a suspensão: é o que
      // "renovar" significa para quem está usando a tela.
      status: "ativo",
    });
    definirSalvando(false);
    aoConcluir(
      vigente
        ? `Acesso estendido até ${dataBonita(dataFim)}, sem interrupção.`
        : `Acesso renovado até ${dataBonita(dataFim)}. A paciente já pode entrar.`,
    );
  }

  return (
    <>
      <p className="c-dica" style={{ marginTop: 14 }}>
        Período atual: {dataBonita(paciente.dataInicio)} a {dataBonita(paciente.dataFim)}
        {vigente ? " — ainda vigente, a renovação emenda no fim." : " — já vencido, a renovação recomeça hoje."}
      </p>
      <Campo rotulo="Novo plano">
        <Selecao
          valor={planoId}
          aoMudar={escolherPlano}
          opcoes={planos.map((p) => ({ valor: p.id, rotulo: `${p.nome} (${p.duracaoDias} dias)` }))}
        />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Início">
          <Texto valor={dataInicio} aoMudar={definirDataInicio} tipo="date" />
        </Campo>
        <Campo rotulo="Novo fim">
          <Texto valor={dataFim} aoMudar={definirDataFim} tipo="date" />
        </Campo>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <button type="button" className="c-botao" disabled={salvando} onClick={() => void renovar()}>
        {salvando ? "Renovando…" : "Renovar acesso"}
      </button>
    </>
  );
}

function AbaEditar({ paciente, aoConcluir }: { paciente: Paciente; aoConcluir: (m: string) => void }) {
  const { alterar } = usePacientes();
  const [nome, definirNome] = useState(paciente.nome);
  const [email, definirEmail] = useState(paciente.email);
  const [telefone, definirTelefone] = useState(paciente.telefone ?? "");
  const [observacoes, definirObservacoes] = useState(paciente.observacoes ?? "");
  const [salvando, definirSalvando] = useState(false);

  return (
    <>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} />
      </Campo>
      <Campo
        rotulo="E-mail"
        dica="Mudar o e-mail desliga o cadastro da conta atual até a pessoa entrar com o novo endereço."
      >
        <Texto valor={email} aoMudar={definirEmail} tipo="email" />
      </Campo>
      <Campo rotulo="Telefone">
        <Texto valor={telefone} aoMudar={definirTelefone} />
      </Campo>
      <Campo rotulo="Observações">
        <AreaTexto valor={observacoes} aoMudar={definirObservacoes} linhas={3} />
      </Campo>
      <button
        type="button"
        className="c-botao"
        disabled={salvando}
        onClick={async () => {
          definirSalvando(true);
          await alterar(paciente.id, {
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            telefone: telefone.trim() || null,
            observacoes: observacoes.trim() || null,
          });
          definirSalvando(false);
          aoConcluir("Dados atualizados.");
        }}
      >
        {salvando ? "Salvando…" : "Salvar alterações"}
      </button>
    </>
  );
}
