import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

interface FibraInfo {
  tipo: string;
  emoji: string;
  descricao: string;
  exemplos: string[];
  quando: string;
  cuidado?: string;
}

const FIBRAS: FibraInfo[] = [
  {
    tipo: "Fibras solúveis",
    emoji: "🫧",
    descricao:
      "Absorvem água e formam um gel no intestino. Ajudam a regular o trânsito, controlar a glicemia e reduzir o colesterol.",
    exemplos: [
      "Aveia e farelo de aveia",
      "Maçã e pera (com casca)",
      "Cenoura e batata-doce",
      "Leguminosas (feijão, lentilha, grão-de-bico)",
      "Psyllium",
      "Banana",
      "Chia e linhaça (hidratadas)",
    ],
    quando:
      "Boas para quem tem diarreia ou intestino muito acelerado — elas ajudam a dar consistência às fezes.",
  },
  {
    tipo: "Fibras insolúveis",
    emoji: "🌾",
    descricao:
      "Não se dissolvem em água. Aumentam o volume do bolo fecal e estimulam o movimento do intestino.",
    exemplos: [
      "Farelo de trigo e cereais integrais",
      "Cascas de frutas e vegetais",
      "Couve, brócolis, repolho",
      "Milho e pipoca",
      "Sementes (girassol, abóbora)",
      "Folhas verdes em geral",
    ],
    quando:
      "Boas para quem tem constipação — ajudam a 'empurrar' o bolo fecal. Mas precisam de água junto!",
    cuidado:
      "Em excesso ou sem hidratação, podem piorar gases e inchaço — especialmente em quem tem SII.",
  },
];

const DICAS = [
  { emoji: "💧", texto: "Aumente a fibra aos poucos e beba bastante água junto." },
  { emoji: "🔄", texto: "Varie entre solúveis e insolúveis — seu intestino precisa das duas." },
  { emoji: "⚠️", texto: "Cuidado com FODMAP: algumas fibras fermentam mais. Consulte o Semáforo FODMAP do app." },
  { emoji: "📈", texto: "A recomendação diária é de 25-30g de fibras por dia para adultos." },
];

export function GuiaFibras() {
  return (
    <>
      <CabecalhoPagina
        titulo="Fibras: Solúvel vs. Insolúvel"
        descricao="Entenda a diferença e saiba qual comer, quando e quanto."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-guia-intro">
          <span className="c-guia-intro-emoji" aria-hidden="true">🥦</span>
          <p>
            Fibras são essenciais para o intestino funcionar bem — mas nem toda fibra
            faz a mesma coisa. Conhecer a diferença ajuda a escolher melhor.
          </p>
        </div>

        {FIBRAS.map((fibra) => (
          <div className="c-guia-card" key={fibra.tipo}>
            <div className="c-guia-card-cabecalho">
              <span className="c-guia-card-emoji" aria-hidden="true">{fibra.emoji}</span>
              <h2>{fibra.tipo}</h2>
            </div>

            <p className="c-guia-card-descricao">{fibra.descricao}</p>

            <div className="c-guia-card-secao">
              <h3>Onde encontrar</h3>
              <ul className="c-guia-lista-exemplos">
                {fibra.exemplos.map((ex) => (
                  <li key={ex}>
                    <span className="c-guia-lista-check" aria-hidden="true">✅</span>
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="c-guia-card-destaque">
              <span className="c-guia-destaque-icone" aria-hidden="true">💡</span>
              <span>{fibra.quando}</span>
            </div>

            {fibra.cuidado && (
              <div className="c-guia-card-cuidado">
                <span className="c-guia-cuidado-icone" aria-hidden="true">⚠️</span>
                <span>{fibra.cuidado}</span>
              </div>
            )}
          </div>
        ))}

        <div className="c-guia-dicas">
          <h3>Na prática</h3>
          {DICAS.map((dica, i) => (
            <div className="c-guia-dica-item" key={i}>
              <span className="c-guia-dica-emoji" aria-hidden="true">{dica.emoji}</span>
              <span>{dica.texto}</span>
            </div>
          ))}
        </div>

        <div className="c-guia-publico">
          <p>
            <strong>Para quem serve:</strong> Todos os públicos. Quem faz acompanhamento
            para saúde gastrointestinal (SII, FODMAP) deve prestar atenção especial
            à relação entre fibras e sintomas — converse com sua nutricionista.
          </p>
        </div>

        <p className="c-dica" style={{ marginTop: 20 }}>
          Conteúdo educativo baseado em orientações gerais de nutrição.
          Não substitui a orientação individualizada da sua nutricionista.
        </p>
      </div>
    </>
  );
}
