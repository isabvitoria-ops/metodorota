import { ETAPAS } from "../conteudo/regras.ts";

/**
 * Reintrodução do Hot Slim (Etapa 3, dias 15 a 21).
 *
 * O roteiro antigo (4 semanas, por grupo de alimento) contradizia o desafio
 * de 21 dias e a lógica do low FODMAP, que testa um GRUPO FODMAP por vez.
 * Ele saiu. O novo mapa de reintrodução entra quando a Etapa 3 for revisada;
 * até lá esta tela só explica como vai funcionar.
 */
export function HotSlimReintroducao() {
  const etapa = ETAPAS[2]!;
  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Reintrodução</h1>
        <p className="hs-texto">
          Etapa {etapa.numero} · dias {etapa.dias.de} a {etapa.dias.ate}
        </p>
      </div>

      <div className="hs-dica">
        <strong>Em preparação.</strong> O seu mapa de reintrodução aparece aqui antes do dia {etapa.dias.de}.
      </div>

      <details className="hs-accordion" open>
        <summary>Como vai funcionar</summary>
        <div className="hs-accordion-body">
          <ul className="hs-lista">
            <li><span className="hs-lista-num">1</span><span>A base continua a mesma das etapas anteriores.</span></li>
            <li><span className="hs-lista-num">2</span><span>Um grupo FODMAP por vez (frutanos, frutose, lactose, polióis, GOS), em 3 dias de dose crescente.</span></li>
            <li><span className="hs-lista-num">3</span><span>Você registra os sintomas no checklist do dia.</span></li>
            <li><span className="hs-lista-num">4</span><span>Entre um teste e outro, uma pausa sem sintomas.</span></li>
            <li><span className="hs-lista-num">5</span><span>No fim, você sai com os seus liberados: o que o seu intestino tolera, e em que quantidade.</span></li>
          </ul>
        </div>
      </details>
    </div>
  );
}
