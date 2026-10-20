import { useCallback, useEffect, useRef, useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Esqueleto } from "@/central/components/Esqueleto";
import { rotas } from "@/central/rotas";
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

export function FotosEvolucao() {
  const [fotos, definirFotos] = useState<FotoEvolucao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [enviando, definirEnviando] = useState(false);
  const [mensagem, definirMensagem] = useState<string | null>(null);
  const [urls, definirUrls] = useState<Record<string, string>>({});
  const [comparando, definirComparando] = useState<{ pose: PoseEvolucao; antes: FotoEvolucao; depois: FotoEvolucao } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const f = await repositorio.minhasFotosEvolucao();
      definirFotos(f);
    } catch {
      /* silencioso */
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarUrl = useCallback(async (caminho: string) => {
    if (urls[caminho]) return urls[caminho];
    const url = await repositorio.enderecoDaFotoEvolucao(caminho);
    definirUrls((prev) => ({ ...prev, [caminho]: url }));
    return url;
  }, [urls]);

  useEffect(() => {
    for (const f of fotos) {
      if (!urls[f.caminho]) void carregarUrl(f.caminho);
    }
  }, [fotos, urls, carregarUrl]);

  async function enviarFoto(pose: PoseEvolucao, arquivo: File) {
    definirEnviando(true);
    definirMensagem(null);
    try {
      const blob = await reduzirFoto(arquivo);
      await repositorio.enviarFotoEvolucao(blob, pose);
      definirMensagem("Foto salva!");
      await carregar();
    } catch (e) {
      definirMensagem(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  const sessoes = agruparPorSessao(fotos);

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Fotos evolutivas" voltarPara={rotas.home} />
        <Esqueleto linhas={4} />
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Fotos evolutivas"
        descricao="Registre suas fotos e acompanhe a transformação."
        voltarPara={rotas.home}
      />

      <section className="c-secao">
        <h2 className="c-secao-titulo">Nova foto</h2>
        <p className="c-dica" style={{ marginBottom: 12 }}>
          Escolha a pose e tire ou selecione uma foto.
        </p>
        <div className="c-evo-poses">
          {POSES.map((p) => (
            <BotaoCaptura
              key={p.id}
              pose={p}
              enviando={enviando}
              aoCapturar={(arq) => void enviarFoto(p.id, arq)}
            />
          ))}
        </div>
        {mensagem && <p className="c-dica" style={{ marginTop: 8 }} role="status">{mensagem}</p>}
      </section>

      {sessoes.length === 0 && (
        <EstadoVazio
          icone="camera"
          titulo="Nenhuma foto ainda"
          descricao="Tire sua primeira foto de evolução usando os botões acima."
        />
      )}

      {sessoes.length >= 2 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Comparar antes e depois</h2>
          <SeletorComparacao sessoes={sessoes} fotos={fotos} aoSelecionar={definirComparando} />
        </section>
      )}

      {comparando && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">
            {POSES.find((p) => p.id === comparando.pose)?.rotulo ?? comparando.pose}
          </h2>
          <SliderComparacao
            antes={urls[comparando.antes.caminho] ?? ""}
            depois={urls[comparando.depois.caminho] ?? ""}
            dataAntes={formatarData(comparando.antes.data)}
            dataDepois={formatarData(comparando.depois.data)}
          />
        </section>
      )}

      {sessoes.map((s) => (
        <section className="c-secao" key={s.data}>
          <h2 className="c-secao-titulo">{formatarData(s.data)}</h2>
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
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function BotaoCaptura({
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
    <div className="c-evo-pose-botao">
      <button
        type="button"
        className="c-botao c-botao-pequeno"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        {pose.rotulo}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) aoCapturar(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SeletorComparacao({
  sessoes,
  fotos,
  aoSelecionar,
}: {
  sessoes: SessaoEvolucao[];
  fotos: FotoEvolucao[];
  aoSelecionar: (v: { pose: PoseEvolucao; antes: FotoEvolucao; depois: FotoEvolucao } | null) => void;
}) {
  const [pose, definirPose] = useState<PoseEvolucao>("frente");
  const [dataAntes, definirDataAntes] = useState(sessoes[sessoes.length - 1]?.data ?? "");
  const [dataDepois, definirDataDepois] = useState(sessoes[0]?.data ?? "");

  useEffect(() => {
    const antes = fotos.find((f) => f.data === dataAntes && f.pose === pose);
    const depois = fotos.find((f) => f.data === dataDepois && f.pose === pose);
    if (antes && depois && antes.id !== depois.id) {
      aoSelecionar({ pose, antes, depois });
    } else {
      aoSelecionar(null);
    }
  }, [pose, dataAntes, dataDepois, fotos, aoSelecionar]);

  const datasDisponiveis = sessoes.map((s) => s.data);

  return (
    <div className="c-evo-comparador-controles">
      <div className="c-campo" style={{ flex: 1 }}>
        <label className="c-campo-rotulo">Pose</label>
        <select className="c-campo-input" value={pose} onChange={(e) => definirPose(e.target.value as PoseEvolucao)}>
          {POSES.map((p) => (
            <option key={p.id} value={p.id}>{p.rotulo}</option>
          ))}
        </select>
      </div>
      <div className="c-campo" style={{ flex: 1 }}>
        <label className="c-campo-rotulo">Antes</label>
        <select className="c-campo-input" value={dataAntes} onChange={(e) => definirDataAntes(e.target.value)}>
          {datasDisponiveis.map((d) => (
            <option key={d} value={d}>{formatarData(d)}</option>
          ))}
        </select>
      </div>
      <div className="c-campo" style={{ flex: 1 }}>
        <label className="c-campo-rotulo">Depois</label>
        <select className="c-campo-input" value={dataDepois} onChange={(e) => definirDataDepois(e.target.value)}>
          {datasDisponiveis.map((d) => (
            <option key={d} value={d}>{formatarData(d)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SliderComparacao({
  antes,
  depois,
  dataAntes,
  dataDepois,
}: {
  antes: string;
  depois: string;
  dataAntes: string;
  dataDepois: string;
}) {
  const [posicao, definirPosicao] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!antes || !depois) {
    return <p className="c-dica">Não há fotos dessa pose nas duas datas selecionadas.</p>;
  }

  return (
    <div className="c-evo-slider" ref={containerRef}>
      <div className="c-evo-slider-imagem c-evo-slider-depois">
        <img src={depois} alt={`Depois — ${dataDepois}`} draggable={false} />
      </div>
      <div className="c-evo-slider-imagem c-evo-slider-antes" style={{ clipPath: `inset(0 ${100 - posicao}% 0 0)` }}>
        <img src={antes} alt={`Antes — ${dataAntes}`} draggable={false} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={posicao}
        onChange={(e) => definirPosicao(Number(e.target.value))}
        className="c-evo-slider-range"
        aria-label="Comparar antes e depois"
      />
      <div className="c-evo-slider-divisor" style={{ left: `${posicao}%` }} />
      <span className="c-evo-slider-rotulo c-evo-slider-rotulo-antes">Antes</span>
      <span className="c-evo-slider-rotulo c-evo-slider-rotulo-depois">Depois</span>
    </div>
  );
}

function formatarData(iso: string): string {
  return iso.split("-").reverse().join("/");
}
