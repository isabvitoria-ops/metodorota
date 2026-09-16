import type { ReactNode } from "react";

/**
 * Campos de formulário da área administrativa.
 *
 * Rótulo sempre visível, nunca só placeholder: quem está preenchendo dez
 * campos de cadastro precisa saber o que é cada um depois de já ter
 * digitado.
 */
export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="c-campo" style={{ display: "block" }}>
      <span className="c-rotulo">{rotulo}</span>
      {children}
      {dica && <span className="c-dica">{dica}</span>}
    </label>
  );
}

export function Texto({
  valor,
  aoMudar,
  tipo = "text",
  placeholder,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  tipo?: string;
  placeholder?: string;
}) {
  return (
    <input
      className="c-input"
      type={tipo}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

export function AreaTexto({
  valor,
  aoMudar,
  placeholder,
  linhas = 4,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  linhas?: number;
}) {
  return (
    <textarea
      className="c-textarea"
      rows={linhas}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

export function Selecao<T extends string>({
  valor,
  aoMudar,
  opcoes,
}: {
  valor: T;
  aoMudar: (v: T) => void;
  opcoes: { valor: T; rotulo: string }[];
}) {
  return (
    <select className="c-select" value={valor} onChange={(e) => aoMudar(e.target.value as T)}>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

/** Lista escrita como texto, uma por linha — mais rápido que um editor de itens. */
export function listaDeLinhas(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function linhasDeLista(lista: string[]): string {
  return lista.join("\n");
}
