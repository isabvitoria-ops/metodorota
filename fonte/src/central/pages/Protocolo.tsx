import { useCallback, useEffect, useState } from "react";
import type { ItemProtocolo, Protocolo as ProtocoloAlimentar, RefeicaoProtocolo } from "@/central/types/protocolo";
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

const EMOJI_REFEICAO: [RegExp, string][] = [
  [/caf[eé]\s*(da)?\s*manh[aã]|desjejum/i, "☀️"],
  [/lanche\s*(da)?\s*manh[aã]/i, "🍎"],
  [/almo[cç]o/i, "🍽️"],
  [/lanche\s*(da)?\s*tarde/i, "☕"],
  [/jant(a|ar)/i, "🌙"],
  [/ceia/i, "✨"],
  [/pr[eé][\s-]*treino/i, "💪"],
  [/p[oó]s[\s-]*treino/i, "🏋️"],
  [/colac[aã]o|col[aá][çc][aã]o/i, "🧃"],
];

function emojiDaRefeicao(nome: string): string {
  for (const [padrao, emoji] of EMOJI_REFEICAO) {
    if (padrao.test(nome)) return emoji;
  }
  return "🥗";
}

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
              <div className="c-refeicao-card" style={{ marginTop: 20 }}>
                <div className="c-refeicao-cabecalho">
                  <span className="c-refeicao-emoji" aria-hidden="true">📋</span>
                  <div className="c-refeicao-titulo">
                    <h2>Orientações gerais</h2>
                  </div>
                </div>
                <ul className="c-orientacoes-card">
                  {conteudo.orientacoes.map((texto, i) => (
                    <li key={i}>
                      <span className="c-orientacao-check" aria-hidden="true">✅</span>
                      <span><TextoComLinks texto={texto} /></span>
                    </li>
                  ))}
                </ul>
              </div>
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
              <div className="c-refeicao-card" style={{ marginTop: 20 }}>
                <div className="c-refeicao-cabecalho">
                  <span className="c-refeicao-emoji" aria-hidden="true">💡</span>
                  <div className="c-refeicao-titulo">
                    <h2>Orientações de rotina</h2>
                  </div>
                </div>
                <div className="c-rotina-lista">
                  {conteudo.secoes.map((secao, i) => (
                    <details key={i} className="c-rotina-sanfona">
                      <summary>{secao.titulo}</summary>
                      {secao.paragrafos.map((p, j) => (
                        <p key={j} className="c-sanfona-texto">
                          <TextoComLinks texto={p} />
                        </p>
                      ))}
                    </details>
                  ))}
                </div>
              </div>
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

  const emoji = emojiDaRefeicao(refeicao.nome);

  return (
    <div className="c-refeicao-card">
      <div className="c-refeicao-cabecalho">
        <span className="c-refeicao-emoji" aria-hidden="true">{emoji}</span>
        <div className="c-refeicao-titulo">
          <h2>{refeicao.nome}</h2>
          {refeicao.horario && (
            <span className="c-refeicao-horario">
              <Icone nome="relogio" tamanho={11} />
              {refeicao.horario}
            </span>
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
            {item.imagem && <FotoInline item={item} />}
            {item.link && (
              <div className="c-refeicao-link">
                <a href={item.link} target="_blank" rel="noreferrer noopener" className="c-link-externo">
                  <Icone nome="link" tamanho={12} /> Ver produto
                </a>
              </div>
            )}
            {item.substituicoes.length > 0 && item.substituicoes.length <= 4 && (
              <div className="c-refeicao-trocas">
                <span className="c-refeicao-trocas-icone" aria-hidden="true">🔄</span>
                <span>{item.substituicoes.join(" · ")}</span>
              </div>
            )}
            {item.substituicoes.length > 4 && (
              <details className="c-refeicao-trocas-lista">
                <summary>
                  <span aria-hidden="true">🔄</span>
                  {item.substituicoes.length} substituicoes
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
              <span className="c-refeicao-nota-icone" aria-hidden="true">📝</span>
              <TextoComLinks texto={nota} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function FotoInline({ item }: { item: ItemProtocolo }) {
  const [url, definirUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!item.imagem) return;
    if (/^https?:\/\//.test(item.imagem)) {
      definirUrl(item.imagem);
      return;
    }
    let ativo = true;
    repositorio
      .enderecoFotoProtocolo(item.imagem)
      .then((u) => ativo && definirUrl(u))
      .catch(() => ativo && definirUrl(null));
    return () => { ativo = false; };
  }, [item.imagem]);

  if (!url) return null;

  return (
    <div className="c-refeicao-foto">
      <img src={url} alt={item.alimento} loading="lazy" />
    </div>
  );
}
