import type { ReactNode } from "react";

export function Tag({ children, cor }: { children: ReactNode; cor: string }) {
  return (
    <span className="tag" style={{ background: `${cor}1E`, color: cor }}>
      {children}
    </span>
  );
}
