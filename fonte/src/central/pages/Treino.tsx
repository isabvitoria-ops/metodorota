import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EvolucaoTreino } from "@/central/components/EvolucaoTreino";
import { rotas } from "@/central/rotas";

/**
 * A tela de evolução de treino da paciente.
 *
 * "Minha evolução", e não "Meu treino": o que esta tela faz é mostrar o que
 * mudou. O treino em si é de quem o programou.
 */
export function Treino() {
  return (
    <>
      <CabecalhoPagina
        titulo="Minha evolução"
        descricao="O que você registrou, e o que mudou de uma sessão para a outra."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        <EvolucaoTreino />
      </div>
    </>
  );
}
