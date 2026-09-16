import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { POSES_FOTO } from "@/constants/evolucao";
import { AVISO_FOTOS_PRIVACIDADE } from "@/constants/textos";
import { formatarDataCurta, paraISODate } from "@/utils/datas";
import { useSessoesFoto } from "@/hooks/useEvolucao";
import { useToast } from "@/hooks/useToast";
import type { PoseFoto, SessaoFoto } from "@/types";

function Silhueta({ pose, preenchida }: { pose: PoseFoto; preenchida: boolean }) {
  return (
    <svg viewBox="0 0 60 100" style={{ width: "100%", height: 92 }} aria-hidden="true">
      <rect x="0" y="0" width="60" height="100" rx="10" fill={preenchida ? "var(--plum-wash)" : "transparent"} stroke={preenchida ? "none" : "var(--line)"} strokeWidth="1.2" strokeDasharray="4 4" />
      <g fill={preenchida ? "var(--plum-2)" : "var(--line)"} opacity={preenchida ? 0.9 : 0.7}>
        <circle cx="30" cy="24" r="8" />
        <path d={pose === "abdomen" ? "M18 40h24v34a12 12 0 0 1-24 0z" : "M22 36h16l5 16-3 2 2 26h-6l-2-18h-8l-2 18h-6l2-26-3-2z"} />
      </g>
    </svg>
  );
}

export function Fotos({ pacienteId, nutricionistaId, onFechar }: { pacienteId: string; nutricionistaId: string; onFechar: () => void }) {
  const { estado, salvar, apagar } = useSessoesFoto(pacienteId, nutricionistaId);
  const [poseSelecionadas, setPoseSelecionadas] = useState<PoseFoto[] | null>(null);
  const [vendo, setVendo] = useState<SessaoFoto | null>(null);
  const avisar = useToast();

  const capturar = (p: PoseFoto) => setPoseSelecionadas((s) => (s ? (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]) : [p]));

  const salvarSessao = async () => {
    if (!poseSelecionadas) return;
    const path: Partial<Record<PoseFoto, string>> = {};
    poseSelecionadas.forEach((p) => {
      path[p] = `fotos-evolucao/${pacienteId}/${Date.now()}/${p}.jpg`;
    });
    await salvar(paraISODate(new Date()), path);
    setPoseSelecionadas(null);
    avisar("Fotos salvas. Só você e sua nutri têm acesso.");
  };

  const sessoes = estado.status === "pronto" ? estado.dado : [];

  return (
    <Sheet onFechar={onFechar} titulo="Evolução corporal">
      {!poseSelecionadas && !vendo && (
        <>
          <Eyebrow>Evolução corporal</Eyebrow>
          <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 8px" }}>Suas fotos</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 18px", lineHeight: 1.5 }}>{AVISO_FOTOS_PRIVACIDADE}</p>

          {estado.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}

          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {sessoes.map((s) => {
              const poses = Object.keys(s.storagePathPorPose) as PoseFoto[];
              return (
                <button
                  key={s.id} onClick={() => setVendo(s)} className="card"
                  style={{ border: 0, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 14 }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    {POSES_FOTO.slice(0, 3).map((p) => (
                      <div key={p.id} style={{ width: 26, height: 34, borderRadius: 7, background: poses.includes(p.id) ? "var(--plum-wash)" : "var(--paper)", border: poses.includes(p.id) ? "none" : "1px dashed var(--line)" }} />
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>{formatarDataCurta(new Date(s.data))}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{poses.length} de 4 ângulos</div>
                  </div>
                  <span style={{ color: "var(--plum)", fontSize: 18 }}>→</span>
                </button>
              );
            })}
          </div>

          <Btn onClick={() => setPoseSelecionadas([])}>Fazer novas fotos</Btn>
          <Btn variante="ghost" style={{ marginTop: 10 }} onClick={onFechar}>Fechar</Btn>
        </>
      )}

      {poseSelecionadas && (
        <>
          <Eyebrow>Nova sessão · {formatarDataCurta(new Date())}</Eyebrow>
          <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 8px" }}>Quatro ângulos, sempre iguais</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 18px", lineHeight: 1.5 }}>
            Mesma luz, mesma distância, mesma roupa. É a repetição que faz a comparação valer alguma coisa — não a qualidade da foto.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {POSES_FOTO.map((p) => {
              const feita = poseSelecionadas.includes(p.id);
              return (
                <button
                  key={p.id} type="button" onClick={() => capturar(p.id)}
                  style={{ padding: 12, borderRadius: 15, cursor: "pointer", background: "var(--card)", border: `1.5px solid ${feita ? "var(--plum)" : "var(--line)"}`, fontFamily: "inherit" }}
                >
                  <Silhueta pose={p.id} preenchida={feita} />
                  <div style={{ fontSize: 14, fontWeight: feita ? 600 : 400, marginTop: 8 }}>{p.label}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: feita ? "var(--plum)" : "var(--ink-3)", marginTop: 3 }}>{feita ? "CAPTURADA" : "TOQUE PARA TIRAR"}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn variante="ghost" style={{ flex: "0 0 100px" }} onClick={() => setPoseSelecionadas(null)}>Cancelar</Btn>
            <Btn style={{ flex: 1 }} disabled={poseSelecionadas.length === 0} onClick={salvarSessao}>
              Salvar {poseSelecionadas.length > 0 ? `${poseSelecionadas.length} foto${poseSelecionadas.length > 1 ? "s" : ""}` : ""}
            </Btn>
          </div>
        </>
      )}

      {vendo && (
        <>
          <Eyebrow>Sessão de {formatarDataCurta(new Date(vendo.data))}</Eyebrow>
          <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 18px" }}>{Object.keys(vendo.storagePathPorPose).length} ângulos</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {POSES_FOTO.filter((p) => p.id in vendo.storagePathPorPose).map((p) => (
              <Card key={p.id} style={{ padding: 12 }}>
                <Silhueta pose={p.id} preenchida />
                <div style={{ fontSize: 14, marginTop: 8 }}>{p.label}</div>
              </Card>
            ))}
          </div>
          <Btn variante="ghost" style={{ marginTop: 18 }} onClick={() => setVendo(null)}>Voltar</Btn>
          <button
            type="button"
            onClick={async () => { await apagar(vendo.id); setVendo(null); avisar("Sessão apagada."); }}
            style={{ width: "100%", background: "none", border: 0, padding: "16px 0 4px", color: "var(--clay)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
          >
            Apagar esta sessão
          </button>
        </>
      )}
    </Sheet>
  );
}
