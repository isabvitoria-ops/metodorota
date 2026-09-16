import { Fragment } from "react";

/**
 * Texto de guia que reconhece endereços da internet e os transforma em link.
 *
 * Os materiais da nutricionista trazem links de compra ("saco hermético:
 * https://…"), e um endereço escrito por extenso, sem poder tocar, é inútil
 * no celular. O reconhecimento é deliberadamente restrito a http e https:
 * qualquer outra coisa continua sendo texto comum, para que um conteúdo
 * cadastrado não consiga virar `javascript:` nem `data:`.
 */
// Duas expressões de propósito: a global parte o texto, a simples testa
// cada pedaço. Reaproveitar a global no teste seria um erro difícil de ver —
// `test` guarda a posição da última busca e passa a alternar entre verdadeiro
// e falso a cada chamada, o que derrubaria um link sim, outro não.
const SEPARADOR = /(https?:\/\/[^\s<>"')]+)/g;
const EH_ENDERECO = /^https?:\/\//;

export function TextoComLinks({ texto }: { texto: string }) {
  const partes = texto.split(SEPARADOR);

  return (
    <>
      {partes.map((parte, indice) =>
        EH_ENDERECO.test(parte) ? (
          <a
            key={indice}
            href={parte}
            target="_blank"
            rel="noreferrer noopener"
            className="c-link-externo"
          >
            {encurtar(parte)}
          </a>
        ) : (
          <Fragment key={indice}>{parte}</Fragment>
        ),
      )}
    </>
  );
}

/** Mostra o domínio em vez da URL inteira — cabe na tela e diz para onde vai. */
function encurtar(endereco: string): string {
  try {
    return new URL(endereco).hostname.replace(/^www\./, "");
  } catch {
    return endereco;
  }
}
