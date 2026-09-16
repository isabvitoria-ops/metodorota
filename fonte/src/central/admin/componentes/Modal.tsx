import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal usado nos formulários da área da nutricionista.
 *
 * Sobe de baixo no celular e fica centrado no computador — o mesmo
 * componente, sem dois caminhos de código. Traz o que faz um modal ser
 * utilizável de verdade: foco vai para dentro ao abrir, Esc fecha, Tab não
 * escapa para a tela de trás e o foco volta para onde estava ao fechar.
 */
export function Modal({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus();

    function focaveis(): HTMLElement[] {
      return Array.from(
        caixa.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    }

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        aoFechar();
        return;
      }
      if (evento.key !== "Tab") return;
      const alvos = focaveis();
      if (alvos.length === 0) {
        evento.preventDefault();
        caixa.current?.focus();
        return;
      }
      const primeiro = alvos[0]!;
      const ultimo = alvos[alvos.length - 1]!;
      const atual = document.activeElement;
      if (evento.shiftKey && (atual === primeiro || atual === caixa.current)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      anterior?.focus?.();
    };
  }, [aoFechar]);

  return (
    <div className="c-veu" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="c-modal" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={caixa}>
        <div className="c-modal-pega" aria-hidden="true" />
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
