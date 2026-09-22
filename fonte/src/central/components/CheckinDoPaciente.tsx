import { useEffect, useState } from "react";
import type { QuestionarioDoPaciente } from "@/central/types/questionario";
import { repositorio } from "@/central/dados/repositorio";
import { valorNaEscala, pontuacaoDoEnvio } from "@/central/utils/pontuacaoQuestionario";
import { carinhaDe, setaDaVariacao } from "@/central/utils/carinhaDaResposta";

/**
 * O histórico longitudinal de check-in, no prontuário.
 *
 * O DESENHO VEIO DA REFERÊNCIA QUE ELA MANDOU: uma linha por semana, uma
 * coluna por pergunta, carinha em vez de número, e a pontuação com a
 * variação ao lado. Cinco semanas de rostos se leem de relance; cinco
 * semanas de "7, 6, 8, 4, 9" exigem parar e comparar.
 *
 * A CARINHA MOSTRA O VALOR JÁ INVERTIDO. Em "quanta dor", 2 é semana boa e
 * aparece como rosto contente — senão a coluna de dor ficaria vermelha
 * justamente na melhor semana da paciente.
 *
 * NENHUM VEREDITO. A tabela mostra "75%" e "+25", nunca "melhorou". A
 * pontuação é resumo de respostas, não julgamento clínico — quem sabe se
 * +25 era o esperado para aquela paciente naquela semana é quem lê.
 *
 * AS MAIS NOVAS EM CIMA, porque a pergunta ao abrir o prontuário é "como
 * foi a última semana", e não "como começou o acompanhamento".
 */
function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export function CheckinDoPaciente({ pacienteId }: { pacienteId: string }) {
  const [lista, definirLista] = useState<QuestionarioDoPaciente[]>([]);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    definirCarregando(true);
    void (async () => {
      try {
        const qs = await repositorio.questionariosDoPaciente(pacienteId);
        if (vivo) definirLista(qs);
      } catch {
        if (vivo) definirLista([]);
      } finally {
        if (vivo) definirCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  const comResposta = lista.filter((q) => q.envios.length > 0);
  if (carregando) return <p className="c-contagem">Carregando os questionários…</p>;

  // Sem resposta nenhuma a seção some inteira: uma seção vazia dizendo
  // "nenhum check-in" ocuparia o prontuário para informar o óbvio.
  if (comResposta.length === 0) return null;

  return (
    <>
      {comResposta.map((q) => (
        <TabelaDoQuestionario key={q.id} questionario={q} />
      ))}
    </>
  );
}

function TabelaDoQuestionario({ questionario }: { questionario: QuestionarioDoPaciente }) {
  const [revisados, definirRevisados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(questionario.envios.map((e) => [e.id, e.revisado])),
  );
  const [erro, definirErro] = useState<string | null>(null);

  // Só as perguntas que viram coluna. Texto livre não cabe numa célula —
  // vai embaixo, inteiro, que é onde costuma estar a informação mais útil.
  const colunas = questionario.perguntas.filter(
    (p) => p.tipo === "escala" || p.tipo === "sim_nao",
  );
  const abertas = questionario.perguntas.filter((p) => p.tipo === "texto");

  // Da mais antiga para a mais nova, para calcular a variação; a tabela é
  // desenhada ao contrário.
  const cronologica = [...questionario.envios].sort((a, b) =>
    a.periodo.localeCompare(b.periodo),
  );
  const notas = new Map(
    cronologica.map((e) => [e.id, pontuacaoDoEnvio(questionario.perguntas, e)]),
  );
  const variacoes = new Map<string, number | null>();
  let anterior: number | null = null;
  for (const e of cronologica) {
    const nota = notas.get(e.id) ?? null;
    variacoes.set(e.id, nota !== null && anterior !== null ? nota - anterior : null);
    if (nota !== null) anterior = nota;
  }

  const linhas = [...cronologica].reverse();
  const semanal = questionario.periodicidade === "semanal";

  async function alternarRevisado(envioId: string) {
    const novo = !revisados[envioId];
    // Otimista, e depois corrigido pelo estado GRAVADO: a marca é um clique
    // de leitura, e esperar a rede para pintar a caixa emperraria a tela.
    definirRevisados({ ...revisados, [envioId]: novo });
    try {
      const estado = await repositorio.marcarRevisado(envioId, novo);
      definirRevisados((atual) => ({ ...atual, [envioId]: estado }));
    } catch (e) {
      definirRevisados((atual) => ({ ...atual, [envioId]: !novo }));
      definirErro(e instanceof Error ? e.message : "Não consegui marcar.");
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{questionario.titulo}</h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        {semanal ? "Uma linha por semana." : "Uma linha por resposta."} As carinhas já
        consideram as perguntas invertidas — em “dores”, rosto contente quer dizer pouca dor.
      </p>

      {!questionario.atribuido && (
        <p className="c-dica">
          Este questionário não está mais atribuído a ela. O histórico continua aqui.
        </p>
      )}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}

      {/* A rolagem fica NA TABELA, e não na página: no celular, uma tabela de
          seis colunas não cabe, e deixar a página inteira rolar de lado
          quebraria todo o resto da tela junto. */}
      <div className="c-rolagem-tabela">
        <table className="c-tabela-checkin">
          <thead>
            <tr>
              <th scope="col">Data</th>
              {colunas.map((p) => (
                <th scope="col" key={p.id}>
                  {p.texto}
                </th>
              ))}
              <th scope="col">Score</th>
              <th scope="col">Revisado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((envio) => {
              const porId = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
              const nota = notas.get(envio.id) ?? null;
              const variacao = variacoes.get(envio.id) ?? null;
              return (
                <tr key={envio.id}>
                  <th scope="row">{diaCurto(envio.periodo)}</th>
                  {colunas.map((p) => {
                    const valor = valorNaEscala(
                      { id: p.id, tipo: p.tipo, peso: p.peso || 1, invertida: p.invertida },
                      porId.get(p.id),
                    );
                    const carinha = carinhaDe(valor);
                    return (
                      <td key={p.id} className="c-celula-carinha">
                        {carinha ? (
                          <span
                            className={`c-carinha nivel-${carinha.nivel}`}
                            title={`${p.texto}: ${carinha.descricao}`}
                          >
                            <span aria-hidden="true">{carinha.rosto}</span>
                            <span className="c-so-leitor">{carinha.descricao}</span>
                          </span>
                        ) : (
                          // Não respondeu não é carinha triste: é ausência.
                          <span className="c-sem-resposta" title="não respondeu">
                            <span aria-hidden="true">—</span>
                            <span className="c-so-leitor">não respondeu</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="c-celula-score">
                    {nota === null ? (
                      <span className="c-sem-resposta">—</span>
                    ) : (
                      <>
                        <strong>{nota}%</strong>
                        <span className="c-variacao">{setaDaVariacao(variacao)}</span>
                      </>
                    )}
                  </td>
                  <td className="c-celula-revisado">
                    <label className="c-so-leitor" htmlFor={`rev-${envio.id}`}>
                      Marcar a semana de {diaCurto(envio.periodo)} como revisada
                    </label>
                    <input
                      id={`rev-${envio.id}`}
                      type="checkbox"
                      checked={revisados[envio.id] ?? false}
                      onChange={() => void alternarRevisado(envio.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* O que ela escreveu, inteiro e sem resumo. Geralmente é a informação
          mais útil da semana, e é a que nenhuma nota captura. */}
      {abertas.length > 0 &&
        linhas.map((envio) => {
          const porId = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
          const ditos = abertas
            .map((p) => ({ p, texto: porId.get(p.id)?.texto ?? "" }))
            .filter((x) => x.texto.trim() !== "");
          if (ditos.length === 0) return null;
          return (
            <div className="c-evento" key={envio.id}>
              <p className="c-lista-item-nome">
                {semanal ? `Semana de ${diaCurto(envio.periodo)}` : diaCurto(envio.periodo)}
              </p>
              {ditos.map(({ p, texto }) => (
                <p className="c-dica" key={p.id}>
                  <strong>{p.texto}</strong> {texto}
                </p>
              ))}
            </div>
          );
        })}
    </section>
  );
}
