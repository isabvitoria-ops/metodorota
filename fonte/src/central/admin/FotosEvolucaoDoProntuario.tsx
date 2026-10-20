import { useCallback, useEffect, useRef, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { reduzirFoto } from "@/central/utils/reduzirFoto";
import type { FotoEvolucao, PoseEvolucao, SessaoEvolucao } from "@/central/types/fotoEvolucao";
import { POSES } from "@/central/types/fotoEvolucao";

function agruparPorSessao(fotos: FotoEvolucao[]): SessaoEvolucao[] {
  const mapa = new Map<string, FotoEvolucao[]>();
  for (const f of fotos) {
    const lista = mapa.get(f.data) ?? [];
    lista.push(f);
    mapa.set(f.data, lista);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([data, fotos]) => ({ data, fotos }));
}

function formatarData(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function FotosEvolucaoDoProntuario({ pacienteId }: { pacienteId: string }) {
  const [fotos, definirFotos] = useState<FotoEvolucao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [urls, definirUrls] = useState<Record<string, string>>({});
  const [enviando, definirEnviando] = useState(false);
  const [mensagem, definirMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const f = await repositorio.fotosEvolucaoDoPaciente(pacienteId);
      definirFotos(f);
    } catch {
      /* não é crítico */
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    for (const f of fotos) {
      if (!urls[f.caminho]) {
        void repositorio.enderecoDaFotoEvolucao(f.caminho).then((url) => {
          definirUrls((prev) => ({ ...prev, [f.caminho]: url }));
        });
      }
    }
  }, [fotos, urls]);

  async function enviarFoto(pose: PoseEvolucao, arquivo: File) {
    definirEnviando(true);
    definirMensagem(null);
    try {
      const blob = await reduzirFoto(arquivo);
      await repositorio.enviarFotoEvolucao(blob, pose);
      definirMensagem("Foto salva.");
      await carregar();
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  async function apagar(foto: FotoEvolucao) {
    if (!confirm(`Apagar a foto de ${POSES.find((p) => p.id === foto.pose)?.rotulo ?? foto.pose} de ${formatarData(foto.data)}?`)) return;
    try {
      await repositorio.apagarFotoEvolucao(foto.id);
      definirFotos((prev) => prev.filter((f) => f.id !== foto.id));
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao apagar.");
    }
  }

  const sessoes = agruparPorSessao(fotos);

  if (carregando) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Fotos evolutivas</h2>

      <div className="c-linha-campos" style={{ flexWrap: "wrap", gap: 8 }}>
        {POSES.map((p) => (
          <BotaoEnvio key={p.id} pose={p} enviando={enviando} aoCapturar={(arq) => void enviarFoto(p.id, arq)} />
        ))}
      </div>

      {mensagem && <p className="c-dica" style={{ marginTop: 8 }} role="status">{mensagem}</p>}

      {sessoes.length === 0 && (
        <p className="c-dica" style={{ marginTop: 12 }}>Nenhuma foto evolutiva registrada ainda.</p>
      )}

      {sessoes.map((s) => (
        <div key={s.data} style={{ marginTop: 16 }}>
          <h3 className="c-secao-subtitulo">{formatarData(s.data)}</h3>
          <div className="c-evo-galeria">
            {s.fotos.map((f) => (
              <div key={f.id} className="c-evo-thumb">
                {urls[f.caminho] ? (
                  <img src={urls[f.caminho]} alt={POSES.find((p) => p.id === f.pose)?.rotulo ?? f.pose} loading="lazy" />
                ) : (
                  <div className="c-evo-thumb-placeholder" />
                )}
                <span className="c-evo-thumb-rotulo">
                  {POSES.find((p) => p.id === f.pose)?.rotulo ?? f.pose}
                </span>
                <button
                  type="button"
                  className="c-botao-icone c-evo-thumb-apagar"
                  title="Apagar foto"
                  onClick={() => void apagar(f)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function BotaoEnvio({
  pose,
  enviando,
  aoCapturar,
}: {
  pose: { id: PoseEvolucao; rotulo: string };
  enviando: boolean;
  aoCapturar: (arquivo: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="c-botao c-botao-pequeno"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        {enviando ? "Enviando…" : pose.rotulo}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) aoCapturar(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
