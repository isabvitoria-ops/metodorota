import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";
import { useState } from "react";

interface Alimento {
  nome: string;
  emoji: string;
  porcao: string;
  fibras: string;
  proteina: string;
  gorduraBoa: string;
  destaque: string;
  dica?: string;
}

const SEMENTES: Alimento[] = [
  {
    nome: "Chia",
    emoji: "⚫",
    porcao: "1 colher de sopa (12 g)",
    fibras: "4 g",
    proteina: "2 g",
    gorduraBoa: "4 g (ômega-3)",
    destaque: "Campeã de fibra solúvel — vira gel na água e ajuda o intestino.",
    dica: "Hidrate antes de consumir: 1 colher para 3 de água, espere 15 min.",
  },
  {
    nome: "Linhaça dourada",
    emoji: "🟡",
    porcao: "1 colher de sopa (10 g)",
    fibras: "3 g",
    proteina: "2 g",
    gorduraBoa: "4 g (ômega-3)",
    destaque: "Rica em lignanas, com ação antioxidante.",
    dica: "Triture na hora ou compre farinha — inteira passa direto pelo intestino.",
  },
  {
    nome: "Gergelim",
    emoji: "🤍",
    porcao: "1 colher de sopa (10 g)",
    fibras: "1 g",
    proteina: "2 g",
    gorduraBoa: "5 g",
    destaque: "Excelente fonte de cálcio — útil para quem não consome laticínios.",
  },
  {
    nome: "Girassol",
    emoji: "🌻",
    porcao: "1 colher de sopa (10 g)",
    fibras: "1 g",
    proteina: "2 g",
    gorduraBoa: "5 g (vitamina E)",
    destaque: "Rica em vitamina E, um antioxidante que protege as células.",
  },
  {
    nome: "Abóbora",
    emoji: "🎃",
    porcao: "1 colher de sopa (10 g)",
    fibras: "1 g",
    proteina: "3 g",
    gorduraBoa: "4 g",
    destaque: "Boa fonte de magnésio e zinco.",
    dica: "Pode tostar no forno com um fio de azeite e usar como snack.",
  },
];

const PSEUDOCEREAIS: Alimento[] = [
  {
    nome: "Quinoa",
    emoji: "🌾",
    porcao: "¼ xícara cozida (45 g)",
    fibras: "1,5 g",
    proteina: "4 g",
    gorduraBoa: "1,5 g",
    destaque: "Proteína completa — tem todos os aminoácidos essenciais.",
    dica: "Lave bem antes de cozinhar para tirar o sabor amargo (saponinas).",
  },
  {
    nome: "Amaranto",
    emoji: "🔴",
    porcao: "¼ xícara cozido (60 g)",
    fibras: "2,5 g",
    proteina: "4 g",
    gorduraBoa: "1 g",
    destaque: "Rico em cálcio e ferro — bom substituto para grãos com glúten.",
  },
  {
    nome: "Trigo sarraceno",
    emoji: "🟤",
    porcao: "¼ xícara cozido (45 g)",
    fibras: "2 g",
    proteina: "3 g",
    gorduraBoa: "0,5 g",
    destaque: "Sem glúten apesar do nome. Boa fonte de rutina, que ajuda a circulação.",
    dica: "Use a farinha para panquecas ou crepes — substitui a farinha de trigo 1:1.",
  },
];

type Aba = "sementes" | "pseudocereais";

export function Sementes() {
  const [aba, definirAba] = useState<Aba>("sementes");

  const lista = aba === "sementes" ? SEMENTES : PSEUDOCEREAIS;

  return (
    <>
      <CabecalhoPagina
        titulo="Sementes e Pseudo-cereais"
        descricao="Nutrientes de cada um, porção de referência e como usar."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-guia-intro">
          <span className="c-guia-intro-emoji" aria-hidden="true">🌱</span>
          <p>
            Pequenas em tamanho, grandes em nutrientes. Sementes e pseudo-cereais
            são aliados fáceis de incluir no dia a dia — basta uma colher.
          </p>
        </div>

        <div className="c-sementes-abas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "sementes"}
            className={`c-sementes-aba ${aba === "sementes" ? "c-sementes-aba--ativa" : ""}`}
            onClick={() => definirAba("sementes")}
          >
            🌰 Sementes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "pseudocereais"}
            className={`c-sementes-aba ${aba === "pseudocereais" ? "c-sementes-aba--ativa" : ""}`}
            onClick={() => definirAba("pseudocereais")}
          >
            🌾 Pseudo-cereais
          </button>
        </div>

        <div className="c-sementes-lista">
          {lista.map((item) => (
            <div className="c-sementes-card" key={item.nome}>
              <div className="c-sementes-card-cabecalho">
                <span className="c-sementes-card-emoji" aria-hidden="true">{item.emoji}</span>
                <div>
                  <h2>{item.nome}</h2>
                  <span className="c-sementes-porcao">{item.porcao}</span>
                </div>
              </div>

              <div className="c-sementes-nutrientes">
                <div className="c-sementes-nutriente">
                  <span className="c-sementes-nutriente-valor">{item.fibras}</span>
                  <span className="c-sementes-nutriente-nome">fibras</span>
                </div>
                <div className="c-sementes-nutriente">
                  <span className="c-sementes-nutriente-valor">{item.proteina}</span>
                  <span className="c-sementes-nutriente-nome">proteína</span>
                </div>
                <div className="c-sementes-nutriente">
                  <span className="c-sementes-nutriente-valor">{item.gorduraBoa}</span>
                  <span className="c-sementes-nutriente-nome">gordura boa</span>
                </div>
              </div>

              <div className="c-guia-card-destaque">
                <span className="c-guia-destaque-icone" aria-hidden="true">💡</span>
                <span>{item.destaque}</span>
              </div>

              {item.dica && (
                <div className="c-guia-card-cuidado">
                  <span className="c-guia-cuidado-icone" aria-hidden="true">👩‍🍳</span>
                  <span>{item.dica}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="c-guia-dicas">
          <h3>Na prática</h3>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🥣</span>
            <span>Misture no iogurte, na fruta, na salada ou no arroz — uma colher de sopa por refeição basta.</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🔄</span>
            <span>Varie entre elas ao longo da semana — cada uma tem um perfil nutricional diferente.</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">💧</span>
            <span>Chia e linhaça absorvem muita água: hidrate antes ou beba bastante líquido junto.</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🏪</span>
            <span>Guarde em pote fechado, na geladeira — as gorduras boas oxidam rápido fora da embalagem.</span>
          </div>
        </div>

        <div className="c-guia-publico">
          <p>
            <strong>Para quem serve:</strong> Todos os públicos. Quem faz acompanhamento
            para saúde gastrointestinal (SII, FODMAP) deve observar a tolerância individual
            a sementes — converse com sua nutricionista sobre quantidades.
          </p>
        </div>

        <p className="c-dica" style={{ marginTop: 20 }}>
          Valores nutricionais aproximados, com base em tabelas de composição (TACO/USDA).
          Não substitui a orientação individualizada da sua nutricionista.
        </p>
      </div>
    </>
  );
}
