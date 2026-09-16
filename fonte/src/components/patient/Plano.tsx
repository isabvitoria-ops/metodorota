import { useState } from "react";
import { Eyebrow } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonCard, EstadoErro, EstadoVazio } from "@/components/ui/EstadoAsync";
import { corPorId } from "@/constants/cores";
import { resolverQuantidadeExibicao } from "@/utils/quantidade";
import { usePlano } from "@/hooks/usePlano";
import { useUiPacienteStore } from "@/store/uiPacienteStore";
import type { ItemPlano, Opcao, Refeicao, Substituicao, UnidadeExibicao } from "@/types";

type Escolha = ItemPlano | Substituicao;

/** Regra #7: a unidade que o paciente vê é a que a nutricionista escolheu para ele. */
export function Plano({ pacienteId, preferenciaUnidade }: { pacienteId: string; preferenciaUnidade: UnidadeExibicao }) {
  const { estado } = usePlano(pacienteId);
  const [refeicaoAberta, setRefeicaoAberta] = useState<string | null>(null);
  const [opcaoAtivaPorRefeicao, setOpcaoAtivaPorRefeicao] = useState<Record<string, string>>({});
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [trocando, setTrocando] = useState<{ refeicao: Refeicao; item: ItemPlano } | null>(null);
  const abrirFicha = useUiPacienteStore((s) => s.abrirFicha);
  const abrirMontador = useUiPacienteStore((s) => s.abrirMontador);

  if (estado.status === "carregando") {
    return (
      <div className="scroll">
        <SkeletonCard />
      </div>
    );
  }
  if (estado.status === "erro") {
    return (
      <div className="scroll">
        <EstadoErro mensagem={estado.erro} />
      </div>
    );
  }
  const plano = estado.dado;
  if (!plano) {
    return (
      <div className="scroll">
        <EstadoVazio>Sua nutricionista ainda não publicou um plano para você.</EstadoVazio>
      </div>
    );
  }

  const opcaoAtiva = (r: Refeicao): Opcao => {
    const id = opcaoAtivaPorRefeicao[r.id];
    return r.opcoes.find((o) => o.id === id) ?? r.opcoes[0]!;
  };

  const escolhaAtual = (item: ItemPlano): Escolha => escolhas[item.id] ?? item;

  return (
    <div className="scroll">
      <section style={{ paddingTop: 4 }}>
        <Eyebrow>{plano.faseRotulo ?? "Seu plano"}</Eyebrow>
        <h1 className="disp" style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 8px" }}>Seu plano de hoje</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 18px", lineHeight: 1.5 }}>
          Toque em qualquer alimento para entender por que ele está aqui. Onde aparecer "Trocar", você pode escolher outra opção equivalente.
        </p>
        <Btn variante="quiet" onClick={abrirMontador} style={{ marginBottom: 22 }}>
          Montar uma refeição com o que tenho
        </Btn>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {plano.refeicoes.map((r) => {
          const on = refeicaoAberta === r.id;
          const cor = corPorId(r.corId);
          const opcao = opcaoAtiva(r);
          const temAbas = r.opcoes.length > 1;
          return (
            <div key={r.id} className="card" style={{ padding: on ? 18 : "16px 18px", borderLeft: `3px solid ${cor}` }}>
              <button
                onClick={() => setRefeicaoAberta(on ? null : r.id)}
                aria-expanded={on}
                aria-controls={`refeicao-conteudo-${r.id}`}
                style={{ width: "100%", background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
              >
                <div>
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.horario}</div>
                  <div className="disp" style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{r.nome}</div>
                </div>
                <span aria-hidden="true" style={{ fontSize: 20, color: "var(--ink-3)", transform: on ? "rotate(45deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>+</span>
              </button>

              {on && (
                <div id={`refeicao-conteudo-${r.id}`} style={{ marginTop: 16 }}>
                  {temAbas && (
                    <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
                      {r.opcoes.map((o) => (
                        <button
                          key={o.id} type="button"
                          onClick={() => setOpcaoAtivaPorRefeicao((s) => ({ ...s, [r.id]: o.id }))}
                          className="chip"
                          style={{
                            fontSize: 13,
                            background: opcao.id === o.id ? cor : "transparent",
                            borderColor: cor,
                            color: opcao.id === o.id ? "#fff" : cor,
                          }}
                        >
                          {o.nome}
                        </button>
                      ))}
                    </div>
                  )}

                  {opcao.itens.map((it, i) => {
                    const atual = escolhaAtual(it);
                    const podeTrocar = it.substituicoes.length > 0;
                    return (
                      <div key={it.id} style={{ padding: "12px 0", borderTop: i ? "1px solid var(--line)" : "0" }}>
                        <div className="eyebrow" style={{ marginBottom: 5 }}>{it.slot}</div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <button
                            onClick={() => atual.alimentoCodigoTaco && abrirFicha(atual.alimentoCodigoTaco, atual.nomeExibicao)}
                            style={{ flex: 1, background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            <div style={{ fontSize: 16, fontWeight: 500 }}>{atual.nomeExibicao}</div>
                            <div className="mono" style={{ fontSize: 13.5, color: "var(--plum)", marginTop: 3 }}>
                              {resolverQuantidadeExibicao(atual.quantidade, atual.quantidadeCaseira, preferenciaUnidade)}
                            </div>
                          </button>
                          {podeTrocar && (
                            <button type="button" className="chip" style={{ fontSize: 13, flexShrink: 0 }} onClick={() => setTrocando({ refeicao: r, item: it })}>
                              Trocar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {r.regraVegetais?.ativa && (
                    <div style={{ marginTop: 14, padding: 13, borderRadius: 12, background: "rgba(106, 149, 108, 0.13)", fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                      Vegetais à vontade{r.regraVegetais.minimoGramas ? `, mínimo ${r.regraVegetais.minimoGramas} g` : ""}:{" "}
                      {r.regraVegetais.itensLiberados.map((v) => v.nomeExibicao).join(", ")}
                    </div>
                  )}
                  {r.observacao && (
                    <div style={{ marginTop: 14, padding: 13, borderRadius: 12, background: "var(--plum-wash)", fontSize: 13.5, color: "var(--plum)", lineHeight: 1.5 }}>
                      {r.observacao}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {trocando && (
        <Sheet onFechar={() => setTrocando(null)} titulo="Trocar alimento">
          <div className="eyebrow">{trocando.refeicao.nome} · {trocando.item.slot}</div>
          <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 6px" }}>Trocar por</h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 20px", lineHeight: 1.5 }}>
            A quantidade já vem ajustada. Só aparecem opções que cabem no seu protocolo desta fase.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {[trocando.item, ...trocando.item.substituicoes].map((op) => {
              const atual = escolhaAtual(trocando.item);
              const selo = "id" in op && atual.nomeExibicao === op.nomeExibicao;
              return (
                <button
                  key={op.id}
                  onClick={() => { setEscolhas((e) => ({ ...e, [trocando.item.id]: op })); setTrocando(null); }}
                  style={{
                    textAlign: "left", padding: 15, borderRadius: 14, cursor: "pointer",
                    border: `1.5px solid ${selo ? "var(--plum)" : "var(--line)"}`,
                    background: selo ? "var(--plum-wash)" : "var(--card)", fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 500 }}>{op.nomeExibicao}</span>
                    <span className="mono" style={{ fontSize: 13.5, color: "var(--plum)" }}>
                      {resolverQuantidadeExibicao(op.quantidade, op.quantidadeCaseira, preferenciaUnidade)}
                    </span>
                  </div>
                  {"aviso" in op && op.aviso && <div style={{ fontSize: 13, color: "var(--clay)", marginTop: 7, lineHeight: 1.45 }}>{op.aviso}</div>}
                </button>
              );
            })}
          </div>
          <Btn variante="ghost" style={{ marginTop: 18 }} onClick={() => setTrocando(null)}>Cancelar</Btn>
        </Sheet>
      )}
    </div>
  );
}
