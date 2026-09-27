import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ItemDoMenu {
  rotulo: string;
  aoEscolher: () => void;
  ativo?: boolean;
  /** Linha fina antes deste item, para separar grupos. */
  separar?: boolean;
}

/**
 * O menu dos três pontinhos.
 *
 * Guarda o que ela usa de vez em quando, para o que ela usa todo dia
 * caber na tela sem rolar de lado. Fecha ao tocar fora e com Esc.
 */
export function MenuMais({
  itens,
  rotulo = "Mais opções",
  gatilho,
  classe = "",
  alinhar = "direita",
}: {
  itens: ItemDoMenu[];
  rotulo?: string;
  /** O que aparece no botão. Sem isto, os três pontinhos. */
  gatilho?: ReactNode;
  classe?: string;
  alinhar?: "direita" | "esquerda";
}) {
  const [aberto, definirAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) definirAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") definirAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div className="c-menu-mais" ref={caixa}>
      <button
        type="button"
        className={classe || "c-menu-mais-botao"}
        aria-label={gatilho ? undefined : rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => definirAberto((a) => !a)}
      >
        {gatilho ?? <span aria-hidden="true" className="c-tres-pontos">⋯</span>}
      </button>

      {aberto && (
        <div className={`c-menu-mais-lista c-menu-mais-${alinhar}`} role="menu">
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              className={`c-menu-mais-item ${item.ativo ? "ativo" : ""} ${item.separar ? "separar" : ""}`}
              onClick={() => {
                definirAberto(false);
                item.aoEscolher();
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
