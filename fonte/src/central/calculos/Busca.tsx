/**
 * O campo de busca de alimento, com a lista embaixo e teclado (setas,
 * Enter, Esc). Procura nas tabelas todas de uma vez (ver tabela.ts).
 *
 * Não achando nada, diz isso — silêncio, para quem monta dieta, lê-se como
 * "este alimento não existe".
 */
import { useId, useState } from "react";
import { buscar, etiquetaDaFonte, semAcento, valorDe, type Alimento } from "./tabela";

export function Busca({
  aoEscolher,
  placeholder = "Buscar alimento",
  compacta,
  textoInicial = "",
}: {
  aoEscolher: (a: Alimento) => void;
  placeholder?: string;
  compacta?: boolean;
  /** Já abre buscando este texto (ex.: o nome do alimento da linha). */
  textoInicial?: string;
}) {
  const id = useId();
  const [texto, definirTexto] = useState(textoInicial);
  const [achados, definirAchados] = useState<Alimento[]>(() => (textoInicial ? buscar(textoInicial) : []));
  const [aberta, definirAberta] = useState(() => semAcento(textoInicial).replace(/[^a-z0-9]/g, "").length >= 2);
  const [marcado, definirMarcado] = useState(0);

  function procurar(t: string) {
    definirTexto(t);
    const lista = buscar(t);
    definirAchados(lista);
    definirMarcado(0);
    definirAberta(semAcento(t).replace(/[^a-z0-9]/g, "").length >= 2);
  }

  function escolher(a: Alimento) {
    aoEscolher(a);
    definirTexto("");
    definirAchados([]);
    definirAberta(false);
  }

  return (
    <div className={`c-cx-busca${compacta ? " c-cx-busca--compacta" : ""}`}>
      <input
        className="c-input"
        value={texto}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={aberta}
        aria-controls={id}
        autoComplete="off"
        onChange={(e) => procurar(e.target.value)}
        onBlur={() => window.setTimeout(() => definirAberta(false), 120)}
        onKeyDown={(e) => {
          if (!aberta) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            definirMarcado((m) => Math.max(0, Math.min(achados.length - 1, m + (e.key === "ArrowDown" ? 1 : -1))));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const a = achados[marcado];
            if (a) escolher(a);
          } else if (e.key === "Escape") {
            definirAberta(false);
          }
        }}
      />
      {aberta && (
        <div className="c-cx-busca-lista" id={id} role="listbox">
          {achados.length === 0 ? (
            <div className="c-cx-busca-nada">
              Nada com essas palavras nas tabelas.
              <small>
                Tente uma palavra só, ou o nome genérico. Marca de produto elas não têm — cadastre em “Meus alimentos”.
              </small>
            </div>
          ) : (
            achados.map((a, i) => (
              <div
                key={a.id}
                role="option"
                aria-selected={i === marcado}
                className={`c-cx-busca-item${i === marcado ? " c-cx-busca-item--marcado" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(a);
                }}
              >
                <span>{a.nome}</span>
                <small>
                  {etiquetaDaFonte(a.fonte)}
                  {a.grupo ? ` · ${a.grupo}` : ""}
                  {valorDe(a, "energia_kcal") === null ? " · sem calorias nesta tabela" : ""}
                </small>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
