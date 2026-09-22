import type { RegistroDeReintroducao } from "@/central/types";
import { faltaParaLer, lerPadroes } from "@/central/utils/padroesRastreio";

/**
 * O que os registros mostram quando lidos juntos — SÓ PARA A NUTRICIONISTA.
 *
 * POR QUE A PACIENTE NÃO VÊ ISTO, e é a decisão mais importante do módulo:
 *
 * "4 de 5 alimentos com sintoma são altos em Histamina" é uma pergunta
 * clínica excelente na mão de quem estuda o assunto — e é um motivo para
 * cortar cinco alimentos na mão de quem está com medo de comer. A paciente
 * leria como veredito, e o aplicativo inteiro foi construído para nunca dar
 * veredito sobre comida: é a mesma razão de a palavra "proibido" não existir
 * em lugar nenhum e de a escada de tolerância dizer "comer com atenção" em
 * vez de "não coma".
 *
 * Quem cruza sintoma com marcador e decide o que fazer é ela, na consulta,
 * com a paciente na frente. Esta tela existe para que ela chegue nessa
 * conversa já tendo visto o padrão — não para adiantar a conclusão.
 *
 * O QUE ESTÁ ESCRITO AQUI É CONTAGEM, não interpretação: toda frase traz os
 * números dentro dela, e nenhuma afirma causa. Ver `utils/padroesRastreio.ts`.
 */
export function PadroesDoRastreio({ registros }: { registros: RegistroDeReintroducao[] }) {
  const leitura = lerPadroes(registros);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">O que os registros mostram</h2>

      {!leitura.temDados ? (
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">Ainda não dá para dizer</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            {leitura.totalDeRegistros === 0
              ? "Ela ainda não registrou nada."
              : `${leitura.totalDeRegistros} ${
                  leitura.totalDeRegistros === 1 ? "registro" : "registros"
                } até agora. ${faltaParaLer(leitura.totalDeRegistros)}`}
          </p>
        </div>
      ) : (
        <>
          <div className="c-bloco">
            <ul className="c-padroes">
              {leitura.padroes.map((p) => (
                <li key={p.id}>{p.texto}</li>
              ))}
            </ul>
          </div>

          {/* A ressalva fica na tela, não só no código: quem abre isto às
              pressas antes da consulta precisa ler que são contagens. */}
          <p className="c-dica">
            São contagens sobre o que ela registrou, não conclusões. O aplicativo não relaciona
            causa — quem lê o padrão e decide o que fazer com ele é você.
          </p>
          <p className="c-dica">Esta leitura não aparece para a paciente.</p>
        </>
      )}
    </section>
  );
}
