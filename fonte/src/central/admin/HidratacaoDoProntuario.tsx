import { useCallback, useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { HidratacaoDoPaciente } from "@/central/types/hidratacao";
import { numeroDeTexto } from "@/central/utils/numero";

interface Props {
  pacienteId: string;
  pesoAtual: number | null;
}

export function HidratacaoDoProntuario({ pacienteId, pesoAtual }: Props) {
  const [dados, definirDados] = useState<HidratacaoDoPaciente | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [metaTexto, definirMetaTexto] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [mensagem, definirMensagem] = useState<string | null>(null);

  const sugestao = pesoAtual && pesoAtual > 0 ? Math.round(pesoAtual * 50) : null;

  const carregar = useCallback(async () => {
    try {
      const d = await repositorio.hidratacaoDoPaciente(pacienteId);
      definirDados(d);
      if (d.metaMl) definirMetaTexto(String(d.metaMl));
    } catch {
      /* não é crítico */
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvarMeta = async () => {
    const valor = numeroDeTexto(metaTexto);
    if (!valor || valor <= 0 || valor > 10000) {
      definirMensagem("Informe um valor entre 1 e 10.000 mL.");
      return;
    }
    definirSalvando(true);
    definirMensagem(null);
    try {
      await repositorio.definirMetaHidratacao(pacienteId, Math.round(valor));
      definirMensagem("Meta salva.");
      await carregar();
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      definirSalvando(false);
    }
  };

  if (carregando) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Hidratação</h2>

      <div className="c-linha-campos">
        <div className="c-campo" style={{ flex: 1 }}>
          <label className="c-campo-rotulo" htmlFor="meta-hidratacao">Meta diária (mL)</label>
          <input
            id="meta-hidratacao"
            type="number"
            inputMode="numeric"
            className="c-campo-input"
            placeholder={sugestao ? `Sugestão: ${sugestao} mL` : "Ex.: 2500"}
            value={metaTexto}
            onChange={(e) => definirMetaTexto(e.target.value)}
            min={1}
            max={10000}
          />
        </div>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          style={{ alignSelf: "flex-end" }}
          disabled={salvando}
          onClick={() => void salvarMeta()}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {sugestao && !dados?.metaMl && (
          <button
            type="button"
            className="c-botao c-botao-pequeno c-botao-secundario"
            style={{ alignSelf: "flex-end" }}
            onClick={() => definirMetaTexto(String(sugestao))}
          >
            Usar {sugestao} mL
          </button>
        )}
      </div>

      {sugestao && (
        <p className="c-dica" style={{ marginTop: 4 }}>
          Sugestão: {pesoAtual} kg × 50 mL/kg = {sugestao} mL/dia
        </p>
      )}

      {mensagem && (
        <p className="c-dica" style={{ marginTop: 8 }} role="status">{mensagem}</p>
      )}

      {dados && dados.dias.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 className="c-secao-subtitulo">Últimos registros</h3>
          <div className="c-hidrata-tabela">
            <table className="c-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Total</th>
                  {dados.metaMl && <th>%</th>}
                </tr>
              </thead>
              <tbody>
                {dados.dias.map((d) => {
                  const pct = dados.metaMl ? Math.round((d.totalMl / dados.metaMl) * 100) : null;
                  return (
                    <tr key={d.data}>
                      <td>{d.data.split("-").reverse().join("/")}</td>
                      <td>{d.totalMl} mL</td>
                      {pct !== null && (
                        <td style={{ color: pct >= 100 ? "var(--success)" : undefined }}>
                          {pct}%
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dados && dados.dias.length === 0 && (
        <p className="c-dica" style={{ marginTop: 12 }}>
          Nenhum registro de hidratação ainda.
        </p>
      )}
    </section>
  );
}
