import { AVISOS_DE_ROTULO, CHAS_ETAPA_1, ETAPAS, FORA_ETAPA_1, REGRAS_ETAPA_1, TEMPEROS_ETAPA_1 } from "../conteudo/regras.ts";
import { ROTINA, SINTOMAS } from "../conteudo/textos.ts";

/**
 * Protocolo do Hot Slim: regras, rotina e sintomas da Etapa 1.
 * Todos os textos vêm de conteudo/regras.ts e conteudo/textos.ts.
 */
export function HotSlimProtocolo() {
  const etapa = ETAPAS[0]!;
  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo">Método Rota</h1>
      <p className="hs-texto">
        Etapa {etapa.numero} · {etapa.nome} · dias {etapa.dias.de} a {etapa.dias.ate}
      </p>

      <div className="hs-dica" style={{ marginTop: 16 }}>
        <strong>Os 21 dias:</strong>{" "}
        {ETAPAS.map((e) => `Etapa ${e.numero}, ${e.nome.toLowerCase()} (dias ${e.dias.de} a ${e.dias.ate})`).join("; ")}.
        {" "}{etapa.resumo}
      </div>

      <details className="hs-accordion" open>
        <summary>As regras da Etapa 1</summary>
        <div className="hs-accordion-body">
          <ul className="hs-lista">
            {REGRAS_ETAPA_1.map((r, i) => (
              <li key={r.titulo}>
                <span className="hs-lista-num">{i + 1}</span>
                <span>
                  <strong>{r.titulo}.</strong> {r.texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Fica fora na Etapa 1</summary>
        <div className="hs-accordion-body">
          <div className="hs-list-card">
            {FORA_ETAPA_1.map((f) => (
              <div className="hs-list-item static evitar" key={f.item}>
                <span className="hs-list-item-name">
                  {f.item}
                  <br />
                  <span className="hs-list-item-detail">{f.motivo}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Atenção no rótulo</summary>
        <div className="hs-accordion-body">
          <div className="hs-list-card">
            {AVISOS_DE_ROTULO.map((a) => (
              <div className="hs-list-item static" key={a.item}>
                <span className="hs-list-item-name">
                  <strong>{a.item}</strong>
                  <br />
                  <span className="hs-list-item-detail">{a.aviso}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details className="hs-accordion">
        <summary>Temperos e chás liberados</summary>
        <div className="hs-accordion-body">
          <p className="hs-texto">{TEMPEROS_ETAPA_1.join(" · ")}</p>
          <p className="hs-texto" style={{ marginTop: 10 }}>
            <strong>Chás:</strong>{" "}
            {CHAS_ETAPA_1.map((c) => (c.obs ? `${c.nome} (${c.obs.replace(/\.$/, "")})` : c.nome)).join(" · ")}. Sempre
            puros entre as refeições: sem adoçante, leite ou ghee.
          </p>
        </div>
      </details>

      <h2 className="c-secao-titulo" style={{ marginTop: 24 }}>Rotina ideal</h2>
      {ROTINA.map((secao) => (
        <details className="hs-accordion" key={secao.titulo}>
          <summary>{secao.titulo}</summary>
          <div className="hs-accordion-body">
            <ul className="hs-lista">
              {secao.itens.map((t, i) => (
                <li key={i}>
                  <span className="hs-lista-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}

      <h2 className="c-secao-titulo" style={{ marginTop: 24 }}>Sintomas comuns</h2>
      {SINTOMAS.map((s) => (
        <details className="hs-accordion" key={s.titulo}>
          <summary>{s.titulo}</summary>
          <div className="hs-accordion-body">
            <p className="hs-texto">{s.porque}</p>
            <ul className="hs-lista" style={{ marginTop: 8 }}>
              {s.oQueFazer.map((t, i) => (
                <li key={i}>
                  <span className="hs-lista-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            {s.procurar && (
              <div className="hs-dica" style={{ marginTop: 10 }}>
                <strong>Atenção:</strong> {s.procurar}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
