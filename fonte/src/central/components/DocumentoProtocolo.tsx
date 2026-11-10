import type { ConteudoProtocolo, Protocolo } from "@/central/types/protocolo";
import { partirSubstituicao } from "@/central/utils/protocoloDaPaciente";
import { dataBonita } from "@/central/utils/situacao";
import { FolhaDeDocumento } from "./FolhaDeDocumento";
import { Marca } from "./Marca";
import { TextoComLinks } from "./TextoComLinks";

/**
 * O protocolo alimentar em documento — para imprimir e pendurar na cozinha.
 *
 * Mesma regra do documento de rastreabilidade: NÃO é a tela impressa. Sem
 * menu, sem botão, sem endereço de site. É o plano dela, escrito como
 * material clínico.
 *
 * E ele NÃO INVENTA NADA. Não cria valor nutricional, não recalcula porção,
 * não mexe no protocolo ao gerar. É a representação do que ela publicou —
 * o mesmo conteúdo, a mesma versão, as mesmas palavras.
 */
export function DocumentoProtocolo({
  paciente,
  protocolo,
  conteudo,
  fotos = {},
}: {
  /** Caminho da foto → endereço já baixado (ver `fotosDoProtocolo`). */
  fotos?: Record<string, string>;
  paciente: string;
  protocolo: Protocolo | null;
  conteudo: ConteudoProtocolo | null;
  /** Já não é usado: o nome sai no rodapé, escrito por `FolhaDeDocumento`. */
  nutricionista?: string;
}) {
  if (!conteudo || conteudo.refeicoes.length === 0) return null;

  return (
    <FolhaDeDocumento titulo={`Protocolo Alimentar — ${paciente}`}>
      <article className="doc">
      <header className="doc-capa doc-capa-inteira">
        <Marca variante="horizontal-clara" altura={40} className="doc-marca" />
        <div className="doc-capa-meio">
          <p className="doc-sobretitulo">Protocolo Alimentar</p>
          <h1 className="doc-nome">{paciente}</h1>
          {protocolo?.titulo && <p className="doc-lema">{protocolo.titulo}</p>}
          <p className="doc-periodo">
            {protocolo?.publicadoEm
              ? `Publicado em ${dataBonita(protocolo.publicadoEm)}`
              : "Protocolo atual"}
            {protocolo?.versao ? ` · versão ${protocolo.versao}` : ""}
          </p>
        </div>
        <div className="doc-capa-fim">
          {protocolo?.ajustes && (
            <p className="doc-aviso">
              <TextoComLinks texto={protocolo.ajustes} />
            </p>
          )}
        </div>
      </header>

      {conteudo.orientacoes.length > 0 && (
        <section className="doc-secao">
          <h2 className="doc-titulo">Orientações gerais</h2>
          <ul className="doc-lista">
            {conteudo.orientacoes.map((o, i) => (
              <li key={i}>
                <TextoComLinks texto={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {conteudo.refeicoes.map((refeicao, i) => (
        // `break-inside: avoid` na refeição: uma refeição partida ao meio
        // obriga a virar a página no meio do café da manhã. Só as grandes
        // demais para uma página é que quebram — e aí não há o que fazer.
        <section className="doc-secao doc-refeicao" key={`${refeicao.nome}-${i}`}>
          <h2 className="doc-titulo doc-titulo-refeicao">
            <span>{refeicao.nome}</span>
            {refeicao.horario && <span className="doc-horario">{refeicao.horario}</span>}
          </h2>

          {refeicao.opcoes.map((opcao, j) => {
            // Coluna de trocas só quando ALGUM item da opção tem troca: três
            // travessões seguidos não dizem nada a quem está na cozinha.
            const temTrocas = opcao.itens.some((item) => item.substituicoes.length > 0);
            return (
            <div className="doc-opcao" key={j}>
              {/* "Opção 2" só aparece quando HÁ uma segunda: num protocolo
                  de opção única, o rótulo seria ruído. */}
              {refeicao.opcoes.length > 1 && (
                <p className="doc-opcao-rotulo">{opcao.rotulo || `Opção ${j + 1}`}</p>
              )}

              <table className={`doc-tabela doc-tabela-protocolo${temTrocas ? "" : " doc-tabela-sem-trocas"}`}>
                <thead>
                  <tr>
                    <th scope="col">Alimento</th>
                    <th scope="col">Quantidade</th>
                    {temTrocas && <th scope="col">Posso trocar por</th>}
                  </tr>
                </thead>
                <tbody>
                  {opcao.itens.map((item, k) => (
                    <tr key={k}>
                      <th scope="row">
                        {item.imagem && fotos[item.imagem] ? (
                          <div className="doc-item-foto">
                            <img src={fotos[item.imagem]} alt="" />
                            <span>{item.alimento}</span>
                          </div>
                        ) : (
                          item.alimento
                        )}
                        {item.link && (
                          <span className="doc-item-link">
                            {" "}— <a href={item.link} target="_blank" rel="noreferrer noopener">{item.link}</a>
                          </span>
                        )}
                      </th>
                      <td className="doc-data doc-quantidade">{item.quantidade}</td>
                      {temTrocas && (
                        <td>
                          {item.substituicoes.length > 0 ? (
                            // Uma troca por linha, com a quantidade alinhada à
                            // direita — as palavras são as que ela escreveu.
                            <ul className="doc-trocas">
                              {item.substituicoes.map((texto, m) => {
                                const troca = partirSubstituicao(texto);
                                return (
                                  <li key={m}>
                                    <span>{troca.alimento}</span>
                                    {troca.quantidade && <i className="doc-trocas-guia" aria-hidden="true" />}
                                    {troca.quantidade && <strong>{troca.quantidade}</strong>}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {opcao.notas.length > 0 && (
                <ul className="doc-lista doc-lista-nota">
                  {opcao.notas.map((n, k) => (
                    <li key={k}>
                      <TextoComLinks texto={n} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            );
          })}
        </section>
      ))}

      {conteudo.secoes.length > 0 && (
        // As orientações de rotina formam UMA seção, com um bloco por tema —
        // como no app. Um cartão com título grande para cada tema gastava
        // meia folha em três frases.
        <section className="doc-secao">
          <h2 className="doc-titulo">Orientações de rotina</h2>
          {conteudo.secoes.map((secao, i) => (
            <div className="doc-rotina" key={`${secao.titulo}-${i}`}>
              <h3 className="doc-rotina-titulo">{secao.titulo}</h3>
              {secao.paragrafos.map((p, j) => (
                <p className="doc-paragrafo" key={j}>
                  <TextoComLinks texto={p} />
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      </article>
    </FolhaDeDocumento>
  );
}
