import { useCallback, useEffect, useMemo, useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { planoService } from "@/services";
import { parsearTextoDePlano, todosOsItensRascunho, TEXTO_EXEMPLO_IMPORTACAO } from "@/services/planoParserService";
import { alimentoService } from "@/services";
import { textoQuantidade } from "@/utils/quantidade";
import type { Alimento, PlanoRascunhoItem, RefeicaoRascunho, UnidadeExibicao } from "@/types";

const GRUPOS_TACO = ["carb", "prot", "laticinio", "legum", "fruta", "vegetal", "gordura", "outros"] as const;

function ItemPreview({
  item, sub, alimentosPorCodigo, onVincular,
}: {
  item: PlanoRascunhoItem;
  sub?: boolean;
  alimentosPorCodigo: Map<number, Alimento>;
  onVincular: (codigo: number) => void;
}) {
  const alimento = item.alimentoCodigoTaco ? alimentosPorCodigo.get(item.alimentoCodigoTaco) : undefined;
  return (
    <div style={{ padding: "6px 0", paddingLeft: sub ? 16 : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
        <span style={{ color: alimento ? (sub ? "var(--ink-2)" : "var(--ink)") : "var(--clay)" }}>
          {sub && <span style={{ color: "var(--ink-3)" }}>ou </span>}
          {alimento ? alimento.nome : item.escrito}
        </span>
        <span className="mono" style={{ fontSize: 13, color: "var(--plum)", flexShrink: 0 }}>{textoQuantidade(item.quantidade)}</span>
      </div>
      {!alimento && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: "var(--clay)", marginBottom: 6 }}>"{item.escrito}" — escolha na base:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {item.sugestoesCodigoTaco.slice(0, 4).map((cod) => {
              const g = alimentosPorCodigo.get(cod);
              return g ? <button key={cod} className="chip sm" onClick={() => onVincular(cod)}>{g.nome}</button> : null;
            })}
            {!item.sugestoesCodigoTaco.length && <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Nada parecido na TACO. Corrija o nome ou cadastre o alimento.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AbaPlano({ nutricionistaId }: { nutricionistaId: string }) {
  const { paciente, atualizar } = useFichaPaciente();
  const [txt, setTxt] = useState("");
  const [refeicoes, setRefeicoes] = useState<RefeicaoRascunho[] | null>(null);
  const [obsGeral, setObsGeral] = useState("");
  const [alimentosPorCodigo, setAlimentosPorCodigo] = useState<Map<number, Alimento>>(new Map());
  const [publicando, setPublicando] = useState(false);
  const avisar = useToast();

  // Regra #7: a unidade não é um estado solto da tela — é a preferência
  // gravada no paciente. Antes o toggle escrevia num useState que ninguém
  // lia e que nada persistia.
  const unidade = paciente.preferenciaUnidade;
  const definirUnidade = (nova: UnidadeExibicao) => {
    if (nova === unidade) return;
    atualizar({ ...paciente, preferenciaUnidade: nova });
  };

  const [estadoHistorico, recarregarHistorico] = useAsync(
    () => planoService.listarHistoricoVersoes(paciente.id),
    [paciente.id],
  );

  // A base TACO é carregada uma vez por ficha, não a cada tecla. Antes cada
  // caractere digitado disparava 8 buscas de grupo em paralelo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const todos = (await Promise.all(GRUPOS_TACO.map((g) => alimentoService.listarPorGrupo(g)))).flat();
      if (ativo) setAlimentosPorCodigo(new Map(todos.map((a) => [a.codigoTaco, a])));
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // O parse também sai do caminho da digitação: roda 250 ms depois que a
  // nutricionista para de digitar, em vez de a cada tecla.
  useEffect(() => {
    if (!txt.trim()) {
      setRefeicoes(null);
      return;
    }
    const t = setTimeout(() => setRefeicoes(parsearTextoDePlano(txt)), 250);
    return () => clearTimeout(t);
  }, [txt]);

  /**
   * Vincula sem mutar: o item vinha sendo alterado no lugar e a árvore só
   * era "re-espalhada" no nível de cima, o que deixava o React livre para
   * não redesenhar as folhas.
   */
  const vincular = useCallback((alvo: PlanoRascunhoItem, codigo: number) => {
    const trocar = (i: PlanoRascunhoItem): PlanoRascunhoItem =>
      i === alvo
        ? { ...i, alimentoCodigoTaco: codigo }
        : { ...i, substituicoes: i.substituicoes.map(trocar) };
    setRefeicoes((rs) =>
      rs
        ? rs.map((r) => ({ ...r, opcoes: r.opcoes.map((o) => ({ ...o, itens: o.itens.map(trocar) })) }))
        : rs,
    );
  }, []);

  const itens = useMemo(() => (refeicoes ? todosOsItensRascunho(refeicoes) : []), [refeicoes]);
  const pendentes = itens.filter((i) => !i.alimentoCodigoTaco).length;

  const publicar = async () => {
    if (!refeicoes || pendentes > 0) return;
    setPublicando(true);
    try {
      const refeicoesFinal = refeicoes.map((r, ri) => ({
        id: `refeicao-${paciente.id}-${ri}`,
        planoId: "",
        nome: r.nome,
        horario: r.horario,
        corId: ["plum", "sage", "gold", "clay", "plum-2"][ri % 5]!,
        ordem: ri,
        observacao: r.observacao,
        regraVegetais: r.regraVegetaisAtiva ? { ativa: true, itensLiberados: [] } : undefined,
        opcoes: r.opcoes.map((o, oi) => ({
          id: `opcao-${paciente.id}-${ri}-${oi}`,
          refeicaoId: `refeicao-${paciente.id}-${ri}`,
          nome: o.nome,
          ordem: oi,
          itens: o.itens.map((it, ii) => ({
            id: `item-${paciente.id}-${ri}-${oi}-${ii}`,
            opcaoId: `opcao-${paciente.id}-${ri}-${oi}`,
            slot: it.escrito,
            ordem: ii,
            alimentoCodigoTaco: it.alimentoCodigoTaco,
            // O que a nutricionista escreveu manda no que o paciente lê. O
            // nome cru da TACO ("Arroz, tipo 1, cozido") é referência de
            // base, não texto de tela — sobrescrever aqui trocava a
            // linguagem dela pela do banco.
            nomeExibicao: it.escrito,
            quantidade: it.quantidade,
            substituicoes: it.substituicoes.map((sb, si) => ({
              id: `sub-${paciente.id}-${ri}-${oi}-${ii}-${si}`,
              itemPlanoId: `item-${paciente.id}-${ri}-${oi}-${ii}`,
              alimentoCodigoTaco: sb.alimentoCodigoTaco,
              nomeExibicao: sb.escrito,
              quantidade: sb.quantidade,
            })),
          })),
        })),
      }));
      await planoService.publicarNovaVersao(paciente.id, nutricionistaId, refeicoesFinal, obsGeral || undefined, paciente.faseRotulo);
      setTxt("");
      setRefeicoes(null);
      setObsGeral("");
      recarregarHistorico();
      avisar(`Plano publicado para ${paciente.nome}. Ela recebe a notificação agora.`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setPublicando(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Importar do Notion</div>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Refeição com horário na linha. Item com hífen no padrão <span className="mono">alimento: quantidade</span>. Substituição começando com <span className="mono">ou</span>.
          Para refeições com alternativas completas, use <span className="mono">OPÇÃO Nome</span>. Uma linha começando com <span className="mono">VEGETAIS</span> vira a regra livre.
        </p>
        <textarea
          className="input" rows={8} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Cole aqui o texto do Notion"
          style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}
        />
        <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <button className="chip" onClick={() => setTxt(TEXTO_EXEMPLO_IMPORTACAO)}>Colar exemplo</button>
          {txt && <button className="chip" onClick={() => setTxt("")}>Limpar</button>}
        </div>
      </div>

      {refeicoes && (
        <>
          <div style={{ height: 12 }} />
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ flex: 1 }}>Prévia · o que o paciente vai ver</div>
              <Tag cor={pendentes ? "#B98B2E" : "#6E8168"}>{itens.length - pendentes}/{itens.length} RECONHECIDOS</Tag>
            </div>

            <div className="eyebrow" style={{ marginBottom: 8 }}>Mostrar quantidade em</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
              {([["g", "Gramas"], ["caseira", "Medida caseira"]] as const).map(([id, l]) => (
                <button key={id} className={`chip ${unidade === id ? "on" : ""}`} onClick={() => definirUnidade(id)}>{l}</button>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Vale para este paciente. Na medida caseira, quem não tiver equivalência cadastrada continua aparecendo em grama.
            </p>

            {refeicoes.map((r, ri) => (
              <div key={ri} style={{ paddingTop: 14, borderTop: ri ? "1px solid var(--line)" : "0" }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.horario}</span>
                  <span className="disp" style={{ fontSize: 16, fontWeight: 600 }}>{r.nome}</span>
                </div>
                {r.opcoes.map((op, oi) => (
                  <div key={oi} style={{ marginBottom: 8 }}>
                    {op.nome && <div className="mono" style={{ fontSize: 10.5, color: "var(--plum)", margin: "8px 0 4px" }}>OPÇÃO {op.nome.toUpperCase()}</div>}
                    {op.itens.map((it, ii) => (
                      <div key={ii}>
                        <ItemPreview item={it} alimentosPorCodigo={alimentosPorCodigo} onVincular={(c) => vincular(it, c)} />
                        {it.substituicoes.map((sb, si) => (
                          <ItemPreview key={si} item={sb} sub alimentosPorCodigo={alimentosPorCodigo} onVincular={(c) => vincular(sb, c)} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                {r.regraVegetaisAtiva && <div className="mono" style={{ fontSize: 10.5, color: "var(--sage)", marginTop: 4 }}>+ REGRA LIVRE DE VEGETAIS</div>}
                {r.observacao && <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, fontStyle: "italic" }}>{r.observacao}</div>}
              </div>
            ))}

            <div className="eyebrow" style={{ margin: "18px 0 8px" }}>Observação desta versão</div>
            <input className="input" value={obsGeral} onChange={(e) => setObsGeral(e.target.value)} placeholder="Ex.: ajuste do jantar após relato de refluxo" />

            <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn" onClick={publicar} disabled={pendentes > 0 || publicando}>
                {publicando ? "Publicando…" : `Publicar para ${paciente.nome.split(" ")[0]}`}
              </button>
              <button className="btn ghost" onClick={() => avisar("Salvo como rascunho.")}>Salvar rascunho</button>
            </div>
            {pendentes > 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "10px 0 0", lineHeight: 1.5 }}>
                Faltam {pendentes} {pendentes === 1 ? "item" : "itens"} para vincular à base. Sem vínculo, o app não consegue guardar o registro nem converter medida caseira.
              </p>
            )}
          </div>
        </>
      )}

      <hr className="hair" />
      <div className="eyebrow" style={{ marginBottom: 10 }}>Histórico de versões</div>
      {estadoHistorico.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
      {estadoHistorico.status === "pronto" && (
        <div style={{ display: "grid", gap: 8 }}>
          {estadoHistorico.dado.map((v) => (
            <div key={`${v.planoId}-${v.versao}`} className="card" style={{ padding: 14 }}>
              <div className="row">
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}>
                  V{v.versao} · {new Date(v.publicadoEm).toLocaleDateString("pt-BR").toUpperCase()}
                </span>
                {v.ativa && <Tag cor="#6E8168">ATIVA</Tag>}
              </div>
              <div style={{ fontSize: 14, marginTop: 6 }}>{v.nota}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
