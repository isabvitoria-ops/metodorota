import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ItemProtocolo, Protocolo as ProtocoloAlimentar, RefeicaoProtocolo } from "@/central/types/protocolo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { ConversaDaRefeicao } from "@/central/components/ConversaDaRefeicao";
import { DocumentoProtocolo } from "@/central/components/DocumentoProtocolo";
import { Icone } from "@/central/components/Icone";
import { Esqueleto } from "@/central/components/Esqueleto";
import { TextoComLinks } from "@/central/components/TextoComLinks";
import type { ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import { alimentosDaRefeicao, naoLidasDaRefeicao } from "@/central/utils/conversaDaRefeicao";
import { fotosDoProtocolo } from "@/central/utils/fotosDoProtocolo";
import {
  iconeDaRefeicao,
  partirSubstituicao,
  proximaRefeicao,
  resumoDoProtocolo,
} from "@/central/utils/protocoloDaPaciente";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { abrirImpressao } from "@/central/utils/impressao";

/**
 * O protocolo alimentar — a tela mais aberta do aplicativo.
 *
 * A paciente entra aqui várias vezes por dia, quase sempre com uma pergunta
 * só: "o que eu como agora?". A tela é montada em volta dessa pergunta:
 *
 *   - uma barra com as refeições, para ir direto à que interessa;
 *   - a próxima refeição marcada, quando a nutricionista escreveu horários;
 *   - cada item com a quantidade ao lado e as trocas logo embaixo, uma por
 *     linha, sem precisar abrir nada;
 *   - a opção escolhida ("Hambúrguer") lembrada da próxima vez.
 *
 * O PROTOCOLO FICA GUARDADO NO APARELHO depois de aberto: no mercado ou no
 * restaurante, sem sinal, ele abre na última versão vista em vez de mostrar
 * uma tela vazia. Com rede, a versão nova entra por cima.
 *
 * A tela não calcula nem altera nada do plano: mostra o que foi publicado.
 */

type Estado = "carregando" | "pronto" | "sem-rede";

const chaveDoProtocolo = (perfilId: string | null) => `central:protocolo:v1:${perfilId ?? "anonimo"}`;
const chaveDasOpcoes = (perfilId: string | null) => `central:protocolo-opcoes:v1:${perfilId ?? "anonimo"}`;

function lerGuardado<T>(chave: string): T | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function guardar(chave: string, valor: unknown) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento, a tela só abre com internet */
  }
}

/** O que veio do aparelho só vale se ainda tiver a forma de um protocolo. */
function protocoloValido(p: ProtocoloAlimentar | null): p is ProtocoloAlimentar {
  return Boolean(p && p.conteudo && Array.isArray(p.conteudo.refeicoes) && Array.isArray(p.conteudo.orientacoes));
}

function minutosDeAgora(): number {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

export function Protocolo() {
  const navegar = useNavigate();
  const { acesso } = useSessao();
  const chave = chaveDoProtocolo(acesso.perfilId);

  const [protocolo, definirProtocolo] = useState<ProtocoloAlimentar | null>(() => {
    const guardado = lerGuardado<ProtocoloAlimentar>(chave);
    return protocoloValido(guardado) ? guardado : null;
  });
  const [estado, definirEstado] = useState<Estado>("carregando");
  const [fotos, definirFotos] = useState<Record<string, string>>({});
  // O documento do PDF fica PRONTO antes do toque — montado fora da tela, com
  // as fotos já baixadas — e o botão só chama a impressão. No iPhone, a tela
  // de imprimir só abre se for chamada NA HORA do toque: baixar as fotos
  // depois do toque fazia o aparelho ignorar o pedido, e o botão ficava
  // apagado sem nada acontecer.
  const [pdfPronto, definirPdfPronto] = useState(false);
  const [pediuPdf, definirPediuPdf] = useState(false);

  // A conversa por refeição: qual está aberta, e as "não lidas" de cada uma.
  const [conversa, definirConversa] = useState<RefeicaoProtocolo | null>(null);
  const [resumo, definirResumo] = useState<ResumoDaConversa[]>([]);
  const recarregarResumo = useCallback(() => {
    void repositorio.resumoDasConversas(null).then(definirResumo).catch(() => definirResumo([]));
  }, []);
  useEffect(() => {
    recarregarResumo();
  }, [recarregarResumo]);

  const carregar = useCallback(() => {
    definirEstado("carregando");
    return repositorio
      .meuProtocolo()
      .then((novo) => {
        definirProtocolo(novo);
        guardar(chave, novo);
        definirEstado("pronto");
      })
      .catch(() => definirEstado("sem-rede"));
  }, [chave]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const conteudo = protocolo?.conteudo ?? null;
  const refeicoes = useMemo(() => conteudo?.refeicoes ?? [], [conteudo]);
  const temRefeicoes = refeicoes.length > 0;

  // As fotos do PDF são baixadas assim que o protocolo chega. Foto que não
  // abre fica de fora (`fotosDoProtocolo` nunca lança), e o botão libera do
  // mesmo jeito.
  useEffect(() => {
    if (!conteudo) return;
    let vivo = true;
    definirPdfPronto(false);
    void fotosDoProtocolo(conteudo)
      .then((mapa) => vivo && definirFotos(mapa))
      .catch(() => undefined)
      .finally(() => vivo && definirPdfPronto(true));
    return () => {
      vivo = false;
    };
  }, [conteudo]);
  // Recalculado a cada vez que a tela é montada: a paciente abre o app na hora de comer.
  const proxima = useMemo(() => proximaRefeicao(refeicoes, minutosDeAgora()), [refeicoes]);

  const secoes = useMemo(() => {
    if (!conteudo) return [];
    return [
      ...(conteudo.orientacoes.length > 0 ? [{ id: "prot-orientacoes", rotulo: "Orientações" }] : []),
      ...refeicoes.map((r, i) => ({ id: `prot-refeicao-${i}`, rotulo: r.nome })),
      ...(conteudo.secoes.length > 0 ? [{ id: "prot-rotina", rotulo: "Rotina" }] : []),
    ];
  }, [conteudo, refeicoes]);

  const visivel = useSecaoVisivel(secoes.map((s) => s.id));

  return (
    <>
      <CabecalhoPagina titulo="Protocolo Alimentar" voltarPara={rotas.home} />

      <div className="c-conteudo c-prot">
        {!protocolo && estado === "carregando" && <Esqueleto />}

        {!protocolo && estado === "sem-rede" && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>Não consegui abrir o seu protocolo agora. Confira a internet e tente de novo.</span>
            <button type="button" className="c-botao c-botao-pequeno" onClick={() => void carregar()}>
              Tentar de novo
            </button>
          </div>
        )}

        {estado === "pronto" && !temRefeicoes && (
          <EstadoVazio
            icone="lista"
            titulo="Seu protocolo ainda não está aqui"
            descricao="Assim que sua nutricionista publicar o plano, ele aparece nesta tela."
          />
        )}

        {protocolo && conteudo && temRefeicoes && (
          <>
            <header className="c-prot-capa">
              <p className="c-prot-capa-sobre">Seu plano</p>
              <h2 className="c-prot-capa-titulo">{protocolo.titulo || "Protocolo alimentar"}</h2>
              <p className="c-prot-capa-meta">{resumoDoProtocolo(protocolo)}</p>
              <div className="c-prot-capa-acoes">
                <button
                  type="button"
                  className="c-prot-acao"
                  disabled={!pdfPronto}
                  onClick={() => {
                    abrirImpressao();
                    definirPediuPdf(true);
                  }}
                >
                  <Icone nome="documentos" tamanho={17} />
                  {pdfPronto ? "Baixar em PDF" : "Preparando…"}
                </button>
                {/* Só aparece quando existe uma avaliação publicada: uma porta
                    que abre vazia faz a paciente achar que perdeu alguma coisa. */}
                {acesso.avaliacao && (
                  <button type="button" className="c-prot-acao" onClick={() => navegar(rotas.avaliacao)}>
                    <Icone nome="balanca" tamanho={17} />
                    Avaliação física
                  </button>
                )}
              </div>
              {/* Depois do toque, e só depois: o caminho de reserva. Não dá
                  para saber, de dentro da página, se a tela de salvar abriu —
                  então a frase é condicional, e leva ao mesmo PDF. */}
              {pediuPdf && (
                <p className="c-prot-capa-reserva" role="status">
                  Se a tela de salvar não abrir, o mesmo PDF está em{" "}
                  <button type="button" onClick={() => navegar(rotas.documentos)}>
                    Meus documentos
                  </button>
                  .
                </p>
              )}
            </header>

            {estado === "sem-rede" && (
              <p className="c-prot-offline" role="status">
                Sem conexão: esta é a última versão aberta neste aparelho.
              </p>
            )}

            {protocolo.ajustes && (
              <div className="c-prot-ajuste" role="status">
                <strong>Ajuste da semana</strong>
                <span>
                  <TextoComLinks texto={protocolo.ajustes} />
                </span>
              </div>
            )}

            {secoes.length > 2 && (
              <nav className="c-prot-nav" aria-label="Partes do protocolo">
                {secoes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`c-prot-nav-item ${visivel === s.id ? "c-prot-nav-item--ativo" : ""}`}
                    aria-current={visivel === s.id ? "true" : undefined}
                    onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {s.rotulo}
                  </button>
                ))}
              </nav>
            )}

            {conteudo.orientacoes.length > 0 && (
              <section id="prot-orientacoes" className="c-prot-bloco">
                <h2 className="c-prot-bloco-titulo">Orientações gerais</h2>
                <ul className="c-prot-orientacoes">
                  {conteudo.orientacoes.map((texto, i) => (
                    <li key={i}>
                      <Icone nome="feito" tamanho={16} aria-hidden="true" />
                      <span>
                        <TextoComLinks texto={texto} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {refeicoes.map((refeicao, i) => (
              <Refeicao
                key={`${refeicao.nome}-${i}`}
                id={`prot-refeicao-${i}`}
                refeicao={refeicao}
                proxima={proxima === i}
                chaveDasOpcoes={chaveDasOpcoes(acesso.perfilId)}
                naoLidas={naoLidasDaRefeicao(resumo, refeicao.nome)}
                aoConversar={() => definirConversa(refeicao)}
              />
            ))}

            <button type="button" className="c-prot-troca" onClick={() => navegar(rotas.trocas)}>
              <span className="c-prot-troca-icone">
                <Icone nome="troca" tamanho={18} />
              </span>
              <span>
                <strong>Quer trocar por outro alimento?</strong>
                <span>A Troca Inteligente calcula a quantidade certa para você.</span>
              </span>
              <Icone nome="seta" tamanho={18} />
            </button>

            {conteudo.secoes.length > 0 && (
              <section id="prot-rotina" className="c-prot-bloco">
                <h2 className="c-prot-bloco-titulo">Orientações de rotina</h2>
                <div className="c-prot-rotina">
                  {conteudo.secoes.map((secao, i) => (
                    <details key={i} className="c-prot-sanfona">
                      <summary>{secao.titulo}</summary>
                      {secao.paragrafos.map((p, j) => (
                        <p key={j}>
                          <TextoComLinks texto={p} />
                        </p>
                      ))}
                    </details>
                  ))}
                </div>
              </section>
            )}

            <p className="c-prot-rodape">
              Plano montado pela sua nutricionista. Em caso de dúvida, fale com ela antes de trocar qualquer coisa por conta.
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

      {protocolo && conteudo && temRefeicoes && (
        <DocumentoProtocolo paciente={acesso.nome ?? "Paciente"} protocolo={protocolo} conteudo={conteudo} fotos={fotos} />
      )}
    </>
  );
}

/**
 * Qual parte do protocolo está na tela, para acender o item certo da barra.
 * Vale a primeira seção cujo topo já passou da barra e que ainda não saiu.
 */
function useSecaoVisivel(ids: string[]): string | null {
  const [visivel, definirVisivel] = useState<string | null>(null);
  const chave = ids.join("|");
  const lista = useRef(ids);
  lista.current = ids;

  useEffect(() => {
    if (lista.current.length === 0 || typeof IntersectionObserver === "undefined") return;
    const naTela = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) naTela.add(e.target.id);
          else naTela.delete(e.target.id);
        }
        definirVisivel(lista.current.find((id) => naTela.has(id)) ?? null);
      },
      // A faixa de cima desconta a barra fixa; a de baixo evita acender a
      // seção que só apontou no pé da tela.
      { rootMargin: "-72px 0px -55% 0px" },
    );
    for (const id of lista.current) {
      const el = document.getElementById(id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [chave]);

  return visivel;
}

function Refeicao({
  id,
  refeicao,
  proxima,
  chaveDasOpcoes: chave,
  naoLidas,
  aoConversar,
}: {
  id: string;
  refeicao: RefeicaoProtocolo;
  proxima: boolean;
  chaveDasOpcoes: string;
  naoLidas: number;
  aoConversar: () => void;
}) {
  const opcoes = refeicao.opcoes;
  // A opção escolhida é lembrada pelo RÓTULO: se a nutricionista reordenar as
  // opções, "Hambúrguer" continua sendo "Hambúrguer".
  const [escolhida, definirEscolhida] = useState(() => {
    const lembradas = lerGuardado<Record<string, string>>(chave) ?? {};
    const indice = opcoes.findIndex((o) => o.rotulo && o.rotulo === lembradas[refeicao.nome]);
    return indice >= 0 ? indice : 0;
  });
  const opcao = opcoes[Math.min(escolhida, opcoes.length - 1)];
  if (!opcao) return null;

  function escolher(i: number) {
    definirEscolhida(i);
    const rotulo = opcoes[i]?.rotulo;
    if (!rotulo) return;
    guardar(chave, { ...(lerGuardado<Record<string, string>>(chave) ?? {}), [refeicao.nome]: rotulo });
  }

  return (
    <section id={id} className={`c-prot-refeicao ${proxima ? "c-prot-refeicao--proxima" : ""}`}>
      <header className="c-prot-refeicao-topo">
        <span className="c-prot-refeicao-icone" aria-hidden="true">
          <Icone nome={iconeDaRefeicao(refeicao.nome)} tamanho={20} />
        </span>
        <div className="c-prot-refeicao-nome">
          <h2>{refeicao.nome}</h2>
          {(refeicao.horario || proxima) && (
            <p>
              {refeicao.horario && (
                <span className="c-prot-horario">
                  <Icone nome="relogio" tamanho={12} />
                  {refeicao.horario}
                </span>
              )}
              {proxima && <span className="c-prot-selo">Próxima</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          className="c-refeicao-conversar"
          onClick={aoConversar}
          aria-label={
            naoLidas > 0 ? `Conversar sobre ${refeicao.nome}, ${naoLidas} mensagens novas` : `Conversar sobre ${refeicao.nome}`
          }
        >
          <Icone nome="conversa" tamanho={16} />
          {naoLidas > 0 && <span className="c-conversar-bolinha">{naoLidas}</span>}
        </button>
      </header>

      {opcoes.length > 1 && (
        <div className="c-refeicao-opcoes" role="tablist" aria-label={`Opções de ${refeicao.nome}`}>
          {opcoes.map((o, i) => (
            <button
              key={`${o.rotulo}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === escolhida}
              className={`c-refeicao-opcao ${i === escolhida ? "c-refeicao-opcao-ativa" : ""}`}
              onClick={() => escolher(i)}
            >
              {o.rotulo || `Opção ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <ul className="c-prot-itens">
        {opcao.itens.map((item, i) => (
          <Item key={`${item.alimento}-${i}`} item={item} />
        ))}
      </ul>

      {opcao.notas.length > 0 && (
        <div className="c-prot-notas">
          {opcao.notas.map((nota, i) => (
            <p key={i}>
              <TextoComLinks texto={nota} />
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Até aqui as trocas ficam abertas; acima disso a lista dobra, para o item não virar uma página. */
const TROCAS_A_VISTA = 3;

function Item({ item }: { item: ItemProtocolo }) {
  const [aberto, definirAberto] = useState(false);
  const trocas = item.substituicoes.filter((t) => t.trim() !== "");
  const visiveis = aberto ? trocas : trocas.slice(0, TROCAS_A_VISTA);

  return (
    <li className="c-prot-item">
      <div className="c-prot-item-linha">
        <span className="c-prot-item-nome">{item.alimento}</span>
        {item.quantidade && <span className="c-prot-item-qtd">{item.quantidade}</span>}
      </div>

      {item.imagem && <FotoInline item={item} />}

      {item.link && (
        <a href={item.link} target="_blank" rel="noreferrer noopener" className="c-link-externo c-prot-item-link">
          <Icone nome="link" tamanho={13} /> Ver produto
        </a>
      )}

      {trocas.length > 0 && (
        <div className="c-prot-trocas">
          <p className="c-prot-trocas-rotulo">
            <Icone nome="troca" tamanho={13} aria-hidden="true" />
            Pode trocar por
          </p>
          <ul>
            {visiveis.map((troca, i) => {
              const { alimento, quantidade } = partirSubstituicao(troca);
              return (
                <li key={i}>
                  <span>{alimento}</span>
                  {quantidade && <span className="c-prot-trocas-qtd">{quantidade}</span>}
                </li>
              );
            })}
          </ul>
          {trocas.length > TROCAS_A_VISTA && (
            <button type="button" className="c-prot-trocas-mais" aria-expanded={aberto} onClick={() => definirAberto(!aberto)}>
              {aberto ? "Mostrar menos" : `Ver as ${trocas.length} trocas`}
            </button>
          )}
        </div>
      )}
    </li>
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
    return () => {
      ativo = false;
    };
  }, [item.imagem]);

  if (!url) return null;

  return (
    <div className="c-refeicao-foto">
      <img src={url} alt={item.alimento} loading="lazy" />
    </div>
  );
}
