import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Icone } from "./Icone";

/**
 * Cabeçalho das telas internas: voltar, título e uma ação opcional à direita
 * (normalmente o botão de salvar). Mantém o mesmo gesto em todas as telas,
 * que é o que faz a Central parecer um app e não um site.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
  voltarPara,
}: {
  titulo: string;
  descricao?: string | null;
  acao?: ReactNode;
  voltarPara?: string;
}) {
  const navegar = useNavigate();

  /**
   * Voltar precisa ser previsível (é a expectativa mais forte que existe num
   * app de celular): se há tela anterior dentro do app, volta de verdade, em
   * vez de empilhar mais um passo no histórico. Quando o paciente chegou
   * direto pelo link de uma tela interna, não há para onde voltar — aí cai
   * no destino declarado pela tela.
   */
  function voltar() {
    const indice = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (indice > 0) navegar(-1);
    else navegar(voltarPara ?? "/central");
  }

  return (
    <>
      <div className="c-cabecalho-pagina">
        <button
          type="button"
          className="c-voltar"
          aria-label="Voltar"
          onClick={voltar}
        >
          <Icone nome="voltar" tamanho={19} />
        </button>
        {acao && <div style={{ marginLeft: "auto" }}>{acao}</div>}
      </div>
      <div className="c-cabecalho" style={{ paddingTop: 10 }}>
        <h1 className="c-titulo">{titulo}</h1>
        {descricao && <p className="c-subtitulo">{descricao}</p>}
      </div>
    </>
  );
}
