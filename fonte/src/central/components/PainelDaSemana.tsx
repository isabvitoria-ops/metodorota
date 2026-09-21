import type { CardioSessao, MetaSemanal, SessaoDeTreino } from "@/central/types/treino";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import {
  MENSAGEM_META_CUMPRIDA,
  diasDaSemana,
  metasDaSemana,
} from "@/central/utils/metasSemanais";

/**
 * O painel da semana: metas, consistência e o que ela fez.
 *
 * "Pouco texto. Cards. Indicadores." — é o que esta tela é.
 *
 * O PROGRESSO É CONTADO NA HORA, das sessões. Guardado, ele envelheceria:
 * a paciente apaga um registro lançado por engano e o contador continuaria
 * em 3/4. Ver `utils/metasSemanais.ts`.
 *
 * E a meta é sempre da PROFISSIONAL. O aplicativo não cria meta, não ajusta
 * e não sugere — uma barra cheia aqui não vira "aumente para 5".
 */
export function PainelDaSemana({
  metas,
  treinos,
  cardio,
}: {
  metas: MetaSemanal[];
  treinos: SessaoDeTreino[];
  cardio: CardioSessao[];
}) {
  const hoje = hojeSaoPaulo();
  const daSemana = metasDaSemana(metas, hoje, treinos, cardio);
  const dias = diasDaSemana(hoje, treinos, cardio);
  const algumDia = dias.some((d) => d.treinou || d.cardio);

  // Sem meta e sem nada feito na semana, o painel não tem o que dizer — e
  // uma barra em 0% seria cobrança por uma semana que mal começou.
  if (daSemana.length === 0 && !algumDia) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Sua semana</h2>

      {daSemana.map((p) => (
        <div className="c-bloco c-meta" key={p.meta.id}>
          <div className="c-meta-topo">
            <span className="c-meta-nome">
              {p.meta.tipo === "treino" ? "Treino de força" : "Cardio"}
            </span>
            <span className="c-meta-numero">{p.texto}</span>
          </div>
          {/* `role="img"` com rótulo: a barra é a informação, e sem isso
              quem usa leitor de tela ouviria só o número solto. */}
          <div
            className="c-meta-barra"
            role="img"
            aria-label={`${p.porcento}% da meta da semana`}
          >
            <span style={{ width: `${p.porcento}%` }} />
          </div>
          <p className="c-meta-rodape">
            {p.cumprida ? MENSAGEM_META_CUMPRIDA : `${p.porcento}% da meta desta semana.`}
          </p>
        </div>
      ))}

      {algumDia && (
        <div className="c-bloco">
          <p className="c-meta-nome">Consistência</p>
          {/* Sempre sete quadradinhos, de segunda a domingo: a régua não
              pode mudar de tamanho a cada semana, senão comparar uma semana
              com a outra deixa de funcionar de olho. */}
          <div className="c-consistencia" aria-hidden="true">
            {dias.map((d, i) => (
              <span
                key={d.data}
                className={
                  "c-dia" +
                  (d.treinou ? " c-dia-treino" : "") +
                  (d.cardio ? " c-dia-cardio" : "")
                }
              >
                {["S", "T", "Q", "Q", "S", "S", "D"][i]}
              </span>
            ))}
          </div>
          <p className="c-meta-rodape">
            {dias.filter((d) => d.treinou).length} de treino ·{" "}
            {dias.filter((d) => d.cardio).length} de cardio nesta semana.
          </p>
        </div>
      )}
    </section>
  );
}
