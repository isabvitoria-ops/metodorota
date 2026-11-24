/**
 * Colinha das medidas caseiras — só para a nutricionista, enquanto monta o
 * plano. Ela busca o alimento e vê quanto pesa cada medida caseira dele
 * ("1 colher de sopa = 25 g").
 *
 * Nenhum número é daqui: vem da mesma base da página Cálculos
 * (nutri/dados/medidas.json — pesos oficiais do USDA SR28 e a planilha de
 * medidas dela) e das medidas que ela mesma criou em Cálculos. Cada linha
 * mostra de onde veio. Peso de medida depende do alimento (a colher de sopa
 * de arroz não pesa o que pesa a de azeite), por isso a colinha é por
 * alimento, e não uma tabela única de utensílios.
 */
import { useCallback, useEffect, useState } from "react";
import { Modal } from "./componentes/Modal";
import { Busca } from "@/central/calculos/Busca";
import { alimentoPorId, base, etiquetaDaFonte, medidasDoAlimento, mostrar, type Alimento, type Medida } from "@/central/calculos/tabela";

const CHAVE = "marvia-colinha-medidas";
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
      <p className="c-dica">
        Quanto pesa cada medida caseira, por alimento. Só você vê. Cada número diz de onde veio.
      </p>
      {erro ? (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      ) : !pronta ? (
        <p className="c-dica">Carregando a tabela de alimentos…</p>
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
