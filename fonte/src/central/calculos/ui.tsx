/**
 * As peças de tela dos Cálculos, no visual da MARVIA (as mesmas classes da
 * aba de cálculos da avaliação: `c-calc-*`).
 *
 * Os campos guardam TEXTO, não número: é o formato das fichas (ver
 * estado.ts), e é o que deixa ela escrever "47,8" sem o navegador comer a
 * vírgula. Quem converte é a conta, com `num()`.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Secao({
  numero,
  titulo,
  dica,
  acoes,
  children,
}: {
  numero?: number;
  titulo: string;
  dica?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="c-calc-secao">
      <header className="c-calc-cabeca c-cx-cabeca">
        {numero !== undefined && (
          <span className="c-calc-numero" aria-hidden="true">
            {numero}
          </span>
        )}
        <div className="c-cx-cabeca-texto">
          <h3 className="c-calc-titulo">{titulo}</h3>
          {dica && <p className="c-calc-dica">{dica}</p>}
        </div>
        {acoes && <div className="c-cx-cabeca-acoes">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

export function Placar({ rotulo, valor, apoio }: { rotulo: string; valor: ReactNode; apoio?: ReactNode }) {
  return (
    <div className="c-calc-placar-item">
      <span className="c-calc-placar-rotulo">{rotulo}</span>
      <span className="c-calc-placar-valor">{valor}</span>
      {apoio ? <span className="c-calc-placar-apoio">{apoio}</span> : null}
    </div>
  );
}

export function Grade({ children, colunas }: { children: ReactNode; colunas?: number }) {
  return (
    <div className="c-calc-grade" style={colunas ? { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  );
}

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  dica,
  placeholder,
  numero = true,
  tipo = "text",
  invalido,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica?: ReactNode;
  placeholder?: string;
  numero?: boolean;
  tipo?: string;
  invalido?: boolean;
}) {
  return (
    <label className="c-campo c-calc-campo" style={{ display: "block" }}>
      <span className="c-rotulo">{rotulo}</span>
      <input
        className="c-input"
        type={tipo}
        inputMode={numero && tipo === "text" ? "decimal" : undefined}
        value={valor}
        placeholder={placeholder}
        aria-invalid={invalido || undefined}
        onChange={(e) => aoMudar(e.target.value)}
      />
      {dica && <span className="c-dica">{dica}</span>}
    </label>
  );
}

export function CampoSelecao({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  dica,
  desligado,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: { valor: string; rotulo: string }[];
  dica?: ReactNode;
  desligado?: boolean;
}) {
  return (
    <label className="c-campo c-calc-campo" style={{ display: "block" }}>
      <span className="c-rotulo">{rotulo}</span>
      <select className="c-select" value={valor} disabled={desligado} onChange={(e) => aoMudar(e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {dica && <span className="c-dica">{dica}</span>}
    </label>
  );
}

export function Avisos({ linhas, tom = "aviso" }: { linhas: string[]; tom?: "aviso" | "erro" }) {
  if (!linhas.length) return null;
  return (
    <div className={`c-aviso${tom === "erro" ? " c-aviso-erro" : ""} c-cx-aviso`} role="status">
      <span>
        {linhas.map((l, i) => (
          <span key={i} style={{ display: "block" }}>
            {l}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Botão que pede um segundo toque antes de fazer algo que não volta atrás
 * (apagar ficha, refeição, alimento). Substitui o `confirm()` da ferramenta
 * antiga, que é uma caixa do navegador fora do visual do app.
 */
export function BotaoConfirmar({
  rotulo,
  pergunta,
  aoConfirmar,
  classe = "c-botao c-botao-secundario c-botao-pequeno",
  titulo,
}: {
  rotulo: ReactNode;
  pergunta: string;
  aoConfirmar: () => void;
  classe?: string;
  titulo?: string;
}) {
  const [pedindo, definirPedindo] = useState(false);
  const relogio = useRef<number | null>(null);
  useEffect(() => () => {
    if (relogio.current) window.clearTimeout(relogio.current);
  }, []);
  return (
    <button
      type="button"
      className={`${classe}${pedindo ? " c-cx-confirmando" : ""}`}
      title={titulo}
      onClick={() => {
        if (pedindo) {
          definirPedindo(false);
          aoConfirmar();
          return;
        }
        definirPedindo(true);
        relogio.current = window.setTimeout(() => definirPedindo(false), 4000);
      }}
    >
      {pedindo ? pergunta : rotulo}
    </button>
  );
}

/** Lista de pares rótulo/valor, a "dl" das telas de resultado. */
export function Pares({ itens }: { itens: [string, ReactNode, ReactNode?][] }) {
  return (
    <div className="c-calc-placar">
      {itens.map(([rotulo, valor, apoio]) => (
        <Placar key={rotulo} rotulo={rotulo} valor={valor} apoio={apoio} />
      ))}
    </div>
  );
}
