/** Configurações → Tour do app: os textos de cada passo, o vídeo e liga/desliga. */
import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { PassoDoTour } from "@/central/types/tour";
import { AREAS } from "@/central/utils/areas";

const nomeDaArea = (a: string | null) =>
  a === null ? "todas as pacientes" : a === "rastreio" ? "quem tem Rastreabilidade" : `quem tem ${AREAS.find((x) => x.chave === a)?.rotulo ?? a}`;

export function TourDoAppAdmin() {
  const [passos, definirPassos] = useState<PassoDoTour[] | null>(null);
  const [recado, definirRecado] = useState<string | null>(null);
  useEffect(() => {
    void repositorio
      .passosDoTour()
      .then(definirPassos)
      .catch(() => definirPassos([]));
  }, []);
  if (!passos || passos.length === 0) return null;

  const mudar = (id: string, parte: Partial<PassoDoTour>) =>
    definirPassos((l) => l?.map((p) => (p.id === id ? { ...p, ...parte } : p)) ?? l);
  async function salvar(p: PassoDoTour) {
    try {
      await repositorio.salvarPassoDoTour(p);
      definirRecado(`Passo "${p.titulo}" salvo.`);
    } catch (e) {
      definirRecado(e instanceof Error ? e.message : "Não consegui salvar.");
    }
  }

  return (
    <div className="c-bloco">
      <h2>Tour do app</h2>
      <p className="c-dica">
        Aparece na primeira vez que a paciente entra, só com os passos das áreas que ela tem ligadas. Ela pode pular, e rever pela
        tela inicial.
      </p>
      {recado && <p className="c-dica">{recado}</p>}
      {passos.map((p) => (
        <details key={p.id} className="c-tour-adm">
          <summary>
            <strong>
              {p.ordem} · {p.titulo}
            </strong>
            <span className={`c-selo ${p.ativo ? "melhor" : "neutro"}`}>{p.ativo ? "Ligado" : "Desligado"}</span>
          </summary>
          <p className="c-dica">Para {nomeDaArea(p.area)}.</p>
          <label className="c-campo">
            <span className="c-rotulo">Título</span>
            <input className="c-input" value={p.titulo} maxLength={80} onChange={(e) => mudar(p.id, { titulo: e.target.value })} />
          </label>
          <label className="c-campo">
            <span className="c-rotulo">Texto</span>
            <textarea className="c-textarea" rows={3} maxLength={400} value={p.texto} onChange={(e) => mudar(p.id, { texto: e.target.value })} />
          </label>
          <label className="c-campo">
            <span className="c-rotulo">Vídeo seu (opcional)</span>
            <input
              className="c-input"
              value={p.videoUrl ?? ""}
              placeholder="https://…"
              onChange={(e) => mudar(p.id, { videoUrl: e.target.value || null })}
            />
          </label>
          <div className="c-chips">
            <button type="button" className="c-chip" aria-pressed={p.ativo} onClick={() => mudar(p.id, { ativo: !p.ativo })}>
              {p.ativo ? "Ligado" : "Desligado"}
            </button>
            <button
              type="button"
              className="c-botao c-botao-pequeno"
              disabled={!p.titulo.trim() || !p.texto.trim() || (!!p.videoUrl && !p.videoUrl.startsWith("https://"))}
              onClick={() => void salvar(p)}
            >
              Salvar este passo
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
