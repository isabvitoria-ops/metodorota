import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { LimpezaDePontos, MesDoHistorico } from "@/central/types/desafio";
import { DocumentoPlacar } from "@/central/components/DocumentoPlacar";
import {
  nomeDoMes,
  placarComoTexto,
  placarParaWhatsApp,
  placarPublicavel,
} from "@/central/utils/historicoDePontos";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { AreaTexto, Campo, Selecao } from "./componentes/Campos";

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

      <LimpezaDosAntigos />

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
                <PlacarParaComunidade mes={mes} aoAvisar={definirAviso} />
                <button
                  type="button"
                  className="c-botao c-botao-secundario c-botao-pequeno"
                  style={{ marginTop: 10 }}
                  onClick={() => void copiar(mes)}
                >
                  Copiar só para mim (com saldo)
                </button>
              </>
            )}
          </details>
        );
      })}
    </>
  );
}

const MENSAGEM_PADRAO = "Obrigada por fazerem parte do Desafio! 💚 Cada ação conta — bora pro próximo mês!";

/**
 * O placar do mês para postar na comunidade do WhatsApp: um PDF (com coroa e
 * medalhas) e o mesmo texto para colar na conversa. Só leva nome e pontos; por
 * padrão o nome sai curto ("Ana M."), e o nome inteiro é uma escolha dela.
 */
function PlacarParaComunidade({
  mes,
  aoAvisar,
}: {
  mes: MesDoHistorico;
  aoAvisar: (texto: string) => void;
}) {
  const [nomeCompleto, definirNomeCompleto] = useState(false);
  const [quantas, definirQuantas] = useState("10");
  const [mensagem, definirMensagem] = useState(MENSAGEM_PADRAO);
  const [imprimindo, definirImprimindo] = useState(false);

  const opcoes = { nomeCompleto, limite: quantas === "todas" ? null : Number(quantas) };
  const placar = placarPublicavel(mes, opcoes);

  function gerarPdf() {
    definirImprimindo(true);
    // Dois quadros antes de imprimir e desmontar só no `afterprint`: o mesmo
    // cuidado dos outros documentos (ver CartaDeEncaminhamento).
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

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(placarParaWhatsApp(mes, opcoes, mensagem));
      aoAvisar(`Texto do placar de ${nomeDoMes(mes.mes)} copiado — é só colar no WhatsApp.`);
    } catch {
      aoAvisar("Não consegui copiar. Use o botão de PDF.");
    }
  }

  if (placar.linhas.length === 0) return null;

  return (
    <div className="c-bloco" style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 14 }}>Para a comunidade do WhatsApp</strong>
      <p className="c-dica">
        👑 1º lugar · 🥈 2º · 🥉 3º. Só leva nome e pontos — saldo e prêmios ficam de fora.
      </p>
      <div className="c-duas-colunas">
        <Campo rotulo="Quantas aparecem">
          <Selecao
            valor={quantas}
            aoMudar={definirQuantas}
            opcoes={[
              { valor: "3", rotulo: "Só o pódio (3)" },
              { valor: "5", rotulo: "As 5 primeiras" },
              { valor: "10", rotulo: "As 10 primeiras" },
              { valor: "todas", rotulo: "Todas que pontuaram" },
            ]}
          />
        </Campo>
        <Campo rotulo="Nome">
          <label className="c-campo" style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={nomeCompleto}
              onChange={(e) => definirNomeCompleto(e.target.checked)}
            />{" "}
            Nome completo (senão sai “Ana M.”)
          </label>
        </Campo>
      </div>
      <Campo rotulo="Mensagem no fim (opcional)">
        <AreaTexto valor={mensagem} aoMudar={definirMensagem} />
      </Campo>
      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao c-botao-pequeno" onClick={gerarPdf}>
          Gerar PDF do placar
        </button>
        <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => void copiarTexto()}>
          Copiar texto para o WhatsApp
        </button>
      </div>
      {imprimindo && <DocumentoPlacar placar={placar} mensagem={mensagem} />}
    </div>
  );
}

/**
 * A limpeza de 3 em 3 meses. Em outubro, sai de junho para trás e ficam julho,
 * agosto, setembro e outubro. Primeiro MOSTRA o que sairia; só apaga depois de
 * uma confirmação, e as linhas vão para um arquivo antes de saírem do saldo.
 */
function LimpezaDosAntigos() {
  const [previa, definirPrevia] = useState<LimpezaDePontos | null>(null);
  const [confirmando, definirConfirmando] = useState(false);
  const [ocupado, definirOcupado] = useState(false);
  const [recado, definirRecado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    void repositorio.limparPontosAntigos(false).then(definirPrevia).catch(() => definirPrevia(null));
  }, []);

  async function limpar() {
    definirOcupado(true);
    definirErro(null);
    try {
      const r = await repositorio.limparPontosAntigos(true);
      definirRecado(
        r.apagou
          ? `Pronto: ${r.linhas} lançamentos de ${r.pacientes} ${r.pacientes === 1 ? "paciente" : "pacientes"} saíram do saldo e foram guardados no arquivo.`
          : "Não havia nada para limpar.",
      );
      definirConfirmando(false);
      definirPrevia(await repositorio.limparPontosAntigos(false));
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui limpar.");
    } finally {
      definirOcupado(false);
    }
  }

  if (!previa) return null;
  const corte = nomeDoMes(previa.corte);

  return (
    <div className="c-bloco" style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 14 }}>Limpeza de 3 em 3 meses</strong>
      <p className="c-dica">
        Ficam {corte} em diante; o que for mais antigo sai do saldo (e dos prêmios). As indicações
        não mudam.
      </p>
      {recado && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{recado}</span>
        </div>
      )}
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {previa.linhas === 0 ? (
        <p className="c-dica">Nada para limpar agora: não há pontos anteriores a {corte}.</p>
      ) : (
        <>
          <p className="c-dica">
            Hoje há <strong>{previa.linhas}</strong> lançamentos antigos ({previa.pontos} pontos, de{" "}
            {previa.pacientes} {previa.pacientes === 1 ? "paciente" : "pacientes"}).
            {previa.saldoNegativo > 0
              ? ` Atenção: ${previa.saldoNegativo} ${previa.saldoNegativo === 1 ? "paciente ficaria" : "pacientes ficariam"} com saldo negativo, porque resgataram prêmios com pontos que são antigos.`
              : ""}
          </p>
          {confirmando ? (
            <div className="c-linha-botoes-treino">
              <button type="button" className="c-botao c-botao-pequeno" disabled={ocupado} onClick={() => void limpar()}>
                {ocupado ? "Limpando…" : "Sim, limpar agora"}
              </button>
              <button type="button" className="c-link" onClick={() => definirConfirmando(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              onClick={() => definirConfirmando(true)}
            >
              Limpar os pontos antigos…
            </button>
          )}
        </>
      )}
    </div>
  );
}
