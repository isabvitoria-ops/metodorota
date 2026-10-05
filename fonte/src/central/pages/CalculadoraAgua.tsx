import { useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { rotas } from "@/central/rotas";

const ML_POR_KG = 40;

function copos(ml: number): number {
  return Math.round(ml / 250);
}

function garrafas(ml: number): number {
  return +(ml / 500).toFixed(1);
}

export function CalculadoraAgua() {
  const [peso, definirPeso] = useState("");

  const pesoNum = parseFloat(peso.replace(",", "."));
  const valido = pesoNum > 0 && pesoNum <= 300;
  const totalMl = valido ? Math.round(pesoNum * ML_POR_KG) : 0;
  const totalL = valido ? (totalMl / 1000).toFixed(1) : "0";

  return (
    <>
      <CabecalhoPagina
        titulo="Calculadora de Água"
        descricao="Descubra quanto de água seu corpo precisa por dia."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-agua-card">
          <div className="c-agua-emoji" aria-hidden="true">💧</div>
          <h2 className="c-agua-titulo">Quanto de água eu preciso?</h2>
          <p className="c-dica" style={{ marginTop: 4 }}>
            A recomendação geral é de <strong>40 mL por kg</strong> de peso corporal por dia.
            Essa é uma estimativa — seu consumo ideal pode variar conforme clima, exercício e orientação da sua nutricionista.
          </p>

          <div className="c-agua-campo">
            <label htmlFor="peso-agua" className="c-agua-label">Seu peso (kg)</label>
            <input
              id="peso-agua"
              type="number"
              inputMode="decimal"
              className="c-agua-input"
              placeholder="Ex.: 65"
              value={peso}
              onChange={(e) => definirPeso(e.target.value)}
              min={1}
              max={300}
              step="0.1"
            />
          </div>

          {valido && (
            <div className="c-agua-resultado" aria-live="polite">
              <div className="c-agua-destaque">
                <span className="c-agua-litros">{totalL}</span>
                <span className="c-agua-unidade">litros/dia</span>
              </div>

              <div className="c-agua-detalhes">
                <div className="c-agua-detalhe">
                  <span className="c-agua-detalhe-icone" aria-hidden="true">🥤</span>
                  <span><strong>{copos(totalMl)}</strong> copos de 250 mL</span>
                </div>
                <div className="c-agua-detalhe">
                  <span className="c-agua-detalhe-icone" aria-hidden="true">🧴</span>
                  <span><strong>{garrafas(totalMl)}</strong> garrafas de 500 mL</span>
                </div>
                <div className="c-agua-detalhe">
                  <span className="c-agua-detalhe-icone" aria-hidden="true">📐</span>
                  <span><strong>{totalMl}</strong> mL no total</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="c-agua-dicas">
          <h3>Dicas para beber mais água</h3>
          <ul>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">⏰</span>
              <span>Comece o dia com um copo ao acordar.</span>
            </li>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">📱</span>
              <span>Coloque alarmes a cada 1-2 horas como lembrete.</span>
            </li>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">🍋</span>
              <span>Não gosta de água pura? Adicione rodelas de limão, laranja ou hortelã.</span>
            </li>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">🧴</span>
              <span>Tenha uma garrafa sempre por perto — visual ajuda a lembrar.</span>
            </li>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">🍽️</span>
              <span>Beba um copo 30 min antes de cada refeição.</span>
            </li>
            <li>
              <span className="c-agua-dica-icone" aria-hidden="true">🏃</span>
              <span>Pratica exercício? Aumente o consumo nos dias de treino.</span>
            </li>
          </ul>
        </div>

        <div className="c-agua-aviso">
          <p>
            <strong>Para quem serve:</strong> Adultos saudáveis em geral. Gestantes,
            lactantes, crianças e idosos podem ter necessidades diferentes — siga
            sempre a orientação da sua nutricionista.
          </p>
        </div>

        <p className="c-dica" style={{ marginTop: 20 }}>
          Cálculo baseado na recomendação de 40 mL/kg/dia. Converse com sua
          nutricionista para ajustes individuais.
        </p>
      </div>
    </>
  );
}
