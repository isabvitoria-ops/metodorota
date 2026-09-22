import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Meta } from "@/central/types/meta";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { metaEmDestaque, progressoNoPeriodo, resumoDoProgresso } from "@/central/utils/progressoMetas";

/**
 * A meta em destaque na tela inicial — o "o que eu preciso fazer hoje".
 *
 * UMA meta, não a lista: a tela inicial responde "o que eu vim fazer aqui?"
 * num olhar, e cinco barras de progresso ali em cima transformam a resposta
 * numa outra pergunta. A lista inteira está a um toque, em "Minhas metas".
 *
 * A ESCOLHIDA É A DE MENOR PROGRESSO no período corrente (ver
 * `metaEmDestaque`): é a que ainda pede alguma coisa dela hoje. Destacar a
 * mais cumprida seria decorar a tela com o que já está resolvido.
 *
 * O CARD NÃO APARECE quando não há meta ativa. Um card vazio dizendo "você
 * não tem metas" ocupa o mesmo espaço e não serve para nada.
 */
export function MinhaMetaDeHoje() {
  const navegar = useNavigate();
  const [meta, definirMeta] = useState<Meta | null>(null);
  const [quantas, definirQuantas] = useState(0);

  useEffect(() => {
    let vivo = true;
    void repositorio
      .metasDe()
      .then((metas) => {
        if (!vivo) return;
        const ativas = metas.filter((m) => m.status === "ativa");
        definirQuantas(ativas.length);
        definirMeta(metaEmDestaque(metas, hojeSaoPaulo()));
      })
      // Silencioso de propósito: a tela inicial não é o lugar de explicar
      // uma falha de rede. Sem meta, o card some e o resto da home funciona.
      .catch(() => vivo && definirMeta(null));
    return () => {
      vivo = false;
    };
  }, []);

  if (!meta) return null;

  const p = progressoNoPeriodo(meta, hojeSaoPaulo());
  const periodo = meta.frequencia === "semanal" ? "desta semana" : "de hoje";

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Minha meta {periodo}</h2>

      <button
        type="button"
        className="c-bloco c-meta c-meta-clicavel"
        onClick={() => navegar(rotas.metas)}
      >
        <div className="c-meta-topo">
          <span className="c-meta-nome">{meta.titulo}</span>
          <span className="c-meta-numero">{resumoDoProgresso(p, meta.unidade)}</span>
        </div>

        <div className="c-meta-barra" role="img" aria-label={`${p.percentual}% da meta ${periodo}`}>
          <span style={{ width: `${p.percentual}%` }} />
        </div>

        <p className="c-meta-rodape">
          {p.cumprida ? `Meta ${periodo} cumprida.` : `${p.percentual}% da meta ${periodo}.`}
          {quantas > 1 &&
            ` Você tem ${quantas} metas — toque para ver todas.`}
          {quantas === 1 && " Toque para marcar."}
        </p>
      </button>
    </section>
  );
}
