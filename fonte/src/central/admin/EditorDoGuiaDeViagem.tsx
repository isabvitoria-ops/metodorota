import { useState, type ReactNode } from "react";
import type {
  BlocoDoGuia,
  CorDoSemaforo,
  EstiloDaLista,
  FichaDeViagem,
  GuiaDeViagem,
  ItemDoGuia,
  SecaoDoGuia,
  TipoDeBloco,
  TomDoDestaque,
} from "@/central/types/viagem";
import { blocoEmBranco, novoIdDeSecao, TAMANHO_MAXIMO_DA_IMAGEM } from "@/central/utils/guiaViagem";
import { reduzirFoto } from "@/central/utils/reduzirFoto";

/**
 * O editor do guia de viagem de uma paciente.
 *
 * Não grava nada: recebe o rascunho e devolve o rascunho mudado. Quem salva é
 * a tela de fora, com um botão só — assim ela pode mexer em dez trechos e
 * decidir no fim se fica ou se descarta.
 *
 * O guia é uma lista de SEÇÕES, e cada seção uma lista de BLOCOS (texto,
 * lista, destaque, semáforo…). Cada bloco tem o próprio formulário abaixo.
 */

const NOMES_DOS_BLOCOS: Record<TipoDeBloco, string> = {
  texto: "Texto",
  subtitulo: "Subtítulo",
  destaque: "Destaque",
  lista: "Lista",
  semaforo: "Semáforo de alimentos",
  abas: "Abas (por país, por idioma)",
  cartao: "Cartão para mostrar",
  tabela: "Tabela",
  produto: "Produto indicado",
  ficha: "Ficha de saúde",
  diario: "Diário da viagem",
};

const TONS: [TomDoDestaque, string][] = [
  ["dica", "Dica (azul)"],
  ["atencao", "Atenção (amarelo)"],
  ["alerta", "Alerta (vermelho)"],
  ["neutro", "Neutro (cinza)"],
];

const ESTILOS: [EstiloDaLista, string][] = [
  ["marcadores", "Marcadores"],
  ["numerada", "Numerada"],
  ["cartoes", "Cartões com título"],
];

const NOMES_DAS_CORES: Record<CorDoSemaforo, string> = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" };

/** Troca o item de lugar com o vizinho. Fora da lista, devolve a mesma lista. */
function mover<T>(lista: T[], indice: number, passo: -1 | 1): T[] {
  const destino = indice + passo;
  if (destino < 0 || destino >= lista.length) return lista;
  const nova = [...lista];
  [nova[indice], nova[destino]] = [nova[destino] as T, nova[indice] as T];
  return nova;
}

const trocar = <T,>(lista: T[], indice: number, valor: T): T[] => lista.map((x, i) => (i === indice ? valor : x));
const tirar = <T,>(lista: T[], indice: number): T[] => lista.filter((_, i) => i !== indice);

function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="c-campo c-vg-ed-campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small className="c-vg-ed-dica">{dica}</small>}
    </label>
  );
}

/** Os três botõezinhos de toda linha que pode subir, descer ou sair. */
function Ordem({
  aoSubir,
  aoDescer,
  aoRemover,
  oQue,
}: {
  aoSubir?: () => void;
  aoDescer?: () => void;
  aoRemover: () => void;
  oQue: string;
}) {
  return (
    <span className="c-vg-ed-ordem">
      <button type="button" className="c-vg-ed-icone" disabled={!aoSubir} onClick={aoSubir} aria-label={`Subir ${oQue}`}>
        ↑
      </button>
      <button type="button" className="c-vg-ed-icone" disabled={!aoDescer} onClick={aoDescer} aria-label={`Descer ${oQue}`}>
        ↓
      </button>
      <button type="button" className="c-vg-ed-icone c-vg-ed-icone--perigo" onClick={aoRemover} aria-label={`Remover ${oQue}`}>
        ✕
      </button>
    </span>
  );
}

export function EditorDoGuiaDeViagem({
  guia,
  ficha,
  aoMudar,
}: {
  guia: GuiaDeViagem;
  ficha: FichaDeViagem;
  aoMudar: (guia: GuiaDeViagem, ficha: FichaDeViagem) => void;
}) {
  const mudarGuia = (parte: Partial<GuiaDeViagem>) => aoMudar({ ...guia, ...parte }, ficha);
  const mudarFicha = (parte: Partial<FichaDeViagem>) => aoMudar(guia, { ...ficha, ...parte });
  const mudarSecao = (i: number, secao: SecaoDoGuia) => mudarGuia({ secoes: trocar(guia.secoes, i, secao) });

  return (
    <div className="c-vg-ed">
      <p className="c-vg-ed-dica">
        Nos textos, <code>**assim**</code> vira <strong>negrito</strong> e <code>*assim*</code> vira <em>itálico</em>.
      </p>

      <fieldset className="c-bloco c-vg-ed-grupo">
        <legend>A viagem</legend>
        <Campo rotulo="Frase do topo">
          <input type="text" value={guia.chamada} onChange={(e) => mudarGuia({ chamada: e.target.value })} />
        </Campo>
        <Campo rotulo="Destinos" dica="Ex.: Portugal · Itália · Espanha">
          <input type="text" value={guia.destinos} onChange={(e) => mudarGuia({ destinos: e.target.value })} />
        </Campo>
        <Campo rotulo="Período, como ela vai ler" dica="Ex.: 11 a 26 de novembro de 2026 (16 dias)">
          <input type="text" value={guia.periodo} onChange={(e) => mudarGuia({ periodo: e.target.value })} />
        </Campo>
        <div className="c-vg-ed-duas">
          <Campo rotulo="Primeiro dia">
            <input type="date" value={guia.dataInicio ?? ""} onChange={(e) => mudarGuia({ dataInicio: e.target.value || null })} />
          </Campo>
          <Campo rotulo="Último dia">
            <input type="date" value={guia.dataFim ?? ""} onChange={(e) => mudarGuia({ dataFim: e.target.value || null })} />
          </Campo>
        </div>
        <p className="c-vg-ed-dica">O diário ganha um dia para cada data entre o primeiro e o último dia.</p>
      </fieldset>

      <fieldset className="c-bloco c-vg-ed-grupo">
        <legend>Ficha de saúde (aparece em inglês, para atendimento no exterior)</legend>
        <Campo rotulo="Nome completo">
          <input type="text" value={ficha.nome ?? ""} onChange={(e) => mudarFicha({ nome: e.target.value })} />
        </Campo>
        <Campo rotulo="Nascimento" dica="Ex.: 13/08/1975">
          <input type="text" value={ficha.nascimento ?? ""} onChange={(e) => mudarFicha({ nascimento: e.target.value })} />
        </Campo>
        <Campo rotulo="Diagnósticos, em inglês">
          <textarea rows={3} value={ficha.diagnosticos ?? ""} onChange={(e) => mudarFicha({ diagnosticos: e.target.value })} />
        </Campo>
        <p className="c-vg-ed-dica">
          A ficha é só desta paciente: copiar o guia para outra pessoa nunca leva estes dados junto.
        </p>
      </fieldset>

      {guia.secoes.map((secao, i) => (
        <fieldset key={secao.id} className="c-bloco c-vg-ed-grupo">
          <legend>
            Seção {i + 1}
            <Ordem
              oQue="a seção"
              aoSubir={i > 0 ? () => mudarGuia({ secoes: mover(guia.secoes, i, -1) }) : undefined}
              aoDescer={i < guia.secoes.length - 1 ? () => mudarGuia({ secoes: mover(guia.secoes, i, 1) }) : undefined}
              aoRemover={() => {
                if (window.confirm(`Remover a seção "${secao.titulo || "sem título"}" inteira?`)) {
                  mudarGuia({ secoes: tirar(guia.secoes, i) });
                }
              }}
            />
          </legend>
          <div className="c-vg-ed-duas">
            <Campo rotulo="Título da seção">
              <input type="text" value={secao.titulo} onChange={(e) => mudarSecao(i, { ...secao, titulo: e.target.value })} />
            </Campo>
            <Campo rotulo="Nome curto na barra" dica="Vazio = fora da barra">
              <input type="text" value={secao.rotulo} onChange={(e) => mudarSecao(i, { ...secao, rotulo: e.target.value })} />
            </Campo>
          </div>
          <EditorDeBlocos blocos={secao.blocos} aoMudar={(blocos) => mudarSecao(i, { ...secao, blocos })} dentroDeAba={false} />
        </fieldset>
      ))}

      <button
        type="button"
        className="c-botao c-botao-pequeno c-botao-secundario"
        onClick={() => mudarGuia({ secoes: [...guia.secoes, { id: novoIdDeSecao(guia), rotulo: "", titulo: "", blocos: [] }] })}
      >
        + Nova seção
      </button>
    </div>
  );
}

function EditorDeBlocos({
  blocos,
  aoMudar,
  dentroDeAba,
}: {
  blocos: BlocoDoGuia[];
  aoMudar: (blocos: BlocoDoGuia[]) => void;
  dentroDeAba: boolean;
}) {
  const [novo, definirNovo] = useState<TipoDeBloco>("texto");
  // Abas dentro de abas não existem na tela da paciente.
  const tipos = (Object.keys(NOMES_DOS_BLOCOS) as TipoDeBloco[]).filter((t) => !(dentroDeAba && t === "abas"));

  return (
    <div className="c-vg-ed-blocos">
      {blocos.map((bloco, i) => (
        <div key={i} className="c-vg-ed-bloco">
          <div className="c-vg-ed-bloco-topo">
            <strong>{NOMES_DOS_BLOCOS[bloco.tipo]}</strong>
            <Ordem
              oQue="o bloco"
              aoSubir={i > 0 ? () => aoMudar(mover(blocos, i, -1)) : undefined}
              aoDescer={i < blocos.length - 1 ? () => aoMudar(mover(blocos, i, 1)) : undefined}
              aoRemover={() => aoMudar(tirar(blocos, i))}
            />
          </div>
          <EditorDeBloco bloco={bloco} aoMudar={(b) => aoMudar(trocar(blocos, i, b))} />
        </div>
      ))}
      <div className="c-vg-ed-novo">
        <select value={novo} onChange={(e) => definirNovo(e.target.value as TipoDeBloco)} aria-label="Tipo do bloco novo">
          {tipos.map((t) => (
            <option key={t} value={t}>
              {NOMES_DOS_BLOCOS[t]}
            </option>
          ))}
        </select>
        <button type="button" className="c-botao c-botao-pequeno c-botao-secundario" onClick={() => aoMudar([...blocos, blocoEmBranco(novo)])}>
          + Adicionar bloco
        </button>
      </div>
    </div>
  );
}

function EditorDeItens({
  itens,
  aoMudar,
  comTitulo = true,
}: {
  itens: ItemDoGuia[];
  aoMudar: (itens: ItemDoGuia[]) => void;
  comTitulo?: boolean;
}) {
  return (
    <div className="c-vg-ed-itens">
      {itens.map((item, i) => (
        <div key={i} className="c-vg-ed-item">
          <div className="c-vg-ed-item-campos">
            {comTitulo && (
              <input
                type="text"
                className="c-input"
                placeholder="Título (opcional)"
                aria-label={`Título do item ${i + 1}`}
                value={item.titulo ?? ""}
                onChange={(e) => aoMudar(trocar(itens, i, { ...item, titulo: e.target.value || undefined }))}
              />
            )}
            <textarea
              className="c-textarea"
              rows={2}
              placeholder="Texto"
              aria-label={`Texto do item ${i + 1}`}
              value={item.texto}
              onChange={(e) => aoMudar(trocar(itens, i, { ...item, texto: e.target.value }))}
            />
          </div>
          <Ordem
            oQue={`o item ${i + 1}`}
            aoSubir={i > 0 ? () => aoMudar(mover(itens, i, -1)) : undefined}
            aoDescer={i < itens.length - 1 ? () => aoMudar(mover(itens, i, 1)) : undefined}
            aoRemover={() => aoMudar(tirar(itens, i))}
          />
        </div>
      ))}
      <button type="button" className="c-botao-texto" onClick={() => aoMudar([...itens, { texto: "" }])}>
        + item
      </button>
    </div>
  );
}

/** Uma frase por linha, para as listas simples (itens de um alerta, frases de um cartão). */
function LinhaPorLinha({ rotulo, linhas, aoMudar }: { rotulo: string; linhas: string[]; aoMudar: (linhas: string[]) => void }) {
  return (
    <Campo rotulo={rotulo} dica="Uma por linha.">
      <textarea rows={Math.max(2, linhas.length)} value={linhas.join("\n")} onChange={(e) => aoMudar(e.target.value.split("\n"))} />
    </Campo>
  );
}

function EditorDeBloco({ bloco, aoMudar }: { bloco: BlocoDoGuia; aoMudar: (bloco: BlocoDoGuia) => void }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <textarea
          className="c-textarea"
          rows={3}
          aria-label="Texto"
          value={bloco.texto}
          onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
        />
      );
    case "subtitulo":
      return (
        <input
          type="text"
          className="c-input"
          aria-label="Subtítulo"
          value={bloco.texto}
          onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
        />
      );
    case "destaque":
      return (
        <>
          <div className="c-vg-ed-duas">
            <Campo rotulo="Cor">
              <select value={bloco.tom} onChange={(e) => aoMudar({ ...bloco, tom: e.target.value as TomDoDestaque })}>
                {TONS.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Título (opcional)">
              <input type="text" value={bloco.titulo ?? ""} onChange={(e) => aoMudar({ ...bloco, titulo: e.target.value || undefined })} />
            </Campo>
          </div>
          <Campo rotulo="Texto">
            <textarea rows={3} value={bloco.texto ?? ""} onChange={(e) => aoMudar({ ...bloco, texto: e.target.value || undefined })} />
          </Campo>
          <LinhaPorLinha rotulo="Itens (opcional)" linhas={bloco.itens ?? []} aoMudar={(itens) => aoMudar({ ...bloco, itens })} />
        </>
      );
    case "lista":
      return (
        <>
          <Campo rotulo="Aparência">
            <select value={bloco.estilo} onChange={(e) => aoMudar({ ...bloco, estilo: e.target.value as EstiloDaLista })}>
              {ESTILOS.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </Campo>
          <EditorDeItens itens={bloco.itens} aoMudar={(itens) => aoMudar({ ...bloco, itens })} />
        </>
      );
    case "semaforo":
      return (
        <>
          {bloco.grupos.map((grupo, i) => (
            <div key={grupo.cor} className={`c-vg-ed-cor c-vg-ed-cor--${grupo.cor}`}>
              <Campo rotulo={`${NOMES_DAS_CORES[grupo.cor]}: título do grupo`}>
                <input
                  type="text"
                  value={grupo.titulo}
                  onChange={(e) => aoMudar({ ...bloco, grupos: trocar(bloco.grupos, i, { ...grupo, titulo: e.target.value }) })}
                />
              </Campo>
              <EditorDeItens itens={grupo.itens} aoMudar={(itens) => aoMudar({ ...bloco, grupos: trocar(bloco.grupos, i, { ...grupo, itens }) })} />
            </div>
          ))}
        </>
      );
    case "abas":
      return (
        <>
          {bloco.abas.map((aba, i) => (
            <div key={i} className="c-vg-ed-aba">
              <div className="c-vg-ed-bloco-topo">
                <input
                  type="text"
                  className="c-input"
                  placeholder="Nome da aba"
                  aria-label={`Nome da aba ${i + 1}`}
                  value={aba.rotulo}
                  onChange={(e) => aoMudar({ ...bloco, abas: trocar(bloco.abas, i, { ...aba, rotulo: e.target.value }) })}
                />
                <Ordem
                  oQue={`a aba ${i + 1}`}
                  aoSubir={i > 0 ? () => aoMudar({ ...bloco, abas: mover(bloco.abas, i, -1) }) : undefined}
                  aoDescer={i < bloco.abas.length - 1 ? () => aoMudar({ ...bloco, abas: mover(bloco.abas, i, 1) }) : undefined}
                  aoRemover={() => aoMudar({ ...bloco, abas: tirar(bloco.abas, i) })}
                />
              </div>
              <EditorDeBlocos
                blocos={aba.blocos}
                dentroDeAba
                aoMudar={(blocos) => aoMudar({ ...bloco, abas: trocar(bloco.abas, i, { ...aba, blocos }) })}
              />
            </div>
          ))}
          <button type="button" className="c-botao-texto" onClick={() => aoMudar({ ...bloco, abas: [...bloco.abas, { rotulo: "", blocos: [] }] })}>
            + aba
          </button>
        </>
      );
    case "cartao":
      return (
        <>
          <Campo rotulo="Frase de abertura">
            <textarea rows={2} value={bloco.texto} onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })} />
          </Campo>
          <LinhaPorLinha rotulo="Frases em destaque" linhas={bloco.destaques} aoMudar={(destaques) => aoMudar({ ...bloco, destaques })} />
        </>
      );
    case "tabela":
      return <EditorDeTabela bloco={bloco} aoMudar={aoMudar} />;
    case "produto":
      return <EditorDeProduto bloco={bloco} aoMudar={aoMudar} />;
    case "ficha":
      return <p className="c-vg-ed-dica">Mostra a ficha de saúde preenchida lá em cima, mais os campos em branco para ela completar.</p>;
    case "diario":
      return <p className="c-vg-ed-dica">Mostra um dia para cada data da viagem. O que ela preenche aparece para você na aba Diário.</p>;
  }
}

function EditorDeTabela({
  bloco,
  aoMudar,
}: {
  bloco: Extract<BlocoDoGuia, { tipo: "tabela" }>;
  aoMudar: (bloco: BlocoDoGuia) => void;
}) {
  const colunas = bloco.colunas.length;
  return (
    <>
      <div className="c-vg-ed-tabela">
        <table>
          <thead>
            <tr>
              {bloco.colunas.map((coluna, c) => (
                <th key={c}>
                  <input
                    type="text"
                    className="c-input"
                    placeholder="Coluna"
                    aria-label={`Nome da coluna ${c + 1}`}
                    value={coluna}
                    onChange={(e) => aoMudar({ ...bloco, colunas: trocar(bloco.colunas, c, e.target.value) })}
                  />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {bloco.linhas.map((linha, l) => (
              <tr key={l}>
                {bloco.colunas.map((_, c) => (
                  <td key={c}>
                    <input
                      type="text"
                      className="c-input"
                      aria-label={`Linha ${l + 1}, coluna ${c + 1}`}
                      value={linha[c] ?? ""}
                      onChange={(e) => aoMudar({ ...bloco, linhas: trocar(bloco.linhas, l, trocar(linha, c, e.target.value)) })}
                    />
                  </td>
                ))}
                <td>
                  <Ordem
                    oQue={`a linha ${l + 1}`}
                    aoSubir={l > 0 ? () => aoMudar({ ...bloco, linhas: mover(bloco.linhas, l, -1) }) : undefined}
                    aoDescer={l < bloco.linhas.length - 1 ? () => aoMudar({ ...bloco, linhas: mover(bloco.linhas, l, 1) }) : undefined}
                    aoRemover={() => aoMudar({ ...bloco, linhas: tirar(bloco.linhas, l) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="c-vg-ed-novo">
        <button type="button" className="c-botao-texto" onClick={() => aoMudar({ ...bloco, linhas: [...bloco.linhas, bloco.colunas.map(() => "")] })}>
          + linha
        </button>
        <button
          type="button"
          className="c-botao-texto"
          disabled={colunas >= 6}
          onClick={() => aoMudar({ ...bloco, colunas: [...bloco.colunas, ""], linhas: bloco.linhas.map((l) => [...l, ""]) })}
        >
          + coluna
        </button>
        <button
          type="button"
          className="c-botao-texto"
          disabled={colunas <= 1}
          onClick={() => aoMudar({ ...bloco, colunas: bloco.colunas.slice(0, -1), linhas: bloco.linhas.map((l) => l.slice(0, colunas - 1)) })}
        >
          − última coluna
        </button>
      </div>
    </>
  );
}

function lerComoEndereco(blob: Blob): Promise<string> {
  return new Promise((resolver, recusar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => recusar(new Error("Não consegui ler a imagem."));
    leitor.readAsDataURL(blob);
  });
}

function EditorDeProduto({
  bloco,
  aoMudar,
}: {
  bloco: Extract<BlocoDoGuia, { tipo: "produto" }>;
  aoMudar: (bloco: BlocoDoGuia) => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    definirErro(null);
    try {
      // A foto vai dentro do guia: pequena, para o guia abrir rápido no exterior.
      const imagem = await lerComoEndereco(await reduzirFoto(arquivo, 520, 0.8));
      if (imagem.length > TAMANHO_MAXIMO_DA_IMAGEM) throw new Error("A imagem ficou grande demais. Tente outra, mais simples.");
      aoMudar({ ...bloco, imagem });
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui usar esta imagem.");
    }
  }

  return (
    <>
      <div className="c-vg-ed-produto">
        {bloco.imagem ? <img src={bloco.imagem} alt="" /> : <span className="c-vg-ed-sem-foto">sem foto</span>}
        <div>
          <label className="c-botao c-botao-pequeno c-botao-secundario c-vg-ed-arquivo">
            {bloco.imagem ? "Trocar a foto" : "Escolher a foto"}
            <input type="file" accept="image/*" onChange={(e) => void escolher(e.target.files?.[0])} />
          </label>
          {bloco.imagem && (
            <button type="button" className="c-botao-texto" onClick={() => aoMudar({ ...bloco, imagem: "" })}>
              tirar a foto
            </button>
          )}
        </div>
      </div>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      <Campo rotulo="Nome do produto">
        <input type="text" value={bloco.titulo} onChange={(e) => aoMudar({ ...bloco, titulo: e.target.value })} />
      </Campo>
      <Campo rotulo="Por que você indica">
        <textarea rows={2} value={bloco.texto} onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })} />
      </Campo>
      <Campo rotulo="Link do produto (opcional)" dica="Precisa começar com https://">
        <input type="url" value={bloco.link ?? ""} onChange={(e) => aoMudar({ ...bloco, link: e.target.value || undefined })} />
      </Campo>
    </>
  );
}
