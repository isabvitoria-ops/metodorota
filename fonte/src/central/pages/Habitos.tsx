import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

interface Habito {
  titulo: string;
  emoji: string;
  porque: string;
  sinais: string[];
  dicas: string[];
}

const HABITOS: Habito[] = [
  {
    titulo: "Sono",
    emoji: "😴",
    porque:
      "Dormir mal aumenta a fome por doces, reduz a saciedade e altera a flora intestinal. Uma noite ruim pode afetar suas escolhas alimentares por até dois dias.",
    sinais: [
      "Acordar cansada mesmo dormindo 7-8h",
      "Desejar doces ou carboidratos simples durante o dia",
      "Intestino mais lento ou irregular sem mudar a alimentação",
      "Dificuldade de concentração e humor irritado",
    ],
    dicas: [
      "Tente dormir e acordar no mesmo horário, inclusive no fim de semana.",
      "Evite telas 1h antes de dormir — a luz azul atrasa a melatonina.",
      "Jantar leve facilita o sono; comer pesado à noite dificulta.",
      "Chás calmantes (camomila, maracujá) podem ajudar, sem açúcar.",
    ],
  },
  {
    titulo: "Estresse e ansiedade",
    emoji: "🧠",
    porque:
      "O estresse libera cortisol, que aumenta a fome, acumula gordura abdominal e acelera o trânsito intestinal. O intestino tem tantos neurônios que é chamado de 'segundo cérebro'.",
    sinais: [
      "Comer sem fome, especialmente à noite",
      "Sentir o intestino 'preso' ou solto demais em semanas difíceis",
      "Inchaço ou gases sem ter mudado a alimentação",
      "Bruxismo, tensão nos ombros, insônia",
    ],
    dicas: [
      "Respire fundo antes de comer — 3 respirações lentas ajudam a sair do 'modo alerta'.",
      "Caminhar 10-15 minutos reduz o cortisol de forma mensurável.",
      "Identifique se você come por fome ou por emoção — anotar ajuda.",
      "Procure ajuda profissional se o estresse for constante.",
    ],
  },
  {
    titulo: "Exercício físico",
    emoji: "🏃",
    porque:
      "A atividade física regular melhora o trânsito intestinal, aumenta a diversidade da flora e ajuda a regular o apetite. Mas o excesso sem alimentação adequada pode ter o efeito contrário.",
    sinais: [
      "Intestino funcionar melhor nos dias que você se mexe",
      "Mais disposição e menos inchaço após atividade regular",
      "Fome excessiva após treino pode indicar alimentação insuficiente",
      "Fadiga constante pode ser sinal de overtraining",
    ],
    dicas: [
      "Movimento conta: escada, caminhada, faxina — não precisa ser academia.",
      "30 minutos de atividade moderada, 5x por semana, já faz diferença.",
      "Coma antes e depois do treino — não treine em jejum prolongado sem orientação.",
      "Se treina forte, converse com sua nutri sobre reposição adequada.",
    ],
  },
  {
    titulo: "Medicações",
    emoji: "💊",
    porque:
      "Vários remédios comuns afetam o intestino, o apetite e a absorção de nutrientes. Saber disso ajuda você e sua nutricionista a ajustarem a alimentação.",
    sinais: [
      "Constipação ou diarreia que começou junto com um remédio novo",
      "Ganho ou perda de peso sem mudar a alimentação",
      "Náusea, azia ou gases persistentes",
      "Deficiência de vitaminas (B12, ferro, cálcio) sem causa alimentar",
    ],
    dicas: [
      "Sempre avise sua nutri quando começar, parar ou trocar um remédio.",
      "Antiácidos (omeprazol) reduzem absorção de B12, ferro e magnésio.",
      "Antibióticos alteram a flora — probióticos podem ajudar na reposição.",
      "Anticoncepcionais podem afetar apetite e retenção de líquido.",
    ],
  },
  {
    titulo: "Hidratação",
    emoji: "💧",
    porque:
      "A água participa de todas as reações do corpo. Desidratação leve já causa constipação, dor de cabeça, cansaço e confusão com fome.",
    sinais: [
      "Urina escura ou com cheiro forte",
      "Intestino preso sem causa alimentar aparente",
      "Dor de cabeça frequente, especialmente à tarde",
      "Confundir sede com fome",
    ],
    dicas: [
      "Use a Calculadora de Água do app para saber sua meta diária.",
      "Tenha uma garrafa visível — o que você vê, você lembra.",
      "Frutas e vegetais também hidratam (melancia, pepino, alface).",
      "Café e chá contam, mas água pura continua sendo a principal.",
    ],
  },
];

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

const DICAS_FIBRA = [
  { emoji: "💧", texto: "Aumente a fibra aos poucos e beba bastante água junto." },
  { emoji: "🔄", texto: "Varie entre solúveis e insolúveis — seu intestino precisa das duas." },
  { emoji: "⚠️", texto: "Cuidado com FODMAP: algumas fibras fermentam mais. Consulte o Semáforo FODMAP do app." },
  { emoji: "📈", texto: "A recomendação diária é de 25-30g de fibras por dia para adultos." },
];

export function Habitos() {
  return (
    <>
      <CabecalhoPagina
        titulo="Hábitos e intestino"
        descricao="O que não está no prato, mas faz diferença: sono, estresse, exercício, medicação, hidratação e fibras."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-guia-intro">
          <span className="c-guia-intro-emoji" aria-hidden="true">🔗</span>
          <p>
            A alimentação é uma parte. Mas o intestino responde a tudo: como você
            dorme, o que te estressa, quanto você se mexe e o que você toma. Entender
            essas conexões ajuda a não culpar só a comida quando algo muda.
          </p>
        </div>

        {HABITOS.map((habito) => (
          <div className="c-guia-card" key={habito.titulo}>
            <div className="c-guia-card-cabecalho">
              <span className="c-guia-card-emoji" aria-hidden="true">{habito.emoji}</span>
              <h2>{habito.titulo}</h2>
            </div>

            <p className="c-guia-card-descricao">{habito.porque}</p>

            <div className="c-guia-card-secao">
              <h3>Sinais de atenção</h3>
              <ul className="c-guia-lista-exemplos">
                {habito.sinais.map((sinal) => (
                  <li key={sinal}>
                    <span className="c-guia-lista-check" aria-hidden="true">⚠️</span>
                    <span>{sinal}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="c-guia-card-secao">
              <h3>O que fazer</h3>
              <ul className="c-guia-lista-exemplos">
                {habito.dicas.map((dica) => (
                  <li key={dica}>
                    <span className="c-guia-lista-check" aria-hidden="true">✅</span>
                    <span>{dica}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        <h2 className="c-secao-titulo" style={{ marginTop: 32 }}>Guia de fibras</h2>

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
          {DICAS_FIBRA.map((dica, i) => (
            <div className="c-guia-dica-item" key={i}>
              <span className="c-guia-dica-emoji" aria-hidden="true">{dica.emoji}</span>
              <span>{dica.texto}</span>
            </div>
          ))}
        </div>

        <div className="c-guia-publico">
          <p>
            <strong>Para quem serve:</strong> Todos os públicos. Estas orientações são
            gerais e complementam o acompanhamento nutricional — não substituem avaliação
            médica para questões de sono, saúde mental ou uso de medicações.
          </p>
        </div>

        <p className="c-dica" style={{ marginTop: 20 }}>
          Conteúdo educativo baseado em orientações gerais de nutrição e saúde integrativa.
          Não substitui a orientação individualizada da sua nutricionista.
        </p>
      </div>
    </>
  );
}
