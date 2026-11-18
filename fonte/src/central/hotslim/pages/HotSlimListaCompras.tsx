import { useState } from "react";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Icone } from "@/central/components/Icone";
import { CARDAPIO_ETAPA_1 } from "../conteudo/cardapio.ts";
import { listaDeCompras } from "../conteudo/calculo.ts";
import { AVISOS_DE_ROTULO, CHAS_ETAPA_1, TEMPEROS_ETAPA_1 } from "../conteudo/regras.ts";
interface SecaoLista {
  titulo: string;
  itens: string[];
}

// A lista é montada do cardápio (conteudo/calculo.ts → listaDeCompras): só
// entra o que alguma opção da Etapa 1 usa. Temperos e chás vêm de regras.ts.
const SECOES: SecaoLista[] = [
  ...listaDeCompras(CARDAPIO_ETAPA_1).map((s) => ({ titulo: s.secao, itens: s.itens.map((a) => a.nome) })),
  { titulo: "Temperos", itens: TEMPEROS_ETAPA_1 },
  { titulo: "Chás", itens: CHAS_ETAPA_1.map((c) => (c.nome.startsWith("Chá") ? c.nome : `Chá de ${c.nome.toLowerCase()}`)) },
];

const TOTAL_DE_ITENS = SECOES.reduce((soma, secao) => soma + secao.itens.length, 0);

/**
 * A lista é de marcar: ela toca no que já pegou, e a marcação fica guardada
 * neste aparelho — fechar o app no meio do mercado não apaga o carrinho.
 * Uma lista de compras que só se lê obriga a lembrar de cabeça o que falta.
 */
export function HotSlimListaCompras() {
  const { acesso } = useSessao();
  const chave = `central:hotslim-compras:v2:${acesso.perfilId ?? "anonimo"}`;
  const [marcados, definirMarcados] = useState<string[]>(() => {
    try {
      const guardado: unknown = JSON.parse(window.localStorage.getItem(chave) ?? "[]");
      return Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  function guardar(novos: string[]) {
    definirMarcados(novos);
    try {
      window.localStorage.setItem(chave, JSON.stringify(novos));
    } catch {
      /* sem armazenamento, a marcação vale enquanto a tela estiver aberta */
    }
  }

  const alternar = (item: string) =>
    guardar(marcados.includes(item) ? marcados.filter((m) => m !== item) : [...marcados, item]);

  // Só conta o que ainda existe na lista: um item que saiu do material não
  // pode ficar somando no "já peguei".
  const pegos = SECOES.reduce((soma, secao) => soma + secao.itens.filter((i) => marcados.includes(i)).length, 0);

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Lista de Compras</h1>
        <p className="hs-texto">Etapa 1 · tudo o que o cardápio usa, e nada além disso</p>
      </div>

      <div className="hs-dica">
        <strong>Leia o rótulo:</strong> nada de trigo, cevada, malte, leite e derivados (inclusive sem lactose), açúcar, alho, cebola ou
        adoçante que não seja stevia ou taumatina.
      </div>

      <div className="hs-compras-resumo" role="status">
        <span>
          {pegos === 0
            ? "Toque no que já pegou."
            : pegos === TOTAL_DE_ITENS
              ? "Tudo no carrinho."
              : `${pegos} de ${TOTAL_DE_ITENS} no carrinho.`}
        </span>
        {pegos > 0 && (
          <button type="button" className="hs-compras-limpar" onClick={() => guardar([])}>
            Limpar marcações
          </button>
        )}
      </div>

      {SECOES.map((secao) => (
        <div className="hs-list-section" key={secao.titulo}>
          <div className="hs-list-header">{secao.titulo}</div>
          <div className="hs-compras">
            {secao.itens.map((item) => {
              const pego = marcados.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  className={`hs-compra${pego ? " pego" : ""}`}
                  aria-pressed={pego}
                  onClick={() => alternar(item)}
                >
                  <span className="hs-compra-marca" aria-hidden="true">
                    {pego && <Icone nome="feito" tamanho={13} />}
                  </span>
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="hs-list-section">
        <div className="hs-list-header">Atenção no rótulo</div>
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
    </div>
  );
}
