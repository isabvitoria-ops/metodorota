import { useRef } from "react";
import { Icone } from "./Icone";

/**
 * Campo de busca. Usado tanto na busca global quanto dentro de listas —
 * mesmo desenho, mesmo comportamento, para o paciente não ter que reaprender.
 */
export function BarraBusca({
  valor,
  aoMudar,
  placeholder = "O que você está procurando?",
  autoFoco = false,
  aoEnviar,
  rotulo = "Buscar",
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder?: string;
  autoFoco?: boolean;
  aoEnviar?: () => void;
  rotulo?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);

  return (
    <div className="c-busca" onClick={() => entrada.current?.focus()}>
      <Icone nome="busca" tamanho={19} />
      <input
        ref={entrada}
        type="search"
        inputMode="search"
        value={valor}
        aria-label={rotulo}
        placeholder={placeholder}
        autoFocus={autoFoco}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && aoEnviar) aoEnviar();
        }}
      />
      {valor && (
        <button
          type="button"
          className="c-busca-limpar"
          aria-label="Limpar busca"
          onClick={(e) => {
            e.stopPropagation();
            aoMudar("");
            entrada.current?.focus();
          }}
        >
          <Icone nome="fechar" tamanho={17} />
        </button>
      )}
    </div>
  );
}
