import type { PlacarPublicavel } from "@/central/utils/historicoDePontos";
import { FolhaDeDocumento } from "./FolhaDeDocumento";
import { Marca } from "./Marca";

/**
 * O placar do mês, em papel (PDF), para postar na comunidade do WhatsApp.
 *
 * Só leva o que pode ir para um grupo: posição, nome (curto, a não ser que ela
 * peça o inteiro) e pontos. Saldo, prêmio alcançado e resgate ficam de fora —
 * são assunto entre ela e cada paciente.
 *
 * As medalhas são emoji (👑 🥈 🥉), e a posição vem escrita por extenso ao lado:
 * se o aparelho que abrir o PDF não desenhar o emoji, o placar continua certo.
 */
export function DocumentoPlacar({
  placar,
  mensagem,
}: {
  placar: PlacarPublicavel;
  mensagem: string;
}) {
  return (
    <FolhaDeDocumento titulo={`Placar de ${placar.titulo}`}>
      <article className="doc doc-placar">
        <header className="doc-capa doc-placar-capa">
          <Marca altura={40} className="doc-marca" />
          <p className="doc-sobretitulo">Desafio do mês</p>
          <h1 className="doc-nome">Placar de {placar.titulo.split(" de ")[0]}</h1>
          <p className="doc-periodo">
            {placar.participantes} {placar.participantes === 1 ? "pessoa pontuou" : "pessoas pontuaram"} ·{" "}
            {placar.total} pontos juntas
          </p>
        </header>

        {placar.linhas.length === 0 ? (
          <p className="doc-paragrafo">Ninguém pontuou neste mês.</p>
        ) : (
          <ol className="doc-placar-lista">
            {placar.linhas.map((l) => (
              <li
                key={`${l.posicao}-${l.nome}`}
                className={`doc-placar-linha ${l.posicao <= 3 ? `doc-placar-p${l.posicao}` : ""}`}
              >
                <span className="doc-placar-medalha" aria-hidden="true">
                  {l.medalha}
                </span>
                <span className="doc-placar-posicao">{l.posicao}º</span>
                <span className="doc-placar-nome">{l.nome}</span>
                <span className="doc-placar-pontos">{l.pontos} pts</span>
              </li>
            ))}
          </ol>
        )}

        {placar.ocultas > 0 && (
          <p className="doc-nota">
            …e mais {placar.ocultas} {placar.ocultas === 1 ? "pessoa que pontuou" : "pessoas que pontuaram"}!
          </p>
        )}

        {mensagem.trim() && <p className="doc-placar-mensagem">{mensagem.trim()}</p>}
      </article>
    </FolhaDeDocumento>
  );
}
