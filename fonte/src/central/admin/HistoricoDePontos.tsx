import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { MesDoHistorico } from "@/central/types/desafio";
import { nomeDoMes, placarComoTexto } from "@/central/utils/historicoDePontos";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * O placar de cada mês, para a nutricionista.
 *
 * Existe para o primeiro dia do mês: "quantos pontos cada uma fez no mês que
 * acabou?" — a pergunta de quem vai dar os presentes. A resposta não depende
 * de memória: vem do livro de pontos, mês a mês.
 *
 * A JANELA É DE 3 MESES (o atual e os 3 anteriores). O que é mais antigo sai
 * da tela sozinho; os pontos continuam valendo no saldo de cada paciente.
 */
export function HistoricoDePontos() {
  const [meses, definirMeses] = useState<MesDoHistorico[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const mesDeHoje = `${hojeSaoPaulo().slice(0, 7)}-01`;

  useEffect(() => {
    void repositorio
      .historicoMensalDePontos(3)
      .then(definirMeses)
      .catch((e) => definirErro(e instanceof Error ? e.message : "Não consegui carregar o histórico."));
  }, []);

  async function copiar(mes: MesDoHistorico) {
    try {
      await navigator.clipboard.writeText(placarComoTexto(mes));
      definirAviso(`Placar de ${nomeDoMes(mes.mes)} copiado.`);
    } catch {
      definirAviso("Não consegui copiar. Selecione o texto da lista e copie.");
    }
  }

  if (erro) {
    return (
      <div className="c-aviso c-aviso-erro" role="alert">
        <span>{erro}</span>
      </div>
    );
  }
  if (!meses) return <p className="c-contagem">Carregando…</p>;

  return (
    <>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Quantos pontos cada paciente fez em cada mês, para você dar os presentes. Mostra o mês
        atual e os 3 anteriores; os mais antigos saem da tela sozinhos, mas os pontos continuam
        valendo no saldo de cada uma. O “saldo” é o acumulado até o fim daquele mês.
      </p>

      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      {meses.map((mes) => {
        const atual = mes.mes === mesDeHoje;
        return (
          <details key={mes.mes} className="c-bloco" open={atual || mes.ranking.length > 0} style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer" }}>
              <strong>{nomeDoMes(mes.mes)}</strong>
              <span className="c-dica" style={{ display: "block", margin: "2px 0 0 18px" }}>
                {atual ? "em andamento · " : ""}
                {mes.ranking.length} {mes.ranking.length === 1 ? "paciente" : "pacientes"} · {mes.total} pontos
              </span>
            </summary>

            {mes.ranking.length === 0 ? (
              <p className="c-dica">Ninguém pontuou neste mês.</p>
            ) : (
              <>
                <div className="c-ranking c-ranking-historico" style={{ marginTop: 10 }}>
                  {mes.ranking.map((l, i) => (
                    <div key={l.pacienteId} className={`c-ranking-linha ${i < 3 ? "destaque" : ""}`}>
                      <span className="c-ranking-posicao">{i + 1}º</span>
                      <span className="c-ranking-nome">
                        {l.nome}
                        <span className="c-dica" style={{ display: "block" }}>
                          saldo {l.saldo}
                          {l.resgatou > 0 ? ` · resgatou ${l.resgatou}` : ""}
                          {l.recompensa ? ` · alcançou: ${l.recompensa}` : ""}
                        </span>
                      </span>
                      <span className="c-ranking-pontos">{l.pontos} pts</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="c-botao c-botao-secundario c-botao-pequeno"
                  style={{ marginTop: 10 }}
                  onClick={() => void copiar(mes)}
                >
                  Copiar placar
                </button>
              </>
            )}
          </details>
        );
      })}
    </>
  );
}
