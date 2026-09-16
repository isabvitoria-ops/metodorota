import { useState } from "react";
import { Eyebrow, Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonCard, EstadoErro, EstadoVazio } from "@/components/ui/EstadoAsync";
import { OPCOES_ADESAO } from "@/constants/adesao";
import { usePlano } from "@/hooks/usePlano";
import { useDiario } from "@/hooks/useDiario";
import { useToast } from "@/hooks/useToast";
import type { AdesaoId, Refeicao } from "@/types";

export function Diario({ pacienteId, nutricionistaId }: { pacienteId: string; nutricionistaId: string }) {
  const { estado: estadoPlano } = usePlano(pacienteId);
  const { estado: estadoDiario, registrar } = useDiario(pacienteId);
  const [editando, setEditando] = useState<Refeicao | null>(null);
  const [adesao, setAdesao] = useState<AdesaoId | null>(null);
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState(false);
  const avisar = useToast();

  if (estadoPlano.status === "carregando" || estadoDiario.status === "carregando") {
    return (
      <div className="scroll">
        <SkeletonCard />
      </div>
    );
  }
  if (estadoPlano.status === "erro") return <div className="scroll"><EstadoErro mensagem={estadoPlano.erro} /></div>;
  if (estadoDiario.status === "erro") return <div className="scroll"><EstadoErro mensagem={estadoDiario.erro} /></div>;
  if (!estadoPlano.dado) {
    return (
      <div className="scroll">
        <EstadoVazio>Seu diário aparece assim que sua nutricionista publicar um plano.</EstadoVazio>
      </div>
    );
  }

  const refeicoes = estadoPlano.dado.refeicoes;
  const registros = estadoDiario.dado;
  const registroPorRefeicao = (id: string) => registros.find((r) => r.refeicaoId === id);
  // Conta só refeições de verdade do plano — uma refeição livre montada pelo
  // paciente (Montador) fica registrada, mas não tem `refeicaoId` de nenhuma
  // das N refeições prescritas do dia (mesmo comportamento do protótipo).
  const registradasCount = refeicoes.filter((r) => registroPorRefeicao(r.id)).length;

  const abrir = (r: Refeicao) => {
    const existente = registroPorRefeicao(r.id);
    setAdesao(existente?.adesao ?? null);
    setNota(existente?.nota ?? "");
    setFoto(!!existente?.fotoUrl);
    setEditando(r);
  };

  const salvar = async () => {
    if (!editando || !adesao) return;
    await registrar(nutricionistaId, editando.id, adesao, nota || undefined, foto ? "foto-anexada" : undefined);
    setEditando(null);
    avisar("Registro salvo.");
  };

  return (
    <div className="scroll">
      <section style={{ paddingTop: 4 }}>
        <Eyebrow>Diário alimentar · hoje</Eyebrow>
        <h1 className="disp" style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 8px" }}>O que aconteceu de verdade</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 20px", lineHeight: 1.5 }}>
          Não precisa ter seguido tudo. O que ajuda sua nutri é saber o que realmente foi.
        </p>
      </section>

      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
        {refeicoes.map((r) => {
          const registro = registroPorRefeicao(r.id);
          const cor = registro ? OPCOES_ADESAO.find((a) => a.id === registro.adesao)?.cor : null;
          return <div key={r.id} style={{ flex: 1, height: 8, borderRadius: 99, background: cor ?? "transparent", border: cor ? "none" : "1px dashed var(--line)" }} />;
        })}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 22 }}>
        {registradasCount} de {refeicoes.length} refeições registradas hoje.
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {refeicoes.map((r) => {
          const registro = registroPorRefeicao(r.id);
          const a = registro && OPCOES_ADESAO.find((x) => x.id === registro.adesao);
          return (
            <button key={r.id} onClick={() => abrir(r)} className="card" style={{ border: 0, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 5, height: 38, borderRadius: 99, background: a ? a.cor : "var(--line)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.horario}</div>
                  <div className="disp" style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{r.nome}</div>
                </div>
                <span className="chip" style={{ fontSize: 13, pointerEvents: "none" }}>{registro ? "Editar" : "Registrar"}</span>
              </div>
              {registro && a && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: a.cor }}>{a.label}</div>
                  {registro.nota && <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.5 }}>{registro.nota}</div>}
                  {registro.fotoUrl && <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 7 }}>1 FOTO ANEXADA</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <hr className="hair" />
      <Card style={{ borderLeft: "3px solid var(--gold)" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
          Sentiu algo depois de comer? Registre no check-in do dia — assim dá para cruzar a refeição com o sintoma na sua consulta.
        </p>
      </Card>

      {editando && (
        <Sheet onFechar={() => setEditando(null)} titulo={editando.nome}>
          <div className="eyebrow">{editando.horario}</div>
          <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 18px" }}>{editando.nome}</h2>

          <Eyebrow>Como foi</Eyebrow>
          <div style={{ display: "grid", gap: 8, margin: "10px 0 22px" }}>
            {OPCOES_ADESAO.map((a) => (
              <button
                key={a.id} type="button" onClick={() => setAdesao(a.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 13, cursor: "pointer",
                  textAlign: "left", fontFamily: "inherit",
                  border: `1.5px solid ${adesao === a.id ? a.cor : "var(--line)"}`,
                  background: adesao === a.id ? `${a.cor}14` : "var(--card)",
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 99, background: a.cor, flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: adesao === a.id ? 600 : 400 }}>{a.label}</span>
              </button>
            ))}
          </div>

          <Eyebrow>Quer contar mais? (opcional)</Eyebrow>
          <textarea
            className="input" rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Ex.: almocei fora, comi pão e um pouco de molho branco" style={{ width: "100%", margin: "10px 0 14px" }}
          />

          <Chip ativo={foto} onClick={() => setFoto((f) => !f)} style={{ width: "100%", padding: 14, fontSize: 14.5 }}>
            {foto ? "Foto anexada · toque para remover" : "Anexar foto do prato"}
          </Chip>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <Btn variante="ghost" style={{ flex: "0 0 100px" }} onClick={() => setEditando(null)}>Cancelar</Btn>
            <Btn style={{ flex: 1 }} disabled={!adesao} onClick={salvar}>Salvar registro</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}
