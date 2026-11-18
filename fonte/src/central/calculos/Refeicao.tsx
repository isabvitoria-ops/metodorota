/**
 * Uma refeição da dieta: horário, nome, opções (só a aberta conta no dia),
 * a tabela de alimentos com macros, os substitutos com a gramatura calculada,
 * as sugestões e os grupos. Regras de nutri/app.mjs e nutri/dieta.mjs.
 */
import { useEffect, useState } from "react";
import { porGramas, somar } from "./motor/calculos.mjs";
import { CRITERIOS, CRITERIO_PADRAO, MEDIDA_GRAMA, duplicarRefeicao, gramasDoItem, normalizarItem, opcaoAtiva } from "./motor/dieta.mjs";
import { listarGrupos, medidasDe, salvarMedidas } from "./motor/meusAlimentos.mjs";
import { gravarMemoria, lerMemoria, montarSugestoes, registrar } from "./motor/sugestoes.mjs";
import { listarFichas } from "./motor/fichas.mjs";
import type { Dieta, Refeicao as TipoRefeicao } from "./estado";
import { Busca } from "./Busca";
import {
  alimentoPorId,
  etiquetaDaFonte,
  medidasDoAlimento,
  mostrar,
  num,
  porcaoDoSubstituto,
  rotuloDaMedida,
  somaDoNutriente,
  textoDaCelula,
  valorDe,
  type Alimento,
  type ItemDaDieta,
  type Medida,
} from "./tabela";
import { BotaoConfirmar } from "./ui";

export const MACROS: [string, string, number][] = [
  ["energia_kcal", "kcal", 0],
  ["carboidrato", "CHO", 1],
  ["proteina", "PTN", 1],
  ["lipideos", "LIP", 1],
  ["fibra_alimentar", "Fibra", 1],
];

export interface SugestaoAberta {
  iR: number;
  iO: number;
  codigo: string;
  nome: string;
  ignoradas: string[];
}

type Editar = (f: (d: Dieta) => void) => void;

function MedidaSelecao({
  codigo,
  nome,
  medida,
  aoMudar,
  aoCriar,
}: {
  codigo: string;
  nome: string;
  medida: Medida;
  aoMudar: (m: Medida) => void;
  aoCriar?: () => void;
}) {
  const medidas = medidasDoAlimento(codigo);
  // A medida guardada é reencontrada PELO NOME: se ela editar o scoop de 30
  // para 32 g, a dieta passa a contar 32 g (ver nutri/app.mjs).
  const achada = medidas.findIndex((m) => m.nome.toLowerCase() === String(medida?.nome ?? "").toLowerCase());
  return (
    <select
      className="c-select c-cx-select-mini"
      aria-label={`Medida de ${nome}`}
      value={String(achada >= 0 ? achada : 0)}
      onChange={(e) => {
        if (e.target.value === "nova") {
          aoCriar?.();
          return;
        }
        aoMudar({ ...(medidas[Number(e.target.value)] ?? MEDIDA_GRAMA) });
      }}
    >
      {medidas.map((m, i) => (
        <option key={`${m.nome}-${i}`} value={String(i)} title={m.ref}>
          {rotuloDaMedida(m)}
        </option>
      ))}
      {aoCriar && <option value="nova">＋ criar medida…</option>}
    </select>
  );
}

/** "100 g de milho = 1 unidade": a medida caseira nasce em cima de qualquer alimento. */
function NovaMedida({ codigo, nome, aoFechar }: { codigo: string; nome: string; aoFechar: (criou: boolean) => void }) {
  const [rotulo, definirRotulo] = useState("");
  const [gramas, definirGramas] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  return (
    <div className="c-cx-nova-medida">
      <strong>Nova medida para {nome}</strong>
      <div className="c-cx-linha">
        <input className="c-input" placeholder="Nome (ex.: unidade, colher)" value={rotulo} onChange={(e) => definirRotulo(e.target.value)} />
        <input className="c-input" inputMode="decimal" placeholder="Gramas em 1 medida" value={gramas} onChange={(e) => definirGramas(e.target.value)} />
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => {
            const novas = [...(medidasDe(codigo) as Medida[]), { nome: rotulo, gramas }];
            const gravadas = salvarMedidas(codigo, novas) as Medida[];
            if (!gravadas.some((m) => m.nome.toLowerCase() === rotulo.trim().toLowerCase())) {
              definirErro(
                `Não consegui guardar "${rotulo.trim()}". As gramas têm que ser um número maior que zero, e o nome não pode repetir uma medida que já existe neste alimento.`,
              );
              return;
            }
            aoFechar(true);
          }}
        >
          Guardar
        </button>
        <button type="button" className="c-link" onClick={() => aoFechar(false)}>
          Cancelar
        </button>
      </div>
      {erro && <p className="c-cx-erro">{erro}</p>}
      <p className="c-calc-dica">Vale para este alimento em toda dieta, hoje e depois.</p>
    </div>
  );
}

/**
 * A quantidade do item. Guarda o texto enquanto ela digita ("1," a caminho
 * de "1,5") e só reescreve quando o número muda por fora (trocou a medida).
 */
function CampoQtd({ valor, rotulo, aoMudar }: { valor: number; rotulo: string; aoMudar: (n: number) => void }) {
  const [texto, definirTexto] = useState(() => String(valor).replace(".", ","));
  useEffect(() => {
    if (num(texto) !== valor) definirTexto(String(valor).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <input
      className="c-input c-cx-qtd"
      inputMode="decimal"
      aria-label={rotulo}
      value={texto}
      aria-invalid={num(texto) < 0 || undefined}
      onChange={(e) => {
        definirTexto(e.target.value);
        const n = num(e.target.value);
        aoMudar(n < 0 ? 0 : n);
      }}
    />
  );
}

export function CartaoRefeicao({
  refeicao,
  iR,
  editar,
  sugestao,
  definirSugestao,
  aoMudarMedidas,
}: {
  refeicao: TipoRefeicao;
  iR: number;
  editar: Editar;
  sugestao: SugestaoAberta | null;
  definirSugestao: (s: SugestaoAberta | null) => void;
  aoMudarMedidas: () => void;
}) {
  const [renomeando, definirRenomeando] = useState<number | null>(null);
  const [rotuloNovo, definirRotuloNovo] = useState("");
  const [criandoMedida, definirCriandoMedida] = useState<{ codigo: string; nome: string } | null>(null);
  const iO = refeicao.opcaoAtiva ?? 0;
  const opcao = opcaoAtiva(refeicao) as { rotulo: string; itens: ItemDaDieta[] };
  const ehSecundaria = iO !== 0 && refeicao.opcoes.length > 1;
  const referencia = ehSecundaria ? refeicao.opcoes[0] : null;
  const grupos = listarGrupos() as { id: string; nome: string; itens: ItemDaDieta[] }[];
  const daRefeicao = (d: Dieta) => d.refeicoes[iR]!;
  const daOpcao = (d: Dieta) => daRefeicao(d).opcoes[daRefeicao(d).opcaoAtiva ?? 0]!;

  if (refeicao.recolhida) {
    const itens = opcao.itens ?? [];
    const kcal = somar(
      itens.map((it) => {
        const a = alimentoPorId(it.codigo);
        return a ? porGramas(valorDe(a, "energia_kcal"), gramasDoItem(it)) : null;
      }),
    ) as { total: number | null };
    return (
      <div className="c-cx-refeicao c-cx-refeicao--recolhida">
        {topo()}
        <p className="c-calc-dica">
          {itens.length ? `${itens.map((it) => it.nome).join(", ")} · ${mostrar(kcal.total, 0)} kcal` : "Sem alimentos."}
        </p>
      </div>
    );
  }

  function topo() {
    return (
      <div className="c-cx-refeicao-topo">
        <button
          type="button"
          className="c-cx-recolher"
          aria-expanded={!refeicao.recolhida}
          aria-label={refeicao.recolhida ? "Abrir esta refeição" : "Recolher esta refeição"}
          onClick={() => editar((d) => void (daRefeicao(d).recolhida = !daRefeicao(d).recolhida))}
        >
          {refeicao.recolhida ? "▸" : "▾"}
        </button>
        <input
          className="c-input c-cx-hora"
          type="time"
          aria-label={`Horário de ${refeicao.nome || "refeição"}`}
          value={refeicao.horario ?? ""}
          onChange={(e) => editar((d) => void (daRefeicao(d).horario = e.target.value))}
        />
        <input
          className="c-input c-cx-nome-refeicao"
          aria-label="Nome da refeição"
          value={refeicao.nome}
          onChange={(e) => editar((d) => void (daRefeicao(d).nome = e.target.value))}
        />
        <div className="c-cx-refeicao-acoes">
          <button
            type="button"
            className="c-link"
            title="Copiar esta refeição inteira"
            onClick={() =>
              editar((d) => void d.refeicoes.splice(iR + 1, 0, duplicarRefeicao(daRefeicao(d)) as TipoRefeicao))
            }
          >
            Duplicar
          </button>
          <BotaoConfirmar
            classe="c-link"
            rotulo="Remover"
            pergunta={`Remover "${refeicao.nome}"?`}
            aoConfirmar={() => editar((d) => void d.refeicoes.splice(iR, 1))}
          />
        </div>
      </div>
    );
  }

  // ---- números: célula por célula, recalculados a cada mudança ----
  const somaOpcao = MACROS.map(([chave]) => somaDoNutriente(opcao.itens, chave));
  const somaRef = referencia ? MACROS.map(([chave]) => somaDoNutriente(referencia.itens ?? [], chave).total) : null;

  // ---- sugestões para acompanhar o primeiro alimento ----
  const painel = (() => {
    if (!sugestao || sugestao.iR !== iR || sugestao.iO !== iO) return null;
    if (!opcao.itens.some((i) => i.codigo === sugestao.codigo)) return null;
    const lista = (
      montarSugestoes({
        fichas: listarFichas(),
        grupos,
        codigoBase: sugestao.codigo,
        jaNaOpcao: new Set(opcao.itens.map((i) => i.codigo)),
        memoria: lerMemoria(),
      }) as { codigo: string; nome: string; quantidade: number; medida: Medida; origem: string; grupos: string[]; vezes: number }[]
    ).filter((x) => !sugestao.ignoradas.includes(x.codigo));
    if (!lista.length) return null;
    return (
      <div className="c-cx-sugestoes" role="region" aria-label={`Sugestões para acompanhar ${sugestao.nome}`}>
        <p className="c-calc-dica">Costuma acompanhar {sugestao.nome}:</p>
        {lista.map((x) => (
          <div className="c-cx-sugestao" key={x.codigo}>
            <span
              title={
                x.origem === "grupo"
                  ? `Está no seu grupo "${x.grupos.join('", "')}"`
                  : x.vezes > 1
                    ? `Apareceu junto ${x.vezes} vezes nas suas dietas salvas`
                    : "Apareceu junto numa das suas dietas salvas"
              }
            >
              {x.nome} · {mostrar(x.quantidade, x.quantidade % 1 ? 1 : 0)} {x.medida.nome}
            </span>
            <button
              type="button"
              className="c-link"
              onClick={() => {
                editar((d) =>
                  void daOpcao(d).itens.push(
                    normalizarItem({ codigo: x.codigo, nome: x.nome, quantidade: x.quantidade, medida: { ...x.medida } }) as ItemDaDieta,
                  ),
                );
                gravarMemoria(registrar(lerMemoria(), sugestao.codigo, x.codigo, "aceita"));
              }}
            >
              Usar
            </button>
            <button
              type="button"
              className="c-link"
              onClick={() => {
                definirSugestao({ ...sugestao, ignoradas: [...sugestao.ignoradas, x.codigo] });
                gravarMemoria(registrar(lerMemoria(), sugestao.codigo, x.codigo, "ignorada"));
              }}
            >
              Ignorar
            </button>
          </div>
        ))}
        <button type="button" className="c-link" onClick={() => definirSugestao(null)}>
          Fechar sugestões
        </button>
      </div>
    );
  })();

  return (
    <div className="c-cx-refeicao">
      {topo()}

      <div className="c-cx-opcoes" role="group" aria-label="Opções desta refeição">
        {refeicao.opcoes.map((o, i) =>
          renomeando === i ? (
            <span className="c-cx-opcao-renomear" key={i}>
              <input
                className="c-input"
                autoFocus
                value={rotuloNovo}
                aria-label="Nome desta opção"
                onChange={(e) => definirRotuloNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rotuloNovo.trim()) {
                    editar((d) => void (daRefeicao(d).opcoes[i]!.rotulo = rotuloNovo.trim()));
                    definirRenomeando(null);
                  } else if (e.key === "Escape") definirRenomeando(null);
                }}
                onBlur={() => {
                  if (rotuloNovo.trim()) editar((d) => void (daRefeicao(d).opcoes[i]!.rotulo = rotuloNovo.trim()));
                  definirRenomeando(null);
                }}
              />
            </span>
          ) : (
            <span className="c-cx-opcao" key={i}>
              <button
                type="button"
                className={`c-calc-fator${i === iO ? " c-calc-fator--ativo" : ""}`}
                aria-pressed={i === iO}
                title="Dois toques para renomear"
                onClick={() => editar((d) => void (daRefeicao(d).opcaoAtiva = i))}
                onDoubleClick={() => {
                  definirRotuloNovo(o.rotulo);
                  definirRenomeando(i);
                }}
              >
                {o.rotulo}
              </button>
              {refeicao.opcoes.length > 1 && (
                <BotaoConfirmar
                  classe="c-cx-opcao-x"
                  rotulo="×"
                  titulo={`Apagar "${o.rotulo}"`}
                  pergunta={o.itens?.length ? `Apagar com ${o.itens.length}?` : "Apagar?"}
                  aoConfirmar={() =>
                    editar((d) => {
                      const r = daRefeicao(d);
                      r.opcoes.splice(i, 1);
                      let ativa = r.opcaoAtiva ?? 0;
                      if (i < ativa) ativa -= 1;
                      r.opcaoAtiva = Math.max(0, Math.min(ativa, r.opcoes.length - 1));
                    })
                  }
                />
              )}
            </span>
          ),
        )}
        <button
          type="button"
          className="c-link"
          title="Outra versão desta mesma refeição. Só a aberta entra no total do dia."
          onClick={() =>
            editar((d) => {
              const r = daRefeicao(d);
              r.opcoes.push({ rotulo: `Opção ${r.opcoes.length + 1}`, itens: [] });
              r.opcaoAtiva = r.opcoes.length - 1;
            })
          }
        >
          + Opção
        </button>
      </div>
      {refeicao.opcoes.length > 1 && (
        <p className="c-calc-dica">As opções são o mesmo horário: só a que está aberta entra no total do dia. Dois toques no nome renomeiam.</p>
      )}

      {(opcao.itens.length > 0 || ehSecundaria) && (
        <div className="c-calc-rolagem">
          <table className="c-cx-tabela">
            <thead>
              <tr>
                <th scope="col">Alimento</th>
                <th scope="col">Qtd.</th>
                <th scope="col">Medida</th>
                <th scope="col">g</th>
                {MACROS.map(([, r]) => (
                  <th scope="col" key={r}>
                    {r}
                  </th>
                ))}
                <th scope="col">
                  <span className="c-so-leitor">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {opcao.itens.map((item, iI) => {
                const a = alimentoPorId(item.codigo);
                const g = gramasDoItem(item);
                const nSubst = item.substitutos?.length ?? 0;
                return [
                  <tr key={`i-${iI}`}>
                    <th scope="row">
                      <span>{a ? a.nome : item.nome}</span>
                      {a && <span className="c-cx-fonte">{etiquetaDaFonte(a.fonte)}</span>}
                      <button
                        type="button"
                        className={nSubst ? "c-cx-selo-subst" : "c-cx-selo-subst c-cx-selo-subst--vazio"}
                        aria-expanded={Boolean(item.verSubstitutos)}
                        title={
                          nSubst
                            ? `${nSubst} ${nSubst === 1 ? "substituto" : "substitutos"}, com a gramatura já calculada. Tocar abre e fecha.`
                            : "Alimentos que podem trocar este, com a gramatura calculada sozinha"
                        }
                        onClick={() =>
                          editar((d) => {
                            const it = daOpcao(d).itens[iI]!;
                            it.substitutos ??= [];
                            it.igualarPor ??= CRITERIO_PADRAO;
                            it.verSubstitutos = !it.verSubstitutos;
                          })
                        }
                      >
                        {nSubst ? `⇄ ${nSubst}` : "+ substituto"}
                      </button>
                    </th>
                    <td>
                      <CampoQtd
                        valor={item.quantidade}
                        rotulo={`Quantidade de ${item.nome}`}
                        aoMudar={(n) => editar((d) => void (daOpcao(d).itens[iI]!.quantidade = n))}
                      />
                    </td>
                    <td>
                      <MedidaSelecao
                        codigo={item.codigo}
                        nome={item.nome}
                        medida={item.medida}
                        aoCriar={() => definirCriandoMedida({ codigo: item.codigo, nome: a ? a.nome : item.nome })}
                        aoMudar={(m) =>
                          editar((d) => {
                            // Trocar a unidade não muda o que se come: as gramas ficam.
                            const it = daOpcao(d).itens[iI]!;
                            const antes = gramasDoItem(it);
                            it.medida = m;
                            it.quantidade = Math.round((antes / m.gramas) * 100) / 100;
                          })
                        }
                      />
                    </td>
                    <td>{mostrar(g, 0)}</td>
                    {MACROS.map(([chave, , casas]) => {
                      const { texto, dica } = textoDaCelula(a, chave, g, casas);
                      return (
                        <td key={chave} title={dica}>
                          {texto}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className="c-cx-x"
                        aria-label={`Tirar ${item.nome}`}
                        title="Tirar este alimento"
                        onClick={() => editar((d) => void daOpcao(d).itens.splice(iI, 1))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>,
                  ...(item.verSubstitutos
                    ? [
                        ...(item.substitutos ?? []).map((sub, iS) => {
                          const troca = alimentoPorId(sub.codigo);
                          const porcao = porcaoDoSubstituto(item, sub);
                          return (
                            <tr key={`s-${iI}-${iS}`} className="c-cx-subst">
                              <th scope="row">
                                <span className="c-cx-ou">ou</span> {troca ? troca.nome : sub.nome}
                                {troca && <span className="c-cx-fonte">{etiquetaDaFonte(troca.fonte)}</span>}
                              </th>
                              <td
                                title={
                                  porcao
                                    ? ""
                                    : `Não dá para igualar por ${(CRITERIOS as Record<string, string>)[item.igualarPor ?? CRITERIO_PADRAO]}: a tabela não traz esse valor, ou este alimento não tem nada dele. Troque o critério ali embaixo.`
                                }
                              >
                                {porcao ? mostrar(porcao.quantidade, porcao.quantidade % 1 ? 1 : 0) : "—"}
                              </td>
                              <td>
                                <MedidaSelecao
                                  codigo={sub.codigo}
                                  nome={sub.nome}
                                  medida={sub.medida}
                                  aoMudar={(m) => editar((d) => void (daOpcao(d).itens[iI]!.substitutos![iS]!.medida = m))}
                                />
                              </td>
                              <td>{porcao ? mostrar(porcao.gramas, 0) : "—"}</td>
                              {MACROS.map(([chave, , casas]) => (
                                <td key={chave}>
                                  {porcao && troca ? mostrar(porGramas(valorDe(troca, chave), porcao.gramas) as number | null, casas) : "—"}
                                </td>
                              ))}
                              <td>
                                <button
                                  type="button"
                                  className="c-cx-x"
                                  aria-label={`Tirar o substituto ${sub.nome}`}
                                  onClick={() => editar((d) => void daOpcao(d).itens[iI]!.substitutos!.splice(iS, 1))}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        }),
                        <tr key={`n-${iI}`} className="c-cx-subst c-cx-subst-novo">
                          <td colSpan={5 + MACROS.length}>
                            <div className="c-cx-subst-controles">
                              <Busca
                                compacta
                                placeholder={`Substituto de ${a ? a.nome.split(",")[0] : "este alimento"}…`}
                                aoEscolher={(al: Alimento) =>
                                  editar((d) => {
                                    const it = daOpcao(d).itens[iI]!;
                                    it.substitutos ??= [];
                                    it.substitutos.push({ codigo: al.id, nome: al.nome, medida: { ...MEDIDA_GRAMA } });
                                  })
                                }
                              />
                              <label className="c-cx-igualar">
                                Igualar por
                                <select
                                  className="c-select c-cx-select-mini"
                                  value={item.igualarPor ?? CRITERIO_PADRAO}
                                  onChange={(e) => editar((d) => void (daOpcao(d).itens[iI]!.igualarPor = e.target.value))}
                                >
                                  {Object.entries(CRITERIOS as Record<string, string>).map(([k, n]) => (
                                    <option key={k} value={k}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </td>
                        </tr>,
                      ]
                    : []),
                ];
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Subtotal</th>
                <td />
                <td />
                <td />
                {MACROS.map(([chave, , casas], iM) => {
                  const s = somaOpcao[iM]!;
                  return (
                    <td key={chave}>
                      {(s.total === null ? (s.tracos ? "Tr" : "—") : mostrar(s.total, casas)) + (s.faltando ? " *" : "")}
                    </td>
                  );
                })}
                <td />
              </tr>
              {somaRef && (
                <>
                  <tr className="c-cx-referencia">
                    <th scope="row">Referência (Principal)</th>
                    <td />
                    <td />
                    <td />
                    {MACROS.map(([chave, , casas], iM) => (
                      <td key={chave}>{somaRef[iM] === null ? "—" : mostrar(somaRef[iM], casas)}</td>
                    ))}
                    <td />
                  </tr>
                  <tr className="c-cx-diferenca">
                    <th scope="row">Diferença</th>
                    <td />
                    <td />
                    <td />
                    {MACROS.map(([chave, , casas], iM) => {
                      const total = somaOpcao[iM]!.total;
                      const ref = somaRef[iM] ?? null;
                      const d = (total ?? 0) - (ref ?? 0);
                      const tolerancia = Math.max((ref ?? 0) * 0.05, casas === 0 ? 10 : 1);
                      const quaseZero = Math.abs(d) < (casas === 0 ? 0.5 : 0.05);
                      return (
                        <td key={chave} className={Math.abs(d) <= tolerancia ? "c-cx-dif-ok" : "c-cx-dif-longe"}>
                          {quaseZero ? "0" : (d > 0 ? "+" : "−") + mostrar(Math.abs(d), casas)}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {criandoMedida && (
        <NovaMedida
          codigo={criandoMedida.codigo}
          nome={criandoMedida.nome}
          aoFechar={(criou) => {
            definirCriandoMedida(null);
            if (criou) aoMudarMedidas();
          }}
        />
      )}

      <Busca
        placeholder="Buscar alimento e apertar Enter"
        aoEscolher={(al) => {
          const eraOPrimeiro = opcao.itens.length === 0;
          editar((d) => void daOpcao(d).itens.push({ codigo: al.id, nome: al.nome, quantidade: 100, medida: { ...MEDIDA_GRAMA } }));
          if (eraOPrimeiro) definirSugestao({ iR, iO, codigo: al.id, nome: al.nome, ignoradas: [] });
        }}
      />

      {painel}

      {grupos.length > 0 && (
        <div className="c-cx-grupos">
          <span className="c-calc-dica">Grupos:</span>
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              className="c-calc-fator"
              title={`Acrescentar os ${g.itens.length} alimentos deste grupo`}
              onClick={() => editar((d) => void daOpcao(d).itens.push(...(g.itens.map((i) => normalizarItem(i)) as ItemDaDieta[])))}
            >
              + {g.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
