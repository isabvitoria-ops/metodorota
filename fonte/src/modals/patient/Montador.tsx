import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card, Eyebrow } from "@/components/ui/Card";
import { NOME_GRUPO_CURTO } from "@/constants/alimentos";
import { useMontador } from "@/hooks/useMontador";
import type { ItemMontadorResolvido } from "@/services/montadorService";

const GRUPOS_ORDEM = ["carb", "prot", "legum", "fruta", "vegetal", "gordura"] as const;

export function Montador({ pacienteId, onFechar, onUsar }: { pacienteId: string; onFechar: () => void; onUsar: (resolvidos: ItemMontadorResolvido[]) => void }) {
  const { estadoPool, selecionados, alternar, resultado } = useMontador(pacienteId);
  const [bloqueio, setBloqueio] = useState<{ codigo: number; nome: string; motivo: string } | null>(null);

  return (
    <Sheet onFechar={onFechar} titulo="Montar uma refeição" cheia>
      <div style={{ flexShrink: 0 }}>
        <Eyebrow>Montar uma refeição</Eyebrow>
        <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 6px" }}>Escolha o que você tem em casa</h2>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 18px", lineHeight: 1.5 }}>
          As quantidades se ajustam sozinhas conforme você escolhe. Só aparece o que cabe no seu protocolo desta fase.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {estadoPool.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
        {estadoPool.status === "erro" && <p style={{ color: "var(--clay)" }}>Não deu pra carregar as opções agora.</p>}
        {estadoPool.status === "pronto" &&
          GRUPOS_ORDEM.map((g) => {
            const itens = estadoPool.dado.filter((f) => f.grupo === g);
            if (!itens.length) return null;
            return (
              <div key={g} style={{ marginBottom: 18 }}>
                <Eyebrow>
                  {NOME_GRUPO_CURTO[g] ?? g}
                  {g === "vegetal" ? " · à vontade" : ""}
                </Eyebrow>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {itens.map((f) => {
                    const on = selecionados.includes(f.alimentoCodigoTaco);
                    return (
                      <Chip
                        key={f.alimentoCodigoTaco}
                        ativo={on}
                        onClick={() => (f.bloqueado ? setBloqueio({ codigo: f.alimentoCodigoTaco, nome: f.nomeExibicao, motivo: f.bloqueado }) : alternar(f.alimentoCodigoTaco))}
                        style={f.bloqueado ? { opacity: 0.5, textDecoration: "line-through", borderStyle: "dashed" } : {}}
                      >
                        {f.nomeExibicao}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {bloqueio && (
          <Card style={{ borderLeft: "3px solid var(--clay)", marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{bloqueio.nome}</div>
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "6px 0 12px", lineHeight: 1.5 }}>{bloqueio.motivo}</p>
            <Chip tamanho="sm" onClick={() => setBloqueio(null)}>Entendi</Chip>
          </Card>
        )}

        {resultado && selecionados.length > 0 && (
          <Card style={{ marginTop: 4 }}>
            <Eyebrow>Sua refeição</Eyebrow>
            <div style={{ marginTop: 14 }}>
              {resultado.resolvidos.map((r) => (
                <div key={r.alimentoCodigoTaco} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 15 }}>{r.nomeExibicao}</span>
                  <span className="mono" style={{ fontSize: 13.5, color: "var(--plum)", textAlign: "right", flexShrink: 0 }}>{r.texto}</span>
                </div>
              ))}
            </div>
            {resultado.resolvidos.filter((r) => r.aviso).map((r) => (
              <div key={r.alimentoCodigoTaco} style={{ marginTop: 12, fontSize: 13, color: "var(--clay)", lineHeight: 1.45 }}>
                {r.nomeExibicao}: {r.aviso}
              </div>
            ))}
          </Card>
        )}

        {resultado && resultado.problemas.length > 0 && selecionados.length > 0 && (
          <Card style={{ marginTop: 12, borderLeft: "3px solid var(--gold)" }}>
            {resultado.problemas.map((p, i) => (
              <p key={i} style={{ margin: i ? "10px 0 0" : 0, fontSize: 14, lineHeight: 1.5 }}>{p}</p>
            ))}
          </Card>
        )}
      </div>

      <div style={{ flexShrink: 0, paddingTop: 12, display: "flex", gap: 10 }}>
        <Btn variante="ghost" style={{ flex: "0 0 100px" }} onClick={onFechar}>Fechar</Btn>
        <Btn style={{ flex: 1 }} disabled={!resultado?.podeUsar} onClick={() => resultado && onUsar(resultado.resolvidos)}>
          {selecionados.length === 0 ? "Escolha os alimentos" : "Usar esta refeição"}
        </Btn>
      </div>
    </Sheet>
  );
}
