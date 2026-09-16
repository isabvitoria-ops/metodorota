import { useMemo } from "react";
import { Fita, type PontoFita } from "@/components/ui/Fita";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { corBristol } from "@/constants/bristol";
import { DesenhoBristol } from "@/components/ui/DesenhoBristol";
import { useCheckin, useHistoricoCheckin } from "@/hooks/useCheckin";
import { usePlano } from "@/hooks/usePlano";
import { useDiario } from "@/hooks/useDiario";
import { useUiPacienteStore, type AbaPaciente } from "@/store/uiPacienteStore";
import { SkeletonCard } from "@/components/ui/EstadoAsync";
import { resolverQuantidadeExibicao } from "@/utils/quantidade";
import type { CheckIn, UnidadeExibicao } from "@/types";

const HISTORICO_VAZIO: CheckIn[] = [];

export function Hoje({
  pacienteId,
  irPara,
  preferenciaUnidade,
}: {
  pacienteId: string;
  irPara: (aba: AbaPaciente) => void;
  preferenciaUnidade: UnidadeExibicao;
}) {
  const { estado: estadoCheckin } = useCheckin(pacienteId);
  const { estado: estadoHistorico } = useHistoricoCheckin(pacienteId, 13);
  const { estado: estadoPlano } = usePlano(pacienteId);
  const { estado: estadoDiario } = useDiario(pacienteId);
  const agua = useUiPacienteStore((s) => s.agua);
  const definirAgua = useUiPacienteStore((s) => s.definirAgua);
  const abrirCheckin = useUiPacienteStore((s) => s.abrirCheckin);
  const abrirQuestionario = useUiPacienteStore((s) => s.abrirQuestionario);
  const questionarioPendente = useUiPacienteStore((s) => s.questionarioPendente);

  const feitoHoje = estadoCheckin.status === "pronto" ? estadoCheckin.dado : null;
  const historico = estadoHistorico.status === "pronto" ? estadoHistorico.dado : HISTORICO_VAZIO;

  const fita: PontoFita[] = useMemo(() => {
    const arr: PontoFita[] = historico.map((c) => ({ dia: new Date(`${c.data}T00:00:00`), bristol: c.bristol, hoje: false }));
    arr.push({ dia: new Date(), bristol: feitoHoje?.bristol ?? null, hoje: true });
    return arr;
  }, [historico, feitoHoje]);

  const horaAgora = new Date().getHours();
  const proximaRefeicao =
    estadoPlano.status === "pronto" && estadoPlano.dado
      ? estadoPlano.dado.refeicoes.find((m) => parseInt(m.horario, 10) >= horaAgora) ?? estadoPlano.dado.refeicoes[0]
      : null;
  const sequencia = historico.length + (feitoHoje ? 1 : 0);
  const refeicoesDoDia = estadoPlano.status === "pronto" && estadoPlano.dado ? estadoPlano.dado.refeicoes : [];
  const totalRefeicoes = refeicoesDoDia.length;
  // Conta só refeições de verdade do plano — uma refeição livre montada
  // pelo paciente (Montador) fica registrada no diário, mas não "preenche"
  // uma das N refeições prescritas do dia (mesmo comportamento do protótipo).
  const registradas =
    estadoDiario.status === "pronto"
      ? refeicoesDoDia.filter((r) => estadoDiario.dado.some((registro) => registro.refeicaoId === r.id)).length
      : 0;

  return (
    <div className="scroll">
      <section style={{ paddingTop: 4 }}>
        <Eyebrow>Como está seu intestino</Eyebrow>
        <h1 className="disp" style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 20px" }}>Últimas duas semanas</h1>
        {estadoHistorico.status === "carregando" ? <SkeletonCard /> : <Fita dados={fita} />}
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 16, lineHeight: 1.5 }}>
          Cada barra é um dia. Verde é o formato mais próximo do ideal — quanto mais a cor se afasta, mais o dia fugiu do padrão.
        </p>
      </section>

      <hr className="hair" />

      {!feitoHoje ? (
        <Card style={{ background: "var(--plum)", color: "#fff" }}>
          <div className="eyebrow" style={{ color: "rgba(255,255,255,.6)" }}>Check-in de hoje</div>
          <h2 className="disp" style={{ fontSize: 23, fontWeight: 600, margin: "10px 0 6px" }}>Leva menos de 30 segundos</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.75)", margin: "0 0 18px", lineHeight: 1.5 }}>
            Quanto mais dias seguidos, mais fácil fica enxergar o que melhora e o que piora.
          </p>
          <Btn onClick={abrirCheckin} style={{ background: "#fff", color: "var(--plum)" }}>Fazer check-in</Btn>
        </Card>
      ) : (
        <Card style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: `${corBristol(feitoHoje.bristol)}22`, display: "grid", placeItems: "center" }}>
            <DesenhoBristol tipo={feitoHoje.bristol ?? 4} cor={corBristol(feitoHoje.bristol)} size={34} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Check-in registrado</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{sequencia} dias seguidos. Isso vira gráfico na sua consulta.</div>
          </div>
          <button type="button" className="chip" onClick={abrirCheckin} style={{ fontSize: 13 }}>Editar</button>
        </Card>
      )}

      {questionarioPendente && (
        <>
          <div style={{ height: 12 }} />
          <Card style={{ borderLeft: "3px solid var(--gold)" }}>
            <Eyebrow>Uma vez por mês</Eyebrow>
            <div style={{ fontSize: 16.5, fontWeight: 600, marginBottom: 6, marginTop: 8 }}>Como foi o seu mês</div>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Seis perguntas. É o que permite comparar este mês com o anterior na sua consulta.
            </p>
            <Btn variante="quiet" style={{ padding: 13, fontSize: 14.5 }} onClick={abrirQuestionario}>Responder agora</Btn>
          </Card>
        </>
      )}

      <hr className="hair" />

      {proximaRefeicao && (
        <>
          <Eyebrow>Próxima refeição · {proximaRefeicao.horario}</Eyebrow>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => irPara("plano")} className="card" style={{ border: 0, cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit", display: "block" }}>
              <h3 className="disp" style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>{proximaRefeicao.nome}</h3>
              {proximaRefeicao.opcoes[0]?.itens.map((it, i) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: i ? "1px solid var(--line)" : "0", fontSize: 14.5 }}>
                  <span>{it.nomeExibicao}</span>
                  <span className="mono" style={{ color: "var(--ink-2)", fontSize: 13 }}>
                    {resolverQuantidadeExibicao(it.quantidade, it.quantidadeCaseira, preferenciaUnidade)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--plum)", fontWeight: 600 }}>Ver o plano completo →</div>
            </button>
          </div>
        </>
      )}

      <div style={{ height: 12 }} />
      <button onClick={() => irPara("diario")} className="card" style={{ border: 0, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", gap: 14, fontFamily: "inherit" }}>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 15.5, fontWeight: 600 }}>Diário alimentar</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 3 }}>
            {registradas === 0 ? "Nenhuma refeição registrada hoje." : `${registradas} de ${totalRefeicoes} refeições registradas.`}
          </div>
        </div>
        <span style={{ color: "var(--plum)", fontSize: 20 }}>→</span>
      </button>

      <hr className="hair" />

      <Eyebrow>Água de hoje</Eyebrow>
      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <button
              key={i} type="button" onClick={() => definirAgua(agua === i + 1 ? i : i + 1)} aria-label={`${i + 1} copos`}
              style={{ flex: 1, height: 44, borderRadius: 9, cursor: "pointer", border: `1.5px solid ${i < agua ? "var(--plum)" : "var(--line)"}`, background: i < agua ? "var(--plum)" : "transparent", transition: "all .14s" }}
            />
          ))}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
          {agua === 0 && "Toque nos copos conforme for bebendo."}
          {agua > 0 && agua < 6 && `${agua} de 8 copos. Faltam ${8 - agua}.`}
          {agua >= 6 && agua < 8 && `${agua} de 8 copos. Quase lá.`}
          {agua === 8 && "Meta do dia completa."}
        </div>
      </Card>
    </div>
  );
}
