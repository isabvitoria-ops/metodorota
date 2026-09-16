import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useToast } from "@/hooks/useToast";

export function Lembretes({ pacienteId, onFechar }: { pacienteId: string; onFechar: () => void }) {
  const { estado, salvar } = usePreferencias(pacienteId);
  const [silencio, setSilencio] = useState(true);
  const avisar = useToast();

  if (estado.status !== "pronto" || !estado.dado) {
    return (
      <Sheet onFechar={onFechar} titulo="Lembretes">
        <p style={{ color: "var(--ink-2)" }}>{estado.status === "carregando" ? "Carregando…" : "Não deu pra carregar suas preferências."}</p>
      </Sheet>
    );
  }

  const prefs = estado.dado;
  const toggleLembrete = (id: string) => {
    salvar({ ...prefs, lembretes: prefs.lembretes.map((l) => (l.id === id ? { ...l, ativo: !l.ativo } : l)) });
  };
  const toggleDiscreto = () => salvar({ ...prefs, textoDiscretoNaTelaBloqueada: !prefs.textoDiscretoNaTelaBloqueada });
  const ativos = prefs.lembretes.filter((l) => l.ativo).length;

  return (
    <Sheet onFechar={onFechar} titulo="Lembretes">
      <Eyebrow>Lembretes</Eyebrow>
      <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 8px" }}>Você decide o quanto o app fala</h2>
      <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px", lineHeight: 1.5 }}>
        Um app de saúde que incomoda vira app desinstalado. Deixe ligado só o que ajuda você.
      </p>

      <Eyebrow>Na tela bloqueada</Eyebrow>
      <Card style={{ margin: "10px 0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Texto discreto</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.45 }}>
              Nenhuma palavra sobre intestino aparece para quem estiver perto de você.
            </div>
          </div>
          <Switch ativo={prefs.textoDiscretoNaTelaBloqueada} onClick={toggleDiscreto} label="Alternar texto discreto" />
        </div>
        <div style={{ background: "var(--ink)", borderRadius: 13, padding: 14 }}>
          <div className="mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,.45)", letterSpacing: ".12em", marginBottom: 6 }}>AGORA · PRÉVIA</div>
          <div style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>
            {prefs.textoDiscretoNaTelaBloqueada ? "Seu registro de hoje" : "Como foi seu intestino hoje?"}
          </div>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.7)", marginTop: 3 }}>
            {prefs.textoDiscretoNaTelaBloqueada ? "Está esperando por você." : "Leva 30 segundos e vira gráfico na consulta."}
          </div>
        </div>
      </Card>

      <Eyebrow>O que avisar</Eyebrow>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {prefs.lembretes.map((l) => (
          <Card key={l.id} style={{ padding: 15, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: l.ativo ? 600 : 400 }}>{l.label}{l.horario ? ` · ${l.horario}` : ""}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3 }}>{l.descricao}</div>
            </div>
            <Switch ativo={l.ativo} onClick={() => toggleLembrete(l.id)} label={`Alternar ${l.label}`} />
          </Card>
        ))}
      </div>

      <Eyebrow>Silêncio</Eyebrow>
      <Card style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Não perturbe · {prefs.naoPerturbeInicio}h às {prefs.naoPerturbeFim}h</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 3 }}>Nada chega nesse intervalo, nem mensagem da nutri.</div>
        </div>
        <Switch ativo={silencio} onClick={() => setSilencio((s) => !s)} label="Alternar não perturbe" />
      </Card>

      <Btn style={{ marginTop: 22 }} onClick={() => { avisar(`${ativos} lembretes ativos.`); onFechar(); }}>Salvar</Btn>
    </Sheet>
  );
}
