import { useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

interface Produto {
  nome: string;
  marca: string;
  detalhe?: string;
  destaque?: string;
}

interface Corredor {
  id: string;
  emoji: string;
  titulo: string;
  cor: string;
  corClara: string;
  dica?: string;
  categorias: { titulo: string; produtos: Produto[] }[];
}

const CORREDORES: Corredor[] = [
  {
    id: "laticinios",
    emoji: "🥛",
    titulo: "Laticínios",
    cor: "#7A9DB5",
    corClara: "#DDE9F0",
    dica: "Prefira iogurtes naturais, sem açúcar e com poucos ingredientes. Quanto mais curta a lista, melhor a escolha.",
    categorias: [
      {
        titulo: "Iogurte natural",
        produtos: [
          { nome: "Viv Simples", marca: "Vigor", destaque: "sem açúcar" },
          { nome: "Natural Desnatado", marca: "Nestlé", destaque: "2 ingredientes" },
          { nome: "Natural Integral", marca: "Itambé" },
          { nome: "Viv Natural", marca: "Vigor", destaque: "consistência firme" },
          { nome: "Natural Milk", marca: "Itambé", detalhe: "Integral, poucos ingredientes" },
          { nome: "Natural Integral", marca: "Nestlé", destaque: "2 ingredientes" },
          { nome: "Natural", marca: "Fazenda Bela Vista" },
          { nome: "Lacfree Natural", marca: "Verde Campo", destaque: "sem lactose" },
          { nome: "Natural Consistência Firme", marca: "Vigor" },
          { nome: "Ati Latte com Kefir", marca: "Ati Latte", destaque: "probiótico" },
        ],
      },
      {
        titulo: "Iogurte grego & proteico",
        produtos: [
          { nome: "Grego Natural", marca: "Yorgus", destaque: "0% gordura · 15g proteína" },
          { nome: "Grego Banana & Chia", marca: "Yorgus", destaque: "0% gordura" },
          { nome: "Grego Morango", marca: "Yorgus", destaque: "0% gordura" },
          { nome: "Grego Maçã & Canela", marca: "Yorgus", destaque: "0% gordura" },
          { nome: "Grego Frutas Vermelhas", marca: "Yorgus", destaque: "0% gordura" },
          { nome: "Grego Abacaxi & Gengibre", marca: "Yorgus", destaque: "0% gordura" },
          { nome: "Natural Whey", marca: "Verde Campo", destaque: "11g proteína" },
          { nome: "Natural Whey Frutas Vermelhas", marca: "Verde Campo", destaque: "11g proteína" },
          { nome: "Natural Integral", marca: "Batavo" },
        ],
      },
    ],
  },
  {
    id: "padaria",
    emoji: "🍞",
    titulo: "Padaria",
    cor: "#B08C3E",
    corClara: "#F5EDD8",
    dica: "Procure pães com farinha integral como primeiro ingrediente e sem xarope de glicose. '100% integral' na embalagem é o mais seguro.",
    categorias: [
      {
        titulo: "Pão de forma integral",
        produtos: [
          { nome: "100% Integral Girassol & Castanha", marca: "Wickbold", destaque: "100% integral" },
          { nome: "100% Integral + Fibras", marca: "Wickbold", destaque: "6,3g fibras" },
          { nome: "Do Forno 100% Integral", marca: "Wickbold", destaque: "100% integral" },
          { nome: "Pão Integral Premium", marca: "Wickbold" },
          { nome: "100% Integral 12 Grãos", marca: "Pullman", destaque: "100% integral" },
          { nome: "Integral", marca: "Pullman" },
          { nome: "14 Grãos", marca: "Nutrella", destaque: "multigrãos" },
          { nome: "100% Integral", marca: "Nutrella", destaque: "100% integral" },
          { nome: "7 Grãos", marca: "Nutrella" },
          { nome: "Benefice 7 Grãos", marca: "SevenBoys", destaque: "alto teor de fibras" },
          { nome: "Benefice Light 7 Grãos", marca: "SevenBoys", destaque: "light" },
          { nome: "12 Grãos", marca: "SevenBoys" },
          { nome: "Castanha & Nozes", marca: "SevenBoys" },
          { nome: "Integral", marca: "SevenBoys" },
          { nome: "Pão Integral", marca: "Visconti" },
        ],
      },
    ],
  },
  {
    id: "conservas",
    emoji: "🫙",
    titulo: "Conservas & doces",
    cor: "#C4515F",
    corClara: "#F9E0E3",
    dica: "Geléia boa de verdade é feita só de fruta. Fuja das que têm açúcar como primeiro ingrediente — procure '100% fruta' no rótulo.",
    categorias: [
      {
        titulo: "Geléia sem açúcar",
        produtos: [
          { nome: "Rhapsodie de Fruit (Raspberry)", marca: "St. Dalfour", destaque: "100% fruta · importada" },
          { nome: "Wellness 100% Fruta Morango", marca: "Queensberry", destaque: "100% fruta" },
          { nome: "Geleia com Pedaços Frutas Vermelhas", marca: "Ritter", destaque: "100% fruta" },
          { nome: "Zero Frutas Vermelhas", marca: "Casa Madeira", destaque: "zero açúcar" },
        ],
      },
    ],
  },
  {
    id: "congelados",
    emoji: "❄️",
    titulo: "Congelados",
    cor: "#6A95AE",
    corClara: "#DAE8F0",
    dica: "Frutas congeladas mantêm os nutrientes e são perfeitas para smoothies, açaí caseiro e sobremesas. Confira se o ingrediente é só a fruta.",
    categorias: [
      {
        titulo: "Frutas congeladas",
        produtos: [
          { nome: "Morango", marca: "Original Food", destaque: "só fruta" },
          { nome: "Amora", marca: "Original Food", destaque: "só fruta" },
          { nome: "Acerola", marca: "Original Food", destaque: "rica em vitamina C" },
          { nome: "Frutas Vermelhas", marca: "Original Food", destaque: "mix" },
          { nome: "Framboesa", marca: "Original Food", destaque: "só fruta" },
          { nome: "Blueberry", marca: "Original Food", destaque: "antioxidante" },
          { nome: "Morango & Amora", marca: "Original Food", destaque: "mix" },
        ],
      },
    ],
  },
  {
    id: "acougue",
    emoji: "🥩",
    titulo: "Açougue & peixaria",
    cor: "#6E946A",
    corClara: "#DFEeDd",
    dica: "Proteínas magras são a base. No frango desfiado pronto, escolha a opção com menos ingredientes possíveis.",
    categorias: [
      {
        titulo: "Aves",
        produtos: [
          { nome: "Peito de frango", marca: "In natura", destaque: "proteína magra" },
          { nome: "Sobrecoxa de frango", marca: "In natura" },
          { nome: "Peito de peru", marca: "In natura", destaque: "proteína magra" },
          { nome: "Frango desfiado pronto", marca: "Nat", detalhe: "Escolha sempre a opção com menos ingredientes possíveis. Essa marca é ideal!" },
        ],
      },
      {
        titulo: "Carnes vermelhas",
        produtos: [
          { nome: "Patinho", marca: "In natura", destaque: "corte magro" },
          { nome: "Alcatra", marca: "In natura", destaque: "versátil" },
          { nome: "Filé mignon suíno", marca: "In natura", destaque: "corte magro" },
        ],
      },
      {
        titulo: "Peixes & frutos do mar",
        produtos: [
          { nome: "Tilápia", marca: "In natura", destaque: "leve e acessível" },
          { nome: "Atum", marca: "In natura / enlatado", destaque: "rico em ômega 3" },
          { nome: "Camarão", marca: "In natura", destaque: "baixa caloria" },
        ],
      },
      {
        titulo: "Ovos",
        produtos: [
          { nome: "Ovos", marca: "Qualquer marca", destaque: "proteína completa", detalhe: "Versátil, econômico e nutritivo. Pode ser cozido, mexido, em omelete ou pochê." },
        ],
      },
    ],
  },
];

export function Mercado() {
  const [corredorAberto, definirCorredor] = useState<string | null>(null);

  return (
    <>
      <CabecalhoPagina
        titulo="Rolê no Mercado"
        descricao="Seu guia para boas escolhas em cada corredor."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <p className="c-mercado-intro">
          Navegue pelos corredores e descubra as melhores opções para o seu
          carrinho. Cada produto foi escolhido a dedo pela sua nutricionista.
        </p>

        <div className="c-mercado-corredores">
          {CORREDORES.map((corredor) => {
            const aberto = corredorAberto === corredor.id;
            return (
              <div key={corredor.id} className="c-corredor">
                <button
                  type="button"
                  className={`c-corredor-botao ${aberto ? "c-corredor-botao--aberto" : ""}`}
                  style={{
                    "--corredor-cor": corredor.cor,
                    "--corredor-clara": corredor.corClara,
                  } as React.CSSProperties}
                  onClick={() => definirCorredor(aberto ? null : corredor.id)}
                  aria-expanded={aberto}
                >
                  <span className="c-corredor-emoji">{corredor.emoji}</span>
                  <span className="c-corredor-info">
                    <span className="c-corredor-titulo">{corredor.titulo}</span>
                    <span className="c-corredor-contagem">
                      {corredor.categorias.reduce((s, c) => s + c.produtos.length, 0)} produtos
                    </span>
                  </span>
                  <span className={`c-corredor-seta ${aberto ? "c-corredor-seta--aberto" : ""}`}>
                    ›
                  </span>
                </button>

                {aberto && (
                  <div className="c-corredor-conteudo" style={{ "--corredor-cor": corredor.cor, "--corredor-clara": corredor.corClara } as React.CSSProperties}>
                    {corredor.dica && (
                      <div className="c-corredor-dica">
                        <span className="c-corredor-dica-icone">💡</span>
                        <span>{corredor.dica}</span>
                      </div>
                    )}

                    {corredor.categorias.map((cat) => (
                      <div key={cat.titulo} className="c-corredor-categoria">
                        {corredor.categorias.length > 1 && (
                          <h3 className="c-corredor-cat-titulo">{cat.titulo}</h3>
                        )}
                        <div className="c-produtos-grade">
                          {cat.produtos.map((produto, i) => (
                            <ProdutoCard key={`${produto.marca}-${produto.nome}-${i}`} produto={produto} corCorredor={corredor.cor} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="c-dica" style={{ marginTop: 22, marginBottom: 30 }}>
          Lista curada pela sua nutricionista. Na dúvida, confira sempre a lista
          de ingredientes — o primeiro ingrediente é o que tem mais.
        </p>
      </div>
    </>
  );
}

function ProdutoCard({ produto, corCorredor }: { produto: Produto; corCorredor: string }) {
  const [expandido, definirExpandido] = useState(false);
  const temDetalhe = !!produto.detalhe;

  return (
    <div
      className={`c-produto-card ${temDetalhe ? "c-produto-card--clicavel" : ""}`}
      onClick={temDetalhe ? () => definirExpandido(!expandido) : undefined}
      role={temDetalhe ? "button" : undefined}
      tabIndex={temDetalhe ? 0 : undefined}
      onKeyDown={temDetalhe ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); definirExpandido(!expandido); } } : undefined}
    >
      <div className="c-produto-topo">
        <span className="c-produto-marca" style={{ color: corCorredor }}>{produto.marca}</span>
        {produto.destaque && (
          <span className="c-produto-destaque" style={{ background: corCorredor }}>
            {produto.destaque}
          </span>
        )}
      </div>
      <span className="c-produto-nome">{produto.nome}</span>
      {expandido && produto.detalhe && (
        <p className="c-produto-detalhe">{produto.detalhe}</p>
      )}
      {temDetalhe && !expandido && (
        <span className="c-produto-ver-mais">ver dica ›</span>
      )}
    </div>
  );
}
