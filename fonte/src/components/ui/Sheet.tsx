import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  onFechar: () => void;
  titulo?: string;
  cheia?: boolean;
  children: ReactNode;
}

/**
 * Modal deslizante de baixo (veil + sheet) — porte do padrão usado nos dois
 * protótipos, com o que faltava de acessibilidade (briefing §19): foco vai
 * para o modal ao abrir, Esc fecha, `role="dialog"`/`aria-modal` para
 * leitor de tela. Clique no fundo escuro fecha, igual ao original.
 */
export function Sheet({ onFechar, titulo, cheia = false, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anteriormenteFocado = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const focaveis = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFechar();
        return;
      }
      // Focus trap (briefing §19): sem isto o Tab saía do modal e ia parar
      // nos botões da tela atrás dele, que o leitor de tela nem deveria ver.
      if (e.key !== "Tab") return;
      const alvos = focaveis();
      if (alvos.length === 0) {
        e.preventDefault();
        ref.current?.focus();
        return;
      }
      const primeiro = alvos[0]!;
      const ultimo = alvos[alvos.length - 1]!;
      const atual = document.activeElement;
      if (e.shiftKey && (atual === primeiro || atual === ref.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      anteriormenteFocado?.focus?.();
    };
  }, [onFechar]);

  return (
    <div className="veil" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div
        ref={ref}
        className={`sheet ${cheia ? "full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <div className="grab" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
