import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { AvaliacaoFisica } from "@/central/components/AvaliacaoFisica";
import { rotas } from "@/central/rotas";

/**
 * A tela da avaliação física.
 *
 * Volta para o Protocolo, não para a home: a paciente chegou aqui de lá, e
 * o botão de voltar tem de desfazer o caminho que ela fez.
 */
export function Avaliacao() {
  return (
    <>
      <CabecalhoPagina
        titulo="Minha avaliação física"
        descricao="Onde você está hoje, medido na consulta."
        voltarPara={rotas.protocolo}
      />
      <div className="c-conteudo">
        <AvaliacaoFisica />
      </div>
    </>
  );
}
