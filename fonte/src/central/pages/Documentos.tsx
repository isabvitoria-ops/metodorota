import { useEffect, useState } from "react";
import type { ConteudoProtocolo, MinhaAvaliacao, Protocolo } from "@/central/types/protocolo";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Exames } from "@/central/components/Exames";
import { DocumentoAvaliacao } from "@/central/components/DocumentoAvaliacao";
import { DocumentoProtocolo } from "@/central/components/DocumentoProtocolo";
import { DocumentoRastreio } from "@/central/components/DocumentoRastreio";
import { Icone } from "@/central/components/Icone";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { useSessao } from "@/central/autenticacao/SessaoContexto";

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
  function gerar(qual: Qual) {
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
        window.print();
      });
    });
  }

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
        {carregando && <p className="c-dica">Carregando…</p>}

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
            <Cartao
              icone="lista"
              titulo="Protocolo Alimentar"
              descricao={
                temProtocolo
                  ? "Seu plano, com as quantidades e as trocas de cada item."
                  : "Aparece aqui quando sua nutricionista publicar."
              }
              disponivel={temProtocolo}
              aoGerar={() => gerar("protocolo")}
            />
            <Cartao
              icone="balanca"
              titulo="Avaliação Física"
              descricao={
                temAvaliacao
                  ? "Medidas, dobras e a evolução entre as consultas."
                  : "Aparece aqui quando sua nutricionista lançar a primeira."
              }
              disponivel={temAvaliacao}
              aoGerar={() => gerar("avaliacao")}
            />
            <Cartao
              icone="folha"
              titulo="Rastreabilidade Alimentar"
              descricao={
                temRastreio
                  ? "Seu mapa de tolerância, com espaço para os próximos testes."
                  : "Aparece aqui depois do seu primeiro registro."
              }
              disponivel={temRastreio}
              aoGerar={() => gerar("rastreio")}
            />

            <p className="c-dica" style={{ marginTop: 18 }}>
              No iPhone, escolha “Salvar em Arquivos” na tela que abrir. No computador, “Salvar
              como PDF”. Deixe “Cabeçalhos e rodapés” desmarcado: é o que tira o endereço do
              site da folha.
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
}: {
  icone: string;
  titulo: string;
  descricao: string;
  disponivel: boolean;
  aoGerar: () => void;
}) {
  return (
    <div className={`c-bloco c-doc-cartao${disponivel ? "" : " c-doc-vazio"}`}>
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
      {disponivel && (
        <button type="button" className="c-botao c-botao-pequeno" onClick={aoGerar}>
          Gerar PDF
        </button>
      )}
    </div>
  );
}
