/**
 * No editor do protocolo: a medida caseira de um alimento, com o desenho.
 * Só aparece quando o protocolo está "em medidas caseiras".
 */
import type { MedidaCaseira, Utensilio } from "@/central/types/protocolo";
import { IconeUtensilio } from "@/central/components/Utensilios";
import { UTENSILIOS, nomeDoUtensilio } from "@/central/utils/utensilios";

/** "1 colher de sopa" — ponto de partida, ela edita para "2 colheres de sopa". */
const textoInicial = (u: Utensilio) => `1 ${nomeDoUtensilio(u).toLowerCase()}`;

function Escolha({ valor, aoMudar }: { valor: Utensilio | ""; aoMudar: (u: Utensilio | "") => void }) {
  return (
    <div className="c-mde-escolha">
      {valor && (
        <span className="c-mde-ic" aria-hidden="true">
          <IconeUtensilio utensilio={valor} tamanho={34} />
        </span>
      )}
      <select className="c-select" value={valor} onChange={(e) => aoMudar(e.target.value as Utensilio | "")}>
        <option value="">Sem medida caseira</option>
        {UTENSILIOS.map((u) => (
          <option key={u.chave} value={u.chave}>
            {u.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EditorDaMedidaCaseira({
  medida,
  aoMudar,
}: {
  medida: MedidaCaseira | undefined;
  aoMudar: (m: MedidaCaseira | undefined) => void;
}) {
  return (
    <div className="c-mde">
      <span className="c-rotulo">Medida caseira (ela vê no lugar dos gramas)</span>
      <div className="c-mde-linha">
        <Escolha
          valor={medida?.utensilio ?? ""}
          aoMudar={(u) =>
            aoMudar(u ? { ...(medida ?? { texto: "" }), utensilio: u, texto: medida?.texto || textoInicial(u) } : undefined)
          }
        />
        {medida && (
          <input
            className="c-input"
            value={medida.texto}
            placeholder="Ex.: 2 colheres de sopa"
            onChange={(e) => aoMudar({ ...medida, texto: e.target.value })}
          />
        )}
      </div>
      {medida && (
        <>
          <div className="c-chips" role="group" aria-label="Rasa ou cheia">
            {([
              [undefined, "Não dizer"],
              ["rasa", "Rasa"],
              ["cheia", "Cheia"],
            ] as const).map(([v, r]) => (
              <button key={r} type="button" className="c-chip" aria-pressed={medida.nivel === v} onClick={() => aoMudar({ ...medida, nivel: v })}>
                {r}
              </button>
            ))}
          </div>
          <div className="c-mde-linha">
            <Escolha
              valor={medida.ou?.utensilio ?? ""}
              aoMudar={(u) =>
                aoMudar({ ...medida, ou: u ? { utensilio: u, texto: medida.ou?.texto || textoInicial(u) } : undefined })
              }
            />
            {medida.ou && (
              <input
                className="c-input"
                value={medida.ou.texto}
                placeholder="Ex.: 10 colheres de sopa"
                onChange={(e) => aoMudar({ ...medida, ou: { ...medida.ou!, texto: e.target.value } })}
              />
            )}
          </div>
          <p className="c-dica" style={{ margin: 0 }}>
            O segundo é o "ou" (opcional): outra medida para a mesma quantidade, para ela usar o que tiver em casa. Confira a
            equivalência pela sua tabela de medidas.
          </p>
        </>
      )}
    </div>
  );
}
