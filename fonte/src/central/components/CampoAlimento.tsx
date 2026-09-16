import { useId, useMemo, useRef, useState } from "react";
import type { Alimento } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { buscarAlimentos } from "@/central/utils/buscaAlimentos";
import { Icone } from "./Icone";

/**
 * Autocomplete de alimento (§4 e §6).
 *
 * Recebe de fora a lista de alimentos que pode oferecer — quem chama decide
 * se são todos, só os que têm troca cadastrada, ou os que sobraram depois
 * dos filtros. O componente não conhece regra de negócio nenhuma.
 *
 * Com o campo vazio ele já mostra as opções disponíveis, em vez de exigir
 * que o paciente adivinhe o que digitar (§31: nada de manual de uso).
 */
export function CampoAlimento({
  rotulo,
  placeholder,
  opcoes,
  selecionado,
  aoSelecionar,
  aoLimpar,
  vazio,
}: {
  rotulo: string;
  placeholder: string;
  opcoes: Alimento[];
  selecionado: Alimento | null;
  aoSelecionar: (alimento: Alimento) => void;
  aoLimpar: () => void;
  vazio?: string;
}) {
  const [consulta, definirConsulta] = useState("");
  const [aberto, definirAberto] = useState(false);
  const [destaque, definirDestaque] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const idLista = useId();

  const sugestoes = useMemo(() => buscarAlimentos(opcoes, consulta, 8), [opcoes, consulta]);

  function escolher(alimento: Alimento) {
    aoSelecionar(alimento);
    definirConsulta("");
    definirAberto(false);
    definirDestaque(0);
  }

  if (selecionado) {
    const grupo = catalogo.grupo(selecionado.grupoId);
    return (
      <div className="c-campo">
        <span className="c-rotulo">{rotulo}</span>
        <button
          type="button"
          className="c-escolhido"
          onClick={() => {
            aoLimpar();
            definirAberto(true);
            window.setTimeout(() => entrada.current?.focus(), 0);
          }}
        >
          <span>
            <span className="c-escolhido-nome">{selecionado.nome}</span>
            {grupo && <span className="c-escolhido-grupo">{grupo.nome}</span>}
          </span>
          <span className="c-escolhido-trocar">Trocar</span>
        </button>
      </div>
    );
  }

  return (
    <div className="c-campo">
      <label className="c-rotulo" htmlFor={`${idLista}-entrada`}>
        {rotulo}
      </label>
      <div className="c-busca" style={{ boxShadow: "none" }}>
        <Icone nome="busca" tamanho={19} />
        <input
          id={`${idLista}-entrada`}
          ref={entrada}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={consulta}
          disabled={opcoes.length === 0}
          onFocus={() => definirAberto(true)}
          onBlur={() => window.setTimeout(() => definirAberto(false), 140)}
          onChange={(e) => {
            definirConsulta(e.target.value);
            definirAberto(true);
            definirDestaque(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              definirAberto(true);
              definirDestaque((i) => Math.min(i + 1, sugestoes.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              definirDestaque((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const alvo = sugestoes[destaque];
              if (alvo) escolher(alvo);
            } else if (e.key === "Escape") {
              definirAberto(false);
            }
          }}
        />
      </div>

      {opcoes.length === 0 && vazio && <p className="c-contagem">{vazio}</p>}

      {/* A mensagem de "nada encontrado" fica FORA da lista: uma lista de
          opções só pode conter opções — um parágrafo solto ali confunde o
          leitor de tela, que anuncia o aviso como se fosse um alimento
          selecionável. */}
      {aberto && opcoes.length > 0 && sugestoes.length === 0 && (
        <p className="c-sugestoes c-sem-sugestao" role="status">
          Nada encontrado com esse nome.
        </p>
      )}

      {aberto && sugestoes.length > 0 && (
        <div className="c-sugestoes" id={idLista} role="listbox" aria-label={rotulo}>
          {sugestoes.map((alimento, indice) => {
            const grupo = catalogo.grupo(alimento.grupoId);
            return (
              <button
                key={alimento.id}
                type="button"
                role="option"
                className="c-sugestao"
                aria-selected={indice === destaque}
                onMouseEnter={() => definirDestaque(indice)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(alimento)}
              >
                <span className="c-sugestao-nome">{alimento.nome}</span>
                {grupo && <span className="c-sugestao-grupo">{grupo.nome}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
