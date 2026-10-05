import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

interface TipoBristol {
  tipo: number;
  descricao: string;
  visual: string;
  significado: string;
  cor: string;
}

const TIPOS: TipoBristol[] = [
  {
    tipo: 1,
    descricao: "Pequenos caroços duros e separados, como nozes",
    visual: "● ● ●",
    significado: "Constipação severa — as fezes passaram muito tempo no intestino.",
    cor: "#b45309",
  },
  {
    tipo: 2,
    descricao: "Forma de salsicha, mas com grumos",
    visual: "▓▓▓░░",
    significado: "Constipação — trânsito lento, pouca água e fibra.",
    cor: "#92400e",
  },
  {
    tipo: 3,
    descricao: "Forma de salsicha com rachaduras na superfície",
    visual: "████▒",
    significado: "Normal — bom, mas poderia ter mais hidratação.",
    cor: "#15803d",
  },
  {
    tipo: 4,
    descricao: "Forma de salsicha ou cobra, lisa e macia",
    visual: "█████",
    significado: "Ideal — o padrão de referência: macia, contínua, fácil de evacuar.",
    cor: "#16a34a",
  },
  {
    tipo: 5,
    descricao: "Pedaços macios com contornos definidos",
    visual: "▪ ▪ ▪ ▪",
    significado: "Normal — pode indicar falta de fibra.",
    cor: "#ca8a04",
  },
  {
    tipo: 6,
    descricao: "Pedaços esfarrapados e irregulares, pastosos",
    visual: "~ ~ ~ ~",
    significado: "Tendência a diarreia — trânsito muito rápido.",
    cor: "#dc2626",
  },
  {
    tipo: 7,
    descricao: "Totalmente líquidas, sem pedaços sólidos",
    visual: "≈≈≈≈≈",
    significado: "Diarreia — pode indicar infecção, intolerância ou estresse intestinal.",
    cor: "#b91c1c",
  },
];

export function Bristol() {
  return (
    <>
      <CabecalhoPagina
        titulo="Escala de Bristol"
        descricao="Conheça os 7 tipos de fezes e o que cada um diz sobre seu intestino."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-guia-intro">
          <span className="c-guia-intro-emoji" aria-hidden="true">🔬</span>
          <p>
            A Escala de Bristol é uma ferramenta médica que classifica as fezes em 7 tipos,
            do mais seco ao mais líquido. Ela ajuda você e sua nutricionista a entenderem
            como está o funcionamento do seu intestino.
          </p>
        </div>

        <div className="c-bristol-faixa">
          <div className="c-bristol-faixa-item c-bristol-faixa-constipacao">
            <span>🔴</span> Tipos 1-2: Constipação
          </div>
          <div className="c-bristol-faixa-item c-bristol-faixa-normal">
            <span>🟢</span> Tipos 3-5: Normal
          </div>
          <div className="c-bristol-faixa-item c-bristol-faixa-diarreia">
            <span>🟠</span> Tipos 6-7: Diarreia
          </div>
        </div>

        <div className="c-bristol-lista">
          {TIPOS.map((t) => (
            <div className="c-bristol-card" key={t.tipo}>
              <div className="c-bristol-card-numero" style={{ background: t.cor }}>
                {t.tipo}
              </div>
              <div className="c-bristol-card-corpo">
                <div className="c-bristol-card-visual" aria-hidden="true">
                  {t.visual}
                </div>
                <p className="c-bristol-card-descricao">{t.descricao}</p>
                <p className="c-bristol-card-significado">{t.significado}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="c-guia-dicas">
          <h3>O que influencia</h3>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">💧</span>
            <span>Hidratação — beber pouca água deixa as fezes mais secas (tipos 1-2).</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🥦</span>
            <span>Fibras — solúveis dão consistência (tipos 6-7), insolúveis dão volume (tipos 1-2).</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🧠</span>
            <span>Estresse e ansiedade podem acelerar o trânsito e causar fezes mais líquidas.</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">💊</span>
            <span>Medicações (antiácidos, laxantes, antibióticos) alteram a consistência.</span>
          </div>
          <div className="c-guia-dica-item">
            <span className="c-guia-dica-emoji" aria-hidden="true">🏃</span>
            <span>Atividade física regular ajuda a manter o trânsito no ritmo certo.</span>
          </div>
        </div>

        <div className="c-guia-publico">
          <p>
            <strong>Para quem serve:</strong> Todos os públicos, especialmente quem faz
            acompanhamento intestinal ou rastreabilidade alimentar. A escala é usada
            mundialmente por médicos e nutricionistas para avaliar a saúde digestiva.
          </p>
        </div>

        <p className="c-dica" style={{ marginTop: 20 }}>
          A Escala de Bristol é uma ferramenta de triagem, não de diagnóstico.
          Alterações persistentes devem ser discutidas com sua nutricionista ou médico.
        </p>
      </div>
    </>
  );
}
