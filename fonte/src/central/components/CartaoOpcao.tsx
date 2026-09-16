import { useEffect, useRef, useState } from "react";
import type { OpcaoComerFora } from "@/central/types";
import { Icone } from "./Icone";
import { Selo } from "./Selo";
import { BotaoFavorito } from "./BotaoFavorito";
import { rotas } from "@/central/rotas";

/**
 * Cartão de opção de "Comer fora" (§14).
 *
 * O cartão nasce ABERTO. Fechado, ele obrigava um toque a mais para ver o
 * que a pessoa veio ver — num combo, os acompanhamentos são a informação,
 * não um detalhe secundário. A seta continua ali para fechar o que não
 * interessa, mas o padrão é mostrar.
 *
 * As calorias (§16) só aparecem quando `mostrarKcal` está ligado naquele
 * item — o número fica guardado de qualquer jeito.
 */
export function CartaoOpcao({
  opcao,
  categoriaId,
  categoriaNome,
  destacada = false,
}: {
  opcao: OpcaoComerFora;
  categoriaId: string;
  categoriaNome: string;
  /** Veio de um link da busca: rola até ela e marca por um instante. */
  destacada?: boolean;
}) {
  const [aberto, definirAberto] = useState(true);
  const caixa = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!destacada) return;
    caixa.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [destacada]);
  const temCorpo = Boolean(opcao.descricao) || opcao.detalhes.length > 0 || Boolean(opcao.energia?.mostrarKcal);

  return (
    <article className={`c-opcao ${destacada ? "destacada" : ""}`} ref={caixa}>
      <div className="c-opcao-topo">
        <button
          type="button"
          className="c-opcao-abrir"
          aria-expanded={temCorpo ? aberto : undefined}
          onClick={() => temCorpo && definirAberto((v) => !v)}
          style={{ cursor: temCorpo ? "pointer" : "default" }}
        >
          <span style={{ flex: 1 }}>
            <span className="c-opcao-titulo">{opcao.titulo}</span>
            {opcao.nivel && (
              <span style={{ display: "block", marginTop: 7 }}>
                <Selo nivel={opcao.nivel} />
              </span>
            )}
          </span>
          {temCorpo && (
            <Icone
              nome="seta"
              tamanho={17}
              style={{
                transform: aberto ? "rotate(90deg)" : "none",
                transition: "transform .16s ease",
                color: "var(--icone)",
                flex: "none",
              }}
            />
          )}
        </button>
        <BotaoFavorito
          item={{
            tipo: "opcao",
            refId: `${categoriaId}:${opcao.id}`,
            titulo: opcao.titulo,
            subtitulo: categoriaNome,
            rota: rotas.opcao(categoriaId, opcao.id),
          }}
        />
      </div>

      {aberto && temCorpo && (
        <div className="c-opcao-corpo">
          {opcao.descricao && <p>{opcao.descricao}</p>}
          {opcao.detalhes.length > 0 && (
            <ul>
              {opcao.detalhes.map((detalhe) => (
                <li key={detalhe}>{detalhe}</li>
              ))}
            </ul>
          )}
          {opcao.energia?.mostrarKcal && opcao.energia.kcal !== null && (
            <p className="c-opcao-kcal">
              Cerca de {opcao.energia.kcal} kcal
              {opcao.energia.observacao ? ` · ${opcao.energia.observacao}` : ""}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
