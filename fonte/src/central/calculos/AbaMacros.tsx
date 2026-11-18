/**
 * Macros e gasto: alvo do dia, divisão em percentual, faixas de referência
 * e ajuste para uma meta de peso. Contas de nutri/calculos.mjs e
 * nutri/motor/bolso.mjs, sem mudança.
 */
import { FAIXAS_MACROS, macrosPorPercentual, venta } from "./motor/calculos.mjs";
import { regraDeBolso } from "./motor/gasto/bolso.mjs";
import type { Campos } from "./estado";
import { mostrar, num } from "./tabela";
import { Avisos, CampoTexto, Grade, Pares, Secao } from "./ui";

const naoNegativo = (v: string) => {
  const n = num(v);
  return n < 0 ? 0 : n;
};

const PRONTAS: [number, number, number][] = [
  [40, 40, 20],
  [25, 40, 35],
  [50, 25, 25],
];

export function AbaMacros({ macros, mudar }: { macros: Campos; mudar: (c: Campos) => void }) {
  const m = (id: string) => macros[id] ?? "";
  const kcal = naoNegativo(m("m-kcal"));
  const peso = naoNegativo(m("m-peso"));
  const pct = { carboidrato: naoNegativo(m("m-cho")), proteina: naoNegativo(m("m-ptn")), lipideo: naoNegativo(m("m-lip")) };
  const soma = pct.carboidrato + pct.proteina + pct.lipideo;
  const diferenca = Math.round(Math.abs(100 - soma));
  const pontos = `${diferenca} ${diferenca === 1 ? "ponto" : "pontos"}`;
  const textoSoma =
    soma === 100
      ? "Soma 100% — fechado."
      : soma > 100
        ? `Soma ${mostrar(soma, 0)}%. ${diferenca === 1 ? "Sobra" : "Sobram"} ${pontos} para fechar 100%.`
        : `Soma ${mostrar(soma, 0)}%. ${diferenca === 1 ? "Falta" : "Faltam"} ${pontos} para fechar 100%.`;

  type Um = { kcal: number; gramas: number; porQuilo: number | null };
  const r = macrosPorPercentual(kcal, pct, peso) as Record<"carboidrato" | "proteina" | "lipideo", Um> | null;

  const atual = num(m("m-atual"));
  const desejado = num(m("m-desejado"));
  const dias = num(m("m-dias"));
  const bolso = regraDeBolso(atual) as { perda: [number, number]; ganho: [number, number] } | null;
  const ajuste = venta(atual, desejado, dias) as number | null;
  const kgSemana = dias > 0 ? (Math.abs(atual - desejado) / dias) * 7 : 0;
  const faixas = Object.values(FAIXAS_MACROS) as { rotulo: string; carboidrato: [number, number]; proteina: [number, number]; lipideo: [number, number] }[];
  const campo = (id: string, rotulo: string) => <CampoTexto key={id} rotulo={rotulo} valor={m(id)} aoMudar={(v) => mudar({ [id]: v })} invalido={num(m(id)) < 0} />;
  const linha = (nome: string, u: Um) =>
    [nome, mostrar(u.gramas, 0, " g"), `${mostrar(u.kcal, 0)} kcal${peso ? ` · ${mostrar(u.porQuilo, 1)} g/kg` : ""}`] as [string, string, string];

  return (
    <div className="c-calc">
      <Secao numero={1} titulo="Alvo do dia">
        <Grade>
          {campo("m-kcal", "Calorias totais")}
          {campo("m-peso", "Peso da paciente (kg)")}
        </Grade>
      </Secao>

      <Secao numero={2} titulo="Divisão" dica="Em percentual das calorias.">
        <Grade colunas={3}>
          {campo("m-cho", "CHO (%)")}
          {campo("m-ptn", "PTN (%)")}
          {campo("m-lip", "LIP (%)")}
        </Grade>
        <p className={`c-calc-soma${soma === 100 ? "" : " c-calc-soma--aberta"}`} role="status">
          {textoSoma}
        </p>
        <div className="c-calc-fatores" role="group" aria-label="Divisões prontas">
          {PRONTAS.map(([cho, ptn, lip]) => {
            const ativa = pct.carboidrato === cho && pct.proteina === ptn && pct.lipideo === lip;
            return (
              <button
                key={`${cho}-${ptn}-${lip}`}
                type="button"
                className={`c-calc-fator${ativa ? " c-calc-fator--ativo" : ""}`}
                aria-pressed={ativa}
                onClick={() => mudar({ "m-cho": String(cho), "m-ptn": String(ptn), "m-lip": String(lip) })}
              >
                <strong>
                  {cho} / {ptn} / {lip}
                </strong>
              </button>
            );
          })}
        </div>
        {r ? (
          <Pares itens={[linha("Carboidrato", r.carboidrato), linha("Proteína", r.proteina), linha("Gordura", r.lipideo)]} />
        ) : (
          <p className="c-calc-dica" style={{ marginTop: 12 }}>
            Informe as calorias totais.
          </p>
        )}

        <h4 className="c-calc-subtitulo">Como está em relação às faixas de referência</h4>
        <div className="c-calc-rolagem">
          <table className="c-calc-macros-tabela c-calc-faixas">
            <thead>
              <tr>
                <th scope="col">Referência</th>
                <th scope="col">Carboidrato {mostrar(pct.carboidrato, 0)}%</th>
                <th scope="col">Proteína {mostrar(pct.proteina, 0)}%</th>
                <th scope="col">Gordura {mostrar(pct.lipideo, 0)}%</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f) => (
                <tr key={f.rotulo}>
                  <th scope="row">{f.rotulo}</th>
                  {([
                    [pct.carboidrato, f.carboidrato],
                    [pct.proteina, f.proteina],
                    [pct.lipideo, f.lipideo],
                  ] as [number, [number, number]][]).map(([valor, [minimo, maximo]], i) => {
                    const dentro = valor >= minimo && valor <= maximo;
                    return (
                      <td key={i} className={dentro ? "c-calc-faixa--dentro" : "c-calc-faixa--fora"}>
                        {minimo}–{maximo} {dentro ? "✓" : "fora"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="c-calc-dica" style={{ marginTop: 8 }}>
          Tabela 29 do manual do CEPRAN/UNESP. Serve para conferir, não para impor: quem prescreve é você.
        </p>
      </Secao>

      <Secao
        numero={3}
        titulo="Ajuste para uma meta de peso"
        dica="(peso atual − peso desejado) × 7.700 ÷ dias. O consumo do dia vira o gasto menos esse valor. O peso desejado não entra no cálculo do gasto: o gasto é sempre estimado com o peso de hoje."
      >
        <Grade colunas={3}>
          {campo("m-atual", "Peso atual (kg)")}
          {campo("m-desejado", "Peso desejado (kg)")}
          {campo("m-dias", "Prazo (dias)")}
        </Grade>
        {bolso && (
          <Pares
            itens={[
              ["Regra de bolso — perder", `${mostrar(bolso.perda[0], 0)} a ${mostrar(bolso.perda[1], 0)} kcal`, "20 a 25 kcal por kg do peso atual"],
              ["Regra de bolso — ganhar", `${mostrar(bolso.ganho[0], 0)} a ${mostrar(bolso.ganho[1], 0)} kcal`, "30 a 35 kcal por kg do peso atual"],
            ]}
          />
        )}
        {atual < 0 || desejado < 0 || dias < 0 ? (
          <Avisos linhas={["Peso e prazo precisam ser positivos. Prazo negativo invertia a conta: perder peso aparecia como superávit."]} />
        ) : ajuste === null ? (
          <p className="c-calc-dica" style={{ marginTop: 12 }}>
            Preencha peso atual, peso desejado e prazo (em dias).
          </p>
        ) : ajuste === 0 ? (
          <p className="c-calc-dica" style={{ marginTop: 12 }}>
            Peso atual e desejado são iguais: não há ajuste a fazer.
          </p>
        ) : (
          <>
            <Pares
              itens={[
                [
                  ajuste > 0 ? "Déficit por dia" : "Superávit por dia",
                  mostrar(Math.abs(ajuste), 0, " kcal"),
                  `${mostrar(Math.abs(atual - desejado), 1)} kg em ${mostrar(dias, 0)} dias · ${mostrar(kgSemana, 2)} kg por semana`,
                ],
                ["Consumo do dia", "GET − VENTA", `o gasto (aba Composição corporal) ${ajuste > 0 ? "menos" : "mais"} ${mostrar(Math.abs(ajuste), 0)} kcal`],
              ]}
            />
            {kgSemana > 1 && (
              <Avisos
                linhas={[
                  `Isto é ${mostrar(kgSemana, 1)} kg por semana. Costuma-se planejar até cerca de 1 kg por semana; um ritmo maior pode ser inviável ou exigir um consumo abaixo do seguro. Confira o prazo.`,
                ]}
              />
            )}
          </>
        )}
      </Secao>
    </div>
  );
}
