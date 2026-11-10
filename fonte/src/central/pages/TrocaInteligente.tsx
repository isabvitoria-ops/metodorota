import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Alimento } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { calcularTroca, destinosPossiveis, opcoesDeTroca, origensPossiveis } from "@/central/utils/calculoTroca";
import { arredondarExibicao, daBase, rotuloUnidade, unidadesDoAlimento } from "@/central/utils/medidas";
import { numero } from "@/central/utils/texto";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { CampoAlimento } from "@/central/components/CampoAlimento";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
import { useHistorico } from "@/central/hooks/useHistorico";
import { rotas } from "@/central/rotas";
import { numeroDeTexto } from "@/central/utils/numero";

/**
 * Troca Inteligente (§4 a §7) — a tela central do produto.
 *
 * O fluxo é o do briefing, na ordem: alimento → quantidade → unidade →
 * novo alimento → filtros → resultado. Nenhuma conta acontece aqui dentro:
 * a tela só junta o que o paciente escolheu e entrega para
 * `calcularTroca`, em `utils/calculoTroca.ts`.
 *
 * Duas decisões de produto que não estavam escritas no briefing:
 *  - o segundo campo só oferece alimentos que **têm** equivalência com o
 *    primeiro, para ninguém escolher algo que depois não calcula;
 *  - a quantidade já vem preenchida com a porção de referência do alimento,
 *    então o paciente vê um resultado antes mesmo de digitar.
 */
export function TrocaInteligente() {
  const [parametros, definirParametros] = useSearchParams();
  const registrar = useHistorico((estado) => estado.registrar);
  const recentes = useHistorico((estado) => estado.itens);

  const origens = useMemo(() => origensPossiveis(), []);

  const [origem, definirOrigem] = useState<Alimento | null>(() => {
    const pedido = parametros.get("de");
    const alimento = pedido ? catalogo.alimento(pedido) : null;
    return alimento && origens.some((a) => a.id === alimento.id) ? alimento : null;
  });
  const [destino, definirDestino] = useState<Alimento | null>(null);
  const [quantidade, definirQuantidade] = useState(() => textoInicial(origem));
  const [unidadeId, definirUnidadeId] = useState(() => origem?.unidadeBaseId ?? "g");
  const [semGluten, definirSemGluten] = useState(false);
  const [semLactose, definirSemLactose] = useState(false);

  const unidades = useMemo(() => (origem ? unidadesDoAlimento(origem) : []), [origem]);
  const candidatos = useMemo(() => (origem ? destinosPossiveis(origem) : []), [origem]);

  // §6: os filtros não são fixos na tela — cada um aparece só quando algum
  // dos alimentos candidatos tem aquele atributo preenchido no cadastro.
  // Alimento com o campo em branco ("ainda não informei") não faz o chip
  // surgir, e também não é oferecido quando o filtro está ligado.
  const filtroGlutenServe = useMemo(() => declarado(candidatos, "semGluten"), [candidatos]);
  const filtroLactoseServe = useMemo(() => declarado(candidatos, "semLactose"), [candidatos]);

  // Na busca do novo alimento, o mesmo grupo vem primeiro: quem troca arroz
  // quer ver macarrão antes de abacaxi. A lista alfabética de tudo abria em
  // "Abacaxi" para qualquer alimento.
  const destinos = useMemo(
    () =>
      candidatos
        .filter(
          (a) =>
            (!semGluten || a.atributos.semGluten === true) &&
            (!semLactose || a.atributos.semLactose === true),
        )
        .sort((a, b) => Number(b.grupoId === origem?.grupoId) - Number(a.grupoId === origem?.grupoId)),
    [candidatos, semGluten, semLactose, origem],
  );

  const valor = numeroDeTexto(quantidade) ?? Number.NaN;

  // As opções já com a quantidade, para ela escolher sem pesquisar: o par
  // cadastrado e o mesmo grupo. Os outros grupos continuam na busca.
  const [todasAsOpcoes, definirTodasAsOpcoes] = useState(false);
  const opcoes = useMemo(
    () =>
      origem && !destino
        ? opcoesDeTroca(origem, { quantidade: valor, unidadeId }, destinos).filter(
            (o) => o.cadastrada || o.mesmoGrupo,
          )
        : [],
    [origem, destino, destinos, valor, unidadeId],
  );
  const opcoesVisiveis = todasAsOpcoes ? opcoes : opcoes.slice(0, OPCOES_DE_INICIO);
  const resultado = useMemo(() => {
    if (!origem || !destino) return null;
    return calcularTroca({
      alimentoOrigem: origem,
      alimentoDestino: destino,
      medida: { quantidade: valor, unidadeId },
    });
  }, [origem, destino, valor, unidadeId]);

  // Se o destino escolhido sai da lista por causa de um filtro, some com ele
  // em vez de deixar um resultado órfão na tela.
  useEffect(() => {
    if (destino && !destinos.some((a) => a.id === destino.id)) definirDestino(null);
  }, [destino, destinos]);

  // Trocas recentes (§24).
  useEffect(() => {
    if (!resultado?.ok || !origem || !destino) return;
    registrar({ origemAlimentoId: origem.id, destinoAlimentoId: destino.id, quantidade: valor, unidadeId });
  }, [resultado, origem, destino, valor, unidadeId, registrar]);

  function escolherOrigem(alimento: Alimento) {
    definirOrigem(alimento);
    definirTodasAsOpcoes(false);
    definirDestino(null);
    definirUnidadeId(alimento.unidadeBaseId);
    definirQuantidade(textoInicial(alimento));
    definirParametros({}, { replace: true });
  }

  function limparOrigem() {
    definirOrigem(null);
    definirDestino(null);
    definirQuantidade("");
    definirParametros({}, { replace: true });
  }

  /** Inverte os dois lados levando o resultado como nova quantidade. */
  function inverter() {
    if (!origem || !destino || !resultado?.ok) return;
    const novaQuantidade = resultado.saida.quantidade;
    const novaUnidade = resultado.saida.unidadeId;
    definirOrigem(destino);
    definirDestino(origem);
    definirUnidadeId(novaUnidade);
    definirQuantidade(String(novaQuantidade).replace(".", ","));
  }

  if (origens.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Troca inteligente" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <EstadoVazio
            icone="troca"
            titulo="Nenhuma troca cadastrada ainda"
            descricao="Assim que sua nutricionista cadastrar as porções e equivalências do seu material, elas aparecem aqui."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Troca inteligente"
        descricao="Escolha o alimento, informe a quantidade e selecione pelo que deseja trocar."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <CampoAlimento
          rotulo="Alimento a ser trocado"
          placeholder="Pesquise o alimento"
          opcoes={origens}
          selecionado={origem}
          aoSelecionar={escolherOrigem}
          aoLimpar={limparOrigem}
        />

        {origem && (
          <div className="c-campo">
            <span className="c-rotulo">Quantidade</span>
            <div className="c-quantidade">
              <input
                className="c-input"
                type="text"
                inputMode="decimal"
                aria-label="Quantidade"
                value={quantidade}
                placeholder="0"
                onChange={(e) => definirQuantidade(e.target.value.replace(/[^0-9.,]/g, ""))}
              />
              <select
                className="c-select"
                aria-label="Unidade"
                value={unidadeId}
                onChange={(e) => definirUnidadeId(e.target.value)}
              >
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {origem && (
          <div className="c-inversor">
            <button
              type="button"
              onClick={inverter}
              disabled={!resultado?.ok}
              aria-label="Inverter os alimentos da troca"
              title="Inverter"
            >
              <Icone nome="inverter" tamanho={19} />
            </button>
          </div>
        )}

        {origem && (
          <>
            <CampoAlimento
              rotulo="Novo alimento"
              placeholder="Pesquise o novo alimento"
              opcoes={destinos}
              selecionado={destino}
              aoSelecionar={definirDestino}
              aoLimpar={() => definirDestino(null)}
              vazio={
                candidatos.length === 0
                  ? "Este alimento ainda não tem trocas cadastradas."
                  : "Nenhum alimento atende aos filtros escolhidos."
              }
            />

            {(filtroGlutenServe || filtroLactoseServe) && (
              <div className="c-chips" style={{ marginTop: 12 }}>
                {filtroGlutenServe && (
                  <button
                    type="button"
                    className="c-chip"
                    aria-pressed={semGluten}
                    onClick={() => definirSemGluten((v) => !v)}
                  >
                    Sem glúten
                  </button>
                )}
                {filtroLactoseServe && (
                  <button
                    type="button"
                    className="c-chip"
                    aria-pressed={semLactose}
                    onClick={() => definirSemLactose((v) => !v)}
                  >
                    Sem lactose
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {origem && !destino && opcoes.length > 0 && (
          <section className="c-secao c-troca-opcoes" aria-label="Opções de troca">
            <h2 className="c-secao-titulo">Opções para trocar</h2>
            <p className="c-troca-para">
              No lugar de {numero(valor)} {rotuloUnidade(valor, catalogo.unidade(unidadeId), unidadeId)} de{" "}
              {origem.nome}. Toque em uma para ver os detalhes.
            </p>
            <ul className="c-troca-lista">
              {opcoesVisiveis.map((opcao) => (
                <li key={opcao.alimento.id}>
                  <button type="button" className="c-troca-opcao" onClick={() => definirDestino(opcao.alimento)}>
                    <span className="c-troca-opcao-nome">{opcao.alimento.nome}</span>
                    <span className="c-troca-opcao-qtd">
                      {numero(opcao.saida.quantidade)}{" "}
                      {rotuloUnidade(
                        opcao.saida.quantidade,
                        catalogo.unidade(opcao.saida.unidadeId),
                        opcao.saida.unidadeId,
                      )}
                    </span>
                    <Icone nome="seta" tamanho={16} />
                  </button>
                </li>
              ))}
            </ul>
            {opcoes.length > OPCOES_DE_INICIO && (
              <button
                type="button"
                className="c-troca-mais"
                aria-expanded={todasAsOpcoes}
                onClick={() => definirTodasAsOpcoes((v) => !v)}
              >
                {todasAsOpcoes ? "Mostrar menos" : `Ver as ${opcoes.length} opções do grupo`}
              </button>
            )}
          </section>
        )}

        {resultado?.ok && origem && destino && (
          <section className="c-resultado" aria-live="polite">
            <p className="c-resultado-rotulo">Você deve consumir</p>
            <p className="c-resultado-valor">
              {numero(resultado.saida.quantidade)}{" "}
              <span>{rotuloUnidade(resultado.saida.quantidade, catalogo.unidade(resultado.saida.unidadeId), resultado.saida.unidadeId)}</span>
            </p>
            <p className="c-resultado-alimento">de {destino.nome}</p>
            {(() => {
              const caseiras = medidasCaseirasDoResultado(
                destino,
                resultado.saida.quantidade,
                resultado.saida.unidadeId,
              );
              return caseiras.length > 0 ? (
                <p className="c-resultado-caseira">
                  ≈ {caseiras.map((m) => `${numero(m.quantidade)} ${m.rotulo}`).join(" ou ")}
                </p>
              ) : null;
            })()}
            <p className="c-resultado-troca">
              no lugar de {numero(valor)}{" "}
              {rotuloUnidade(valor, catalogo.unidade(unidadeId), unidadeId)} de {origem.nome}
            </p>
            {resultado.porcoes !== null && (
              <p className="c-resultado-nota">
                {/* 1,5 g de arroz dizia "Equivale a 0 porções" — arredondado
                    para zero, como se não fosse nada. */}
                {resultado.porcoes < 0.05
                  ? "Equivale a menos de um décimo de porção."
                  : `Equivale a ${numero(resultado.porcoes)} ${
                      Math.round(resultado.porcoes * 10) / 10 === 1 ? "porção" : "porções"
                    }.`}
              </p>
            )}
            {resultado.porcoes !== null && resultado.porcoes > 10 && (
              <p className="c-resultado-nota">
                É mais de 10 porções de uma vez — confira se a quantidade foi digitada certa.
              </p>
            )}
            {resultado.observacoes.map((nota) => (
              <p className="c-resultado-nota" key={nota}>
                {nota}
              </p>
            ))}
          </section>
        )}

        {resultado && !resultado.ok && resultado.motivo !== "mesmo-alimento" && (
          <div className="c-aviso" role="status">
            <Icone nome="alerta" tamanho={19} />
            <span>{resultado.mensagem}</span>
          </div>
        )}

        {recentes.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Trocas recentes</h2>
            <div className="c-chips">
              {recentes.map((troca) => {
                const de = catalogo.alimento(troca.origemAlimentoId);
                const para = catalogo.alimento(troca.destinoAlimentoId);
                if (!de || !para) return null;
                return (
                  <button
                    key={troca.id}
                    type="button"
                    className="c-chip"
                    onClick={() => {
                      definirOrigem(de);
                      definirDestino(para);
                      definirUnidadeId(troca.unidadeId);
                      definirQuantidade(String(troca.quantidade).replace(".", ","));
                    }}
                  >
                    <Icone nome="relogio" tamanho={14} />
                    {de.nome.split(" ")[0]} → {para.nome.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Medidas caseiras equivalentes ao resultado, para o paciente visualizar.
 *
 * Se o resultado é "86 g de Achocolatado em pó" e o alimento tem "colher de
 * sopa = 10 g" cadastrada, mostra "≈ 8,5 colheres de sopa" ao lado.
 */
function medidasCaseirasDoResultado(
  alimento: Alimento,
  quantidade: number,
  unidadeId: string,
): { quantidade: number; rotulo: string }[] {
  const base =
    unidadeId === alimento.unidadeBaseId
      ? quantidade
      : (() => {
          const medida = alimento.medidas.find((m) => m.unidadeId === unidadeId);
          return medida?.equivalenteNaBase != null ? quantidade * medida.equivalenteNaBase : null;
        })();
  if (base === null) return [];

  const resultado: { quantidade: number; rotulo: string }[] = [];
  for (const m of alimento.medidas) {
    if (m.unidadeId === unidadeId) continue;
    if (m.equivalenteNaBase == null || m.equivalenteNaBase === 0) continue;
    const convertido = daBase(alimento, base, m.unidadeId);
    if (convertido === null || convertido <= 0) continue;
    const unidade = catalogo.unidade(m.unidadeId);
    if (!unidade) continue;
    const arredondado = arredondarExibicao(convertido, unidade);
    resultado.push({
      quantidade: arredondado,
      rotulo: rotuloUnidade(arredondado, unidade, m.unidadeId),
    });
  }

  if (unidadeId !== alimento.unidadeBaseId && base > 0) {
    const unidadeBase = catalogo.unidade(alimento.unidadeBaseId);
    if (unidadeBase) {
      const arredondado = arredondarExibicao(base, unidadeBase);
      resultado.unshift({
        quantidade: arredondado,
        rotulo: rotuloUnidade(arredondado, unidadeBase, alimento.unidadeBaseId),
      });
    }
  }

  return resultado;
}

/** Quantas opções aparecem antes do "ver todas". */
const OPCOES_DE_INICIO = 6;

/** A quantidade já começa na porção de referência — resultado na tela sem digitar nada. */
function textoInicial(alimento: Alimento | null): string {
  if (!alimento?.porcao) return "";
  return String(alimento.porcao.quantidade).replace(".", ",");
}

/** O chip só existe se o atributo estiver preenchido em algum candidato. */
function declarado(alimentos: Alimento[], atributo: "semGluten" | "semLactose"): boolean {
  return alimentos.some((a) => a.atributos[atributo] !== null);
}
