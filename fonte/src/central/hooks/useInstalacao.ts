import { useCallback, useSyncExternalStore } from "react";
import { jaEstaInstalado } from "@/central/utils/plataforma";

/**
 * A instalação do aplicativo na tela do aparelho.
 *
 * No Android e no computador, o navegador avisa quando o site pode ser
 * instalado (`beforeinstallprompt`) e deixa o próprio app abrir a janela de
 * "Instalar" — um toque, sem passo a passo. No iPhone esse aviso não existe:
 * lá o caminho é o guia ilustrado.
 *
 * O aviso chega UMA vez, logo depois de a página abrir, muitas vezes antes de
 * qualquer tela existir. Por isso ele é guardado aqui, fora dos componentes,
 * no momento em que este arquivo é carregado.
 */
interface AvisoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let aviso: AvisoDeInstalacao | null = null;
let instalado =
  typeof window !== "undefined" && jaEstaInstalado(window as unknown as Parameters<typeof jaEstaInstalado>[0]);
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((o) => o());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    // Sem isto o navegador mostra a barrinha dele por conta própria, fora de hora.
    evento.preventDefault();
    aviso = evento as AvisoDeInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    instalado = true;
    avisar();
  });
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useInstalacao() {
  const podeInstalarAgora = useSyncExternalStore(assinar, () => aviso !== null, () => false);
  const jaInstalado = useSyncExternalStore(assinar, () => instalado, () => false);

  /** Abre a janela de instalar do navegador. Devolve se ela aceitou. */
  const instalar = useCallback(async (): Promise<boolean> => {
    const atual = aviso;
    if (!atual) return false;
    // O aviso só serve uma vez: usado, o navegador não aceita de novo.
    aviso = null;
    avisar();
    try {
      await atual.prompt();
      return (await atual.userChoice).outcome === "accepted";
    } catch {
      return false;
    }
  }, []);

  return { podeInstalarAgora, jaInstalado, instalar };
}
