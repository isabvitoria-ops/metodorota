import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { useFicha } from "@/hooks/useFicha";

export function Ficha({ codigoTaco, nomeExibicao, onFechar }: { codigoTaco: number; nomeExibicao: string; onFechar: () => void }) {
  const estado = useFicha(codigoTaco);

  return (
    <Sheet onFechar={onFechar} titulo={nomeExibicao}>
      {estado.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
      {estado.status === "erro" && <p style={{ color: "var(--clay)" }}>Não deu pra carregar esta ficha agora.</p>}
      {estado.status === "pronto" && estado.dado && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {estado.dado.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11.5,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: "var(--plum-wash)",
                  color: "var(--plum)",
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <Eyebrow>{nomeExibicao}</Eyebrow>
          <h2 className="disp" style={{ fontSize: 26, fontWeight: 600, margin: "10px 0 14px" }}>
            {estado.dado.titulo}
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 24px" }}>{estado.dado.corpo}</p>
          <Eyebrow>Como preparar</Eyebrow>
          <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
            {estado.dado.dicas.map((d, i) => (
              <Card key={i} style={{ padding: 14, display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.5 }}>
                <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12, paddingTop: 2 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{d}</span>
              </Card>
            ))}
          </div>
        </>
      )}
      {estado.status === "pronto" && !estado.dado && (
        <p style={{ color: "var(--ink-2)" }}>Ainda não há conteúdo educativo cadastrado para {nomeExibicao}.</p>
      )}
      <Btn variante="ghost" style={{ marginTop: 22 }} onClick={onFechar}>
        Fechar
      </Btn>
    </Sheet>
  );
}
