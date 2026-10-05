import { useCallback, useEffect, useState } from "react";
import type { Protocolo as ProtocoloAlimentar, RefeicaoProtocolo } from "@/central/types/protocolo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { ConversaDaRefeicao } from "@/central/components/ConversaDaRefeicao";
import { Icone } from "@/central/components/Icone";
import type { ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import { alimentosDaRefeicao, naoLidasDaRefeicao } from "@/central/utils/conversaDaRefeicao";
import { TextoComLinks } from "@/central/components/TextoComLinks";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { useNavigate } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Esqueleto } from "@/central/components/Esqueleto";

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
  const navegar = useNavigate();
  const { acesso } = useSessao();
  // A conversa por refeição: qual está aberta, e as "não lidas" de cada uma.
  const [conversa, definirConversa] = useState<RefeicaoProtocolo | null>(null);
  const [resumo, definirResumo] = useState<ResumoDaConversa[]>([]);
  const recarregarResumo = useCallback(() => {
    void repositorio.resumoDasConversas(null).then(definirResumo).catch(() => definirResumo([]));
  }, []);
  useEffect(() => {
    recarregarResumo();
  }, [recarregarResumo]);

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
        {carregando && <Esqueleto />}

        {!carregando && !temRefeicoes && (
          <EstadoVazio
            icone="lista"
            titulo="Seu protocolo ainda não está aqui"
            descricao="Assim que sua nutricionista publicar o plano, ele aparece nesta tela."
          />
        )}

        {!carregando && temRefeicoes && conteudo && (
          <>
            {/* O atalho para a avaliação física, ao lado do protocolo. Só
                aparece quando existe uma publicada: uma porta que abre vazia
                faz a paciente achar que perdeu alguma coisa. */}
            {acesso.avaliacao && (
              <button
                type="button"
                className="c-lista-item"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => navegar(rotas.avaliacao)}
              >
                <span>
                  <span className="c-lista-item-nome">Minha avaliação física</span>
                  <span className="c-lista-item-apoio">
                    Peso, medidas, dobras e composição da última consulta
                  </span>
                </span>
                <span className="c-lista-item-direita">›</span>
              </button>
            )}

            {protocolo?.ajustes && (
              <div className="c-aviso c-aviso-ok" role="status">
                <span>
                  <TextoComLinks texto={protocolo.ajustes} />
                </span>
              </div>
            )}

            {conteudo.orientacoes.length > 0 && (
              <section className="c-secao">
                <h2 className="c-secao-titulo">Orientações gerais</h2>
                <ul className="c-orientacoes">
                  {conteudo.orientacoes.map((texto, i) => (
                    <li key={i}>
                      <TextoComLinks texto={texto} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {conteudo.refeicoes.map((refeicao, i) => (
              <Refeicao
                key={`${refeicao.nome}-${i}`}
                refeicao={refeicao}
                naoLidas={naoLidasDaRefeicao(resumo, refeicao.nome)}
                aoConversar={() => definirConversa(refeicao)}
              />
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
                          <TextoComLinks texto={p} />
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

      {conversa && (
        <ConversaDaRefeicao
          refeicao={conversa.nome}
          pacienteId={null}
          alimentos={alimentosDaRefeicao(conversa)}
          aoFechar={() => {
            definirConversa(null);
            recarregarResumo();
          }}
          aoMudar={recarregarResumo}
        />
      )}
    </>
  );
}

function Refeicao({
  refeicao,
  naoLidas,
  aoConversar,
}: {
  refeicao: RefeicaoProtocolo;
  naoLidas: number;
  aoConversar: () => void;
}) {
  const [escolhida, definirEscolhida] = useState(0);
  const opcoes = refeicao.opcoes;
  const opcao = opcoes[Math.min(escolhida, opcoes.length - 1)];
  if (!opcao) return null;

  return (
    <div className="c-refeicao-card">
      <div className="c-refeicao-cabecalho">
        <div className="c-refeicao-titulo">
          <h2>{refeicao.nome}</h2>
          {refeicao.horario && (
            <span className="c-refeicao-horario">{refeicao.horario}</span>
          )}
        </div>
        <button
          type="button"
          className="c-refeicao-conversar"
          onClick={aoConversar}
          aria-label={
            naoLidas > 0
              ? `Conversar sobre ${refeicao.nome}, ${naoLidas} mensagens novas`
              : `Conversar sobre ${refeicao.nome}`
          }
        >
          <Icone nome="conversa" tamanho={15} />
          {naoLidas > 0 && <span className="c-conversar-bolinha">{naoLidas}</span>}
        </button>
      </div>

      {opcoes.length > 1 && (
        <div className="c-refeicao-opcoes" role="tablist" aria-label={`Opções de ${refeicao.nome}`}>
          {opcoes.map((o, i) => (
            <button
              key={`${o.rotulo}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === escolhida}
              className={`c-refeicao-opcao ${i === escolhida ? "c-refeicao-opcao-ativa" : ""}`}
              onClick={() => definirEscolhida(i)}
            >
              {o.rotulo || `Opção ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="c-refeicao-itens">
        {opcao.itens.map((item, i) => (
          <div className="c-refeicao-item" key={`${item.alimento}-${i}`}>
            <div className="c-refeicao-item-principal">
              <span className="c-refeicao-item-ponto" aria-hidden="true" />
              <span className="c-refeicao-item-nome">{item.alimento}</span>
              {item.quantidade && (
                <span className="c-refeicao-item-qtd">{item.quantidade}</span>
              )}
            </div>
            {item.substituicoes.length > 0 && item.substituicoes.length <= 4 && (
              <div className="c-refeicao-trocas">
                <Icone nome="troca" tamanho={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{item.substituicoes.join(" · ")}</span>
              </div>
            )}
            {item.substituicoes.length > 4 && (
              <details className="c-refeicao-trocas-lista">
                <summary>
                  <Icone nome="troca" tamanho={12} style={{ flexShrink: 0 }} />
                  {item.substituicoes.length} substituições
                </summary>
                <ul>
                  {item.substituicoes.map((troca, j) => (
                    <li key={j}>{troca}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {opcao.notas.length > 0 && (
        <div className="c-refeicao-notas">
          {opcao.notas.map((nota, i) => (
            <p key={i}>
              <TextoComLinks texto={nota} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
