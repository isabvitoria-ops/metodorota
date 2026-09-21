import { useMemo, useState } from "react";
import type { CardioSessao, MetaSemanal, SessaoDeTreino } from "@/central/types/treino";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import {
  exerciciosComHistorico,
  frequenciaPorSemana,
  noPeriodo,
  serieDoExercicio,
  type MetricaDoGrafico,
} from "@/central/utils/graficosTreino";
import { metasDaSemana } from "@/central/utils/metasSemanais";
import { recordesDe } from "@/central/utils/progressaoTreino";
import { BarrasDeFrequencia, GraficoLinha } from "./GraficoLinha";

/**
 * O painel da profissional: a evolução da paciente sem abrir sessão por
 * sessão.
 *
 * É o pedido 16 — "permitir que a profissional entenda a evolução sem
 * precisar abrir cada sessão individualmente". Frequência, carga,
 * repetições, volume e cardio no mesmo lugar, com filtro de período.
 *
 * E NENHUM DESENHO AQUI JULGA. Uma linha descendo não vira alerta, não vira
 * "está piorando" e não vira sugestão de carga. O gráfico mostra o que
 * aconteceu; quem lê é ela.
 *
 * O VOLUME é complementar, e a tela diz isso em voz alta: ele soma carga ×
 * repetições, o que faz 40 kg × 20 parecer mais que 60 kg × 8. Sozinho,
 * mandaria para baixo quem subiu de carga.
 */
const PERIODOS = [
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 3 meses" },
  { valor: "180", rotulo: "Últimos 6 meses" },
  { valor: "0", rotulo: "Tudo" },
];

const METRICAS: { valor: MetricaDoGrafico; rotulo: string; unidade: string }[] = [
  { valor: "carga", rotulo: "Carga", unidade: "kg" },
  { valor: "repeticoes", rotulo: "Repetições", unidade: "rep." },
  { valor: "volume", rotulo: "Volume", unidade: "kg" },
];

export function PainelDeTreino({
  treinos,
  cardio,
  metas,
}: {
  treinos: SessaoDeTreino[];
  cardio: CardioSessao[];
  metas: MetaSemanal[];
}) {
  const hoje = hojeSaoPaulo();
  const [dias, definirDias] = useState("90");
  const [metrica, definirMetrica] = useState<MetricaDoGrafico>("carga");
  const [exercicio, definirExercicio] = useState("");

  const de = useMemo(() => {
    if (dias === "0") return null;
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Number(dias));
    return d.toISOString().slice(0, 10);
  }, [dias, hoje]);

  const treinosNoPeriodo = noPeriodo(treinos, de, null);
  const cardioNoPeriodo = noPeriodo(cardio, de, null);
  const exercicios = exerciciosComHistorico(treinosNoPeriodo);
  // O primeiro da lista quando ela ainda não escolheu: uma tela que abre
  // com o seletor vazio e nenhum gráfico parece quebrada.
  const escolhido = exercicios.includes(exercicio) ? exercicio : (exercicios[0] ?? "");

  const semanas = frequenciaPorSemana(
    treinosNoPeriodo,
    cardioNoPeriodo,
    dias === "0" ? 12 : Math.min(12, Math.ceil(Number(dias) / 7)),
    hoje,
  );
  const serie = escolhido ? serieDoExercicio(treinosNoPeriodo, escolhido, metrica) : [];
  const recordes = escolhido
    ? recordesDe(
        treinosNoPeriodo.map((s) => ({
          data: s.data,
          series: s.series
            .filter((x) => x.exercicioNome === escolhido)
            .map((x) => ({ numero: x.numero, carga: x.carga, repeticoes: x.repeticoes })),
        })),
      )
    : null;

  const diasDeTreino = new Set(treinosNoPeriodo.map((s) => s.data.slice(0, 10))).size;
  const minutosDeCardio = cardioNoPeriodo.reduce((t, c) => t + (c.duracaoMin ?? 0), 0);
  const daSemana = metasDaSemana(metas, hoje, treinos, cardio);

  if (treinos.length === 0 && cardio.length === 0) {
    return <p className="c-dica">Ela ainda não registrou treino nem cardio.</p>;
  }

  const unidade = METRICAS.find((m) => m.valor === metrica)?.unidade ?? "";

  return (
    <>
      <div className="c-linha">
        <label className="c-campo">
          <span>Período</span>
          <select value={dias} onChange={(e) => definirDias(e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="c-bloco c-destaques">
        <div>
          <span className="c-destaque-rotulo">Dias de treino</span>
          <span className="c-destaque-valor">{diasDeTreino}</span>
        </div>
        <div>
          <span className="c-destaque-rotulo">Cardio</span>
          <span className="c-destaque-valor">
            {minutosDeCardio}
            <span className="c-destaque-unidade">min</span>
          </span>
        </div>
        <div>
          <span className="c-destaque-rotulo">Exercícios</span>
          <span className="c-destaque-valor">{exercicios.length}</span>
        </div>
      </div>

      {daSemana.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Metas desta semana</h2>
          <div className="c-bloco">
            {daSemana.map((p) => (
              <div className="c-item-protocolo" key={p.meta.id}>
                <div className="c-item-protocolo-linha">
                  <span className="c-item-protocolo-nome">
                    {p.meta.tipo === "treino" ? "Treino de força" : "Cardio"}
                  </span>
                  <span className="c-item-protocolo-quantidade">{p.texto}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="c-secao">
        <h2 className="c-secao-titulo">Frequência, semana a semana</h2>
        <div className="c-bloco">
          <p className="c-meta-nome">Dias de treino</p>
          <BarrasDeFrequencia semanas={semanas} metrica="treinos" />
        </div>
        {minutosDeCardio > 0 && (
          <div className="c-bloco">
            <p className="c-meta-nome">Minutos de cardio</p>
            <BarrasDeFrequencia semanas={semanas} metrica="cardioMin" />
          </div>
        )}
      </section>

      {exercicios.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Evolução por exercício</h2>

          <div className="c-duas-colunas">
            <label className="c-campo">
              <span>Exercício</span>
              <select value={escolhido} onChange={(e) => definirExercicio(e.target.value)}>
                {exercicios.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="c-campo">
              <span>O que desenhar</span>
              <select
                value={metrica}
                onChange={(e) => definirMetrica(e.target.value as MetricaDoGrafico)}
              >
                {METRICAS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="c-bloco">
            <GraficoLinha
              serie={serie}
              unidade={unidade}
              vazio={
                metrica === "carga" || metrica === "volume"
                  ? "Este exercício não tem carga registrada — a evolução dele é por repetição."
                  : "Ainda não há dois registros para desenhar uma linha."
              }
            />
            {metrica === "volume" && (
              <p className="c-dica" style={{ marginTop: 8 }}>
                Volume é carga × repetições, somado na sessão. É métrica{" "}
                <strong>complementar</strong>: 40 kg × 20 soma mais que 60 kg × 8, então ela não
                serve sozinha para dizer se houve progressão.
              </p>
            )}
          </div>

          {recordes && (recordes.maiorCarga !== null || recordes.maiorRepeticoes !== null) && (
            <p className="c-nota-protocolo">
              {recordes.maiorCarga !== null && (
                <>
                  Maior carga registrada: {recordes.maiorCarga} kg
                  {recordes.repeticoesNaMaiorCarga !== null
                    ? ` (${recordes.repeticoesNaMaiorCarga} repetições)`
                    : ""}
                  .{" "}
                </>
              )}
              {recordes.maiorRepeticoes !== null && (
                <>
                  Maior número de repetições: {recordes.maiorRepeticoes}
                  {recordes.cargaNasMaioresRepeticoes !== null
                    ? ` (com ${recordes.cargaNasMaioresRepeticoes} kg)`
                    : ""}
                  .
                </>
              )}
            </p>
          )}
        </section>
      )}

      {cardioNoPeriodo.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Cardio no período</h2>
          <div className="c-tabela-rolagem">
            <table className="c-tabela-medidas">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Minutos</th>
                  <th scope="col">Distância</th>
                </tr>
              </thead>
              <tbody>
                {cardioNoPeriodo.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{dataBonita(c.data)}</th>
                    <td>{c.tipo}</td>
                    <td>{c.duracaoMin ?? "—"}</td>
                    <td>
                      {c.distanciaKm === null
                        ? "—"
                        : `${c.distanciaKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
