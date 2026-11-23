import { useMemo, useState } from "react";
import type { Alimento } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { CampoAlimento } from "@/central/components/CampoAlimento";

/**
 * Os alimentos da lista de trocas ligados a uma restrição (0105). É isto
 * que a Troca da paciente lê: alergia esconde, intolerância e sensibilidade
 * avisam, preferência vai para o fim. Sem alimento ligado, nada muda na troca.
 */
export function AlimentosDaTroca({ ids, aoMudar }: { ids: string[]; aoMudar: (ids: string[]) => void }) {
  const [campo, definirCampo] = useState(0);
  const todos = useMemo(() => catalogo.alimentos().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), []);
  const disponiveis = todos.filter((a) => !ids.includes(a.id));
  const nome = (id: string) => catalogo.alimento(id)?.nome ?? id;

  return (
    <div className="c-alim-troca">
      <CampoAlimento
        key={campo}
        rotulo="Alimentos da lista de trocas"
        placeholder="Buscar alimento para ligar"
        opcoes={disponiveis}
        selecionado={null}
        aoSelecionar={(a: Alimento) => {
          aoMudar([...ids, a.id]);
          definirCampo((n) => n + 1);
        }}
        aoLimpar={() => undefined}
      />
      {ids.length > 0 ? (
        <div className="c-alim-troca-chips">
          {ids.map((id) => (
            <button key={id} type="button" className="c-chip" onClick={() => aoMudar(ids.filter((x) => x !== id))} aria-label={`Tirar ${nome(id)}`}>
              {nome(id)} ✕
            </button>
          ))}
        </div>
      ) : (
        <p className="c-dica">Nenhum ligado: esta restrição não muda a troca da paciente.</p>
      )}
    </div>
  );
}
