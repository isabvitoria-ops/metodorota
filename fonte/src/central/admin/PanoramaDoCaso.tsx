/**
 * Panorama da ficha: o caso em blocos (Intestino, Restrições, Exames, Corpo,
 * Treino, Adesão). Só lê o que já existe; nada muda na tela da paciente.
 * A conta de cada linha está em utils/panoramaDoCaso.ts, com teste.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import type { AvaliacaoFisica } from "@/central/types/protocolo";
import type { Meta } from "@/central/types/meta";
import { panoramaDoCaso, type DadosDoCaso, type LinhaDoCaso } from "@/central/utils/panoramaDoCaso";

type Lidos = Pick<DadosDoCaso, "reintroducao" | "restricoes" | "marcadores" | "exames" | "treinos" | "cardio">;


function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-");
  return ` · ${d}/${m}`;
}

function Linha({ linha }: { linha: LinhaDoCaso }) {
  const rodape = `${linha.origem}${dataCurta(linha.data)} ›`;
  const [caminho, ancora] = linha.link.split("#");
  return (
    <div className="c-pano-linha">
      <strong>{linha.texto}</strong>
      {ancora ? (
        <button
          type="button"
          className="c-pano-origem"
          onClick={() => document.getElementById(ancora)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          {rodape}
        </button>
      ) : (
        <Link className="c-pano-origem" to={caminho!}>
          {rodape}
        </Link>
      )}
    </div>
  );
}

export function PanoramaDoCaso({
  pacienteId,
  avaliacoes,
  metas,
  pesoAtual,
  pesoInicial,
  hoje,
}: {
  pacienteId: string;
  avaliacoes: AvaliacaoFisica[];
  /** As do cabeçalho da ficha (lista de pacientes): a adesão sai igual. */
  metas: Meta[];
  pesoAtual: number | null;
  pesoInicial: number | null;
  hoje: string;
}) {
  const [lidos, definirLidos] = useState<Lidos | null>(null);

  useEffect(() => {
    let vivo = true;
    definirLidos(null);
    // Cada leitura falha sozinha: um bloco diz "não consegui ler", os outros aparecem.
    void Promise.all([
      repositorio.reintroducaoDoPaciente(pacienteId).catch(() => null),
      repositorio.restricoesDoPaciente(pacienteId).catch(() => null),
      repositorio.marcadoresDoPaciente(pacienteId).catch(() => null),
      repositorio.examesDoPaciente(pacienteId).catch(() => null),
      repositorio.sessoesDeTreino(pacienteId).catch(() => null),
      repositorio.sessoesDeCardio(pacienteId).catch(() => null),
    ]).then(([reintroducao, restricoes, marcadores, exames, treinos, cardio]) => {
      if (vivo) definirLidos({ reintroducao, restricoes, marcadores, exames, treinos, cardio });
    });
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  // A data do peso: a avaliação mais recente que tem peso.
  const dataDoPeso = useMemo(
    () => avaliacoes.filter((a) => a.dados.peso !== null).map((a) => a.data.slice(0, 10)).sort().at(-1) ?? null,
    [avaliacoes],
  );
  const blocos = useMemo(
    () =>
      lidos
        ? panoramaDoCaso({ ...lidos, pacienteId, hoje, metas, peso: { atual: pesoAtual, inicial: pesoInicial, data: dataDoPeso } })
        : null,
    [lidos, pacienteId, hoje, metas, pesoAtual, pesoInicial, dataDoPeso],
  );

  return (
    <section className="c-secao c-pano" aria-label="Panorama do caso">
      <p className="c-dica">O caso em blocos, para começar a consulta. Cada linha diz de onde veio e leva para a tela.</p>
      {!blocos ? (
        <p className="c-dica">Montando o panorama…</p>
      ) : (
        <div className="c-pano-grade">
          {blocos.map((b) => (
            <article key={b.titulo} className="c-pano-bloco">
              <h3>{b.titulo}</h3>
              {b.linhas.map((l, i) => (
                <Linha key={i} linha={l} />
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
