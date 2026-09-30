import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { DiarioDeFotos } from "@/central/components/DiarioDeFotos";
import { rotas } from "@/central/rotas";

/**
 * O diário da paciente: ela fotografa a refeição e registra. A nutricionista
 * vê pela ficha e curte.
 */
export function DiarioDeFotosPagina() {
  return (
    <>
      <CabecalhoPagina
        titulo="Diário de fotos"
        descricao="Fotografe suas refeições. Sua nutricionista acompanha e curte."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        <DiarioDeFotos pacienteId={null} />
      </div>
    </>
  );
}
