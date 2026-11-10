import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  ItemDeReintroducao,
  NovoRegistroDeReintroducao,
  RegistroDeReintroducao,
  SintomaReintroducao,
} from "@/central/types";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
// Primitivo compartilhado: mora em `admin/componentes` por ter nascido lá, e
// traz o que faz um modal ser usável — foco preso dentro, Esc fecha, foco
// volta ao sair. Escrever um segundo aqui seria duplicar isso tudo com a
// chance de esquecer metade.
import { Modal } from "@/central/admin/componentes/Modal";
import { repositorio } from "@/central/dados/repositorio";
import { useReintroducao } from "@/central/hooks/useReintroducao";
import {
  BRISTOL,
  SINTOMAS,
  conferirRegistro,
  faixaDaIntensidade,
  fraseDoHistorico,
  itensParaRegistrar,
  mostrarMarcacao,
  porSemana,
  resumoDoUltimoRegistro,
  seloDoItem,
  temSintoma,
  textoDaMarcacao,
  textoDosSintomas,
} from "@/central/utils/reintroducao";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";
import { lerPreenchimento, type PreenchimentoDaRastreabilidade } from "@/central/utils/conversaDaRefeicao";
import { normalizar } from "@/central/utils/texto";
import { RastreioAlimentar } from "@/central/components/RastreioAlimentar";
import { DocumentoRastreio } from "@/central/components/DocumentoRastreio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Esqueleto } from "@/central/components/Esqueleto";

/**
 * Rastreabilidade alimentar — a tela da paciente.
 *
 * O que esta tela faz: pergunta o que ela comeu e como se sentiu, e mostra o
 * que já registrou.
 *
 * O que ela NÃO faz, e é o motivo de o módulo existir assim:
 *
 *   * não conta o que falta, não mostra progresso e não fala em "restantes";
 *   * não impede registrar um alimento porque outro entrou há pouco tempo;
 *   * não conclui nada a partir de um sintoma;
 *   * não trata semana como prazo. O que não foi testado continua ali, sem
 *     virar tarefa vencida.
 *
 * Se algum dia aparecer aqui uma barra de progresso ou um "você ainda
 * precisa", é sinal de que o módulo virou aquilo que ela pediu para não ser.
 */
export function Rastreabilidade() {
  const { dados, carregando, erro, ocupado, comRecarga, definirErro } = useReintroducao();
  const { acesso, configuracoes } = useSessao();
  /**
   * `false` fechado; `true` aberto sem alimento escolhido; um id quando ela
   * veio pelo atalho de um alimento da lista.
   *
   * DEFEITO QUE ISTO FECHA: pelo atalho "Tive sintoma", o formulário abria
   * com o PRIMEIRO alimento da lista selecionado, não com o que ela tocou.
   * Quem não percebesse gravaria o sintoma no alimento errado — e o registro
   * errado é pior do que o registro que não aconteceu, porque ele conta.
   */
  const [registrando, definirRegistrando] = useState<boolean | string>(false);
  const [editando, definirEditando] = useState<RegistroDeReintroducao | null>(null);
  const [semanaVisivel, definirSemanaVisivel] = useState<number | "todas">("todas");
  const [aba, definirAba] = useState<Aba>("alimentos");

  // "Comi e fiquei bem" grava num toque — e um toque sem querer também. O
  // aviso que aparece depois traz o "Desfazer". Para saber QUAL registro
  // desfazer, guarda-se o que existia antes do toque e procura-se o novo
  // quando a lista volta do banco.
  const [recemFeito, definirRecemFeito] = useState<{ registroId: string; nome: string } | null>(null);
  const aguardando = useRef<{ itemId: string; antes: Set<string> } | null>(null);
  useEffect(() => {
    const espera = aguardando.current;
    if (!espera || !dados) return;
    const novo = dados.registros.find((r) => r.itemId === espera.itemId && !espera.antes.has(r.id));
    if (!novo) return;
    aguardando.current = null;
    definirRecemFeito({ registroId: novo.id, nome: novo.itemNome });
  }, [dados]);
  useEffect(() => {
    if (!recemFeito) return;
    const prazo = window.setTimeout(() => definirRecemFeito(null), 8000);
    return () => window.clearTimeout(prazo);
  }, [recemFeito]);

  // Vindo do atalho da CONVERSA POR REFEIÇÃO ("me deu inchaço"): abre o
  // formulário já com o alimento, o sintoma e o texto. Nada é gravado sozinho —
  // ela confere e toca em salvar. O que vem no endereço é lido com cautela
  // (`lerPreenchimento` descarta sintoma inventado e corta o tamanho).
  const [busca, definirBusca] = useSearchParams();
  const [preenchimento, definirPreenchimento] = useState<
    (PreenchimentoDaRastreabilidade & { itemId: string | null }) | null
  >(null);
  const jaLeuOEndereco = useRef(false);
  useEffect(() => {
    if (jaLeuOEndereco.current || carregando || !dados || dados.previa) return;
    const p = lerPreenchimento(busca);
    if (!p) return;
    jaLeuOEndereco.current = true;
    const alvo = itensParaRegistrar(dados.itens).find(
      (i) => normalizar(i.nome) === normalizar(p.alimento),
    );
    definirPreenchimento({ ...p, itemId: alvo?.id ?? null });
    definirRegistrando(alvo?.id ?? true);
    definirBusca({}, { replace: true });
  }, [busca, carregando, dados, definirBusca]);

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Rastreabilidade alimentar" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <Esqueleto />
        </div>
      </>
    );
  }

  // Desligado, a tela não é uma tela vazia: é um recado curto, sem sugerir
  // que ela perdeu alguma coisa ou que deixou de fazer algo.
  if (dados && !dados.ativo) {
    return (
      <>
        <CabecalhoPagina titulo="Rastreabilidade alimentar" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <EstadoVazio
            icone="folha"
            titulo="Este acompanhamento não está ativo para você"
            descricao="Se a sua nutricionista quiser acompanhar sua reintrodução por aqui, ela liga e o espaço aparece."
          />
        </div>
      </>
    );
  }

  const semanaAtual = dados?.semanaAtual ?? 1;
  const itens = (dados?.itens ?? []).filter(
    (item) => item.semanaSugerida === null || item.semanaSugerida <= semanaAtual,
  );
  const registros = dados?.registros ?? [];
  const disponiveis = itensParaRegistrar(itens);
  const foraDaLista = itens.filter((i) => i.status === "nao_relevante");
  const semanas = porSemana(registros);
  const visiveis =
    semanaVisivel === "todas"
      ? semanas
      : semanas.filter((s) => s.semana === semanaVisivel);

  return (
    <>
      <CabecalhoPagina
        titulo="Rastreabilidade alimentar"
        descricao="Registre os alimentos que você está reintroduzindo e como se sentiu depois deles."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {dados?.previa && (
          <div className="c-aviso" role="status">
            <span>
              Você está vendo a tela como sua paciente vê. O que aparece aqui é a lista e o
              histórico dela — por aqui você não registra nada.
            </span>
          </div>
        )}

        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}

        {/* --------------------------------------------------------- a capa */}
        <section className="c-prot-capa c-ras-capa">
          <p className="c-prot-capa-sobre">Semana {semanaAtual} da sua reintrodução</p>
          <h2 className="c-prot-capa-titulo">Comeu algo da sua lista?</h2>
          <p className="c-prot-capa-meta">Conte como você se sentiu. Um toque já vale como registro.</p>
          {!dados?.previa && (
            <div className="c-prot-capa-acoes">
              <button
                type="button"
                className="c-prot-acao"
                onClick={() => {
                  definirErro(null);
                  definirRegistrando(true);
                }}
              >
                <Icone nome="salvos" tamanho={17} />
                Registrar alimento
              </button>
            </div>
          )}
        </section>

        {/* A orientação dela fica sempre à mão, mas não ocupa a tela toda
            vez: aberta enquanto não há registro, recolhida depois. */}
        {dados?.orientacao && (
          <details className="c-sanfona c-ras-orientacao" open={registros.length === 0}>
            <summary>Como funciona</summary>
            <div className="c-prosa">
              {dados.orientacao.split("\n\n").map((paragrafo) => (
                <p key={paragrafo.slice(0, 24)}>{paragrafo}</p>
              ))}
            </div>
          </details>
        )}

        {/* ---------------------------------------------------------- as abas */}
        <div className="c-ras-abas" role="tablist" aria-label="Partes da rastreabilidade">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={aba === a.chave}
              className={`c-ras-aba${aba === a.chave ? " c-ras-aba--ativa" : ""}`}
              onClick={() => definirAba(a.chave)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {/* -------------------------------------------------- a lista dela */}
        {aba === "alimentos" && (
          <section className="c-ras-painel">
            {itens.length === 0 ? (
              <EstadoVazio
                icone="folha"
                titulo="Sua lista ainda não foi montada"
                descricao="Você já pode registrar qualquer alimento que tenha comido, pelo botão “Registrar alimento”."
              />
            ) : (
              <>
                <p className="c-dica" style={{ marginTop: 0 }}>
                  Esta é a lista que sua nutricionista montou para você. Você não precisa testar todos,
                  e pode testar na ordem que fizer sentido.
                </p>
                <div className="c-ras-itens">
                  {disponiveis.map((item) => (
                    <CartaoItem
                      key={item.id}
                      item={item}
                      ultimo={resumoDoUltimoRegistro(registros.filter((r) => r.itemId === item.id))}
                      ocupado={ocupado || Boolean(dados?.previa)}
                      aoMudar={comRecarga}
                      aoFicarBem={() => {
                        aguardando.current = { itemId: item.id, antes: new Set(registros.map((r) => r.id)) };
                        definirRecemFeito(null);
                        void comRecarga(() =>
                          repositorio.registrarReintroducao({ itemId: item.id, sintomas: ["nenhum"] }),
                        );
                      }}
                      aoRegistrarComSintoma={(id) => {
                        definirErro(null);
                        definirRegistrando(id);
                      }}
                    />
                  ))}
                </div>

                {foraDaLista.length > 0 && (
                  <details className="c-sanfona" style={{ marginTop: 14 }}>
                    <summary>
                      Fora da minha alimentação ({foraDaLista.length})
                    </summary>
                    <div className="c-ras-itens" style={{ marginTop: 10 }}>
                      {foraDaLista.map((item) => (
                        <CartaoItem
                          key={item.id}
                          item={item}
                          ultimo={null}
                          ocupado={ocupado || Boolean(dados?.previa)}
                          aoMudar={comRecarga}
                          aoFicarBem={() => undefined}
                          aoRegistrarComSintoma={() => undefined}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </section>
        )}

        {/* ------------------------------------------------ o rastreio dela */}
        {aba === "rastreio" && (
          <section className="c-ras-painel">
            <RastreioAlimentar itens={itens} registros={registros} />
          </section>
        )}

        {/* O documento, que só existe no papel. Não é a tela impressa: tem
            layout próprio, três tabelas, o mapa de tolerância e espaço para
            os próximos testes. Fica montado em qualquer aba, para o PDF sair
            inteiro. Ver `DocumentoRastreio`. */}
        <DocumentoRastreio
          paciente={acesso.nome ?? "Paciente"}
          semana={dados?.semanaAtual ?? 1}
          itens={itens}
          registros={registros}
          nutricionista={configuracoes.nomeNutricionista}
        />

        {/* ----------------------------------------------------- histórico */}
        {aba === "historico" && (
          <section className="c-ras-painel">
            <p className="c-contagem" style={{ marginTop: 0 }}>
              {fraseDoHistorico(registros.length, new Set(registros.map((r) => r.itemId)).size, itens.length)}
            </p>

            {semanas.length > 1 && (
              <div className="c-chips" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="c-chip"
                  aria-pressed={semanaVisivel === "todas"}
                  onClick={() => definirSemanaVisivel("todas")}
                >
                  Todos os registros
                </button>
                {semanas.map((s) => (
                  <button
                    key={s.semana}
                    type="button"
                    className="c-chip"
                    aria-pressed={semanaVisivel === s.semana}
                    onClick={() => definirSemanaVisivel(s.semana)}
                  >
                    Semana {s.semana}
                  </button>
                ))}
              </div>
            )}

            {registros.some(mostrarMarcacao) && (
              <p className="c-dica" style={{ marginTop: 10 }}>
                As linhas em cinza vêm da tabela de oxalato, histamina e lectina da sua
                nutricionista. Elas não dizem que o alimento faz mal — servem para vocês duas
                compararem com outros alimentos parecidos.
              </p>
            )}

            {visiveis.map((grupo) => (
              <div key={grupo.semana} style={{ marginTop: 16 }}>
                <h3 className="c-secao-titulo" style={{ fontSize: 14 }}>
                  Semana {grupo.semana}
                </h3>
                <div className="c-ras-itens">
                  {grupo.registros.map((registro) => (
                    <CartaoRegistro
                      key={registro.id}
                      registro={registro}
                      ocupado={ocupado || Boolean(dados?.previa)}
                      podeMexer={!dados?.previa}
                      aoEditar={() => definirEditando(registro)}
                      aoApagar={() =>
                        void comRecarga(() => repositorio.excluirRegistroReintroducao(registro.id))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* O aviso do registro de um toque, com o desfazer. */}
      {recemFeito && (
        <div className="c-ras-feito" role="status">
          <span>
            Registrado: <strong>{recemFeito.nome}</strong>, sem sintomas.
          </span>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const id = recemFeito.registroId;
              definirRecemFeito(null);
              void comRecarga(() => repositorio.excluirRegistroReintroducao(id));
            }}
          >
            Desfazer
          </button>
        </div>
      )}

      {(registrando || editando) && (
        <FormularioRegistro
          itens={disponiveis}
          registro={editando}
          itemInicial={typeof registrando === "string" ? registrando : null}
          preenchimento={registrando && !editando ? preenchimento : null}
          aoFechar={() => {
            definirRegistrando(false);
            definirEditando(null);
            definirPreenchimento(null);
          }}
          aoSalvar={async (novo) => {
            const deuCerto = await comRecarga(() =>
              editando
                ? repositorio.editarRegistroReintroducao(editando.id, novo)
                : repositorio.registrarReintroducao(novo),
            );
            if (deuCerto) {
              definirRegistrando(false);
              definirEditando(null);
              definirPreenchimento(null);
            }
            return deuCerto;
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------ um alimento

function CartaoItem({
  item,
  ultimo,
  ocupado,
  aoMudar,
  aoFicarBem,
  aoRegistrarComSintoma,
}: {
  item: ItemDeReintroducao;
  /** "10/11 · sem sintomas" — o último registro deste alimento, se houver. */
  ultimo: string | null;
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>) => Promise<boolean>;
  aoFicarBem: () => void;
  aoRegistrarComSintoma: (itemId: string) => void;
}) {
  const selo = seloDoItem(item);
  const naoRelevante = item.status === "nao_relevante";
  // Só os dois estados neutros são dela para mexer. Se a nutricionista já
  // classificou o alimento, o botão some — desfazer um julgamento clínico não
  // é papel da tela da paciente.
  const podeEscolher = item.status === "nao_iniciado" || naoRelevante;

  return (
    <article className={`c-ras-item${naoRelevante ? " c-ras-item--fora" : ""}`}>
      <div className="c-ras-item-topo">
        <div className="c-ras-item-texto">
          <strong>{item.nome}</strong>
          {item.porcaoReferencia && <span>Porção de referência: {item.porcaoReferencia}</span>}
          {item.observacaoMaterial && <span>{item.observacaoMaterial}</span>}
          {item.notaNutri && <span className="c-ras-item-nota">“{item.notaNutri}”</span>}
        </div>
        {!naoRelevante && <span className={`c-selo ${seloDoTom(selo.tom)}`}>{selo.texto}</span>}
      </div>

      {ultimo && (
        <p className="c-ras-item-ultimo">
          Último registro: {ultimo}
          {item.totalDeRegistros > 1 ? ` · ${item.totalDeRegistros} registros` : ""}
        </p>
      )}

      {!naoRelevante && (
        <div className="c-ras-item-acoes">
          {/* Caminho rápido para o caso mais comum: comeu e passou bem. Um
              toque grava o registro de hoje sem abrir formulário — o registro
              que não acontece por preguiça de preencher não ajuda ninguém. */}
          <button type="button" className="c-ras-botao c-ras-botao--bem" disabled={ocupado} onClick={aoFicarBem}>
            <Icone nome="feito" tamanho={16} />
            Comi e fiquei bem
          </button>
          {/* O outro atalho: o registro com sintoma é o que sustenta a
              leitura de padrões — deixá-lo mais caro de fazer do que o outro
              enviesa o que ela registra. */}
          <button
            type="button"
            className="c-ras-botao"
            disabled={ocupado}
            onClick={() => aoRegistrarComSintoma(item.id)}
          >
            Tive sintoma
          </button>
        </div>
      )}

      {podeEscolher && (
        <button
          type="button"
          className="c-ras-item-fora"
          disabled={ocupado}
          onClick={() => void aoMudar(() => repositorio.marcarRelevanciaReintroducao(item.id, naoRelevante))}
        >
          {naoRelevante ? "Voltar para a minha lista" : "Não como este alimento"}
        </button>
      )}
    </article>
  );
}

type Aba = "alimentos" | "rastreio" | "historico";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "alimentos", rotulo: "Meus alimentos" },
  { chave: "rastreio", rotulo: "Meu rastreio" },
  { chave: "historico", rotulo: "Histórico" },
];

function seloDoTom(tom: string): string {
  if (tom === "bom") return "melhor";
  if (tom === "atencao") return "ocasional";
  return "neutro";
}

// ------------------------------------------------------------ um registro

function CartaoRegistro({
  registro,
  ocupado,
  podeMexer,
  aoEditar,
  aoApagar,
}: {
  registro: RegistroDeReintroducao;
  ocupado: boolean;
  podeMexer: boolean;
  aoEditar: () => void;
  aoApagar: () => void;
}) {
  const semSintoma = !temSintoma(registro);
  const [confirmando, definirConfirmando] = useState(false);

  return (
    <article className="c-ras-item">
      <div className="c-ras-item-topo">
        <div className="c-ras-item-texto">
          <strong>{registro.itemNome}</strong>
          <span>
            {dataBonita(registro.data)}
            {registro.horario ? ` · ${registro.horario.slice(0, 5)}` : ""}
            {registro.quantidade ? ` · ${registro.quantidade}` : ""}
          </span>
          {registro.preparo && <span>{registro.preparo}</span>}
        </div>
        <span className={`c-selo ${semSintoma ? "melhor" : "ocasional"}`}>
          {semSintoma ? "Sem sintomas" : "Com sintoma"}
        </span>
      </div>

      {!semSintoma && <p className="c-ras-registro-sintomas">{textoDosSintomas(registro)}</p>}
      {registro.bristol != null && (
        <p className="c-dica">Escala de Bristol: tipo {registro.bristol}</p>
      )}
      {registro.observacao && <p className="c-dica">“{registro.observacao}”</p>}

      {/* A marcação do material dela. Só aparece quando houve sintoma — é a
          regra que ela deu, e é a que mantém a tela leve: alimento que caiu
          bem não ganha rótulo nenhum. */}
      {mostrarMarcacao(registro) && (
        <p className="c-marcacao">{textoDaMarcacao(registro.marcacao)}</p>
      )}

      {podeMexer && (
        <div className="c-ras-registro-acoes">
          <button type="button" className="c-link" disabled={ocupado} onClick={aoEditar}>
            Editar
          </button>
          {/* Apagar pede um segundo toque: os dois links ficavam lado a lado,
              e um registro apagado sem querer some sem deixar rastro. */}
          <button
            type="button"
            className="c-link"
            disabled={ocupado}
            onClick={() => {
              if (confirmando) return aoApagar();
              definirConfirmando(true);
              window.setTimeout(() => definirConfirmando(false), 4000);
            }}
          >
            {confirmando ? "Apagar mesmo?" : "Apagar"}
          </button>
        </div>
      )}
    </article>
  );
}

// ------------------------------------------------------------ o formulário

/**
 * As perguntas na ordem que ela pediu (§14): qual alimento, quando, quanto,
 * teve sintoma, qual, intensidade, observação.
 *
 * Só a primeira é obrigatória. Um registro com o alimento e mais nada já vale
 * — exigir os sete campos faria a paciente desistir de anotar, e o registro
 * que não acontece não ajuda ninguém.
 */
function FormularioRegistro({
  itens,
  registro,
  itemInicial = null,
  preenchimento = null,
  aoFechar,
  aoSalvar,
}: {
  itens: ItemDeReintroducao[];
  registro: RegistroDeReintroducao | null;
  /** O alimento que ela tocou na lista, quando veio pelo atalho. */
  itemInicial?: string | null;
  /** Vindo da conversa por refeição: alimento, sintoma e texto já preenchidos. */
  preenchimento?: (PreenchimentoDaRastreabilidade & { itemId: string | null }) | null;
  aoFechar: () => void;
  aoSalvar: (novo: NovoRegistroDeReintroducao) => Promise<boolean>;
}) {
  const [itemId, definirItemId] = useState(registro?.itemId ?? itemInicial ?? itens[0]?.id ?? "");
  const [outro, definirOutro] = useState(Boolean(preenchimento && !preenchimento.itemId));
  const [nomeNovo, definirNomeNovo] = useState(
    preenchimento && !preenchimento.itemId ? preenchimento.alimento : "",
  );
  const [data, definirData] = useState(registro?.data ?? hojeSaoPaulo());
  const [horario, definirHorario] = useState(registro?.horario ?? "");
  const [quantidade, definirQuantidade] = useState(registro?.quantidade ?? "");
  const [preparo, definirPreparo] = useState(registro?.preparo ?? "");
  const [teveSintoma, definirTeveSintoma] = useState(
    registro
      ? !(registro.sintomas.length === 0 || registro.sintomas[0] === "nenhum")
      : // Vindo do atalho "Tive sintoma", a pergunta já está respondida: o
        // formulário abre com a lista de sintomas aberta, e ela só marca
        // qual. Abrir em "não" obrigaria a responder de novo o que o botão
        // que ela acabou de tocar já disse.
        itemInicial !== null || preenchimento !== null,
  );
  const [sintomas, definirSintomas] = useState<SintomaReintroducao[]>(
    registro?.sintomas.filter((s) => s !== "nenhum") ?? preenchimento?.sintomas ?? [],
  );
  // Em branco até ela escolher. Antes começava em 0, e quem marcava "Gases"
  // sem mexer na régua gravava "Gases · Nenhum (0/10)".
  const [intensidade, definirIntensidade] = useState<number | null>(
    registro?.intensidade != null && registro.intensidade > 0 ? registro.intensidade : null,
  );
  const [bristol, definirBristol] = useState<number | "">(registro?.bristol ?? "");
  const [observacao, definirObservacao] = useState(
    registro?.observacao ??
      (preenchimento
        ? [preenchimento.refeicao && `(${preenchimento.refeicao})`, preenchimento.observacao]
            .filter(Boolean)
            .join(" ")
        : ""),
  );
  const [aviso, definirAviso] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  const escolhendoNome = outro || itens.length === 0;
  const item = itens.find((i) => i.id === itemId) ?? null;

  function alternar(chave: SintomaReintroducao) {
    definirSintomas((atuais) =>
      atuais.includes(chave) ? atuais.filter((s) => s !== chave) : [...atuais, chave],
    );
  }

  async function salvar() {
    definirAviso(null);
    if (!registro && escolhendoNome && !nomeNovo.trim()) {
      return definirAviso("Escreva o nome do alimento.");
    }
    if (!registro && !escolhendoNome && !itemId) {
      return definirAviso("Escolha o alimento.");
    }
    const impedimento = conferirRegistro({ teveSintoma, sintomas, data, hoje: hojeSaoPaulo() });
    if (impedimento) return definirAviso(impedimento);
    definirSalvando(true);
    try {
      const deuCerto = await aoSalvar({
        itemId: registro ? registro.itemId : escolhendoNome ? null : itemId,
        nomeNovo: registro || !escolhendoNome ? null : nomeNovo.trim(),
        data,
        horario: horario || null,
        quantidade: quantidade.trim() || null,
        preparo: preparo.trim() || null,
        sintomas: teveSintoma ? sintomas : ["nenhum"],
        intensidade: teveSintoma ? intensidade : 0,
        bristol: bristol === "" ? null : Number(bristol),
        observacao: observacao.trim() || null,
      });
      if (!deuCerto) definirAviso("Não consegui salvar. Tente de novo.");
    } catch {
      definirAviso("Não consegui salvar. Tente de novo.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Modal titulo={registro ? "Editar registro" : "Registrar alimento"} aoFechar={aoFechar}>
      {/* 1. Qual alimento? */}
      {registro ? (
        <p className="c-dica">{registro.itemNome}</p>
      ) : (
        <>
          {/* O botão fica FORA do <label>: dentro dele, tocar em "Foi outro
              alimento" também acionava o campo e abria a lista do celular
              junto — dois efeitos num toque só. */}
          <label className="c-campo" style={{ display: "block" }}>
            <span className="c-rotulo">Qual alimento?</span>
            {escolhendoNome ? (
              <input
                className="c-input"
                value={nomeNovo}
                onChange={(e) => definirNomeNovo(e.target.value)}
                placeholder="Ex.: pão da padaria"
              />
            ) : (
              <select
                className="c-select"
                value={itemId}
                onChange={(e) => definirItemId(e.target.value)}
              >
                {itens.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            )}
            {!escolhendoNome && item?.porcaoReferencia && (
              <span className="c-dica">
                Porção de referência do seu material: {item.porcaoReferencia}. Se der sintoma,
                sua nutricionista pode pedir para reduzir pela metade.
              </span>
            )}
          </label>

          {escolhendoNome
            ? itens.length > 0 && (
                <button type="button" className="c-link" onClick={() => definirOutro(false)}>
                  Escolher da minha lista
                </button>
              )
            : (
                <button type="button" className="c-link" onClick={() => definirOutro(true)}>
                  Foi outro alimento
                </button>
              )}
        </>
      )}

      {/* 2. Quando você consumiu? */}
      <div className="c-duas-colunas">
        <label className="c-campo" style={{ display: "block" }}>
          <span className="c-rotulo">Que dia?</span>
          <input
            className="c-input"
            type="date"
            value={data}
            max={hojeSaoPaulo()}
            onChange={(e) => definirData(e.target.value)}
          />
        </label>
        <label className="c-campo" style={{ display: "block" }}>
          <span className="c-rotulo">Que horas? (opcional)</span>
          <input
            className="c-input"
            type="time"
            value={horario}
            onChange={(e) => definirHorario(e.target.value)}
          />
        </label>
      </div>

      {/* 3. Quanto consumiu? / como? */}
      <div className="c-duas-colunas">
        <label className="c-campo" style={{ display: "block" }}>
          <span className="c-rotulo">Quanto? (opcional)</span>
          <input
            className="c-input"
            value={quantidade}
            onChange={(e) => definirQuantidade(e.target.value)}
            placeholder="Ex.: meia fruta, 60g"
          />
        </label>
        <label className="c-campo" style={{ display: "block" }}>
          <span className="c-rotulo">Preparo (opcional)</span>
          <input
            className="c-input"
            value={preparo}
            onChange={(e) => definirPreparo(e.target.value)}
            placeholder="Ex.: cozido, no almoço"
          />
        </label>
      </div>

      {/* 4 e 5. Teve algum sintoma? Qual?
          Envolvido em `c-campo` para ganhar o mesmo respiro dos outros: solto,
          o rótulo encostava no campo de cima e a pergunta parecia legenda do
          "Preparo". */}
      <div className="c-campo">
        <span className="c-rotulo">Teve algum sintoma depois?</span>
        <div className="c-chips">
          <button
            type="button"
            className="c-chip"
            aria-pressed={!teveSintoma}
            onClick={() => definirTeveSintoma(false)}
          >
            Nenhum sintoma
          </button>
          <button
            type="button"
            className="c-chip"
            aria-pressed={teveSintoma}
            onClick={() => definirTeveSintoma(true)}
          >
            Sim, tive sintoma
          </button>
        </div>
      </div>

      {teveSintoma && (
        <>
          <div className="c-campo">
            <span className="c-rotulo">Quais? (pode marcar mais de um)</span>
            <div className="c-chips">
              {SINTOMAS.filter((s) => s.chave !== "nenhum").map((s) => (
                <button
                  key={s.chave}
                  type="button"
                  className="c-chip"
                  aria-pressed={sintomas.includes(s.chave)}
                  onClick={() => alternar(s.chave)}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Intensidade — de 1 a 10, e pode ficar em branco. Tocar de
              novo no número escolhido desmarca. */}
          <div className="c-campo">
            <span className="c-rotulo">
              Quão forte foi? (opcional){intensidade !== null ? ` — ${faixaDaIntensidade(intensidade)}` : ""}
            </span>
            <div className="c-escala c-ras-escala" role="group" aria-label="Intensidade do sintoma, de 1 a 10">
              {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="c-escala-numero"
                  aria-pressed={intensidade === n}
                  onClick={() => definirIntensidade(intensidade === n ? null : n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="c-dica">1 a 3 leve · 4 a 6 moderado · 7 a 10 intenso</span>
          </div>
        </>
      )}

      <label className="c-campo" style={{ display: "block" }}>
        <span className="c-rotulo">Como estavam as fezes? (opcional)</span>
        <select
          className="c-select"
          value={bristol}
          onChange={(e) => definirBristol(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Prefiro não responder</option>
          {BRISTOL.map((b) => (
            <option key={b.tipo} value={b.tipo}>
              Tipo {b.tipo} — {b.descricao}
            </option>
          ))}
        </select>
        <a href={rotas.bristol} target="_blank" rel="noopener noreferrer" className="c-link" style={{ fontSize: "0.82rem", marginTop: 4, display: "inline-block" }}>
          Ver a escala ilustrada
        </a>
      </label>

      {/* 7. Observações */}
      <label className="c-campo" style={{ display: "block" }}>
        <span className="c-rotulo">Quer anotar mais alguma coisa?</span>
        <textarea
          className="c-textarea"
          rows={2}
          value={observacao}
          onChange={(e) => definirObservacao(e.target.value)}
          placeholder="O que você quiser contar sobre esse dia"
        />
      </label>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar registro"}
        </button>
      </div>
    </Modal>
  );
}
