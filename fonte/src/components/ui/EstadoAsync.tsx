import type { ReactNode } from "react";
import type { Estado } from "@/types";
import { Card } from "./Card";

/** Skeleton simples — pulsante, sem depender de biblioteca externa. */
export function Skeleton({ altura = 18, largura = "100%" }: { altura?: number; largura?: string | number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: altura,
        width: largura,
        borderRadius: 8,
        background: "linear-gradient(90deg, var(--line) 25%, var(--paper) 50%, var(--line) 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <Skeleton altura={14} largura="40%" />
      <Skeleton altura={20} largura="70%" />
      <Skeleton altura={14} largura="90%" />
    </Card>
  );
}

export function EstadoErro({ mensagem, tentarNovamente }: { mensagem: string; tentarNovamente?: () => void }) {
  return (
    <Card style={{ borderLeft: "3px solid var(--clay)" }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}>
        Não deu pra carregar agora. {mensagem}
      </p>
      {tentarNovamente && (
        <button
          type="button"
          onClick={tentarNovamente}
          className="chip"
          style={{ marginTop: 12, fontSize: 13 }}
        >
          Tentar de novo
        </button>
      )}
    </Card>
  );
}

export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <Card style={{ textAlign: "center", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5 }}>
      {children}
    </Card>
  );
}

/**
 * Wrapper genérico para `Estado<T>` (briefing §7, §18) — nenhuma tela deve
 * mais assumir dado síncrono. `vazio` decide, a partir do `dado` já
 * carregado, se deve mostrar o empty-state em vez do conteúdo normal.
 */
export function EstadoAsync<T>({
  estado,
  vazio,
  renderVazio,
  tentarNovamente,
  children,
}: {
  estado: Estado<T>;
  vazio?: (dado: T) => boolean;
  renderVazio?: ReactNode;
  tentarNovamente?: () => void;
  children: (dado: T) => ReactNode;
}) {
  if (estado.status === "carregando") return <SkeletonCard />;
  if (estado.status === "erro") return <EstadoErro mensagem={estado.erro} tentarNovamente={tentarNovamente} />;
  if (vazio?.(estado.dado) && renderVazio) return <>{renderVazio}</>;
  return <>{children(estado.dado)}</>;
}
