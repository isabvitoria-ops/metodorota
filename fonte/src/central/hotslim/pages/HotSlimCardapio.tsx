import { useState } from "react";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { alimento } from "../conteudo/alimentos.ts";
import { CARDAPIO_ETAPA_1 } from "../conteudo/cardapio.ts";
import { macrosDaOpcao, textoDaQuantidade, trocasDe } from "../conteudo/calculo.ts";
import { ETAPAS, META_KCAL, REFEICOES, etapaDoDia } from "../conteudo/regras.ts";

/**
 * Cardápio do Hot Slim.
 *
 * Tudo nesta tela sai da base única (conteudo/): opções, gramas, calorias e
 * trocas. Nada é digitado aqui. Por isso o cardápio não consegue contradizer
 * a lista de compras nem o Protocolo — o teste conteudo.test.ts garante.
 *
 * Por enquanto só a Etapa 1 está revisada. Nos dias das Etapas 2 e 3 a tela
 * avisa e continua mostrando a Etapa 1, que é segura.
 */
export function HotSlimCardapio() {
  const { acesso } = useSessao();
  const dia = Math.max(1, acesso.hotslimDiaAtual ?? 1);
  const etapaHoje = etapaDoDia(dia);
  const etapa = ETAPAS[0]!;
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Cardápio</h1>
        <p className="hs-texto">
          Etapa {etapa.numero} · {etapa.nome} · dias {etapa.dias.de} a {etapa.dias.ate}
        </p>
      </div>

      {!etapaHoje.revisada && (
        <div className="hs-dica">
          <strong>Etapa {etapaHoje.numero} chegando:</strong> o cardápio da {etapaHoje.nome.toLowerCase()} está sendo
          preparado. Até ele entrar, siga a Etapa 1.
        </div>
      )}

      <div className="hs-dica">
        <strong>Como usar:</strong> escolha 1 opção de cada refeição. Qualquer combinação dá perto de{" "}
        {META_KCAL.toLocaleString("pt-BR")} kcal. Pese depois de pronto (carnes, arroz, batata) e cru o que é seco
        (aveia, tapioca, flocão). Toque numa opção para ver as trocas.
      </div>

      {REFEICOES.map((ref) => (
        <div className="hs-refeicao" key={ref.id}>
          <div className="hs-refeicao-header">
            <span>{ref.nome}</span>
            <span style={{ marginLeft: "auto", color: "var(--hs-fg-soft)", fontSize: 13 }}>
              {ref.horario} · ~{ref.kcal} kcal
            </span>
          </div>
          <div className="hs-refeicao-body">
            {CARDAPIO_ETAPA_1[ref.id].map((op) => {
              const m = macrosDaOpcao(op);
              const chave = `${ref.id}-${op.id}`;
              const expandida = aberta === chave;
              const avisos = [...new Set(op.itens.map((i) => alimento(i.alimento).aviso).filter((a): a is string => !!a))];
              return (
                <div key={op.id} className="hs-list-card" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="hs-list-item"
                    aria-expanded={expandida}
                    onClick={() => setAberta(expandida ? null : chave)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      borderTop: 0,
                      borderLeft: 0,
                      borderRight: 0,
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <span className="hs-list-item-name">
                      <strong>{op.nome}</strong>
                      <br />
                      <span className="hs-list-item-detail">
                        {Math.round(m.kcal)} kcal · {Math.round(m.proteina)} g proteína · {m.fibra.toFixed(0)} g fibra
                      </span>
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--hs-fg-soft)" }}>{expandida ? "▾" : "▸"}</span>
                  </button>
                  {op.itens.map((item) => (
                    <div className="hs-list-item static" key={item.alimento}>
                      <span className="hs-list-item-name">{alimento(item.alimento).nome}</span>
                      <span className="hs-list-item-detail">{textoDaQuantidade(item)}</span>
                    </div>
                  ))}
                  {op.preparo && (
                    <div className="hs-list-item static">
                      <span className="hs-list-item-name">
                        <span className="hs-list-item-detail">{op.preparo}</span>
                      </span>
                    </div>
                  )}
                  {avisos.map((a) => (
                    <div className="hs-list-item static" key={a}>
                      <span className="hs-list-item-name">
                        <span className="hs-list-item-detail">⚠ {a}</span>
                      </span>
                    </div>
                  ))}
                  {expandida &&
                    op.itens.map((item) => {
                      const trocas = trocasDe(item, etapa.numero);
                      if (trocas.length === 0) return null;
                      return (
                        <div className="hs-list-item static" key={`t-${item.alimento}`}>
                          <span className="hs-list-item-name">
                            <span className="hs-list-item-detail">
                              <strong>Troque {textoDaQuantidade(item)} de {alimento(item.alimento).nome.toLowerCase()} por:</strong>{" "}
                              {trocas.map((t) => `${t.alimento.nome.toLowerCase()} ${t.g} g`).join(" · ")}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="hs-texto" style={{ fontSize: 12, marginTop: 16 }}>
        Calorias pela TACO (4ª ed.) e pela USDA FoodData Central. Porções low FODMAP conforme a Monash University.
      </p>
    </div>
  );
}
