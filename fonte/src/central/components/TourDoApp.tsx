/**
 * O tour da primeira vez (0099): poucos passos, só das áreas que a paciente
 * tem ligadas. Pular conta como visto: a nutricionista pediu que não repita.
 * Quem quiser rever acha "Ver o tour de novo" no fim da tela inicial.
 */
import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { passosVisiveis } from "@/central/utils/tour";
import type { PassoDoTour } from "@/central/types/tour";

export function TourDoApp({ rever, aoFechar }: { rever: boolean; aoFechar: () => void }) {
  const { acesso } = useSessao();
  const [passos, definirPassos] = useState<PassoDoTour[] | null>(null);
  const [i, definirI] = useState(0);

  useEffect(() => {
    if (acesso.papel === "admin" && !rever) return;
    let vivo = true;
    void repositorio
      .meuTour()
      .then((t) => {
        if (!vivo) return;
        definirPassos(t.visto && !rever ? [] : passosVisiveis(t.passos, acesso));
      })
      .catch(() => vivo && definirPassos([]));
    return () => {
      vivo = false;
    };
  }, [acesso, rever]);

  if (!passos || passos.length === 0) return null;
  const passo = passos[Math.min(i, passos.length - 1)]!;
  const ultimo = i >= passos.length - 1;

  function fechar() {
    if (!rever) void repositorio.concluirTour().catch(() => undefined);
    definirPassos([]);
    definirI(0);
    aoFechar();
  }

  return (
    <div className="c-tour-veu" role="presentation">
      <div className="c-tour" role="dialog" aria-modal="true" aria-label={`Tour do app, passo ${i + 1} de ${passos.length}`}>
        <p className="c-tour-conta">
          {i + 1} de {passos.length}
        </p>
        <h2 className="c-tour-titulo">{passo.titulo}</h2>
        <p className="c-tour-texto">{passo.texto}</p>
        {passo.videoUrl && (
          <a className="c-link" href={passo.videoUrl} target="_blank" rel="noreferrer noopener">
            Ver o vídeo
          </a>
        )}
        <div className="c-tour-pontos" aria-hidden="true">
          {passos.map((_, k) => (
            <span key={k} className={k === i ? "ativo" : ""} />
          ))}
        </div>
        <div className="c-tour-acoes">
          <button type="button" className="c-link" onClick={fechar}>
            {ultimo ? "Fechar" : "Pular"}
          </button>
          <button type="button" className="c-botao" onClick={() => (ultimo ? fechar() : definirI(i + 1))}>
            {ultimo ? "Começar" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
