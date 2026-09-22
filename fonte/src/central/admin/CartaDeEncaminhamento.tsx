import { useState } from "react";
import type { DadosDaCarta, ResumoObjetivo } from "@/central/components/DocumentoEncaminhamento";
import { DocumentoEncaminhamento } from "@/central/components/DocumentoEncaminhamento";
import { AreaTexto, Campo, Texto } from "@/central/admin/componentes/Campos";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * A carta de encaminhamento — no prontuário, escrita por ela.
 *
 * O formulário nasce VAZIO nos dois campos de conteúdo. É deliberado: o
 * aplicativo preenche fato (nome, tempo de acompanhamento, consultas,
 * peso) e não escreve uma palavra de opinião clínica. Esta carta vai para
 * um médico com o nome dela embaixo; sugerir o texto seria redigir parecer
 * assinado por outra pessoa.
 *
 * A impressão usa a mesma mecânica dos outros documentos, e pelos mesmos
 * dois motivos que produzem folha em branco quando ignorados — ver
 * `pages/Documentos.tsx`: dois quadros antes de imprimir, e desmontar só no
 * `afterprint`.
 */
const VAZIA: DadosDaCarta = {
  destinatario: "",
  especialidade: "",
  motivo: "",
  observacoes: "",
  incluirResumo: false,
};

export function CartaDeEncaminhamento({
  paciente,
  nutricionista,
  resumo,
}: {
  paciente: string;
  nutricionista: string;
  resumo: ResumoObjetivo;
}) {
  const [aberta, definirAberta] = useState(false);
  const [carta, definirCarta] = useState<DadosDaCarta>(VAZIA);
  const [imprimindo, definirImprimindo] = useState(false);

  const mudar = (campo: keyof DadosDaCarta, valor: string | boolean) =>
    definirCarta((antes) => ({ ...antes, [campo]: valor }));

  function gerar() {
    definirImprimindo(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let jaSaiu = false;
        const limpar = () => {
          if (jaSaiu) return;
          jaSaiu = true;
          window.removeEventListener("afterprint", limpar);
          clearTimeout(prazo);
          definirImprimindo(false);
        };
        const prazo = setTimeout(limpar, 60_000);
        window.addEventListener("afterprint", limpar);
        window.print();
      });
    });
  }

  if (!aberta) {
    return (
      <section className="c-secao">
        <h2 className="c-secao-titulo">Encaminhamento</h2>
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">Carta para outro profissional</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            Gera uma carta em PDF para gastroenterologia, psicologia, endocrinologia — o que for.
            O texto clínico é seu; o aplicativo só preenche os dados que já estão no
            acompanhamento.
          </p>
          <button
            type="button"
            className="c-botao"
            style={{ marginTop: 12 }}
            onClick={() => definirAberta(true)}
          >
            Escrever encaminhamento
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Encaminhamento</h2>

      <div className="c-linha-medidas">
        <Campo rotulo="Para (opcional)" dica="Em branco, sai “Ao(À) profissional”.">
          <Texto
            valor={carta.destinatario}
            aoMudar={(v) => mudar("destinatario", v)}
            placeholder="Dr. João Silva"
          />
        </Campo>
        <Campo rotulo="Especialidade">
          <Texto
            valor={carta.especialidade}
            aoMudar={(v) => mudar("especialidade", v)}
            placeholder="Gastroenterologia"
          />
        </Campo>
      </div>

      <Campo rotulo="Motivo do encaminhamento" dica="É o seu texto. O aplicativo não sugere nada aqui.">
        <AreaTexto
          valor={carta.motivo}
          aoMudar={(v) => mudar("motivo", v)}
          placeholder="Sintomas gastrointestinais persistentes apesar do ajuste alimentar…"
        />
      </Campo>

      <Campo rotulo="Observações do acompanhamento (opcional)">
        <AreaTexto
          valor={carta.observacoes}
          aoMudar={(v) => mudar("observacoes", v)}
          placeholder="O que você observou e acha que ajuda quem for atender."
        />
      </Campo>

      <label className="c-campo" style={{ display: "block" }}>
        <input
          type="checkbox"
          checked={carta.incluirResumo}
          onChange={(e) => mudar("incluirResumo", e.target.checked)}
        />{" "}
        Incluir os dados objetivos (tempo de acompanhamento, consultas, peso)
      </label>
      {/* Nasce desligado: nem todo encaminhamento precisa de peso, e mandar
          peso para um psicólogo sem motivo é entregar dado que ninguém pediu. */}
      <p className="c-dica">Nem todo encaminhamento precisa desses números.</p>

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" onClick={gerar}>
          Gerar PDF
        </button>
        <button
          type="button"
          className="c-botao c-botao-secundario"
          onClick={() => {
            definirAberta(false);
            definirCarta(VAZIA);
          }}
        >
          Cancelar
        </button>
      </div>

      {/* Montado só na hora de imprimir: montado o tempo todo, ele sairia
          grudado em qualquer outro PDF gerado nesta tela — os documentos
          compartilham a classe `.doc` que a folha manda aparecer. */}
      {imprimindo && (
        <DocumentoEncaminhamento
          paciente={paciente}
          nutricionista={nutricionista}
          carta={carta}
          resumo={resumo}
          hoje={hojeSaoPaulo()}
        />
      )}
    </section>
  );
}
