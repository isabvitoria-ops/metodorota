/**
 * Os documentos novos no padrão do PDF do plano (cabeçalho `doc-pa-*`,
 * rodapé com nome, CRN e contato escrito por `FolhaDeDocumento`):
 *   - pedido de exames (a nutricionista monta para uma paciente);
 *   - mercado da semana (soma do plano, ver utils/listaDeCompras.ts);
 *   - minhas trocas (cada item do plano com as substituições).
 */
import type { ConteudoProtocolo } from "@/central/types/protocolo";
import { partirSubstituicao } from "@/central/utils/protocoloDaPaciente";
import type { ListaDeCompras } from "@/central/utils/listaDeCompras";
import { CRN_DA_NUTRICIONISTA } from "@/central/utils/marcaDosDocumentos";
import { hojeEmTexto } from "@/central/utils/dataDoDocumento";
import { CabecalhoDoDocumento } from "./CabecalhoDoDocumento";
import { FolhaDeDocumento } from "./FolhaDeDocumento";

export interface GrupoDeExames {
  grupo: string;
  exames: string[];
}

export function DocumentoExames({
  paciente,
  data,
  grupos,
  orientacao,
  nutricionista,
}: {
  paciente: string;
  data: string;
  /** Só os grupos com algum exame marcado, e só os marcados. */
  grupos: GrupoDeExames[];
  orientacao: string;
  nutricionista: string;
}) {
  return (
    <FolhaDeDocumento titulo={`Pedido de exames — ${paciente}`}>
      <article className="doc doc-exames">
        <CabecalhoDoDocumento sobretitulo="Solicitação de exames" titulo="Pedido de exames" paciente={paciente} data={data} />
        <p className="doc-novo-intro">Solicito os exames laboratoriais abaixo para acompanhamento nutricional.</p>
        <div className="doc-ex-grupos">
          {grupos.map((g) => (
            <section key={g.grupo} className="doc-ex-grupo">
              <h2 className="doc-pa-secao-titulo">{g.grupo}</h2>
              <ul>
                {g.exames.map((e) => (
                  <li key={e}>
                    <span className="doc-caixa doc-caixa--marcada" aria-hidden="true">
                      ✓
                    </span>
                    {e}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {orientacao.trim() && (
          <p className="doc-pa-ajustes doc-ex-orientacao">
            <strong>No dia da coleta: </strong>
            {orientacao.trim()}
          </p>
        )}
        <div className="doc-assinatura">
          <span className="doc-assinatura-linha" />
          <strong>{nutricionista}</strong>
          <span>Nutricionista · {CRN_DA_NUTRICIONISTA}</span>
        </div>
      </article>
    </FolhaDeDocumento>
  );
}

export function DocumentoCompras({ paciente, lista }: { paciente: string; lista: ListaDeCompras }) {
  return (
    <FolhaDeDocumento titulo={`Mercado da semana — ${paciente}`}>
      <article className="doc doc-compras">
        <CabecalhoDoDocumento sobretitulo="Lista de compras · 7 dias" titulo="Mercado da semana" paciente={paciente} data={hojeEmTexto()} />
        <p className="doc-novo-intro">
          Somei as quantidades do seu plano para 7 dias, na primeira opção de cada refeição. O peso que está no plano é o do
          alimento como você come: se o plano diz “arroz cozido”, a conta é de arroz cozido.
        </p>
        {lista.secoes.map((s) => (
          <section key={s.titulo} className="doc-cp-secao">
            <h2 className="doc-pa-secao-titulo">{s.titulo}</h2>
            <ul>
              {s.itens.map((i) => (
                <li key={i.nome}>
                  <span className="doc-caixa" aria-hidden="true" />
                  <span className="doc-cp-nome">{i.nome}</span>
                  <span className="doc-cp-conta">{i.conta}</span>
                  <strong className="doc-cp-total">{i.total}</strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {lista.semConta.length > 0 && (
          <section className="doc-cp-secao">
            <h2 className="doc-pa-secao-titulo">Conforme o plano</h2>
            <p className="doc-novo-intro doc-cp-semconta">
              Estes itens não têm uma quantidade que dê para somar (ex.: “à vontade”). Compre conforme o seu plano:
            </p>
            <ul>
              {lista.semConta.map((i) => (
                <li key={i}>
                  <span className="doc-caixa" aria-hidden="true" />
                  <span className="doc-cp-nome">{i}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </FolhaDeDocumento>
  );
}

export function DocumentoTrocas({ paciente, conteudo }: { paciente: string; conteudo: ConteudoProtocolo }) {
  return (
    <FolhaDeDocumento titulo={`Minhas trocas — ${paciente}`}>
      <article className="doc doc-trocas">
        <CabecalhoDoDocumento sobretitulo="Protocolo alimentar" titulo="Minhas trocas" paciente={paciente} data={hojeEmTexto()} />
        <p className="doc-novo-intro">Cada alimento do plano e o que pode entrar no lugar dele, na quantidade certa.</p>
        {conteudo.refeicoes.map((r, k) => {
          const linhas = r.opcoes.flatMap((o) =>
            o.itens.map((i) => ({ opcao: r.opcoes.length > 1 ? o.rotulo : null, item: i })),
          );
          if (!linhas.length) return null;
          return (
            <section key={`${r.nome}-${k}`} className="doc-tr-refeicao">
              <h2 className="doc-pa-secao-titulo">{r.nome}</h2>
              <table className="doc-tabela doc-tr-tabela">
                <thead>
                  <tr>
                    <th>No plano</th>
                    <th>Quantidade</th>
                    <th>Pode trocar por</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ opcao, item }, j) => {
                    const trocas = item.substituicoes.filter((t) => t.trim());
                    return (
                      <tr key={j}>
                        <td>
                          <strong>{item.alimento}</strong>
                          {opcao && <small className="doc-tr-opcao">{opcao}</small>}
                        </td>
                        <td>{item.quantidade || "—"}</td>
                        <td>
                          {trocas.length
                            ? trocas.map((t, z) => {
                                const { alimento, quantidade } = partirSubstituicao(t);
                                return (
                                  <span key={z} className="doc-tr-troca">
                                    {alimento} {quantidade && <b>{quantidade}</b>}
                                  </span>
                                );
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </article>
    </FolhaDeDocumento>
  );
}

/** Uma linha do PDF de medicamentos: o que ela usa e o que acompanhar (só da base CONFERIDA). */
export interface LinhaDeMedicamento {
  nome: string;
  tipo: string;
  uso: string;
  /** Nutriente e o número da fonte (1, 2…) na lista de fontes. */
  acompanhar: { nutriente: string; fonte: number }[];
  anotacao: string | null;
}

/**
 * Medicamentos e nutrientes (N31): para a nutricionista e o médico. Cada
 * nutriente leva o número da sua fonte; sem fonte, não entra. Nada aqui é
 * escrito por IA.
 */
export function DocumentoMedicamentos({
  paciente,
  linhas,
  fontes,
  nutricionista,
}: {
  paciente: string;
  linhas: LinhaDeMedicamento[];
  fontes: string[];
  nutricionista: string;
}) {
  const anotacoes = linhas.filter((l) => l.anotacao?.trim());
  return (
    <FolhaDeDocumento titulo={`Medicamentos e nutrientes — ${paciente}`}>
      <article className="doc doc-medicamentos">
        <CabecalhoDoDocumento sobretitulo="Acompanhamento nutricional" titulo="Medicamentos e nutrientes" paciente={paciente} data={hojeEmTexto()} />
        <p className="doc-novo-intro">O que está em uso e os nutrientes que a literatura indica acompanhar, com a fonte de cada linha.</p>
        <table className="doc-tabela doc-tr-tabela">
          <thead>
            <tr>
              <th>Em uso</th>
              <th>Dose e horário</th>
              <th>Acompanhar</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>
                  <strong>{l.nome}</strong>
                  {l.tipo && <small className="doc-tr-opcao">{l.tipo}</small>}
                </td>
                <td>{l.uso || "—"}</td>
                <td>
                  {l.acompanhar.length
                    ? l.acompanhar.map((a, j) => (
                        <span key={j} className="doc-tr-troca">
                          {a.nutriente}
                          <sup>{a.fonte}</sup>
                        </span>
                      ))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {anotacoes.length > 0 && (
          <div className="doc-pa-ajustes doc-med-anotacao">
            <strong>Anotação da nutricionista</strong>
            {anotacoes.map((l, i) => (
              <p key={i}>
                <b>{l.nome}:</b> {l.anotacao!.trim()}
              </p>
            ))}
          </div>
        )}
        {fontes.length > 0 && (
          <section className="doc-med-fontes">
            <h2 className="doc-pa-secao-titulo">Fontes</h2>
            <ol>
              {fontes.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ol>
          </section>
        )}
        <p className="doc-med-aviso">Documento de apoio. Não substitui a avaliação médica e não é prescrição.</p>
        <div className="doc-assinatura">
          <span className="doc-assinatura-linha" />
          <strong>{nutricionista}</strong>
          <span>Nutricionista · {CRN_DA_NUTRICIONISTA}</span>
        </div>
      </article>
    </FolhaDeDocumento>
  );
}
