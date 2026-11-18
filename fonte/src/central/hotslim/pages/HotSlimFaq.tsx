import { FAQ } from "../conteudo/textos.ts";

/** Dúvidas do Hot Slim. As respostas vêm de conteudo/textos.ts. */
export function HotSlimFaq() {
  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Dúvidas Frequentes</h1>
        <p className="hs-texto">Tudo que você precisa saber sobre o desafio</p>
      </div>

      {FAQ.map((f) => (
        <Pergunta key={f.pergunta} titulo={f.pergunta} resposta={f.resposta} />
      ))}
    </div>
  );
}

function Pergunta({ titulo, resposta }: { titulo: string; resposta: string }) {
  return (
    <details className="hs-accordion">
      <summary>{titulo}</summary>
      <div className="hs-accordion-body">{resposta}</div>
    </details>
  );
}
