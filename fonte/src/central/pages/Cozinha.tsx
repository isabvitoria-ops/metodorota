/**
 * Cozinha — as receitas da nutricionista, com as contas já feitas.
 *
 * A paciente vê as receitas PUBLICADAS e as que foram enviadas para ela (quem
 * recorta é o banco, ver 0095). As enviadas vêm primeiro: foram escolhidas
 * para ela.
 *
 * Os números de cada receita vêm prontos do cadastro (calculados pela tabela
 * de cada ingrediente); aqui só se divide pelas porções.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { BarraBusca } from "@/central/components/BarraBusca";
import { BotaoPdf } from "@/central/components/BotaoPdf";
import { DocumentoReceita } from "@/central/components/DocumentoReceita";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Esqueleto } from "@/central/components/Esqueleto";
import { Icone, IconeCoracaoCheio } from "@/central/components/Icone";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { useFavoritos, useEstaSalvo } from "@/central/hooks/useFavoritos";
import { useMinhaCozinha } from "@/central/hooks/useMinhaCozinha";
import { rotas } from "@/central/rotas";
import type { CategoriaReceita, Receita } from "@/central/types/receita";
import { CATEGORIAS_RECEITA, MARCACOES_RECEITA, NUTRIENTES_DA_RECEITA, rotuloDaCategoria } from "@/central/types/receita";
import { formatarNutriente, porPorcao, receitaCombina, textoDasFontes } from "@/central/utils/receitas";

function textoDoRendimento(r: Receita): string {
  return r.porcoes === 1 ? "1 porção" : `rende ${r.porcoes.toLocaleString("pt-BR")} porções`;
}

function Coracao({ receita }: { receita: Receita }) {
  const salvo = useEstaSalvo("receita", receita.id);
  const alternar = useFavoritos((s) => s.alternar);
  return (
    <button
      type="button"
      className={`c-cz-coracao${salvo ? " c-cz-coracao--salvo" : ""}`}
      aria-pressed={salvo}
      aria-label={salvo ? `Tirar ${receita.titulo} das favoritas` : `Guardar ${receita.titulo} nas favoritas`}
      onClick={(e) => {
        e.stopPropagation();
        void alternar({
          tipo: "receita",
          refId: receita.id,
          titulo: receita.titulo,
          subtitulo: rotuloDaCategoria(receita.categoria),
          rota: rotas.receita(receita.id),
        });
      }}
    >
      {salvo ? <IconeCoracaoCheio tamanho={18} /> : <Icone nome="coracao" tamanho={18} />}
    </button>
  );
}

function CartaoReceita({ receita, enviada }: { receita: Receita; enviada: boolean }) {
  const navegar = useNavigate();
  const kcal = porPorcao(receita.numeros?.total.energia_kcal, receita.porcoes);
  return (
    <article className="c-cz-cartao" onClick={() => navegar(rotas.receita(receita.id))}>
      <div className="c-cz-cartao-topo">
        <span className="c-cz-categoria">{rotuloDaCategoria(receita.categoria)}</span>
        <Coracao receita={receita} />
      </div>
      <a
        className="c-cz-cartao-nome"
        href={rotas.receita(receita.id)}
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        {receita.titulo}
      </a>
      <span className="c-cz-meta">
        {[receita.minutos ? `${receita.minutos} min` : null, textoDoRendimento(receita)].filter(Boolean).join(" · ")}
      </span>
      <div className="c-cz-cartao-rodape">
        {kcal !== null && (
          <>
            <span className="c-cz-kcal">{formatarNutriente(kcal, "energia_kcal")} kcal</span>
            <span className="c-cz-por">por porção</span>
          </>
        )}
        {enviada && <span className="c-cz-enviada">Para você</span>}
      </div>
    </article>
  );
}

export function Cozinha() {
  const { cozinha, carregando, erro } = useMinhaCozinha();
  const favoritos = useFavoritos((s) => s.itens);
  const [busca, definirBusca] = useState("");
  const [categoria, definirCategoria] = useState<CategoriaReceita | "todas">("todas");
  const [marcacoes, definirMarcacoes] = useState<string[]>([]);
  const [soFavoritas, definirSoFavoritas] = useState(false);

  const enviadas = useMemo(() => new Set(cozinha?.enviadas ?? []), [cozinha]);
  const favoritas = useMemo(
    () => new Set(favoritos.filter((f) => f.tipo === "receita").map((f) => f.refId)),
    [favoritos],
  );
  const categoriasComReceita = useMemo(
    () => CATEGORIAS_RECEITA.filter((c) => cozinha?.receitas.some((r) => r.categoria === c.valor)),
    [cozinha],
  );
  const marcacoesUsadas = useMemo(
    () => MARCACOES_RECEITA.filter((m) => cozinha?.receitas.some((r) => r.tags.includes(m))),
    [cozinha],
  );

  const filtradas = (cozinha?.receitas ?? []).filter(
    (r) =>
      (categoria === "todas" || r.categoria === categoria) &&
      marcacoes.every((m) => r.tags.includes(m)) &&
      (!soFavoritas || favoritas.has(r.id)) &&
      receitaCombina(r, busca),
  );
  const paraVoce = filtradas.filter((r) => enviadas.has(r.id));
  const outras = filtradas.filter((r) => !enviadas.has(r.id));
  const filtrando = busca.trim() !== "" || categoria !== "todas" || marcacoes.length > 0 || soFavoritas;

  return (
    <>
      <CabecalhoPagina
        titulo="Cozinha"
        descricao="Receitas da sua nutricionista, com as contas já feitas."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        {carregando && <Esqueleto />}
        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            Não consegui abrir as receitas agora. Confira a internet e tente de novo.
          </div>
        )}
        {cozinha && cozinha.receitas.length === 0 && (
          <EstadoVazio
            icone="receita"
            titulo="Ainda não há receitas aqui"
            descricao="Quando sua nutricionista colocar receitas na Cozinha, elas aparecem nesta tela."
          />
        )}
        {cozinha && cozinha.receitas.length > 0 && (
          <>
            <BarraBusca valor={busca} aoMudar={definirBusca} placeholder="Buscar por nome ou ingrediente" rotulo="Buscar receita" />
            <div className="c-chips c-cz-chips" role="group" aria-label="Refeição">
              <button type="button" className="c-chip" aria-pressed={categoria === "todas"} onClick={() => definirCategoria("todas")}>
                Todas
              </button>
              {categoriasComReceita.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  className="c-chip"
                  aria-pressed={categoria === c.valor}
                  onClick={() => definirCategoria(c.valor)}
                >
                  {c.rotulo}
                </button>
              ))}
            </div>
            <div className="c-cz-filtros" role="group" aria-label="Filtros">
              {marcacoesUsadas.map((m) => {
                const ativa = marcacoes.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    className="c-cz-filtro"
                    aria-pressed={ativa}
                    onClick={() => definirMarcacoes(ativa ? marcacoes.filter((x) => x !== m) : [...marcacoes, m])}
                  >
                    {m}
                  </button>
                );
              })}
              <button
                type="button"
                className="c-cz-filtro c-cz-filtro--fav"
                aria-pressed={soFavoritas}
                onClick={() => definirSoFavoritas(!soFavoritas)}
              >
                {soFavoritas ? <IconeCoracaoCheio tamanho={13} /> : <Icone nome="coracao" tamanho={13} />} Favoritas
              </button>
            </div>

            {filtradas.length === 0 && (
              <p className="c-dica c-cz-nada" role="status">
                {soFavoritas && favoritas.size === 0
                  ? "Você ainda não guardou nenhuma. Toque no coração de uma receita para ela aparecer aqui."
                  : "Nenhuma receita com esse filtro. Tente uma palavra só, ou tire um filtro."}
              </p>
            )}

            {paraVoce.length > 0 && (
              <section aria-label="Enviadas para você">
                <h2 className="c-cz-secao">Enviadas para você</h2>
                <div className="c-cz-grade">
                  {paraVoce.map((r) => (
                    <CartaoReceita key={r.id} receita={r} enviada />
                  ))}
                </div>
              </section>
            )}
            {outras.length > 0 && (
              <section aria-label="Receitas">
                <h2 className="c-cz-secao">{paraVoce.length > 0 || filtrando ? "Mais receitas" : "Receitas"}</h2>
                <div className="c-cz-grade">
                  {outras.map((r) => (
                    <CartaoReceita key={r.id} receita={r} enviada={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function ReceitaDetalhe() {
  const { receitaId } = useParams();
  const { cozinha, carregando, erro } = useMinhaCozinha();
  const { acesso } = useSessao();
  const [inteira, definirInteira] = useState(false);
  const receita = cozinha?.receitas.find((r) => r.id === receitaId) ?? null;

  if (carregando || erro || !receita) {
    return (
      <>
        <CabecalhoPagina titulo="Receita" voltarPara={rotas.cozinha} />
        <div className="c-conteudo">
          {carregando && <Esqueleto />}
          {erro && (
            <div className="c-aviso c-aviso-erro" role="alert">
              Não consegui abrir a receita agora. Confira a internet e tente de novo.
            </div>
          )}
          {!carregando && !erro && (
            <EstadoVazio icone="receita" titulo="Receita não encontrada" descricao="Ela pode ter saído da Cozinha." />
          )}
        </div>
      </>
    );
  }

  const n = receita.numeros;
  const valor = (chave: (typeof NUTRIENTES_DA_RECEITA)[number]["chave"]) =>
    inteira ? (n?.total[chave] ?? null) : porPorcao(n?.total[chave], receita.porcoes);
  const faltando = n ? Object.entries(n.faltando).filter(([, l]) => l && l.length) : [];

  return (
    <>
      <CabecalhoPagina
        titulo={receita.titulo}
        descricao={[rotuloDaCategoria(receita.categoria), receita.minutos ? `${receita.minutos} min` : null, textoDoRendimento(receita)]
          .filter(Boolean)
          .join(" · ")}
        voltarPara={rotas.cozinha}
        acao={<Coracao receita={receita} />}
      />
      <div className="c-conteudo">
        <div className="c-cz-etiquetas">
          <span className="c-cz-etiqueta">Receita</span>
          {receita.tags.map((t) => (
            <span key={t} className="c-cz-filtro c-cz-filtro--leitura">
              {t}
            </span>
          ))}
        </div>

        {n && (
          <div className="c-cz-numeros">
            <div className="c-cz-numeros-topo">
              <span className="c-cz-numeros-rotulo">{inteira ? "A receita inteira" : "Uma porção"}</span>
              {receita.porcoes !== 1 && (
                <div className="c-cz-alternar" role="group" aria-label="Ver os números de">
                  <button type="button" aria-pressed={!inteira} onClick={() => definirInteira(false)}>
                    Porção
                  </button>
                  <button type="button" aria-pressed={inteira} onClick={() => definirInteira(true)}>
                    Inteira
                  </button>
                </div>
              )}
            </div>
            <div className="c-cz-numeros-grade">
              <div className="c-cz-num c-cz-num--kcal">
                <strong>{formatarNutriente(valor("energia_kcal"), "energia_kcal")}</strong>
                <span>kcal</span>
              </div>
              <div className="c-cz-num">
                <strong>{formatarNutriente(valor("proteina"), "proteina")} g</strong>
                <span>proteína</span>
              </div>
              <div className="c-cz-num">
                <strong>{formatarNutriente(valor("carboidrato"), "carboidrato")} g</strong>
                <span>carboidrato</span>
              </div>
              <div className="c-cz-num">
                <strong>{formatarNutriente(valor("lipideos"), "lipideos")} g</strong>
                <span>gordura</span>
              </div>
            </div>
            <p className="c-cz-fonte">
              Contas a partir dos gramas de cada ingrediente: {textoDasFontes(n.fontes)}.
              {faltando.length > 0 && " Algum ingrediente não tem todos os valores na tabela; esses números ficam um pouco abaixo do real."}
            </p>
          </div>
        )}

        <section className="c-bloco c-cz-bloco">
          <h2 className="c-cz-secao c-cz-secao--dentro">Ingredientes</h2>
          <ul className="c-cz-ingredientes">
            {receita.ingredientes.map((i, k) => (
              <li key={k}>
                <span>{i.texto}</span>
                {i.gramas ? <span className="c-cz-gramas">{i.gramas.toLocaleString("pt-BR")} g</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {receita.preparo.length > 0 && (
          <section className="c-bloco c-cz-bloco">
            <h2 className="c-cz-secao c-cz-secao--dentro">Preparo</h2>
            <ol className="c-cz-preparo">
              {receita.preparo.map((p, k) => (
                <li key={k}>{p}</li>
              ))}
            </ol>
          </section>
        )}

        {receita.dica && (
          <p className="c-cz-dica">
            <strong>Dica.</strong> {receita.dica}
          </p>
        )}

        <div className="c-cz-acoes">
          <BotaoPdf
            titulo={`Receita — ${receita.titulo}`}
            documento={<DocumentoReceita receita={receita} paciente={acesso.nome ?? null} />}
          />
        </div>
      </div>
    </>
  );
}
