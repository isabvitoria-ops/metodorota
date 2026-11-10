import { useState } from "react";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Icone } from "@/central/components/Icone";
interface SecaoLista {
  titulo: string;
  itens: string[];
}

const SECOES: SecaoLista[] = [
  {
    titulo: "Proteínas",
    itens: [
      "Frango (peito, coxa, sobrecoxa)",
      "Peixe (tilápia, salmão, atum em lata ao natural)",
      "Ovos",
      "Carne bovina magra (patinho, alcatra, músculo)",
      "Carne suína (lombo)",
    ],
  },
  {
    titulo: "Carboidratos",
    itens: [
      "Arroz branco ou integral",
      "Batata inglesa",
      "Aipim / mandioca",
      "Cuscuz de milho",
      "Tapioca (goma)",
      "Macarrão de arroz",
    ],
  },
  {
    titulo: "Gorduras boas",
    itens: [
      "Azeite de oliva extravirgem",
      "Óleo de coco",
      "Manteiga ghee",
    ],
  },
  {
    titulo: "Vegetais",
    itens: [
      "Abobrinha",
      "Cenoura",
      "Chuchu",
      "Vagem",
      "Pepino",
      "Beterraba",
      "Abóbora",
      "Tomate (sem semente e sem casca)",
    ],
  },
  {
    titulo: "Frutas",
    itens: [
      "Banana",
      "Maçã (sem casca)",
      "Morango",
      "Melão",
      "Kiwi",
      "Mamão",
    ],
  },
  {
    titulo: "Temperos e ervas",
    itens: [
      "Sal",
      "Pimenta-do-reino",
      "Salsinha, coentro",
      "Manjericão",
      "Cúrcuma",
      "Gengibre",
      "Limão",
    ],
  },
  {
    titulo: "Extras",
    itens: [
      "Café (coado, moderado)",
      "Chás (camomila, erva-doce, hortelã)",
      "Água de coco (sem açúcar)",
    ],
  },
];

const DICAS = [
  "Comece pelas frutas e vegetais — isso ocupa o carrinho de coisas boas primeiro",
  "Evite corredores de biscoitos, salgadinhos e doces — se não comprar, não come",
  "Prefira produtos com lista de ingredientes curta e legível",
  "Leve uma lista e siga ela — supermercado com fome é cilada",
];

const TOTAL_DE_ITENS = SECOES.reduce((soma, secao) => soma + secao.itens.length, 0);

/**
 * A lista é de marcar: ela toca no que já pegou, e a marcação fica guardada
 * neste aparelho — fechar o app no meio do mercado não apaga o carrinho.
 * Uma lista de compras que só se lê obriga a lembrar de cabeça o que falta.
 */
export function HotSlimListaCompras() {
  const { acesso } = useSessao();
  const chave = `central:hotslim-compras:v1:${acesso.perfilId ?? "anonimo"}`;
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
        <p className="hs-texto">O que levar do supermercado para o desafio</p>
      </div>

      <div className="hs-dica">
        <strong>Dica:</strong> Leia sempre os ingredientes dos produtos! Se tiver mais de 5
        ingredientes ou nomes que você não reconhece, devolva pra prateleira.
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
        <div className="hs-list-header">Dicas no Supermercado</div>
        <div className="hs-list-card">
          {DICAS.map((dica, i) => (
            <div className="hs-list-item static" key={i}>
              <span className="hs-regra-num" style={{ width: 20, height: 20, fontSize: 11 }}>{i + 1}</span>
              <span className="hs-list-item-name">{dica}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
