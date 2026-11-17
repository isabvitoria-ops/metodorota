import { useState } from "react";
import { Campo, NumeroDecimal } from "./Campos";
import {
  DIVISOES_PRONTAS,
  conferirFaixas,
  macrosPorPercentual,
  mensagemDaSoma,
  metaDePeso,
  regraDeBolso,
  type Macro,
  type Percentuais,
} from "@/central/utils/planejamentoDeMacros";

/**
 * O que a aba "Macros e gasto" da ferramenta de cálculo dela faz, dentro da
 * aba de cálculos da avaliação: meta de peso (passo 4), divisão em
 * percentual e conferência com as faixas de referência (passo 5).
 */

const kcal = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kcal`;
const casas = (n: number, c: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

const NOME: Record<Macro, string> = { carboidrato: "Carboidrato", proteina: "Proteína", lipideo: "Gordura" };
/** As siglas do passo 5 (PTN, LIP, CHO), para os rótulos curtos caberem no celular. */
const SIGLA: Record<Macro, string> = { carboidrato: "CHO", proteina: "PTN", lipideo: "LIP" };

/* ─────────────────────────────────────────── passo 4: meta de peso */

export function MetaDePesoNoCalculo({
  pesoAtual,
  get,
  aoUsarAjuste,
}: {
  pesoAtual: number | null;
  get: number | null;
  aoUsarAjuste: (ajuste: number) => void;
}) {
  const [pesoDesejado, definirPesoDesejado] = useState<number | null>(null);
  // 30 dias é o prazo que a ferramenta dela já traz preenchido.
  const [dias, definirDias] = useState<number | null>(30);
  const bolso = regraDeBolso(pesoAtual);
  const meta = metaDePeso(pesoAtual, pesoDesejado, dias);
  const negativo = (pesoDesejado ?? 0) < 0 || (dias ?? 0) < 0;

  return (
    <div className="c-calc-bloco">
      <h4 className="c-calc-subtitulo">Ajuste para uma meta de peso</h4>
      <div className="c-calc-grade">
        <div className="c-calc-campo">
          <Campo rotulo="Peso desejado (kg)" dica={pesoAtual ? `Hoje: ${casas(pesoAtual, 1)} kg (passo 2).` : "Preencha o peso no passo 2."}>
            <NumeroDecimal valor={pesoDesejado} aoMudar={definirPesoDesejado} />
          </Campo>
        </div>
        <div className="c-calc-campo">
          <Campo rotulo="Prazo (dias)">
            <NumeroDecimal valor={dias} aoMudar={definirDias} />
          </Campo>
        </div>
      </div>

      {bolso && (
        <div className="c-calc-placar">
          <div className="c-calc-placar-item">
            <span className="c-calc-placar-rotulo">Regra de bolso — perder</span>
            <span className="c-calc-placar-valor">
              {Math.round(bolso.perda[0]).toLocaleString("pt-BR")} a {kcal(bolso.perda[1])}
            </span>
            <span className="c-calc-placar-apoio">20 a 25 kcal por kg do peso atual</span>
          </div>
          <div className="c-calc-placar-item">
            <span className="c-calc-placar-rotulo">Regra de bolso — ganhar</span>
            <span className="c-calc-placar-valor">
              {Math.round(bolso.ganho[0]).toLocaleString("pt-BR")} a {kcal(bolso.ganho[1])}
            </span>
            <span className="c-calc-placar-apoio">30 a 35 kcal por kg do peso atual</span>
          </div>
        </div>
      )}

      {negativo ? (
        <div className="c-aviso" role="status" style={{ marginTop: 12 }}>
          <span>Peso e prazo precisam ser positivos. Prazo negativo inverteria a conta: perder peso apareceria como superávit.</span>
        </div>
      ) : meta === null ? (
        <p className="c-calc-dica" style={{ marginTop: 10 }}>
          Preencha o peso desejado e o prazo para ver o déficit ou o superávit por dia.
        </p>
      ) : meta.venta === 0 ? (
        <p className="c-calc-dica" style={{ marginTop: 10 }}>
          Peso atual e desejado são iguais: não há ajuste a fazer.
        </p>
      ) : (
        <>
          <div className="c-calc-placar">
            <div className="c-calc-placar-item">
              <span className="c-calc-placar-rotulo">{meta.venta > 0 ? "Déficit por dia" : "Superávit por dia"}</span>
              <span className="c-calc-placar-valor">{kcal(Math.abs(meta.venta))}</span>
              <span className="c-calc-placar-apoio">
                {casas(Math.abs((pesoAtual ?? 0) - (pesoDesejado ?? 0)), 1)} kg em {Math.round(dias ?? 0)} dias ·{" "}
                {casas(meta.kgPorSemana, 2)} kg por semana
              </span>
            </div>
            {get !== null && (
              <div className="c-calc-placar-item">
                <span className="c-calc-placar-rotulo">Consumo do dia</span>
                <span className="c-calc-placar-valor">{kcal(get - meta.venta)}</span>
                <span className="c-calc-placar-apoio">
                  GET {meta.venta > 0 ? "menos" : "mais"} {kcal(Math.abs(meta.venta))}
                </span>
              </div>
            )}
          </div>
          {meta.ritmoAlto && (
            <div className="c-aviso" role="status" style={{ marginTop: 12 }}>
              <span>
                Isto é <strong>{casas(meta.kgPorSemana, 1)} kg por semana</strong>. Costuma-se planejar até cerca de 1 kg por
                semana; um ritmo maior pode ser inviável ou exigir um consumo abaixo do seguro. Confira o prazo.
              </span>
            </div>
          )}
          <button
            type="button"
            className="c-botao c-botao-secundario c-calc-preencher"
            onClick={() => aoUsarAjuste(-Math.round(meta.venta))}
          >
            Usar {meta.venta > 0 ? "−" : "+"}
            {kcal(Math.abs(meta.venta))} no ajuste
          </button>
        </>
      )}
      <p className="c-calc-dica" style={{ marginTop: 10 }}>
        (peso atual − peso desejado) × 7.700 ÷ dias (Wishnofsky, 1958). O consumo do dia vira o GET menos esse valor. O
        peso desejado não entra no gasto: o gasto é sempre estimado com o peso de hoje.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────── passo 5: divisão em percentual */

export function DivisaoPorPercentual({
  vet,
  peso,
  inicial,
  aoUsar,
}: {
  vet: number | null;
  peso: number | null;
  inicial: Percentuais | null;
  aoUsar: (percentuais: Percentuais) => void;
}) {
  // Começa da divisão que já está nos campos; sem ela, da que a ferramenta dela traz (50/30/20).
  const [pct, definirPct] = useState<Percentuais>(inicial ?? { carboidrato: 50, proteina: 30, lipideo: 20 });
  const soma = mensagemDaSoma(pct);
  const r = macrosPorPercentual(vet, pct, peso);
  const mudar = (macro: Macro, valor: number | null) => definirPct({ ...pct, [macro]: valor ?? 0 });

  return (
    <div className="c-calc-bloco">
      <div className="c-calc-grade c-calc-grade--tres">
        {(["carboidrato", "proteina", "lipideo"] as Macro[]).map((m) => (
          <div className="c-calc-campo" key={m}>
            <Campo rotulo={`${SIGLA[m]} (%)`}>
              <NumeroDecimal valor={pct[m]} aoMudar={(v) => mudar(m, v)} />
            </Campo>
          </div>
        ))}
      </div>
      <p className={`c-calc-soma${soma.fechado ? "" : " c-calc-soma--aberta"}`} role="status">
        {soma.texto}
      </p>
      <div className="c-calc-fatores" role="group" aria-label="Divisões prontas">
        {DIVISOES_PRONTAS.map((d) => {
          const ativa = d.carboidrato === pct.carboidrato && d.proteina === pct.proteina && d.lipideo === pct.lipideo;
          return (
            <button
              key={`${d.carboidrato}-${d.proteina}-${d.lipideo}`}
              type="button"
              className={`c-calc-fator${ativa ? " c-calc-fator--ativo" : ""}`}
              aria-pressed={ativa}
              onClick={() => definirPct(d)}
            >
              <strong>
                {d.carboidrato} / {d.proteina} / {d.lipideo}
              </strong>
            </button>
          );
        })}
      </div>

      {r === null ? (
        <p className="c-calc-dica" style={{ marginTop: 12 }}>
          Preencha o VET no passo 4 para dividir as calorias.
        </p>
      ) : (
        <>
          <div className="c-calc-placar">
            {(["carboidrato", "proteina", "lipideo"] as Macro[]).map((m) => (
              <div className="c-calc-placar-item" key={m}>
                <span className="c-calc-placar-rotulo">{NOME[m]}</span>
                <span className="c-calc-placar-valor">{Math.round(r[m].gramas).toLocaleString("pt-BR")} g</span>
                <span className="c-calc-placar-apoio">
                  {kcal(r[m].kcal)}
                  {r[m].porQuilo !== null ? ` · ${casas(r[m].porQuilo!, 1)} g/kg` : ""}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="c-botao c-botao-secundario c-calc-preencher"
            disabled={!soma.fechado}
            onClick={() => aoUsar(pct)}
          >
            {soma.fechado ? "Usar esta divisão nos campos" : "A soma precisa fechar 100% para usar"}
          </button>
        </>
      )}

      <FaixasDeReferencia percentuais={pct} />
    </div>
  );
}

/* ─────────────────────────────────────────── faixas de referência */

export function FaixasDeReferencia({ percentuais }: { percentuais: Percentuais }) {
  const conferencia = conferirFaixas(percentuais);
  const ordem: Macro[] = ["carboidrato", "proteina", "lipideo"];
  return (
    <div className="c-calc-bloco">
      <h4 className="c-calc-subtitulo">Como está em relação às faixas de referência</h4>
      <div className="c-calc-rolagem">
        <table className="c-calc-macros-tabela c-calc-faixas">
          <thead>
            <tr>
              <th scope="col">Referência</th>
              {ordem.map((m) => (
                <th scope="col" key={m}>
                  {NOME[m]} {Math.round(percentuais[m])}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conferencia.map((f) => (
              <tr key={f.rotulo}>
                <th scope="row">{f.rotulo}</th>
                {f.itens.map((i) => (
                  <td key={i.macro} className={i.dentro ? "c-calc-faixa--dentro" : "c-calc-faixa--fora"}>
                    {i.minimo}–{i.maximo} {i.dentro ? "✓" : "fora"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="c-calc-dica" style={{ marginTop: 8 }}>
        Tabela 29 do manual do CEPRAN/UNESP. Serve para conferir, não para impor: quem prescreve é você.
      </p>
    </div>
  );
}
