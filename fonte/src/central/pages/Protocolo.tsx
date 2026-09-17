import { useEffect, useState } from "react";
import type { Protocolo as ProtocoloAlimentar, RefeicaoProtocolo } from "@/central/types/protocolo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";

/**
 * Protocolo Alimentar — a dieta da paciente.
 *
 * O conteúdo é da nutricionista, inteirinho: ela calcula fora e cola no app.
 * Esta tela não soma, não converte e não opina — mostra o que ela escreveu,
 * com a cara do aplicativo, para a paciente não precisar de um segundo app
 * (que era o pedido: um só).
 *
 * As decisões de tela que importam:
 *
 *   * a substituição fica EMBAIXO do item, discreta, e não numa tabela ao
 *     lado. Numa tela de celular a terceira coluna vira ilegível;
 *   * quando a refeição tem mais de um jeito de fazer, as opções viram
 *     botões. Com uma só, nem rótulo aparece;
 *   * o recado da semana fica em destaque no topo, porque é o que muda.
 */
export function Protocolo() {
  const [protocolo, definirProtocolo] = useState<ProtocoloAlimentar | null>(null);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void repositorio
      .meuProtocolo()
      .then((p) => vivo && definirProtocolo(p))
      .catch(() => vivo && definirProtocolo(null))
      .finally(() => vivo && definirCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const conteudo = protocolo?.conteudo;
  const temRefeicoes = (conteudo?.refeicoes.length ?? 0) > 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Protocolo Alimentar"
        descricao={protocolo?.titulo ?? "Seu plano alimentar."}
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {carregando && <p className="c-dica">Carregando…</p>}

        {!carregando && !temRefeicoes && (
          <EstadoVazio
            icone="lista"
            titulo="Seu protocolo ainda não está aqui"
            descricao="Assim que sua nutricionista publicar o plano, ele aparece nesta tela."
          />
        )}

        {!carregando && temRefeicoes && conteudo && (
          <>
            {protocolo?.ajustes && (
              <div className="c-aviso c-aviso-ok" role="status">
                <span>{protocolo.ajustes}</span>
              </div>
            )}

            {conteudo.orientacoes.length > 0 && (
              <section className="c-secao">
                <h2 className="c-secao-titulo">Orientações gerais</h2>
                <ul className="c-orientacoes">
                  {conteudo.orientacoes.map((texto, i) => (
                    <li key={i}>{texto}</li>
                  ))}
                </ul>
              </section>
            )}

            {conteudo.refeicoes.map((refeicao, i) => (
              <Refeicao key={`${refeicao.nome}-${i}`} refeicao={refeicao} />
            ))}

            {conteudo.secoes.length > 0 && (
              <section className="c-secao">
                <h2 className="c-secao-titulo">Orientações de rotina</h2>
                <div className="c-lista">
                  {conteudo.secoes.map((secao, i) => (
                    <details key={i} className="c-sanfona">
                      <summary>{secao.titulo}</summary>
                      {secao.paragrafos.map((p, j) => (
                        <p key={j} className="c-sanfona-texto">
                          {p}
                        </p>
                      ))}
                    </details>
                  ))}
                </div>
              </section>
            )}

            <p className="c-dica" style={{ marginTop: 22 }}>
              Plano montado pela sua nutricionista. Em caso de dúvida, fale com ela antes de
              trocar qualquer coisa por conta.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Refeicao({ refeicao }: { refeicao: RefeicaoProtocolo }) {
  const [escolhida, definirEscolhida] = useState(0);
  const opcoes = refeicao.opcoes;
  const opcao = opcoes[Math.min(escolhida, opcoes.length - 1)];
  if (!opcao) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{refeicao.nome}</h2>

      {opcoes.length > 1 && (
        <div className="c-chips" style={{ marginBottom: 12 }}>
          {opcoes.map((o, i) => (
            <button
              key={`${o.rotulo}-${i}`}
              type="button"
              className="c-chip"
              aria-pressed={i === escolhida}
              onClick={() => definirEscolhida(i)}
            >
              {o.rotulo || `Opção ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="c-bloco">
        {opcao.itens.map((item, i) => (
          <div className="c-item-protocolo" key={`${item.alimento}-${i}`}>
            <div className="c-item-protocolo-linha">
              <span className="c-item-protocolo-nome">{item.alimento}</span>
              {item.quantidade && (
                <span className="c-item-protocolo-quantidade">{item.quantidade}</span>
              )}
            </div>
            {item.substituicoes.length > 0 && (
              <p className="c-item-protocolo-trocas">
                ou {item.substituicoes.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {opcao.notas.map((nota, i) => (
        <p className="c-nota-protocolo" key={i}>
          {nota}
        </p>
      ))}
    </section>
  );
}
