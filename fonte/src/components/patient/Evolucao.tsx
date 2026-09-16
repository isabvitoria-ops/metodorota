import { useMemo } from "react";
import { Fita, type PontoFita } from "@/components/ui/Fita";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/EstadoAsync";
import { useCheckin, useHistoricoCheckin } from "@/hooks/useCheckin";
import { useSessoesFoto } from "@/hooks/useEvolucao";
import { useToast } from "@/hooks/useToast";
import { useUiPacienteStore } from "@/store/uiPacienteStore";
import type { CheckIn, SessaoFoto } from "@/types";

const HISTORICO_VAZIO: CheckIn[] = [];
const SESSOES_VAZIO: SessaoFoto[] = [];

export function Evolucao({ pacienteId, nutricionistaId }: { pacienteId: string; nutricionistaId: string }) {
  const { estado: estadoCheckin } = useCheckin(pacienteId);
  const { estado: estadoHistorico } = useHistoricoCheckin(pacienteId, 13);
  const { estado: estadoSessoes } = useSessoesFoto(pacienteId, nutricionistaId);
  const abrirFotos = useUiPacienteStore((s) => s.abrirFotos);
  const avisar = useToast();

  const feitoHoje = estadoCheckin.status === "pronto" ? estadoCheckin.dado : null;
  const historico = estadoHistorico.status === "pronto" ? estadoHistorico.dado : HISTORICO_VAZIO;
  const sessoes = estadoSessoes.status === "pronto" ? estadoSessoes.dado : SESSOES_VAZIO;

  // "hoje" é sempre a última barra e sempre existe — mesmo sem check-in
  // ainda. Marcar `i === length - 1` sem empurrar o dia de hoje fazia a
  // fita destacar *ontem* como hoje enquanto o check-in não fosse feito.
  const dados: PontoFita[] = useMemo(() => {
    const arr: PontoFita[] = historico.map((c) => ({ dia: new Date(`${c.data}T00:00:00`), bristol: c.bristol, hoje: false }));
    arr.push({ dia: new Date(), bristol: feitoHoje?.bristol ?? null, hoje: true });
    return arr;
  }, [historico, feitoHoje]);

  const dorSerie = useMemo(() => {
    const base = historico.map((c) => (c.sintomas.dor ?? 0) * 3.33);
    if (feitoHoje) base.push((feitoHoje.sintomas.dor ?? 0) * 3.33);
    return base;
  }, [historico, feitoHoje]);

  const maxDor = 10, w = 100, h = 40;
  const linha = dorSerie.map((v, i) => `${(i / Math.max(dorSerie.length - 1, 1)) * w},${h - (v / maxDor) * h}`).join(" ");
  const bons = dados.filter((d) => d.bristol === 3 || d.bristol === 4).length;

  return (
    <div className="scroll">
      <section style={{ paddingTop: 4 }}>
        <Eyebrow>Sua linha do tempo</Eyebrow>
        <h1 className="disp" style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 22px" }}>O que mudou</h1>
      </section>

      {estadoHistorico.status === "carregando" ? (
        <SkeletonCard />
      ) : (
        <Card>
          <Eyebrow>Formato, dia a dia</Eyebrow>
          <div style={{ marginTop: 14 }}>
            <Fita dados={dados} altura={54} />
          </div>
          <div style={{ marginTop: 18, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
            <strong style={{ color: "var(--ink)" }}>{bons} de {dados.length} dias</strong> ficaram na faixa mais próxima do ideal. No começo do mês eram menos.
          </div>
        </Card>
      )}

      <div style={{ height: 12 }} />

      <Card>
        <Eyebrow>Dor abdominal</Eyebrow>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, overflow: "visible", marginTop: 14 }}>
          {[0, 0.5, 1].map((p) => (
            <line key={p} x1="0" y1={h * p} x2={w} y2={h * p} stroke="var(--line)" strokeWidth=".4" />
          ))}
          <polyline points={linha} fill="none" stroke="var(--clay)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {dorSerie.map((v, i) => (
            <circle key={i} cx={(i / Math.max(dorSerie.length - 1, 1)) * w} cy={h - (v / maxDor) * h} r="1.4" fill="var(--clay)" />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>2 semanas atrás</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>hoje</span>
        </div>
      </Card>

      <hr className="hair" />

      <Eyebrow>Registros</Eyebrow>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Fotos</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "6px 0 14px", lineHeight: 1.5 }}>
            {sessoes.length} sessões guardadas. Frente, perfil, costas e abdômen.
          </p>
          <Btn variante="quiet" style={{ padding: 13, fontSize: 14.5 }} onClick={abrirFotos}>Abrir minhas fotos</Btn>
        </Card>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Peso</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "6px 0 14px", lineHeight: 1.5 }}>
            Sua nutri deixou este registro no modo discreto: você anota, ela acompanha.
          </p>
          <Btn variante="quiet" style={{ padding: 13, fontSize: 14.5 }} onClick={() => avisar("Registro de peso abriria aqui.")}>Registrar peso</Btn>
        </Card>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Medidas</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "6px 0 14px", lineHeight: 1.5 }}>
            Cintura, abdômen e quadril, quando sua nutri pedir.
          </p>
          <Btn variante="quiet" style={{ padding: 13, fontSize: 14.5 }} onClick={() => avisar("Histórico de medidas abriria aqui.")}>Ver histórico</Btn>
        </Card>
      </div>
    </div>
  );
}
