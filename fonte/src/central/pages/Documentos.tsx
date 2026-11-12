import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ConteudoProtocolo, MinhaAvaliacao, Protocolo } from "@/central/types/protocolo";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Exames } from "@/central/components/Exames";
import { DocumentoAvaliacao } from "@/central/components/DocumentoAvaliacao";
import { DocumentoProtocolo } from "@/central/components/DocumentoProtocolo";
import { DocumentoRastreio } from "@/central/components/DocumentoRastreio";
import { Icone } from "@/central/components/Icone";
import { fotosDoProtocolo } from "@/central/utils/fotosDoProtocolo";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Esqueleto } from "@/central/components/Esqueleto";
import { abrirImpressao } from "@/central/utils/impressao";
import { pedidoDePdf } from "@/central/utils/pedidoDePdf";
import { gerarPdfDoDocumento } from "@/central/utils/pdf/gerarPdfDoDocumento";
import { CRN_DA_NUTRICIONISTA, INSTAGRAM_DA_MARCA, TELEFONE_DA_MARCA } from "@/central/utils/marcaDosDocumentos";

/**
 * Meus documentos — a central de onde saem os PDFs.
 *
 * O QUE ELA É: um lugar só para os documentos que a paciente pode guardar e
 * imprimir. O que ela NÃO é: uma segunda versão dos dados. Cada documento
 * representa o que já existe no aplicativo — o protocolo publicado, a
 * avaliação lançada, o rastreio registrado. Gerar o PDF não altera nada.
 *
 * COMO O PDF SAI: pelo "Salvar como PDF" do próprio navegador. Sem
 * biblioteca: uma custaria centenas de kilobytes no celular dela para fazer
 * pior — o diálogo do sistema respeita a fonte, a quebra de página e a
 * impressora de verdade.
 *
 * UM DE CADA VEZ, e é o detalhe que faz a tela funcionar: os três
 * documentos usam a mesma classe `.doc`, que a folha de impressão manda
 * aparecer. Montados juntos, o "Gerar PDF" do protocolo sairia com os três
 * grudados. Então só o escolhido é montado.
 *
 * CRESCE SEM REFORMA: acrescentar exames, orientações ou um relatório novo
 * é acrescentar uma entrada em `DOCUMENTOS` e um componente ao lado.
 */
type Qual = "protocolo" | "avaliacao" | "rastreio";

/**
 * O arquivo PDF de um documento, do pedido até ficar pronto para salvar.
 *
 * O aplicativo MONTA o arquivo, em vez de abrir a tela de imprimir do
 * aparelho: no iPhone, com o app instalado na tela inicial, essa tela não
 * existe — o toque não fazia nada, em tela nenhuma.
 */
type Pdf =
  | { qual: Qual; estado: "montando"; pagina: number; total: number }
  | { qual: Qual; estado: "pronto"; arquivo: File; url: string }
  | { qual: Qual; estado: "erro" };

/** Espera o documento entrar na página (ele é montado em dois tempos). */
function esperarDocumento(prazoMs = 4000): Promise<HTMLElement | null> {
  return new Promise((resolver) => {
    const inicio = Date.now();
    const olhar = () => {
      const folha = document.querySelector<HTMLElement>(".folha-documento");
      if (folha?.querySelector(".doc")) return resolver(folha);
      if (Date.now() - inicio > prazoMs) return resolver(null);
      requestAnimationFrame(olhar);
    };
    olhar();
  });
}

/** O aparelho sabe entregar um arquivo pela tela de compartilhar? */
function podeCompartilhar(arquivo: File): boolean {
  try {
    return typeof navigator.share === "function" && navigator.canShare?.({ files: [arquivo] }) === true;
  } catch {
    return false;
  }
}

/** App aberto pelo ícone da tela inicial: ali a tela de imprimir não existe. */
function appInstalado(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const NOME_DO_DOCUMENTO: Record<Qual, string> = {
  protocolo: "Protocolo Alimentar",
  avaliacao: "Avaliação Física",
  rastreio: "Rastreabilidade Alimentar",
};

interface Dados {
  protocolo: Protocolo | null;
  conteudo: ConteudoProtocolo | null;
  avaliacao: MinhaAvaliacao | null;
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
  semana: number;
}

export function Documentos() {
  const { acesso, configuracoes } = useSessao();
  const [dados, definirDados] = useState<Dados | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [imprimindo, definirImprimindo] = useState<Qual | null>(null);
  const [fotos, definirFotos] = useState<Record<string, string>>({});
  const [pdf, definirPdf] = useState<Pdf | null>(null);
  // O endereço do arquivo pronto ocupa memória até ser solto.
  const urlDoPdf = pdf?.estado === "pronto" ? pdf.url : null;
  useEffect(() => {
    if (!urlDoPdf) return;
    return () => URL.revokeObjectURL(urlDoPdf);
  }, [urlDoPdf]);
  // O pedido que veio de outra tela ("Baixar em PDF" no protocolo ou na
  // avaliação). Lido UMA vez, na chegada: voltar a esta tela ou recarregar
  // não abre a tela de imprimir de novo.
  const local = useLocation();
  const navegar = useNavigate();
  const [pedido] = useState<Qual | null>(() => pedidoDePdf(local.state));
  const pedidoCumprido = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      // Os três juntos: em série, a tela montaria aos pedaços no celular.
      // E cada um cai sozinho — quem não tem protocolo ainda tem avaliação.
      const [protocolo, avaliacao, reintroducao] = await Promise.all([
        repositorio.meuProtocolo().catch(() => null),
        repositorio.minhaAvaliacao().catch(() => null),
        repositorio.minhaReintroducao().catch(() => null),
      ]);
      if (!vivo) return;
      definirDados({
        protocolo,
        conteudo: protocolo?.conteudo ?? null,
        avaliacao,
        itens: reintroducao?.itens ?? [],
        registros: reintroducao?.registros ?? [],
        semana: reintroducao?.semanaAtual ?? 1,
      });
      definirCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Monta o documento e manda imprimir — nessa ordem, e só desmonta depois.
   *
   * DOIS DETALHES, e os dois produzem FOLHA EM BRANCO quando ignorados:
   *
   *   * `window.print()` chamado no mesmo quadro em que o documento é
   *     montado abre o diálogo antes de o navegador ter desenhado. Daí o
   *     `requestAnimationFrame` duplo — um quadro para o React aplicar a
   *     mudança, outro para o navegador desenhar;
   *   * `window.print()` NÃO espera o diálogo fechar em vários navegadores
   *     (no Safari do iPhone, em particular): ele volta na hora. Desmontar
   *     o documento na linha seguinte o tirava da página antes de o
   *     diálogo lê-lo, e o PDF saía em branco. Quem avisa que acabou é o
   *     evento `afterprint`.
   *
   * O prazo de 60 segundos é a rede de segurança: se um navegador não
   * disparar `afterprint`, o documento sai sozinho em vez de ficar montado
   * para sempre — invisível na tela, mas pesando em toda impressão
   * seguinte.
   */
  async function gerar(qual: Qual) {
    // As fotinhas do protocolo são baixadas ANTES: o PDF imprime o que já está
    // carregado, e uma foto ainda baixando sairia como um buraco.
    if (qual === "protocolo") definirFotos(await fotosDoProtocolo(dados?.conteudo ?? null));
    definirImprimindo(qual);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let jaSaiu = false;
        const limpar = () => {
          if (jaSaiu) return;
          jaSaiu = true;
          window.removeEventListener("afterprint", limpar);
          clearTimeout(prazo);
          definirImprimindo(null);
        };
        const prazo = setTimeout(limpar, 60_000);
        window.addEventListener("afterprint", limpar);
        // Os dois quadros bastam quando o pedido vem de um toque nesta tela.
        // Quando vem de OUTRA tela (o "Baixar em PDF" do protocolo, da
        // avaliação ou do rastreio), o documento pode levar mais um ou dois
        // quadros para entrar na página — e imprimir antes disso dá folha em
        // branco. Então: se ele ainda não está lá, espera mais um pouco.
        let tentativas = 0;
        const imprimirQuandoMontado = () => {
          const montado = document.querySelector(".folha-documento .doc") !== null;
          if (montado || tentativas >= 90) {
            if (montado && tentativas > 0) requestAnimationFrame(() => abrirImpressao());
            else abrirImpressao();
            return;
          }
          tentativas += 1;
          requestAnimationFrame(imprimirQuandoMontado);
        };
        imprimirQuandoMontado();
      });
    });
  }

  /**
   * Monta o arquivo PDF do documento escolhido.
   *
   * O documento é montado na página (invisível), copiado e desenhado folha a
   * folha — ver `gerarPdfDoDocumento`. Não precisa do toque da pessoa para
   * começar: por isso o "Baixar em PDF" das outras telas pode trazer para cá
   * e o arquivo já vai sendo montado. Entregar o arquivo, sim, é com um
   * toque dela (os botões do cartão), que é o que o aparelho exige.
   */
  async function montarPdf(qual: Qual) {
    if (pdf?.estado === "montando") return;
    definirPdf({ qual, estado: "montando", pagina: 0, total: 0 });
    try {
      if (qual === "protocolo") definirFotos(await fotosDoProtocolo(dados?.conteudo ?? null));
      definirImprimindo(qual);
      const folha = await esperarDocumento();
      if (!folha) throw new Error("O documento não ficou pronto.");
      const nome = `${NOME_DO_DOCUMENTO[qual]} — ${acesso.nome ?? "Paciente"}`;
      const blob = await gerarPdfDoDocumento({
        folha,
        titulo: nome,
        assinatura: [
          `${configuracoes.nomeNutricionista || "Isabela Marçal"} · Nutricionista`,
          `${CRN_DA_NUTRICIONISTA} · ${INSTAGRAM_DA_MARCA} · ${TELEFONE_DA_MARCA}`,
        ],
        aoAvancar: (pagina, total) => definirPdf({ qual, estado: "montando", pagina, total }),
      });
      const arquivo = new File([blob], `${nome.replace(" — ", " - ")}.pdf`, { type: "application/pdf" });
      definirPdf({ qual, estado: "pronto", arquivo, url: URL.createObjectURL(arquivo) });
    } catch {
      definirPdf({ qual, estado: "erro" });
    } finally {
      definirImprimindo(null);
    }
  }

  // Cumpre o pedido que veio de outra tela assim que os dados chegam: o
  // arquivo começa a ser montado sozinho, e o cartão fica destacado.
  const podeCumprir =
    !carregando &&
    pedido !== null &&
    ((pedido === "protocolo" && Boolean(dados?.conteudo && dados.conteudo.refeicoes.length > 0)) ||
      (pedido === "avaliacao" && Boolean(dados?.avaliacao)) ||
      (pedido === "rastreio" && (dados?.registros.length ?? 0) > 0));
  useEffect(() => {
    if (!podeCumprir || pedido === null || pedidoCumprido.current) return;
    pedidoCumprido.current = true;
    // Tira o pedido do histórico: o "voltar" do aparelho não deve repeti-lo.
    navegar(".", { replace: true, state: null });
    void montarPdf(pedido);
    // `montarPdf` lê `dados`, que já chegou quando `podeCumprir` vira verdadeiro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeCumprir, pedido]);

  const paciente = acesso.nome ?? "Paciente";
  const nutri = configuracoes.nomeNutricionista;

  const temProtocolo = Boolean(dados?.conteudo && dados.conteudo.refeicoes.length > 0);
  const temAvaliacao = Boolean(dados?.avaliacao);
  const temRastreio = (dados?.registros.length ?? 0) > 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Meus documentos"
        descricao="Para visualizar, imprimir e guardar."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {carregando && <Esqueleto />}

        {!carregando && !temProtocolo && !temAvaliacao && !temRastreio && (
          <div className="c-bloco">
            <p className="c-item-protocolo-nome">Ainda não há documentos</p>
            <p className="c-dica" style={{ marginTop: 6 }}>
              Assim que sua nutricionista publicar o protocolo ou lançar uma avaliação, eles
              aparecem aqui para você guardar. Seus exames você já pode guardar abaixo.
            </p>
          </div>
        )}

        {!carregando && (
          <>
            {pedido && podeCumprir && (
              <div className="c-aviso c-aviso-ok c-doc-pedido" role="status">
                <span>
                  Montando o PDF de <strong>{NOME_DO_DOCUMENTO[pedido]}</strong>. Quando ficar pronto, os botões
                  para salvar aparecem no cartão logo abaixo.
                </span>
              </div>
            )}
            <Cartao
              destaque={pedido === "protocolo"}
              icone="lista"
              titulo="Protocolo Alimentar"
              descricao={
                temProtocolo
                  ? "Seu plano, com as quantidades e as trocas de cada item."
                  : "Aparece aqui quando sua nutricionista publicar."
              }
              disponivel={temProtocolo}
              pdf={pdf?.qual === "protocolo" ? pdf : null}
              ocupado={pdf?.estado === "montando"}
              aoGerar={() => void montarPdf("protocolo")}
              aoImprimir={appInstalado() ? null : () => void gerar("protocolo")}
            />
            <Cartao
              destaque={pedido === "avaliacao"}
              icone="balanca"
              titulo="Avaliação Física"
              descricao={
                temAvaliacao
                  ? "Medidas, dobras e a evolução entre as consultas."
                  : "Aparece aqui quando sua nutricionista lançar a primeira."
              }
              disponivel={temAvaliacao}
              pdf={pdf?.qual === "avaliacao" ? pdf : null}
              ocupado={pdf?.estado === "montando"}
              aoGerar={() => void montarPdf("avaliacao")}
              aoImprimir={appInstalado() ? null : () => void gerar("avaliacao")}
            />
            <Cartao
              destaque={pedido === "rastreio"}
              icone="folha"
              titulo="Rastreabilidade Alimentar"
              descricao={
                temRastreio
                  ? "Seu mapa de tolerância, com espaço para os próximos testes."
                  : "Aparece aqui depois do seu primeiro registro."
              }
              disponivel={temRastreio}
              pdf={pdf?.qual === "rastreio" ? pdf : null}
              ocupado={pdf?.estado === "montando"}
              aoGerar={() => void montarPdf("rastreio")}
              aoImprimir={appInstalado() ? null : () => void gerar("rastreio")}
            />

            <p className="c-dica" style={{ marginTop: 18 }}>
              O PDF é montado aqui mesmo, no seu aparelho. No celular, toque em “Salvar ou
              compartilhar” e escolha “Salvar em Arquivos”, ou mande para onde quiser. No
              computador, “Baixar”.
            </p>
          </>
        )}

        {/* Os exames vêm depois dos PDFs que o aplicativo gera: aqueles são
            o que ela RECEBE, este é o que ela GUARDA. */}
        <Exames pacienteId={null} />
      </div>

      {/* Só o escolhido é montado. Ver o comentário do componente. */}
      {imprimindo === "protocolo" && dados && (
        <DocumentoProtocolo
          paciente={paciente}
          protocolo={dados.protocolo}
          conteudo={dados.conteudo}
          nutricionista={nutri}
          fotos={fotos}
        />
      )}
      {imprimindo === "avaliacao" && dados && (
        <DocumentoAvaliacao
          paciente={paciente}
          avaliacao={dados.avaliacao}
          nutricionista={nutri}
        />
      )}
      {imprimindo === "rastreio" && dados && (
        <DocumentoRastreio
          paciente={paciente}
          semana={dados.semana}
          itens={dados.itens}
          registros={dados.registros}
          nutricionista={nutri}
        />
      )}
    </>
  );
}

function Cartao({
  icone,
  titulo,
  descricao,
  disponivel,
  aoGerar,
  aoImprimir,
  pdf,
  ocupado,
  destaque = false,
}: {
  /** Veio de outra tela pedindo este documento: o cartão fica marcado. */
  destaque?: boolean;
  icone: string;
  titulo: string;
  descricao: string;
  disponivel: boolean;
  aoGerar: () => void;
  /** A tela de imprimir do navegador. Nula no app instalado, onde ela não existe. */
  aoImprimir: (() => void) | null;
  /** O PDF DESTE documento, se está sendo montado ou já ficou pronto. */
  pdf: Pdf | null;
  /** Algum PDF está sendo montado (deste ou de outro cartão): um de cada vez. */
  ocupado: boolean;
}) {
  const [recado, definirRecado] = useState<string | null>(null);

  async function compartilhar(arquivo: File) {
    definirRecado(null);
    try {
      await navigator.share({ files: [arquivo], title: titulo });
    } catch (e) {
      // Fechar a tela de compartilhar sem escolher nada não é erro.
      if (e instanceof DOMException && e.name === "AbortError") return;
      definirRecado("Não consegui abrir a tela de compartilhar. Use “Baixar”.");
    }
  }

  return (
    <div className={`c-bloco c-doc-cartao${disponivel ? "" : " c-doc-vazio"}${destaque && disponivel ? " c-doc-destaque" : ""}`}>
      <div className="c-doc-linha">
        <span className="c-atalho-icone">
          <Icone nome={icone} tamanho={20} />
        </span>
        <div>
          <p className="c-item-protocolo-nome">{titulo}</p>
          <p className="c-dica" style={{ marginTop: 2 }}>
            {descricao}
          </p>
        </div>
      </div>

      {disponivel && pdf?.estado !== "pronto" && (
        <div className="c-doc-acoes">
          <button type="button" className="c-botao c-botao-pequeno" disabled={ocupado} onClick={aoGerar}>
            {pdf?.estado === "montando"
              ? pdf.total > 0
                ? `Montando… página ${pdf.pagina} de ${pdf.total}`
                : "Montando o PDF…"
              : pdf?.estado === "erro"
                ? "Tentar de novo"
                : "Gerar PDF"}
          </button>
          {aoImprimir && pdf?.estado !== "montando" && (
            <button type="button" className="c-botao c-botao-pequeno c-botao-secundario" disabled={ocupado} onClick={aoImprimir}>
              Imprimir
            </button>
          )}
        </div>
      )}

      {pdf?.estado === "erro" && (
        <p className="c-doc-recado" role="alert">
          Não consegui montar o PDF agora. Tente de novo.
        </p>
      )}

      {pdf?.estado === "pronto" && (
        <div className="c-doc-pronto" role="status">
          <p className="c-doc-pronto-titulo">
            <Icone nome="feito" tamanho={16} /> PDF pronto
          </p>
          <div className="c-doc-acoes">
            {podeCompartilhar(pdf.arquivo) && (
              <button type="button" className="c-botao c-botao-pequeno" onClick={() => void compartilhar(pdf.arquivo)}>
                Salvar ou compartilhar
              </button>
            )}
            <a
              className={`c-botao c-botao-pequeno${podeCompartilhar(pdf.arquivo) ? " c-botao-secundario" : ""}`}
              href={pdf.url}
              download={pdf.arquivo.name}
            >
              Baixar
            </a>
          </div>
          {recado && (
            <p className="c-doc-recado" role="alert">
              {recado}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
