/**
 * Colinha das medidas caseiras — só para a nutricionista, enquanto monta o
 * plano. Abre por utensílio (escolhe a colher de sopa e vê quanto ela pesa em
 * cada alimento da base). A busca por alimento continua na segunda aba.
 *
 * Nenhum número é daqui: vem da mesma base da página Cálculos
 * (nutri/dados/medidas.json — pesos oficiais do USDA SR28 e a planilha de
 * medidas dela) e das medidas que ela mesma criou em Cálculos. Cada linha
 * mostra de onde veio. Peso de medida depende do alimento (a colher de sopa
 * de arroz não pesa o que pesa a de azeite), por isso cada utensílio lista
 * alimento por alimento, e não um peso único.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./componentes/Modal";
import { Busca } from "@/central/calculos/Busca";
import { colinhaPorUtensilio, type GrupoDoUtensilio } from "@/central/utils/colinhaPorUtensilio";
import { alimentoPorId, base, etiquetaDaFonte, medidasDoAlimento, mostrar, type Alimento, type Medida } from "@/central/calculos/tabela";

const CHAVE = "marvia-colinha-medidas";
const CHAVE_UTENSILIO = "marvia-colinha-utensilio";

function lerTexto(chave: string): string {
  try {
    return localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

function guardarTexto(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento, só não lembra da última vez */
  }
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function montarGrupos(): GrupoDoUtensilio[] {
  const ids = new Set<string>(Object.keys(base.medidasPadrao));
  for (const a of base.alimentos) if (a.fonte === "meu" || a.fonte === "importada") ids.add(a.id);
  const entradas = [];
  for (const id of ids) {
    const a = alimentoPorId(id);
    if (a) entradas.push({ id: a.id, nome: a.nome, medidas: medidasDoAlimento(a.id) });
  }
  return colinhaPorUtensilio(entradas);
}

function PorUtensilio() {
  const grupos = useMemo(montarGrupos, []);
  const [chave, definirChave] = useState(() => {
    const guardada = lerTexto(CHAVE_UTENSILIO);
    return grupos.some((g) => g.chave === guardada) ? guardada : grupos[0]?.chave ?? "";
  });
  const [filtro, definirFiltro] = useState("");
  const grupo = grupos.find((g) => g.chave === chave) ?? null;
  const termo = semAcento(filtro.trim());
  const linhas = grupo ? grupo.linhas.filter((l) => !termo || semAcento(l.alimento).includes(termo)) : [];

  function escolher(c: string) {
    definirChave(c);
    guardarTexto(CHAVE_UTENSILIO, c);
  }

  if (grupos.length === 0) {
    return <p className="c-dica">A base não traz nenhuma medida de utensílio agora.</p>;
  }
  const chips = (eua: boolean) =>
    grupos
      .filter((g) => g.eua === eua)
      .map((g) => (
        <button
          key={g.chave}
          type="button"
          className={`c-chip c-chip-pequeno ${g.chave === chave ? "c-chip-ativo" : ""}`}
          aria-pressed={g.chave === chave}
          onClick={() => escolher(g.chave)}
        >
          {g.nome} · {g.linhas.length}
        </button>
      ));
  return (
    <>
      <div className="c-chips c-colinha-utensilios" aria-label="Utensílios do Brasil">
        {chips(false)}
      </div>
      {grupos.some((g) => g.eua) && (
        <>
          <p className="c-colinha-subtitulo">Utensílios dos EUA (pesos do USDA, em inglês)</p>
          <div className="c-chips c-colinha-utensilios" aria-label="Utensílios dos EUA">
            {chips(true)}
          </div>
        </>
      )}
      <p className="c-dica c-colinha-ml">
        O volume em ml de cada utensílio ainda está em aberto: falta uma fonte que eu consiga conferir. O peso
        muda com o alimento, por isso a colinha mostra alimento por alimento.
      </p>
      {grupo && (
        <article className="c-colinha-cartao">
          <header>
            <div>
              <strong>{grupo.nome}</strong>
              <small>
                {grupo.linhas.length} {grupo.linhas.length === 1 ? "alimento" : "alimentos"} com peso na base
              </small>
            </div>
          </header>
          <input
            type="search"
            className="c-input c-colinha-filtro"
            placeholder="Filtrar alimento (ex.: arroz)"
            aria-label={`Filtrar alimento em ${grupo.nome}`}
            value={filtro}
            onChange={(e) => definirFiltro(e.target.value)}
          />
          {linhas.length === 0 ? (
            <p className="c-dica">Nenhum alimento com esse nome neste utensílio.</p>
          ) : (
            <ul>
              {linhas.map((l) => (
                <li key={`${l.alimentoId}|${l.medida}`}>
                  <span className="c-colinha-medida">
                    {l.alimento} <span className="c-colinha-qual">· 1 {l.medida}</span>
                  </span>
                  <span className="c-colinha-peso">{gramas(l.gramas)}</span>
                  <small className="c-colinha-origem">{l.origem}</small>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </>
  );
}
const MAXIMO = 15;

function lerGuardados(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAXIMO) : [];
  } catch {
    return [];
  }
}

function guardar(ids: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ids));
  } catch {
    /* sem armazenamento, a colinha só não lembra da última vez */
  }
}

const gramas = (g: number) => `${mostrar(g, g < 10 && g % 1 ? 1 : 0)} g`;

function origem(m: Medida): string {
  return m.ref ? m.ref : "Medida criada por você em Cálculos";
}

function CartaoDoAlimento({ alimento, aoTirar }: { alimento: Alimento; aoTirar: () => void }) {
  const medidas = medidasDoAlimento(alimento.id).filter((m) => m.nome !== "g");
  return (
    <article className="c-colinha-cartao">
      <header>
        <div>
          <strong>{alimento.nome}</strong>
          <small>{etiquetaDaFonte(alimento.fonte)}</small>
        </div>
        <button type="button" className="c-link" onClick={aoTirar} aria-label={`Tirar ${alimento.nome} da colinha`}>
          Tirar
        </button>
      </header>
      {medidas.length === 0 ? (
        <p className="c-dica">
          A base não traz medida caseira para este alimento. Dá para criar uma em Cálculos, no próprio alimento da dieta.
        </p>
      ) : (
        <ul>
          {medidas.map((m) => (
            <li key={m.nome}>
              <span className="c-colinha-medida">1 {m.nome}</span>
              <span className="c-colinha-peso">{gramas(m.gramas)}</span>
              <small className="c-colinha-origem">{origem(m)}</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ColinhaDeMedidas({
  rotulo = "Colinha das medidas",
  comoLink = false,
  buscaInicial = "",
}: {
  rotulo?: string;
  /** Link discreto (ao lado da medida de um item) em vez de botão. */
  comoLink?: boolean;
  /** Já abre buscando este alimento. */
  buscaInicial?: string;
}) {
  const [aberta, definirAberta] = useState(false);
  const fechar = useCallback(() => definirAberta(false), []);
  return (
    <>
      <button
        type="button"
        className={comoLink ? "c-link c-colinha-link" : "c-botao c-botao-pequeno c-botao-secundario"}
        onClick={() => definirAberta(true)}
      >
        {rotulo}
      </button>
      {aberta && <JanelaDaColinha aoFechar={fechar} buscaInicial={buscaInicial} />}
    </>
  );
}

function JanelaDaColinha({ aoFechar, buscaInicial }: { aoFechar: () => void; buscaInicial: string }) {
  const [pronta, definirPronta] = useState(base.alimentos.length > 0);
  const [erro, definirErro] = useState<string | null>(null);
  const [ids, definirIds] = useState<string[]>(lerGuardados);
  const [aba, definirAba] = useState<"utensilio" | "alimento">("utensilio");

  useEffect(() => {
    let vivo = true;
    base
      .carregar()
      .then(() => vivo && definirPronta(true))
      .catch(() => vivo && definirErro("Não consegui carregar a tabela de alimentos. Feche e abra de novo; se continuar, me avise."));
    return () => {
      vivo = false;
    };
  }, []);

  function mudar(novos: string[]) {
    definirIds(novos);
    guardar(novos);
  }

  const alimentos = pronta ? ids.map((id) => alimentoPorId(id)).filter((a): a is Alimento => a !== null) : [];

  return (
    <Modal titulo="Colinha das medidas" aoFechar={aoFechar}>
      <div className="c-chips" role="tablist" aria-label="Ver a colinha">
        <button type="button" role="tab" aria-selected={aba === "utensilio"} className={`c-chip ${aba === "utensilio" ? "c-chip-ativo" : ""}`} onClick={() => definirAba("utensilio")}>
          Por utensílio
        </button>
        <button type="button" role="tab" aria-selected={aba === "alimento"} className={`c-chip ${aba === "alimento" ? "c-chip-ativo" : ""}`} onClick={() => definirAba("alimento")}>
          Por alimento
        </button>
      </div>
      <p className="c-dica">Só você vê. Cada número diz de onde veio.</p>
      {erro ? (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      ) : !pronta ? (
        <p className="c-dica">Carregando a tabela de alimentos…</p>
      ) : aba === "utensilio" ? (
        <PorUtensilio />
      ) : (
        <>
          <Busca
            textoInicial={buscaInicial.trim()}
            placeholder="Buscar alimento (ex.: arroz, aveia, azeite)"
            aoEscolher={(a) => mudar([a.id, ...ids.filter((x) => x !== a.id)].slice(0, MAXIMO))}
          />
          {alimentos.length === 0 ? (
            <p className="c-dica" style={{ marginTop: 12 }}>
              Busque um alimento para ver as medidas dele. Os últimos que você olhou ficam aqui na próxima vez.
            </p>
          ) : (
            <div className="c-colinha-lista">
              {alimentos.map((a) => (
                <CartaoDoAlimento key={a.id} alimento={a} aoTirar={() => mudar(ids.filter((x) => x !== a.id))} />
              ))}
            </div>
          )}
        </>
      )}
      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
