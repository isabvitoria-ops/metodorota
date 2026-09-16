import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Alimento } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { calcularTroca, destinosPossiveis, origensPossiveis } from "@/central/utils/calculoTroca";
import { rotuloUnidade, unidadesDoAlimento } from "@/central/utils/medidas";
import { numero } from "@/central/utils/texto";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { CampoAlimento } from "@/central/components/CampoAlimento";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
import { BotaoFavorito } from "@/central/components/BotaoFavorito";
import { useHistorico } from "@/central/hooks/useHistorico";
import { rotas } from "@/central/rotas";

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

  const destinos = useMemo(
    () =>
      candidatos.filter(
        (a) =>
          (!semGluten || a.atributos.semGluten === true) &&
          (!semLactose || a.atributos.semLactose === true),
      ),
    [candidatos, semGluten, semLactose],
  );

  const valor = Number(quantidade.replace(",", "."));
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

        {resultado?.ok && origem && destino && (
          <section className="c-resultado" aria-live="polite">
            <p className="c-resultado-rotulo">Você deve consumir</p>
            <p className="c-resultado-valor">
              {numero(resultado.saida.quantidade)}{" "}
              <span>{rotuloUnidade(resultado.saida.quantidade, catalogo.unidade(resultado.saida.unidadeId), resultado.saida.unidadeId)}</span>
            </p>
            <p className="c-resultado-alimento">de {destino.nome}</p>
            <p className="c-resultado-troca">
              no lugar de {numero(valor)}{" "}
              {rotuloUnidade(valor, catalogo.unidade(unidadeId), unidadeId)} de {origem.nome}
            </p>
            {resultado.porcoes !== null && (
              <p className="c-resultado-nota">
                Equivale a {numero(resultado.porcoes)}{" "}
                {resultado.porcoes === 1 ? "porção" : "porções"}.
              </p>
            )}
            {resultado.observacoes.map((nota) => (
              <p className="c-resultado-nota" key={nota}>
                {nota}
              </p>
            ))}
            <div className="c-resultado-acoes">
              <BotaoFavorito
                classe="c-resultado-acao"
                item={{
                  tipo: "troca",
                  refId: `${origem.id}>${destino.id}`,
                  titulo: `${origem.nome} → ${destino.nome}`,
                  subtitulo: `${numero(valor)} ${rotuloUnidade(valor, catalogo.unidade(unidadeId), unidadeId)} equivalem a ${numero(resultado.saida.quantidade)} ${rotuloUnidade(resultado.saida.quantidade, catalogo.unidade(resultado.saida.unidadeId), resultado.saida.unidadeId)}`,
                  rota: rotas.trocaCom(origem.id),
                }}
              />
            </div>
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

/** A quantidade já começa na porção de referência — resultado na tela sem digitar nada. */
function textoInicial(alimento: Alimento | null): string {
  if (!alimento?.porcao) return "";
  return String(alimento.porcao.quantidade).replace(".", ",");
}

/** O chip só existe se o atributo estiver preenchido em algum candidato. */
function declarado(alimentos: Alimento[], atributo: "semGluten" | "semLactose"): boolean {
  return alimentos.some((a) => a.atributos[atributo] !== null);
}
