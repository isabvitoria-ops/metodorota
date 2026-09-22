import { dataBonita } from "@/central/utils/situacao";
import { FolhaDeDocumento } from "./FolhaDeDocumento";
import { Marca } from "./Marca";

export interface DadosDaCarta {
  /** "Dr. João Silva", ou em branco para o genérico. */
  destinatario: string;
  /** "Gastroenterologia", "Psicologia". Texto livre: é a rede dela. */
  especialidade: string;
  motivo: string;
  observacoes: string;
  /** Se o bloco de dados objetivos entra. */
  incluirResumo: boolean;
}

export interface ResumoObjetivo {
  semanas: number | null;
  consultas: number;
  pesoAtual: number | null;
  pesoInicial: number | null;
}

/**
 * A carta de encaminhamento, em papel.
 *
 * O público dela é gastro: encaminhar para gastroenterologia, psicologia ou
 * endocrinologia é rotina, e hoje ela escreve à mão toda vez.
 *
 * O QUE O APLICATIVO ESCREVE E O QUE ELE NÃO ESCREVE — e a linha entre as
 * duas coisas é a razão de este documento existir do jeito que existe:
 *
 *   ESCREVE o que é FATO e já está no banco: nome, há quanto tempo o
 *   acompanhamento corre, quantas consultas houve, peso atual e inicial.
 *   São números que ela mesma lançou, e digitá-los de novo numa carta é
 *   trabalho manual sem nenhum julgamento envolvido.
 *
 *   NÃO ESCREVE uma palavra de conteúdo clínico. Motivo do encaminhamento e
 *   observações vêm em branco e são dela. Um aplicativo que sugerisse o
 *   texto de um encaminhamento estaria redigindo opinião clínica assinada
 *   por outra pessoa — e essa carta vai para um médico, com o nome dela
 *   embaixo.
 *
 * O bloco de dados objetivos é OPCIONAL e nasce desligado: nem todo
 * encaminhamento precisa de peso, e mandar peso para um psicólogo sem
 * motivo é entregar dado que ninguém pediu.
 */
export function DocumentoEncaminhamento({
  paciente,
  nutricionista,
  carta,
  resumo,
  hoje,
}: {
  paciente: string;
  nutricionista: string;
  carta: DadosDaCarta;
  resumo: ResumoObjetivo;
  hoje: string;
}) {
  const para = carta.destinatario.trim();
  const especialidade = carta.especialidade.trim();

  const numero = (v: number | null) =>
    v === null ? null : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <FolhaDeDocumento titulo={`Encaminhamento — ${paciente}`}>
      <article className="doc">
        <header className="doc-capa">
          <Marca altura={40} className="doc-marca" />
          <p className="doc-sobretitulo">Encaminhamento</p>
          <h1 className="doc-nome">{paciente}</h1>
          <p className="doc-periodo">{dataBonita(hoje)}</p>
        </header>

        <section className="doc-secao">
          <p className="doc-paragrafo">
            {para
              ? `A ${para}${especialidade ? ` — ${especialidade}` : ""},`
              : especialidade
                ? `Ao(À) profissional de ${especialidade},`
                : "Ao(À) profissional,"}
          </p>

          <p className="doc-paragrafo">
            Encaminho a paciente <strong>{paciente}</strong>, que acompanho em atendimento
            nutricional
            {resumo.semanas !== null && resumo.semanas > 0
              ? ` há ${resumo.semanas} ${resumo.semanas === 1 ? "semana" : "semanas"}`
              : ""}
            .
          </p>

          {carta.motivo.trim() && (
            <>
              <h2 className="doc-titulo">Motivo do encaminhamento</h2>
              {carta.motivo
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => (
                  <p className="doc-paragrafo" key={l.slice(0, 32)}>
                    {l}
                  </p>
                ))}
            </>
          )}

          {carta.observacoes.trim() && (
            <>
              <h2 className="doc-titulo">Observações do acompanhamento</h2>
              {carta.observacoes
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => (
                  <p className="doc-paragrafo" key={l.slice(0, 32)}>
                    {l}
                  </p>
                ))}
            </>
          )}

          {carta.incluirResumo && (
            <>
              <h2 className="doc-titulo">Dados do acompanhamento</h2>
              <ul className="doc-lista">
                {resumo.semanas !== null && (
                  <li>
                    Em acompanhamento há {resumo.semanas}{" "}
                    {resumo.semanas === 1 ? "semana" : "semanas"}.
                  </li>
                )}
                <li>
                  {resumo.consultas} {resumo.consultas === 1 ? "consulta" : "consultas"} realizadas.
                </li>
                {resumo.pesoAtual !== null && (
                  <li>
                    Peso atual: {numero(resumo.pesoAtual)} kg
                    {resumo.pesoInicial !== null
                      ? ` (primeira avaliação: ${numero(resumo.pesoInicial)} kg)`
                      : ""}
                    .
                  </li>
                )}
              </ul>
              {/* A origem do número fica escrita: quem recebe a carta precisa
                  saber que o peso é de avaliação registrada, e não relatado. */}
              <p className="doc-nota">
                Dados registrados no acompanhamento nutricional.
              </p>
            </>
          )}

          <p className="doc-paragrafo" style={{ marginTop: 22 }}>
            Permaneço à disposição para trocar informações sobre o caso.
          </p>
        </section>

        {/* DEFEITO QUE ISTO CONSERTA, visto no PDF gerado: com `doc-quebra`
            (que é `break-before: page`), a assinatura ia SOZINHA para uma
            segunda folha em branco. Uma carta de encaminhamento com a
            assinatura numa página vazia chega assim na mão de um médico.

            O que se quer não é uma página nova: é que o bloco da assinatura
            não se parta ao meio. `break-inside: avoid` diz exatamente isso,
            e deixa a assinatura fechar a mesma página quando ela cabe. */}
        <section className="doc-secao doc-assinatura">
          <p className="doc-paragrafo" style={{ textAlign: "center", marginTop: 34 }}>
            ______________________________________
          </p>
          <p className="doc-paragrafo" style={{ textAlign: "center" }}>
            <strong>{nutricionista || "Nutricionista"}</strong>
          </p>
          <p className="doc-nota" style={{ textAlign: "center" }}>
            Nutricionista
          </p>
        </section>

        <p className="doc-rodape">
          {paciente} · {dataBonita(hoje)}
        </p>
      </article>
    </FolhaDeDocumento>
  );
}
