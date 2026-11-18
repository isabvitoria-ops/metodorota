/**
 * Mais → Receitas: o cadastro da Cozinha.
 *
 * Cada ingrediente tem DUAS caras: o texto que a paciente lê ("1 cenoura
 * média") e o alimento da tabela com os gramas, que é de onde sai a conta.
 * Os números nunca são digitados: somam sozinhos pela base dos Cálculos
 * (TACO, IBGE, USDA, Meus alimentos) e são gravados junto da receita.
 *
 * Ingrediente sem alimento escolhido é "a gosto": aparece na receita e fica
 * fora da conta — e a tela diz isso, para não parecer esquecimento.
 */
import { useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { esquecerCozinha } from "@/central/hooks/useMinhaCozinha";
import { BarraBusca } from "@/central/components/BarraBusca";
import { BotaoPdf } from "@/central/components/BotaoPdf";
import { DocumentoReceita } from "@/central/components/DocumentoReceita";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Esqueleto } from "@/central/components/Esqueleto";
import { Busca } from "@/central/calculos/Busca";
import { BotaoConfirmar } from "@/central/calculos/ui";
import { alimentoPorId, base, etiquetaDaFonte, valorDe, type Fonte } from "@/central/calculos/tabela";
import type { Paciente } from "@/central/types";
import type {
  CategoriaReceita,
  ChaveNutriente,
  IngredienteReceita,
  NumerosDaReceita,
  Receita,
  ReceitaDaNutri,
  ReceitaParaSalvar,
} from "@/central/types/receita";
import { CATEGORIAS_RECEITA, MARCACOES_RECEITA, NUTRIENTES_DA_RECEITA, rotuloDaCategoria } from "@/central/types/receita";
import { calcularNumeros, comUnidade, formatarNutriente, numerosParaMostrar, porPorcao, receitaCombina, textoDasFontes } from "@/central/utils/receitas";

interface LinhaIngrediente {
  chave: number;
  texto: string;
  alimentoId: string | null;
  alimentoNome: string | null;
  fonte: string | null;
  gramas: string;
}

interface Rascunho {
  id: string | null;
  titulo: string;
  categoria: CategoriaReceita;
  minutos: string;
  porcoes: string;
  tags: string[];
  ingredientes: LinhaIngrediente[];
  preparo: string;
  dica: string;
  publicada: boolean;
  /** Números por porção digitados por ela, no lugar da soma pelos gramas. */
  manual: boolean;
  manualValores: Record<ChaveNutriente, string>;
  manualOrigem: string;
}

const SEM_VALORES = (): Record<ChaveNutriente, string> => ({
  energia_kcal: "",
  proteina: "",
  carboidrato: "",
  lipideos: "",
  fibra_alimentar: "",
});

let proximaChave = 1;
const novaLinha = (): LinhaIngrediente => ({
  chave: proximaChave++,
  texto: "",
  alimentoId: null,
  alimentoNome: null,
  fonte: null,
  gramas: "",
});

const VAZIO = (): Rascunho => ({
  id: null,
  titulo: "",
  categoria: "almoco_jantar",
  minutos: "",
  porcoes: "1",
  tags: [],
  ingredientes: [novaLinha()],
  preparo: "",
  dica: "",
  publicada: false,
  manual: false,
  manualValores: SEM_VALORES(),
  manualOrigem: "",
});

const numero = (t: string): number | null => {
  const v = Number(String(t).replace(",", ".").trim());
  return t.trim() !== "" && Number.isFinite(v) ? v : null;
};

function paraRascunho(r: Receita): Rascunho {
  return {
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria,
    minutos: r.minutos === null ? "" : String(r.minutos),
    porcoes: String(r.porcoes).replace(".", ","),
    tags: [...r.tags],
    ingredientes: r.ingredientes.length
      ? r.ingredientes.map((i) => ({
          chave: proximaChave++,
          texto: i.texto,
          alimentoId: i.alimentoId,
          alimentoNome: i.alimentoNome,
          fonte: i.fonte,
          gramas: i.gramas === null ? "" : String(i.gramas).replace(".", ","),
        }))
      : [novaLinha()],
    preparo: r.preparo.join("\n"),
    dica: r.dica ?? "",
    publicada: r.publicada,
    manual: Boolean(r.numeros?.manual),
    manualValores: r.numeros?.manual
      ? (Object.fromEntries(
          Object.entries(r.numeros.manual.porcao).map(([k, v]) => [k, v === null ? "" : String(v).replace(".", ",")]),
        ) as Record<ChaveNutriente, string>)
      : SEM_VALORES(),
    manualOrigem: r.numeros?.manual?.origem ?? "",
  };
}

/** Os números que vão ser gravados: os digitados por ela, ou a soma pelos gramas. */
function numerosDe(r: Rascunho, agora = new Date()): NumerosDaReceita | null {
  if (r.manual) {
    const porcao = Object.fromEntries(
      Object.entries(r.manualValores).map(([k, v]) => [k, numero(v)]),
    ) as Record<ChaveNutriente, number | null>;
    return {
      total: { energia_kcal: null, proteina: null, carboidrato: null, lipideos: null, fibra_alimentar: null },
      faltando: {},
      fontes: [],
      calculadoEm: agora.toISOString(),
      manual: { porcao, origem: r.manualOrigem.trim() },
    };
  }
  return calcularNumeros(ingredientesDe(r), valorDaBase);
}

function ingredientesDe(r: Rascunho): IngredienteReceita[] {
  return r.ingredientes
    .filter((i) => i.texto.trim() || i.alimentoId)
    .map((i) => ({
      texto: i.texto.trim() || i.alimentoNome || "",
      alimentoId: i.alimentoId,
      alimentoNome: i.alimentoNome,
      fonte: i.fonte,
      gramas: i.alimentoId ? numero(i.gramas) : null,
    }));
}

const NOMES: Record<ChaveNutriente, string> = {
  energia_kcal: "energia",
  proteina: "proteína",
  carboidrato: "carboidrato",
  lipideos: "gordura",
  fibra_alimentar: "fibra",
};

const valorDaBase = (id: string, chave: ChaveNutriente) => valorDe(alimentoPorId(id), chave);

/** O que impede salvar, em frases que ela entende. Vazio = pode salvar. */
function problemas(r: Rascunho): string[] {
  const p: string[] = [];
  if (!r.titulo.trim()) p.push("Dê um nome à receita.");
  const ing = ingredientesDe(r);
  if (!ing.length) p.push("Coloque pelo menos um ingrediente.");
  for (const i of r.ingredientes) {
    if (i.alimentoId && !(numero(i.gramas) !== null && (numero(i.gramas) as number) > 0)) {
      p.push(`Faltam os gramas de “${i.texto.trim() || i.alimentoNome}”.`);
    }
  }
  const porcoes = numero(r.porcoes);
  if (porcoes === null || porcoes <= 0) p.push("O rendimento precisa ser um número maior que zero.");
  if (r.manual) {
    if (numero(r.manualValores.energia_kcal) === null) p.push("Digite pelo menos as calorias da porção.");
    for (const [k, v] of Object.entries(r.manualValores)) {
      if (v.trim() && (numero(v) === null || (numero(v) as number) < 0)) p.push(`O valor de ${NOMES[k as ChaveNutriente]} precisa ser um número.`);
    }
    if (!r.manualOrigem.trim()) p.push("Diga de onde vêm os números (ex.: rótulo, e-book, sua conta).");
  }
  const minutos = numero(r.minutos);
  if (r.minutos.trim() && (minutos === null || minutos < 0 || minutos > 1440)) p.push("O tempo está em minutos (0 a 1440).");
  return p;
}

export function Receitas() {
  const [receitas, definirReceitas] = useState<ReceitaDaNutri[] | null>(null);
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [erroCarga, definirErroCarga] = useState(false);
  const [baseOk, definirBaseOk] = useState<boolean | null>(null);
  const [busca, definirBusca] = useState("");
  const [rascunho, definirRascunho] = useState<Rascunho | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [recado, definirRecado] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    try {
      const [r, p] = await Promise.all([repositorio.receitasDaNutri(), repositorio.listarPacientes()]);
      definirReceitas(r);
      definirPacientes(p);
    } catch {
      definirErroCarga(true);
    }
  }

  useEffect(() => {
    void carregar();
    let vivo = true;
    base
      .carregar()
      .then(() => vivo && definirBaseOk(true))
      .catch(() => vivo && definirBaseOk(false));
    return () => {
      vivo = false;
    };
  }, []);

  const numeros = useMemo(
    () => (rascunho && (baseOk || rascunho.manual) ? numerosDe(rascunho) : null),
    [rascunho, baseOk],
  );

  function mudar(parte: Partial<Rascunho>) {
    definirRecado(null);
    definirRascunho((r) => (r ? { ...r, ...parte } : r));
  }
  function mudarIngrediente(chave: number, parte: Partial<LinhaIngrediente>) {
    definirRecado(null);
    definirRascunho((r) =>
      r ? { ...r, ingredientes: r.ingredientes.map((i) => (i.chave === chave ? { ...i, ...parte } : i)) } : r,
    );
  }

  const aSalvar = rascunho ? problemas(rascunho) : [];
  const atual = rascunho?.id ? (receitas?.find((x) => x.id === rascunho.id) ?? null) : null;

  async function salvar() {
    if (!rascunho || aSalvar.length || salvando) return;
    if (!baseOk && !rascunho.manual) {
      definirRecado({ tom: "erro", texto: "A tabela de alimentos não carregou, então não dá para fazer as contas. Recarregue a página." });
      return;
    }
    definirSalvando(true);
    const paraSalvar: ReceitaParaSalvar = {
      id: rascunho.id,
      titulo: rascunho.titulo.trim(),
      categoria: rascunho.categoria,
      minutos: numero(rascunho.minutos),
      porcoes: numero(rascunho.porcoes) as number,
      tags: rascunho.tags,
      ingredientes: ingredientesDe(rascunho),
      preparo: rascunho.preparo
        .split("\n")
        .map((l) => l.replace(/^\s*\d+[.)-]\s*/, "").trim())
        .filter(Boolean),
      dica: rascunho.dica.trim() || null,
      numeros: numerosDe(rascunho),
      publicada: rascunho.publicada,
    };
    try {
      const { id } = await repositorio.salvarReceita(paraSalvar);
      esquecerCozinha();
      await carregar();
      definirRascunho((r) => (r ? { ...r, id } : r));
      definirRecado({ tom: "ok", texto: "Receita salva." });
    } catch {
      definirRecado({ tom: "erro", texto: "Não consegui salvar. Confira a internet e tente de novo." });
    } finally {
      definirSalvando(false);
    }
  }

  async function apagar() {
    if (!rascunho?.id) return;
    try {
      await repositorio.apagarReceita(rascunho.id);
      esquecerCozinha();
      definirRascunho(null);
      await carregar();
    } catch {
      definirRecado({ tom: "erro", texto: "Não consegui apagar. Tente de novo." });
    }
  }

  async function alternarEnvio(pacienteId: string) {
    if (!atual) return;
    const lista = atual.enviadaPara.includes(pacienteId)
      ? atual.enviadaPara.filter((p) => p !== pacienteId)
      : [...atual.enviadaPara, pacienteId];
    try {
      await repositorio.enviarReceita(atual.id, lista);
      esquecerCozinha();
      definirReceitas((rs) => rs?.map((r) => (r.id === atual.id ? { ...r, enviadaPara: lista } : r)) ?? rs);
    } catch {
      definirRecado({ tom: "erro", texto: "Não consegui enviar. Tente de novo." });
    }
  }

  const lista = (receitas ?? []).filter((r) => receitaCombina(r, busca));
  const ativas = pacientes.filter((p) => ["ativo", "proximo_do_vencimento", "nao_iniciado"].includes(p.situacao));
  const previa: Receita | null = rascunho
    ? {
        id: rascunho.id ?? "previa",
        titulo: rascunho.titulo.trim() || "Receita sem nome",
        categoria: rascunho.categoria,
        minutos: numero(rascunho.minutos),
        porcoes: numero(rascunho.porcoes) && (numero(rascunho.porcoes) as number) > 0 ? (numero(rascunho.porcoes) as number) : 1,
        tags: rascunho.tags,
        ingredientes: ingredientesDe(rascunho),
        preparo: rascunho.preparo.split("\n").map((l) => l.trim()).filter(Boolean),
        dica: rascunho.dica.trim() || null,
        numeros,
        publicada: rascunho.publicada,
        atualizadoEm: "",
      }
    : null;
  const porcoes = previa?.porcoes ?? 1;

  return (
    <div className="c-rc">
      <div className="c-rc-cabeca">
        <div>
          <h1 className="c-titulo">Receitas</h1>
          <p className="c-subtitulo">A Cozinha das pacientes. As contas saem das tabelas dos Cálculos, pelos gramas.</p>
        </div>
        {rascunho === null && (
          <button type="button" className="c-botao" onClick={() => definirRascunho(VAZIO())}>
            + Nova receita
          </button>
        )}
      </div>

      {erroCarga && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar as receitas. Recarregue a página.
        </div>
      )}
      {baseOk === false && (
        <div className="c-aviso c-aviso-erro" role="alert">
          A tabela de alimentos não carregou. Dá para ver as receitas, mas não para salvar contas novas. Recarregue a página.
        </div>
      )}

      <div className={`c-rc-grade${rascunho ? " c-rc-grade--editando" : ""}`}>
        <aside className="c-rc-lista" aria-label="Receitas cadastradas">
          {receitas === null && !erroCarga && <Esqueleto />}
          {receitas && receitas.length > 0 && (
            <BarraBusca valor={busca} aoMudar={definirBusca} placeholder="Buscar receita ou ingrediente" rotulo="Buscar receita" />
          )}
          {receitas && receitas.length === 0 && (
            <EstadoVazio
              icone="receita"
              titulo="Nenhuma receita ainda"
              descricao="Toque em “Nova receita”. Ela só aparece para as pacientes quando você publicar ou enviar."
            />
          )}
          {lista.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`c-rc-item${rascunho?.id === r.id ? " c-rc-item--ativo" : ""}`}
              onClick={() => {
                definirRecado(null);
                definirRascunho(paraRascunho(r));
              }}
            >
              <strong>{r.titulo}</strong>
              <span>
                {rotuloDaCategoria(r.categoria)}
                {numerosParaMostrar(r)?.porcao?.energia_kcal != null
                  ? ` · ${formatarNutriente(numerosParaMostrar(r)?.porcao?.energia_kcal, "energia_kcal")} kcal/porção`
                  : ""}
              </span>
              <span className="c-rc-item-estado">
                {r.publicada ? "Na Cozinha" : "Não publicada"}
                {r.enviadaPara.length ? ` · enviada a ${r.enviadaPara.length}` : ""}
              </span>
            </button>
          ))}
        </aside>

        {rascunho && previa && (
          <>
            <section className="c-bloco c-rc-form" aria-label="Editar receita">
              <div className="c-rc-form-topo">
                <button type="button" className="c-link" onClick={() => definirRascunho(null)}>
                  ← Voltar à lista
                </button>
                {rascunho.id && (
                  <button
                    type="button"
                    className="c-botao c-botao-secundario c-botao-pequeno"
                    onClick={() => {
                      definirRecado({ tom: "ok", texto: "Cópia criada. Mude o que quiser e salve." });
                      definirRascunho({ ...rascunho, id: null, titulo: `${rascunho.titulo} (cópia)`, publicada: false });
                    }}
                  >
                    Duplicar
                  </button>
                )}
              </div>

              <label className="c-campo">
                <span className="c-rotulo">Nome</span>
                <input className="c-input" value={rascunho.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
              </label>
              <div className="c-rc-tres">
                <label className="c-campo">
                  <span className="c-rotulo">Refeição</span>
                  <select
                    className="c-select"
                    value={rascunho.categoria}
                    onChange={(e) => mudar({ categoria: e.target.value as CategoriaReceita })}
                  >
                    {CATEGORIAS_RECEITA.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="c-campo">
                  <span className="c-rotulo">Tempo (min)</span>
                  <input className="c-input" inputMode="numeric" value={rascunho.minutos} onChange={(e) => mudar({ minutos: e.target.value })} />
                </label>
                <label className="c-campo">
                  <span className="c-rotulo">Rende (porções)</span>
                  <input className="c-input" inputMode="decimal" value={rascunho.porcoes} onChange={(e) => mudar({ porcoes: e.target.value })} />
                </label>
              </div>
              <div className="c-cz-filtros" role="group" aria-label="Marcações">
                {MARCACOES_RECEITA.map((m) => {
                  const ativa = rascunho.tags.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className="c-cz-filtro"
                      aria-pressed={ativa}
                      onClick={() => mudar({ tags: ativa ? rascunho.tags.filter((t) => t !== m) : [...rascunho.tags, m] })}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              <h2 className="c-cz-secao c-cz-secao--dentro">Ingredientes</h2>
              <p className="c-dica">
                Escreva como a paciente lê e ligue ao alimento da tabela com os gramas. Sem alimento, o ingrediente fica “a gosto”, fora da conta.
              </p>
              <div className="c-rc-ingredientes">
                {rascunho.ingredientes.map((i) => {
                  const kcal = i.alimentoId && numero(i.gramas) ? (valorDaBase(i.alimentoId, "energia_kcal") ?? null) : null;
                  return (
                    <div key={i.chave} className="c-rc-ing">
                      <label className="c-campo c-rc-ing-texto">
                        <span className="c-rotulo">Como aparece para a paciente</span>
                        <input
                          className="c-input"
                          value={i.texto}
                          placeholder="1 cenoura média"
                          onChange={(e) => mudarIngrediente(i.chave, { texto: e.target.value })}
                        />
                      </label>
                      <div className="c-rc-ing-alimento">
                        <span className="c-rotulo">Alimento na tabela</span>
                        {i.alimentoId ? (
                          <div className="c-rc-escolhido">
                            <span>
                              {i.alimentoNome}
                              <small> · {etiquetaDaFonte((i.fonte ?? "taco") as Fonte)}</small>
                            </span>
                            <button
                              type="button"
                              className="c-link"
                              onClick={() => mudarIngrediente(i.chave, { alimentoId: null, alimentoNome: null, fonte: null })}
                            >
                              trocar
                            </button>
                          </div>
                        ) : baseOk ? (
                          <Busca
                            compacta
                            placeholder="Buscar na TACO, IBGE, USDA…"
                            aoEscolher={(a) =>
                              mudarIngrediente(i.chave, {
                                alimentoId: a.id,
                                alimentoNome: a.nome,
                                fonte: a.fonte,
                                texto: i.texto || a.nome,
                              })
                            }
                          />
                        ) : (
                          <span className="c-dica">Carregando a tabela…</span>
                        )}
                      </div>
                      <label className="c-campo c-rc-ing-g">
                        <span className="c-rotulo">Gramas</span>
                        <input
                          className="c-input"
                          inputMode="decimal"
                          value={i.gramas}
                          disabled={!i.alimentoId}
                          placeholder={i.alimentoId ? "" : "a gosto"}
                          onChange={(e) => mudarIngrediente(i.chave, { gramas: e.target.value })}
                        />
                      </label>
                      <span className="c-rc-ing-kcal" aria-label="kcal deste ingrediente">
                        {kcal !== null ? `${formatarNutriente((kcal * (numero(i.gramas) as number)) / 100, "energia_kcal")} kcal` : i.alimentoId ? "—" : rascunho.manual ? "" : "fora da conta"}
                      </span>
                      <button
                        type="button"
                        className="c-rc-tirar"
                        aria-label={`Tirar ${i.texto || "ingrediente"}`}
                        onClick={() =>
                          mudar({
                            ingredientes:
                              rascunho.ingredientes.length > 1
                                ? rascunho.ingredientes.filter((x) => x.chave !== i.chave)
                                : [novaLinha()],
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="c-link c-rc-mais" onClick={() => mudar({ ingredientes: [...rascunho.ingredientes, novaLinha()] })}>
                + Ingrediente
              </button>

              <label className="c-campo">
                <span className="c-rotulo">Preparo (um passo por linha)</span>
                <textarea
                  className="c-input c-rc-textarea"
                  value={rascunho.preparo}
                  onChange={(e) => mudar({ preparo: e.target.value })}
                />
              </label>
              <label className="c-campo">
                <span className="c-rotulo">Dica (uma linha, opcional)</span>
                <input className="c-input" value={rascunho.dica} onChange={(e) => mudar({ dica: e.target.value })} />
              </label>

              <label className="c-rc-publicar">
                <input type="checkbox" checked={rascunho.publicada} onChange={(e) => mudar({ publicada: e.target.checked })} />
                <span>
                  <strong>Mostrar na Cozinha de todas as pacientes</strong>
                  <small>Desmarcada, a receita só aparece para quem você enviar.</small>
                </span>
              </label>

              {aSalvar.length > 0 && (
                <ul className="c-rc-falta">
                  {aSalvar.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {recado && (
                <div className={`c-aviso ${recado.tom === "ok" ? "c-aviso-ok" : "c-aviso-erro"}`} role="status">
                  {recado.texto}
                </div>
              )}
              <div className="c-rc-acoes">
                <button type="button" className="c-botao" disabled={aSalvar.length > 0 || salvando} onClick={() => void salvar()}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                {rascunho.id && (
                  <BotaoConfirmar rotulo="Apagar" pergunta="Apagar mesmo? Toque de novo" aoConfirmar={() => void apagar()} />
                )}
              </div>
            </section>

            <aside className="c-bloco c-rc-numeros" aria-label="Números da receita">
              <label className="c-rc-publicar c-rc-manual">
                <input type="checkbox" checked={rascunho.manual} onChange={(e) => mudar({ manual: e.target.checked })} />
                <span>
                  <strong>Digitar os números eu mesma</strong>
                  <small>Por porção, no lugar da soma pelos gramas (rótulo, e-book, conta sua).</small>
                </span>
              </label>
              {rascunho.manual ? (
                <div className="c-rc-manual-campos">
                  {NUTRIENTES_DA_RECEITA.map((n) => (
                    <label key={n.chave} className="c-campo">
                      <span className="c-rotulo">
                        {n.rotulo} ({n.unidade})
                      </span>
                      <input
                        className="c-input"
                        inputMode="decimal"
                        value={rascunho.manualValores[n.chave]}
                        placeholder={n.chave === "energia_kcal" ? "obrigatório" : "se souber"}
                        onChange={(e) => mudar({ manualValores: { ...rascunho.manualValores, [n.chave]: e.target.value } })}
                      />
                    </label>
                  ))}
                  <label className="c-campo c-rc-manual-origem">
                    <span className="c-rotulo">De onde vêm (aparece para a paciente)</span>
                    <input
                      className="c-input"
                      value={rascunho.manualOrigem}
                      placeholder="ex.: rótulo do produto"
                      onChange={(e) => mudar({ manualOrigem: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <hr />
                  <p className="c-cz-numeros-rotulo">Receita inteira</p>
                  <p className="c-rc-grande">
                    {formatarNutriente(numeros?.total.energia_kcal, "energia_kcal")} <small>kcal</small>
                  </p>
                  <p className="c-rc-mini">
                    {comUnidade(numeros?.total.proteina, "proteina")} proteína · {comUnidade(numeros?.total.carboidrato, "carboidrato")} carboidrato ·{" "}
                    {comUnidade(numeros?.total.lipideos, "lipideos")} gordura · {comUnidade(numeros?.total.fibra_alimentar, "fibra_alimentar")} fibra
                  </p>
                  <hr />
                  <p className="c-cz-numeros-rotulo">Uma porção ({porcoes.toLocaleString("pt-BR")} no total)</p>
                  <p className="c-rc-grande">
                    {formatarNutriente(porPorcao(numeros?.total.energia_kcal, porcoes), "energia_kcal")} <small>kcal</small>
                  </p>
                  <p className="c-rc-mini">
                    {comUnidade(porPorcao(numeros?.total.proteina, porcoes), "proteina")} proteína ·{" "}
                    {comUnidade(porPorcao(numeros?.total.carboidrato, porcoes), "carboidrato")} carboidrato ·{" "}
                    {comUnidade(porPorcao(numeros?.total.lipideos, porcoes), "lipideos")} gordura
                  </p>
                </>
              )}
              {!rascunho.manual && numeros && Object.entries(numeros.faltando).some(([, l]) => l?.length) && (
                <details className="c-rc-mini c-rc-aviso">
                  <summary>Alguns alimentos não têm todos os valores na tabela</summary>
                  Esses ficam fora daquele número (não viram zero):{" "}
                  {Object.entries(numeros.faltando)
                    .filter(([, l]) => l?.length)
                    .map(([k, l]) => `${NOMES[k as ChaveNutriente]} de ${l?.join(", ")}`)
                    .join("; ")}
                  .
                </details>
              )}
              {!rascunho.manual && numeros && <p className="c-cz-fonte">Fonte: {textoDasFontes(numeros.fontes)}.</p>}
              <hr />
              <BotaoPdf
                titulo={`Receita — ${previa.titulo}`}
                classe="c-botao c-botao-secundario c-botao-pequeno"
                rotulo="Ver o PDF"
                desligado={aSalvar.length > 0}
                documento={<DocumentoReceita receita={previa} paciente={null} />}
              />
              <hr />
              <p className="c-cz-numeros-rotulo">Enviar para</p>
              {!atual ? (
                <p className="c-rc-mini">Salve a receita para poder enviar.</p>
              ) : ativas.length === 0 ? (
                <p className="c-rc-mini">Nenhuma paciente com acesso ativo.</p>
              ) : (
                <ul className="c-rc-pacientes">
                  {ativas.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={atual.enviadaPara.includes(p.id)} onChange={() => void alternarEnvio(p.id)} />
                        <span>{p.nome}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
