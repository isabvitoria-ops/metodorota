import { useState } from "react";
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
  faixaDaIntensidade,
  fraseDoHistorico,
  itensParaRegistrar,
  mostrarMarcacao,
  porSemana,
  rotuloSintoma,
  status,
  temSintoma,
  textoDaMarcacao,
} from "@/central/utils/reintroducao";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";

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
  const [registrando, definirRegistrando] = useState(false);
  const [editando, definirEditando] = useState<RegistroDeReintroducao | null>(null);
  const [semanaVisivel, definirSemanaVisivel] = useState<number | "todas">("todas");

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Rastreabilidade alimentar" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <p className="c-contagem">Carregando…</p>
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

  const itens = dados?.itens ?? [];
  const registros = dados?.registros ?? [];
  const disponiveis = itensParaRegistrar(itens);
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

        {/* ------------------------------------------------------ orientação */}
        {dados?.orientacao && (
          <section className="c-bloco c-prosa" style={{ marginTop: 4 }}>
            {dados.orientacao.split("\n\n").map((paragrafo) => (
              <p key={paragrafo.slice(0, 24)}>{paragrafo}</p>
            ))}
          </section>
        )}

        {!dados?.previa && (
          <button
            type="button"
            className="c-botao"
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => {
              definirErro(null);
              definirRegistrando(true);
            }}
          >
            <Icone nome="salvos" tamanho={16} /> Registrar alimento
          </button>
        )}

        {/* -------------------------------------------------- a lista dela */}
        {itens.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Seus alimentos</h2>
            <p className="c-dica">
              Esta é a lista que sua nutricionista montou para você. Você não precisa testar todos,
              e pode testar na ordem que fizer sentido.
            </p>
            <div className="c-acoes">
              {itens.map((item) => (
                <CartaoItem
                  key={item.id}
                  item={item}
                  ocupado={ocupado || Boolean(dados?.previa)}
                  aoMudar={comRecarga}
                />
              ))}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------- histórico */}
        <section className="c-secao">
          <h2 className="c-secao-titulo">Seu histórico</h2>
          <p className="c-contagem">
            {fraseDoHistorico(registros.length, new Set(registros.map((r) => r.itemId)).size)}
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
              <div className="c-acoes">
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
      </div>

      {(registrando || editando) && (
        <FormularioRegistro
          itens={disponiveis}
          registro={editando}
          aoFechar={() => {
            definirRegistrando(false);
            definirEditando(null);
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
  ocupado,
  aoMudar,
}: {
  item: ItemDeReintroducao;
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const info = status(item.status);
  const naoRelevante = item.status === "nao_relevante";
  // Só os dois estados neutros são dela para mexer. Se a nutricionista já
  // classificou o alimento, o botão some — desfazer um julgamento clínico não
  // é papel da tela da paciente.
  const podeEscolher = item.status === "nao_iniciado" || naoRelevante;

  return (
    <article className={`c-acao ${naoRelevante ? "apagado" : ""}`}>
      <div className="c-acao-topo">
        <span className="c-acao-texto">
          <strong>{item.nome}</strong>
          <span className="c-acao-descricao">
            {item.porcaoReferencia ? `Porção de referência: ${item.porcaoReferencia}` : null}
            {item.porcaoReferencia && item.totalDeRegistros > 0 ? " · " : null}
            {item.totalDeRegistros > 0
              ? `${item.totalDeRegistros} ${item.totalDeRegistros === 1 ? "registro" : "registros"}`
              : null}
          </span>
          {item.observacaoMaterial && (
            <span className="c-acao-descricao">{item.observacaoMaterial}</span>
          )}
          {item.notaNutri && <span className="c-acao-descricao">“{item.notaNutri}”</span>}
        </span>
        <span className={`c-selo ${seloDoTom(info.tom)}`}>{info.paciente}</span>
      </div>

      <div className="c-acao-estado">
        {/* Caminho rápido para o caso mais comum: comeu e passou bem. Um toque
            grava o registro de hoje sem abrir formulário — o registro que não
            acontece por preguiça de preencher não ajuda ninguém. */}
        {!naoRelevante && (
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            disabled={ocupado}
            onClick={() =>
              void aoMudar(() =>
                repositorio.registrarReintroducao({
                  itemId: item.id,
                  sintomas: ["nenhum"],
                }),
              )
            }
          >
            Nenhum sintoma
          </button>
        )}
        {podeEscolher && (
          <button
            type="button"
            className="c-link"
            disabled={ocupado}
            onClick={() =>
              void aoMudar(() =>
                repositorio.marcarRelevanciaReintroducao(item.id, naoRelevante),
              )
            }
          >
            {naoRelevante
              ? "Voltar para a minha lista"
              : "Não faz parte da minha alimentação"}
          </button>
        )}
      </div>
    </article>
  );
}

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

  return (
    <article className="c-acao">
      <div className="c-acao-topo">
        <span className="c-acao-texto">
          <strong>{registro.itemNome}</strong>
          <span className="c-acao-descricao">
            {dataBonita(registro.data)}
            {registro.horario ? ` · ${registro.horario}` : ""}
            {registro.quantidade ? ` · ${registro.quantidade}` : ""}
          </span>
          {registro.preparo && <span className="c-acao-descricao">{registro.preparo}</span>}
        </span>
        <span className={`c-selo ${semSintoma ? "melhor" : "ocasional"}`}>
          {semSintoma ? "Sem sintomas" : "Sintomas registrados"}
        </span>
      </div>

      {!semSintoma && (
        <p className="c-dica">
          {registro.sintomas.map(rotuloSintoma).join(", ")}
          {registro.intensidade != null
            ? ` · ${faixaDaIntensidade(registro.intensidade)} (${registro.intensidade}/10)`
            : ""}
        </p>
      )}
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
        <div className="c-acao-estado">
          <button type="button" className="c-link" disabled={ocupado} onClick={aoEditar}>
            Editar
          </button>
          <button type="button" className="c-link" disabled={ocupado} onClick={aoApagar}>
            Apagar
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
  aoFechar,
  aoSalvar,
}: {
  itens: ItemDeReintroducao[];
  registro: RegistroDeReintroducao | null;
  aoFechar: () => void;
  aoSalvar: (novo: NovoRegistroDeReintroducao) => Promise<boolean>;
}) {
  const [itemId, definirItemId] = useState(registro?.itemId ?? itens[0]?.id ?? "");
  const [outro, definirOutro] = useState(false);
  const [nomeNovo, definirNomeNovo] = useState("");
  const [data, definirData] = useState(registro?.data ?? hojeSaoPaulo());
  const [horario, definirHorario] = useState(registro?.horario ?? "");
  const [quantidade, definirQuantidade] = useState(registro?.quantidade ?? "");
  const [preparo, definirPreparo] = useState(registro?.preparo ?? "");
  const [teveSintoma, definirTeveSintoma] = useState(
    registro ? !(registro.sintomas.length === 0 || registro.sintomas[0] === "nenhum") : false,
  );
  const [sintomas, definirSintomas] = useState<SintomaReintroducao[]>(
    registro?.sintomas.filter((s) => s !== "nenhum") ?? [],
  );
  const [intensidade, definirIntensidade] = useState(registro?.intensidade ?? 0);
  const [bristol, definirBristol] = useState<number | "">(registro?.bristol ?? "");
  const [observacao, definirObservacao] = useState(registro?.observacao ?? "");
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
    definirSalvando(true);
    const deuCerto = await aoSalvar({
      itemId: registro ? registro.itemId : escolhendoNome ? null : itemId,
      nomeNovo: registro || !escolhendoNome ? null : nomeNovo.trim(),
      data,
      horario: horario || null,
      quantidade: quantidade.trim() || null,
      preparo: preparo.trim() || null,
      sintomas: teveSintoma ? (sintomas.length > 0 ? sintomas : ["outros"]) : ["nenhum"],
      intensidade: teveSintoma ? intensidade : 0,
      bristol: bristol === "" ? null : Number(bristol),
      observacao: observacao.trim() || null,
    });
    definirSalvando(false);
    if (!deuCerto) definirAviso("Não consegui salvar. Tente de novo.");
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

          {/* 6. Intensidade */}
          <label className="c-campo" style={{ display: "block" }}>
            <span className="c-rotulo">
              Intensidade: {intensidade} — {faixaDaIntensidade(intensidade)}
            </span>
            <input
              className="c-faixa"
              type="range"
              min={0}
              max={10}
              value={intensidade}
              onChange={(e) => definirIntensidade(Number(e.target.value))}
              aria-label="Intensidade do sintoma, de 0 a 10"
            />
            <span className="c-dica">0 nenhum · 1 a 3 leve · 4 a 6 moderado · 7 a 10 intenso</span>
          </label>
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
