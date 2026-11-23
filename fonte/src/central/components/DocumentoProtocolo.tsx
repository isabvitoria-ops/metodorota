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

  // Os horários existem só quando ela preencheu algum: sem eles, a faixa do
  // alto mostra só a ordem das refeições, que já orienta o dia.
  const temHorario = conteudo.refeicoes.some((r) => r.horario?.trim());

  return (
    <FolhaDeDocumento titulo={`Protocolo Alimentar — ${paciente}`}>
      <article className="doc doc-plano">
      {/* Sem capa de folha inteira: o plano começa na primeira página, com um
          cabeçalho compacto e o dia inteiro num olhar. */}
      <header className="doc-pa-topo">
        <Marca variante="horizontal" altura={30} className="doc-pa-marca" />
        <div className="doc-pa-titulos">
          <div>
            <p className="doc-pa-sobretitulo">
              Protocolo alimentar
              {protocolo?.titulo ? ` · ${protocolo.titulo}` : ""}
            </p>
            <h1 className="doc-pa-titulo">Plano alimentar</h1>
          </div>
          <div className="doc-pa-paciente">
            <span className="doc-pa-rotulo">Paciente</span>
            <strong>{paciente}</strong>
            <span className="doc-pa-data">
              {protocolo?.publicadoEm ? `Publicado em ${dataBonita(protocolo.publicadoEm)}` : "Protocolo atual"}
              {protocolo?.versao ? ` · versão ${protocolo.versao}` : ""}
            </span>
          </div>
        </div>

        <ol className="doc-pa-dia" aria-label="As refeições do dia">
          {conteudo.refeicoes.map((r, i) => (
            <li key={`${r.nome}-${i}`} className="doc-pa-dia-item">
              {temHorario && <span className="doc-pa-dia-hora">{r.horario?.trim() || "—"}</span>}
              <span className="doc-pa-dia-nome">{r.nome}</span>
            </li>
          ))}
        </ol>

        {protocolo?.ajustes && (
          <p className="doc-pa-ajustes">
            <strong>Nesta semana: </strong>
            <TextoComLinks texto={protocolo.ajustes} />
          </p>
        )}
      </header>

      {conteudo.orientacoes.length > 0 && (
        <section className="doc-secao doc-pa-orientacoes">
          <h2 className="doc-pa-secao-titulo">Orientações gerais</h2>
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
        <section className="doc-secao doc-pa-refeicao" key={`${refeicao.nome}-${i}`}>
          <h2 className="doc-pa-refeicao-titulo">
            <span className="doc-pa-numero" aria-hidden="true">{i + 1}</span>
            <span className="doc-pa-refeicao-nome">{refeicao.nome}</span>
            {refeicao.horario && <span className="doc-pa-hora">{refeicao.horario}</span>}
          </h2>

          {refeicao.opcoes.map((opcao, j) => {
            // Coluna de trocas só quando ALGUM item da opção tem troca: três
            // travessões seguidos não dizem nada a quem está na cozinha.
            const temTrocas = opcao.itens.some((item) => item.substituicoes.length > 0);
            return (
            <div className="doc-pa-opcao" key={j}>
              {/* A letra da opção só aparece quando HÁ uma segunda: num
                  protocolo de opção única, ela seria ruído. */}
              {refeicao.opcoes.length > 1 && (
                <p className="doc-pa-opcao-rotulo">
                  <span className="doc-pa-letra" aria-hidden="true">{String.fromCharCode(97 + j)}</span>
                  {opcao.rotulo || `Opção ${j + 1}`}
                </p>
              )}

              <table className={`doc-tabela doc-tabela-protocolo doc-pa-tabela${temTrocas ? "" : " doc-tabela-sem-trocas"}`}>
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
                      <td className="doc-data doc-quantidade">
                        {conteudo.medidasCaseiras && item.medida
                          ? `${item.medida.texto}${item.medida.nivel ? ` ${item.medida.nivel}` : ""}${item.medida.ou ? ` ou ${item.medida.ou.texto}` : ""}`
                          : item.quantidade}
                      </td>
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
                <ul className="doc-pa-notas">
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
        <section className="doc-secao doc-pa-rotina">
          <h2 className="doc-pa-secao-titulo">Orientações de rotina</h2>
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
