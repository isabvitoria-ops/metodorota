import type { ConteudoProtocolo, Protocolo } from "@/central/types/protocolo";
import { dataBonita } from "@/central/utils/situacao";
import { Marca } from "./Marca";

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
  nutricionista,
}: {
  paciente: string;
  protocolo: Protocolo | null;
  conteudo: ConteudoProtocolo | null;
  nutricionista: string;
}) {
  if (!conteudo || conteudo.refeicoes.length === 0) return null;

  return (
    <article className="doc" aria-hidden="true">
      <header className="doc-capa">
        <Marca altura={40} className="doc-marca" />
        <p className="doc-sobretitulo">Protocolo Alimentar</p>
        <h1 className="doc-nome">{paciente}</h1>
        {protocolo?.titulo && <p className="doc-lema">{protocolo.titulo}</p>}
        <p className="doc-periodo">
          {protocolo?.publicadoEm
            ? `Publicado em ${dataBonita(protocolo.publicadoEm)}`
            : "Protocolo atual"}
          {protocolo?.versao ? ` · versão ${protocolo.versao}` : ""}
        </p>

        {protocolo?.ajustes && <p className="doc-aviso">{protocolo.ajustes}</p>}
      </header>

      {conteudo.orientacoes.length > 0 && (
        <section className="doc-secao">
          <h2 className="doc-titulo">Orientações gerais</h2>
          <ul className="doc-lista">
            {conteudo.orientacoes.map((o, i) => (
              <li key={i}>{o}</li>
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
            {refeicao.nome}
            {refeicao.horario && <span className="doc-horario">{refeicao.horario}</span>}
          </h2>

          {refeicao.opcoes.map((opcao, j) => (
            <div className="doc-opcao" key={j}>
              {/* "Opção 2" só aparece quando HÁ uma segunda: num protocolo
                  de opção única, o rótulo seria ruído. */}
              {refeicao.opcoes.length > 1 && (
                <p className="doc-opcao-rotulo">{opcao.rotulo || `Opção ${j + 1}`}</p>
              )}

              <table className="doc-tabela doc-tabela-protocolo">
                <thead>
                  <tr>
                    <th scope="col">Alimento</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Posso trocar por</th>
                  </tr>
                </thead>
                <tbody>
                  {opcao.itens.map((item, k) => (
                    <tr key={k}>
                      <th scope="row">{item.alimento}</th>
                      <td className="doc-data">{item.quantidade}</td>
                      <td>
                        {item.substituicoes.length > 0 ? item.substituicoes.join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {opcao.notas.length > 0 && (
                <ul className="doc-lista doc-lista-nota">
                  {opcao.notas.map((n, k) => (
                    <li key={k}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}

      {conteudo.secoes.map((secao, i) => (
        <section className="doc-secao doc-refeicao" key={`${secao.titulo}-${i}`}>
          <h2 className="doc-titulo">{secao.titulo}</h2>
          {secao.paragrafos.map((p, j) => (
            <p className="doc-paragrafo" key={j}>
              {p}
            </p>
          ))}
        </section>
      ))}

      <footer className="doc-rodape">
        <p>
          <strong>Protocolo Alimentar — {paciente}</strong>
        </p>
        <p>Nutricionista: {nutricionista}</p>
      </footer>
    </article>
  );
}
