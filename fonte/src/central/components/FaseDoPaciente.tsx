import { useCallback, useEffect, useState } from "react";
import type { Fase, MudancaDeFase } from "@/central/types/fase";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto, AreaTexto } from "@/central/admin/componentes/Campos";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * A fase da paciente, no prontuário: onde ela está e por onde passou.
 *
 * MOVER É EVENTO COM DATA, e a tela deixa escolher a data de propósito: a
 * mudança aconteceu na consulta, e ela registra depois. Forçar "hoje"
 * empurraria o histórico para a frente toda vez, e a conta de "quanto tempo
 * ficou na restrição" sairia errada.
 *
 * O histórico aparece inteiro, do mais recente para o mais antigo — inclusive
 * as voltas. Voltar para uma fase anterior não é erro a esconder: é
 * informação clínica.
 */
function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

/** Quantos dias entre duas datas. Serve para "ficou 32 dias nesta fase". */
function diasEntre(de: string, ate: string): number | null {
  const a = new Date(`${de}T00:00:00Z`).getTime();
  const b = new Date(`${ate}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function FaseDoPaciente({ pacienteId }: { pacienteId: string }) {
  const [fases, definirFases] = useState<Fase[]>([]);
  const [historico, definirHistorico] = useState<MudancaDeFase[]>([]);
  const [escolhida, definirEscolhida] = useState("");
  const [quando, definirQuando] = useState(hojeSaoPaulo());
  const [observacao, definirObservacao] = useState("");
  const [abrindo, definirAbrindo] = useState(false);
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [fs, hs] = await Promise.all([
        repositorio.listarFases(),
        repositorio.fasesDoPaciente(pacienteId),
      ]);
      definirFases(fs);
      definirHistorico(hs);
      definirErro(null);
    } catch {
      definirFases([]);
      definirHistorico([]);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Sem nenhuma fase cadastrada, a seção some: não há caminho a percorrer
  // ainda, e uma seção vazia só ocuparia o prontuário.
  if (fases.length === 0) return null;

  const atual = historico[0] ?? null;
  const disponiveis = fases.filter((f) => f.ativa);

  async function mover() {
    if (!escolhida) return;
    definirOcupado(true);
    try {
      await repositorio.moverDeFase(pacienteId, escolhida, quando, observacao.trim() || null);
      definirEscolhida("");
      definirObservacao("");
      definirAbrindo(false);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar a fase.");
    } finally {
      definirOcupado(false);
    }
  }

  async function apagar(id: string) {
    definirOcupado(true);
    try {
      await repositorio.apagarMudancaDeFase(id);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui apagar.");
    } finally {
      definirOcupado(false);
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Fase do método</h2>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}

      {atual ? (
        <p className="c-versao-carimbo" style={{ fontSize: "1.1rem" }}>
          {atual.fase}
          <span className="c-dica" style={{ display: "block" }}>
            desde {diaCurto(atual.inicio)}
            {(() => {
              const d = diasEntre(atual.inicio, hojeSaoPaulo());
              // Aqui a contagem PODE aparecer: é a tela dela, e a pergunta
              // "há quanto tempo?" é clínica. Na tela da paciente não vai,
              // porque lá viraria cobrança de um prazo que ninguém prometeu.
              return d === null || d === 0 ? "" : ` · ${d} ${d === 1 ? "dia" : "dias"}`;
            })()}
          </span>
        </p>
      ) : (
        <p className="c-dica">Ainda não está em nenhuma fase.</p>
      )}

      {!abrindo && (
        <button type="button" className="c-botao c-botao-secundario" onClick={() => definirAbrindo(true)}>
          {atual ? "Mudar de fase" : "Colocar numa fase"}
        </button>
      )}

      {abrindo && (
        <>
          <Campo rotulo="Para qual fase">
            <Selecao
              valor={escolhida}
              aoMudar={definirEscolhida}
              opcoes={[
                { valor: "", rotulo: "Escolha" },
                ...disponiveis.map((f) => ({ valor: f.id, rotulo: f.nome })),
              ]}
            />
          </Campo>
          <Campo
            rotulo="A partir de quando"
            dica="A data da mudança de verdade, que pode ser anterior a hoje."
          >
            <Texto valor={quando} aoMudar={definirQuando} placeholder="2026-09-22" />
          </Campo>
          <Campo rotulo="Anotação (opcional)" dica="É sua. A paciente não vê isto.">
            <AreaTexto valor={observacao} aoMudar={definirObservacao} linhas={2} />
          </Campo>
          <div className="c-chips">
            <button
              type="button"
              className="c-chip"
              disabled={!escolhida || ocupado}
              onClick={() => void mover()}
            >
              {ocupado ? "Salvando…" : "Registrar"}
            </button>
            <button type="button" className="c-chip" onClick={() => definirAbrindo(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {historico.length > 0 && (
        <div className="c-cronologia" style={{ marginTop: 14 }}>
          {historico.map((m, i) => {
            const seguinte = historico[i - 1];
            // Quanto tempo ficou: até a mudança seguinte, ou até hoje.
            const ate = seguinte?.inicio ?? hojeSaoPaulo();
            const d = diasEntre(m.inicio, ate);
            return (
              <div className="c-evento" key={m.id}>
                <p className="c-lista-item-nome">{m.fase}</p>
                <p className="c-lista-item-apoio">
                  desde {diaCurto(m.inicio)}
                  {d !== null && d > 0 && ` · ${d} ${d === 1 ? "dia" : "dias"}`}
                  {!seguinte && " · até agora"}
                </p>
                {m.observacao && <p className="c-dica">{m.observacao}</p>}
                <button
                  type="button"
                  className="c-link"
                  disabled={ocupado}
                  onClick={() => void apagar(m.id)}
                >
                  Apagar este registro
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
