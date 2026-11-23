/**
 * Configurações → Lixeira (0102). O que ela apagou nos últimos 30 dias, com
 * quantos dias faltam. Restaurar devolve tudo junto (a paciente volta com os
 * registros dela). Apagar de vez serve também para o pedido de LGPD.
 */
import { useCallback, useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { ItemDaLixeira, TipoNaLixeira } from "@/central/types/lixeira";

const ROTULO: Record<TipoNaLixeira, string> = {
  paciente: "Paciente",
  receita: "Receita",
  exame: "Exame",
  grupo_protocolo: "Grupo de protocolo",
};
const dataBr = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function LixeiraAdmin() {
  const [itens, definirItens] = useState<ItemDaLixeira[] | null>(null);
  const [recado, definirRecado] = useState<string | null>(null);
  const [apagando, definirApagando] = useState<string | null>(null);
  const [esvaziando, definirEsvaziando] = useState(false);
  const [confirmacao, definirConfirmacao] = useState("");
  const [ocupado, definirOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      definirItens(await repositorio.itensDaLixeira());
    } catch {
      definirItens([]);
      definirRecado("Não consegui abrir a lixeira. Recarregue a página.");
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<void>, ok: string) {
    definirOcupado(true);
    try {
      await acao();
      definirRecado(ok);
      await carregar();
    } catch (e) {
      definirRecado(e instanceof Error ? e.message : "Não deu certo. Tente de novo.");
    } finally {
      definirOcupado(false);
      definirApagando(null);
    }
  }

  if (!itens) return null;

  return (
    <div className="c-bloco" id="lixeira">
      <h2>Lixeira</h2>
      <p className="c-dica">O que você apagou nos últimos 30 dias. Depois disso, some de vez. A paciente não vê a lixeira.</p>
      {recado && (
        <p className="c-dica" role="status">
          {recado}
        </p>
      )}
      {itens.length === 0 ? (
        <p className="c-dica">A lixeira está vazia.</p>
      ) : (
        <ul className="c-lixeira-lista">
          {itens.map((i) => (
            <li key={i.id}>
              <div className="c-lixeira-texto">
                <strong>{i.titulo}</strong>
                <small>
                  {[ROTULO[i.tipo], i.detalhe && i.detalhe !== ROTULO[i.tipo] ? i.detalhe : null, `apagado em ${dataBr(i.apagadoEm)}`]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · {i.diasRestantes === 1 ? "falta 1 dia" : `faltam ${i.diasRestantes} dias`}
                </small>
              </div>
              <div className="c-lixeira-acoes">
                <button
                  type="button"
                  className="c-botao c-botao-pequeno"
                  disabled={ocupado}
                  onClick={() => void agir(() => repositorio.restaurarDaLixeira(i.id), `"${i.titulo}" voltou.`)}
                >
                  Restaurar
                </button>
                {apagando === i.id ? (
                  <button
                    type="button"
                    className="c-botao c-botao-perigo c-botao-pequeno"
                    disabled={ocupado}
                    onClick={() => void agir(() => repositorio.apagarDaLixeiraDeVez(i.id), `"${i.titulo}" foi apagado de vez.`)}
                  >
                    Apagar de vez
                  </button>
                ) : (
                  <button type="button" className="c-link" disabled={ocupado} onClick={() => definirApagando(i.id)}>
                    Apagar de vez
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {itens.length > 0 &&
        (esvaziando ? (
          <div className="c-lixeira-esvaziar">
            <label className="c-campo">
              <span className="c-rotulo">Para esvaziar, digite EXCLUIR</span>
              <input className="c-input" value={confirmacao} onChange={(e) => definirConfirmacao(e.target.value)} autoComplete="off" />
            </label>
            <div className="c-acoes">
              <button
                type="button"
                className="c-botao c-botao-perigo c-botao-pequeno"
                disabled={ocupado || confirmacao.trim() !== "EXCLUIR"}
                onClick={() =>
                  void agir(async () => {
                    await repositorio.esvaziarLixeira(confirmacao.trim());
                    definirEsvaziando(false);
                    definirConfirmacao("");
                  }, "Lixeira esvaziada.")
                }
              >
                Esvaziar a lixeira
              </button>
              <button type="button" className="c-link" onClick={() => definirEsvaziando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" style={{ marginTop: 12 }} onClick={() => definirEsvaziando(true)}>
            Esvaziar a lixeira
          </button>
        ))}
    </div>
  );
}
