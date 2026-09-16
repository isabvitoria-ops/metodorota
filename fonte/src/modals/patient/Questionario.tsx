import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { corPorId } from "@/constants/cores";
import { calcularFaixaIncomodo } from "@/services/questionarioService";
import { useQuestionarioMensal } from "@/hooks/useQuestionario";
import type { RespostaQuestionario } from "@/types";

export function Questionario({ pacienteId, nutricionistaId, onFechar, onEnviado }: { pacienteId: string; nutricionistaId: string; onFechar: () => void; onEnviado: () => void }) {
  const { template, carregando, enviar } = useQuestionarioMensal(pacienteId);
  const [i, setI] = useState(-1);
  const [resp, setResp] = useState<RespostaQuestionario["respostas"]>({});
  const [fim, setFim] = useState(false);

  const total = template?.perguntas.length ?? 0;
  const q = template?.perguntas[i];
  const respondida = !q ? true : q.tipo === "texto" ? true : resp[q.id] !== undefined;

  const faixa = useMemo(() => (template ? calcularFaixaIncomodo(template.perguntas, resp) : null), [template, resp]);

  const enviarRespostas = async () => {
    await enviar(nutricionistaId, resp);
    setFim(true);
  };

  if (carregando) {
    return (
      <Sheet onFechar={onFechar} titulo="Questionário">
        <p style={{ color: "var(--ink-2)" }}>Carregando…</p>
      </Sheet>
    );
  }
  if (!template) {
    return (
      <Sheet onFechar={onFechar} titulo="Questionário">
        <p style={{ color: "var(--ink-2)" }}>Nenhum questionário disponível no momento.</p>
        <Btn variante="ghost" style={{ marginTop: 18 }} onClick={onFechar}>Fechar</Btn>
      </Sheet>
    );
  }

  return (
    <Sheet onFechar={onFechar} titulo={template.titulo}>
      {i === -1 && (
        <>
          <Eyebrow>Questionário mensal</Eyebrow>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "10px 0 10px" }}>{template.titulo}</h2>
          <p style={{ fontSize: 15, color: "var(--ink-2)", margin: "0 0 24px", lineHeight: 1.55 }}>{template.introducao}</p>
          <Card style={{ marginBottom: 22, borderLeft: "3px solid var(--gold)" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
              Responda pensando no mês inteiro, não só em hoje. Não existe resposta certa — e um mês pior não significa que você errou alguma coisa.
            </p>
          </Card>
          <Btn onClick={() => setI(0)}>Começar · leva 2 minutos</Btn>
          <button type="button" onClick={onFechar} style={{ width: "100%", background: "none", border: 0, padding: "16px 0 4px", color: "var(--ink-3)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Depois
          </button>
        </>
      )}

      {i >= 0 && !fim && q && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
            {template.perguntas.map((_, k) => (
              <div key={k} style={{ flex: 1, height: 3, borderRadius: 99, background: k <= i ? "var(--plum)" : "var(--line)" }} />
            ))}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 12 }}>{i + 1} DE {total}</div>
          <h2 className="disp" style={{ fontSize: 24, fontWeight: 600, margin: "0 0 24px", lineHeight: 1.15 }}>{q.texto}</h2>

          {q.tipo === "escala" && (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: 11 }).map((_, v) => (
                  <button
                    key={v} type="button" onClick={() => setResp((r) => ({ ...r, [q.id]: v }))} aria-label={`${v}`}
                    style={{
                      flex: 1, height: 52, borderRadius: 9, cursor: "pointer", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
                      border: `1.5px solid ${resp[q.id] === v ? "var(--plum)" : "var(--line)"}`,
                      background: resp[q.id] === v ? "var(--plum)" : "var(--card)",
                      color: resp[q.id] === v ? "#fff" : "var(--ink-3)", transition: "all .12s",
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{q.rotuloEsquerda}</span>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{q.rotuloDireita}</span>
              </div>
            </>
          )}

          {q.tipo === "escolha_unica" && (
            <div style={{ display: "grid", gap: 8 }}>
              {q.opcoes?.map((o, k) => (
                <button
                  key={o} type="button" onClick={() => setResp((r) => ({ ...r, [q.id]: k }))}
                  style={{
                    padding: 15, borderRadius: 13, cursor: "pointer", textAlign: "left", fontSize: 15, fontFamily: "inherit",
                    border: `1.5px solid ${resp[q.id] === k ? "var(--plum)" : "var(--line)"}`,
                    background: resp[q.id] === k ? "var(--plum-wash)" : "var(--card)",
                    fontWeight: resp[q.id] === k ? 600 : 400,
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          )}

          {q.tipo === "texto" && (
            <textarea
              className="input" rows={5} value={(resp[q.id] as string) ?? ""} style={{ width: "100%" }}
              placeholder="Opcional. Escreva do seu jeito." onChange={(e) => setResp((r) => ({ ...r, [q.id]: e.target.value }))}
            />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <Btn variante="ghost" style={{ flex: "0 0 90px" }} onClick={() => setI((k) => k - 1)}>Voltar</Btn>
            <Btn style={{ flex: 1 }} disabled={!respondida} onClick={() => (i === total - 1 ? enviarRespostas() : setI((k) => k + 1))}>
              {i === total - 1 ? "Enviar" : "Continuar"}
            </Btn>
          </div>
        </>
      )}

      {fim && faixa && (
        <>
          <Eyebrow>Enviado</Eyebrow>
          <h2 className="disp" style={{ fontSize: 27, fontWeight: 600, margin: "10px 0 18px" }}>Obrigada por responder</h2>
          <Card style={{ borderLeft: `3px solid ${corPorId(faixa.corId)}`, marginBottom: 16 }}>
            <Eyebrow>Este mês</Eyebrow>
            <div style={{ fontSize: 19, fontWeight: 600, color: corPorId(faixa.corId), marginBottom: 8, marginTop: 8 }}>Carga de sintomas {faixa.nome}</div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
              Sua nutri vai comparar com o mês anterior na próxima consulta junto com os seus check-ins diários.
            </p>
          </Card>
          <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, margin: "0 0 22px" }}>
            Isto é um resumo do que você respondeu, não um diagnóstico. Quem interpreta é a sua nutricionista.
          </p>
          <Btn onClick={onEnviado}>Fechar</Btn>
        </>
      )}
    </Sheet>
  );
}
