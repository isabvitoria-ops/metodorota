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

export function Habitos() {
  return (
    <>
      <CabecalhoPagina
        titulo="Hábitos que afetam o intestino"
        descricao="Sono, estresse, exercício, medicação e hidratação: o que não está no prato, mas faz diferença."
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
