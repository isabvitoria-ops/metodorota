import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { DesenhoBristol } from "@/components/ui/DesenhoBristol";
import { ESCALA_BRISTOL } from "@/constants/bristol";
import {
  AVISO_SANGUE, FAIXAS_SONO, FLAGS_EVACUACAO, NIVEIS_MOVIMENTO, OPCOES_HUMOR, REGIOES_ABDOMINAIS, SINTOMAS,
} from "@/constants/checkin";
import type {
  BristolTipo, CheckIn as CheckInType, FaixaSono, FlagEvacuacao, Humor, Intensidade, MapaDor, NivelMovimento, RegiaoAbdominal, RegistroSintoma,
} from "@/types";

type Passo = "evacuacao" | "bristol" | "detalhes" | "sintomas" | "mapa" | "rotina" | "humor";

export interface DadosCheckIn {
  evacuou: boolean | null;
  bristol: BristolTipo | null;
  flags: FlagEvacuacao[];
  sintomas: RegistroSintoma;
  mapaDor: MapaDor;
  humor: Humor | null;
  sono: FaixaSono | null;
  movimento: NivelMovimento | null;
}

/**
 * Fluxo em passos condicionais — porte literal do protótipo. Manter
 * exatamente esta condicionalidade é regra de negócio (briefing §14 ·
 * Check-in): bristol/detalhes só aparecem se evacuou; mapa só se marcou dor
 * ou coceira.
 */
export function CheckIn({
  inicial,
  onFechar,
  onSalvar,
}: {
  inicial: CheckInType | null;
  onFechar: () => void;
  onSalvar: (dados: DadosCheckIn) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [evacuou, setEvacuou] = useState<boolean | null>(inicial?.evacuou ?? null);
  const [bristol, setBristol] = useState<BristolTipo | null>(inicial?.bristol ?? null);
  const [flags, setFlags] = useState<FlagEvacuacao[]>(inicial?.flags ?? []);
  const [sintomas, setSintomas] = useState<RegistroSintoma>(inicial?.sintomas ?? {});
  const [mapaDor, setMapaDor] = useState<MapaDor>(inicial?.mapaDor ?? {});
  const [humor, setHumor] = useState<Humor | null>(inicial?.humor ?? null);
  const [sono, setSono] = useState<FaixaSono | null>(inicial?.sono ?? null);
  const [movimento, setMovimento] = useState<NivelMovimento | null>(inicial?.movimento ?? null);

  const temDor = !!sintomas.dor || !!sintomas.coceira;
  const passos: Passo[] = ["evacuacao", ...(evacuou ? (["bristol", "detalhes"] as const) : []), "sintomas", ...(temDor ? (["mapa"] as const) : []), "rotina", "humor"];
  const atual = passos[Math.min(passo, passos.length - 1)]!;
  const ultimo = passo >= passos.length - 1;

  const toggleFlag = (f: FlagEvacuacao) => setFlags((v) => (v.includes(f) ? v.filter((x) => x !== f) : [...v, f]));
  const setSint = (id: keyof RegistroSintoma, v: Intensidade) =>
    setSintomas((s) => {
      const n = { ...s };
      if (v === 0) delete n[id];
      else n[id] = v;
      return n;
    });
  const toggleRegiao = (id: RegiaoAbdominal) =>
    setMapaDor((r) => {
      const v = r[id] ?? 0;
      const nv = ((v + 1) % 4) as Intensidade;
      const n = { ...r };
      if (nv === 0) delete n[id];
      else n[id] = nv;
      return n;
    });

  const podeAvancar: Record<Passo, boolean> = {
    evacuacao: evacuou !== null,
    bristol: bristol !== null,
    detalhes: true,
    sintomas: true,
    mapa: true,
    rotina: true,
    humor: humor !== null,
  };

  return (
    <Sheet onFechar={onFechar} titulo="Check-in do dia">
      <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
        {passos.map((_, i) => (
          <div
            key={i}
            style={{ flex: 1, height: 3, borderRadius: 99, background: i <= passo ? "var(--plum)" : "var(--line)", transition: "background .2s" }}
          />
        ))}
      </div>

      {atual === "evacuacao" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Você evacuou hoje?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 24px" }}>Sem julgamento. É só um registro.</p>
          <div style={{ display: "flex", gap: 10 }}>
            {([["Sim", true], ["Ainda não", false]] as const).map(([l, v]) => (
              <Chip key={l} ativo={evacuou === v} onClick={() => setEvacuou(v)} style={{ flex: 1, padding: "18px 0", fontSize: 16 }}>
                {l}
              </Chip>
            ))}
          </div>
        </>
      )}

      {atual === "bristol" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Qual formato ficou mais parecido?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 20px" }}>Se teve mais de um, escolha o que mais se repetiu.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {ESCALA_BRISTOL.map((b) => (
              <button
                key={b.n}
                type="button"
                onClick={() => setBristol(b.n)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 14,
                  cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${bristol === b.n ? b.cor : "var(--line)"}`,
                  background: bristol === b.n ? `${b.cor}18` : "var(--card)",
                  transition: "all .14s", fontFamily: "inherit",
                }}
              >
                <DesenhoBristol tipo={b.n} cor={b.cor} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{b.label}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{b.hint}</div>
                </div>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{b.n}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {atual === "detalhes" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Teve algo disso?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 20px" }}>Toque no que aconteceu. Se não teve nada, é só avançar.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FLAGS_EVACUACAO.map((f) => (
              <Chip key={f.id} variante={f.alerta ? "warn" : "padrao"} ativo={flags.includes(f.id as FlagEvacuacao)} onClick={() => toggleFlag(f.id as FlagEvacuacao)}>
                {f.label}
              </Chip>
            ))}
          </div>
          {flags.includes("sangue") && (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#fff", borderLeft: "3px solid var(--clay)", fontSize: 14, lineHeight: 1.5 }}>
              {AVISO_SANGUE}
            </div>
          )}
        </>
      )}

      {atual === "sintomas" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Como o corpo se comportou?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 20px" }}>Toque uma vez para leve, duas para moderado, três para forte.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {SINTOMAS.map((s) => {
              const v = sintomas[s.id] ?? 0;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, background: "var(--card)", border: `1.5px solid ${v ? "var(--plum)" : "var(--line)"}` }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: v ? 600 : 400 }}>{s.label}</span>
                  <button
                    type="button"
                    onClick={() => setSint(s.id, ((v + 1) % 4) as Intensidade)}
                    aria-label={`${s.label}, intensidade ${v} de 3`}
                    style={{ display: "flex", gap: 5, background: "none", border: 0, cursor: "pointer", padding: 4 }}
                  >
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        style={{ width: 22, height: 22, borderRadius: 7, transition: "all .13s", background: v >= n ? ["#C9C3C7", "var(--plum-2)", "var(--plum)"][v - 1] : "var(--line)" }}
                      />
                    ))}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {atual === "mapa" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Onde exatamente?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 16px" }}>Toque nas áreas. Toque de novo para aumentar a intensidade.</p>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 8 }}>
            <svg width="230" height="270" viewBox="0 0 230 270">
              <path
                d="M115 6c30 0 46 16 52 40 6 26 10 62 10 96 0 44-8 82-20 104-8 14-24 20-42 20s-34-6-42-20C61 224 53 186 53 142c0-34 4-70 10-96C69 22 85 6 115 6z"
                fill="#fff" stroke="var(--line)" strokeWidth="1.5"
              />
              {REGIOES_ABDOMINAIS.map(([id, nome], i) => {
                const col = i % 3, row = Math.floor(i / 3), v = mapaDor[id] ?? 0;
                const cores = ["transparent", "#E3CFDD", "var(--plum-2)", "var(--plum)"];
                return (
                  <rect
                    key={id} className="region" x={62 + col * 36} y={62 + row * 46} width={34} height={44} rx={11}
                    fill={cores[v]} stroke={v ? "none" : "var(--line)"} strokeWidth="1.2" strokeDasharray={v ? "0" : "3 3"}
                    onClick={() => toggleRegiao(id)} role="button" tabIndex={0} aria-label={nome}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRegiao(id); } }}
                  >
                    <title>{nome}</title>
                  </rect>
                );
              })}
              <circle cx="115" cy="152" r="4" fill="var(--line)" />
            </svg>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", textAlign: "center" }}>
            {Object.keys(mapaDor).length === 0
              ? "Nenhuma área marcada ainda."
              : Object.keys(mapaDor).map((id) => REGIOES_ABDOMINAIS.find((r) => r[0] === id)![1]).join(" · ")}
          </div>
        </>
      )}

      {atual === "rotina" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>Sono e movimento</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px" }}>Dois toques. Os dois mexem no trânsito intestinal mais do que parece.</p>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Quanto você dormiu</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {FAIXAS_SONO.map((l) => (
              <Chip key={l} ativo={sono === l} onClick={() => setSono(l)} style={{ flex: 1, padding: "14px 4px", fontSize: 12.5 }}>
                {l}
              </Chip>
            ))}
          </div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Você se mexeu hoje</div>
          <div style={{ display: "flex", gap: 8 }}>
            {NIVEIS_MOVIMENTO.map((l) => (
              <Chip key={l} ativo={movimento === l} onClick={() => setMovimento(l)} style={{ flex: 1, padding: "14px 4px", fontSize: 13 }}>
                {l}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 18, lineHeight: 1.5 }}>Pode pular se não quiser responder — o check-in salva do mesmo jeito.</p>
        </>
      )}

      {atual === "humor" && (
        <>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "0 0 6px" }}>E o dia, como foi?</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px" }}>Estresse mexe com o intestino tanto quanto a comida. Por isso perguntamos.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {OPCOES_HUMOR.map(([l, v]) => (
              <Chip key={v} ativo={humor === v} onClick={() => setHumor(v as Humor)} style={{ flex: 1, padding: "16px 0", fontSize: 13 }}>
                {l}
              </Chip>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        {passo > 0 && (
          <Btn variante="ghost" style={{ flex: "0 0 90px" }} onClick={() => setPasso((p) => p - 1)}>
            Voltar
          </Btn>
        )}
        <Btn
          style={{ flex: 1 }}
          disabled={!podeAvancar[atual]}
          onClick={() =>
            ultimo
              ? onSalvar({ evacuou, bristol: evacuou ? bristol : null, flags: evacuou ? flags : [], sintomas, mapaDor: temDor ? mapaDor : {}, humor, sono, movimento })
              : setPasso((p) => p + 1)
          }
        >
          {ultimo ? "Salvar check-in" : "Continuar"}
        </Btn>
      </div>
      <button
        type="button"
        onClick={onFechar}
        style={{ width: "100%", background: "none", border: 0, padding: "16px 0 4px", color: "var(--ink-3)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
      >
        Agora não
      </button>
    </Sheet>
  );
}
