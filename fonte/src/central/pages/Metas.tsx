import { useCallback, useEffect, useState } from "react";
import type { Meta } from "@/central/types/meta";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { CartaoDeMeta } from "@/central/components/CartaoDeMeta";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";

/**
 * "Minhas metas" — a tela da paciente.
 *
 * As ATIVAS primeiro e sozinhas no topo, porque são as únicas que pedem
 * alguma coisa dela hoje. O resto fica embaixo, separado, para ela poder
 * olhar o que já passou sem confundir com o que está valendo.
 */
export function Metas() {
  const [metas, definirMetas] = useState<Meta[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirMetas(await repositorio.metasDe());
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar suas metas.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativas = metas.filter((m) => m.status === "ativa");
  const encerradas = metas.filter((m) => m.status !== "ativa");

  return (
    <>
      <CabecalhoPagina
        titulo="Minhas metas"
        descricao="O que combinamos, e quanto você já fez."
        voltarPara={rotas.home}
      />
      <div className="c-conteudo">
        {carregando && <p className="c-dica">Carregando…</p>}

        {erro && (
          <div className="c-aviso c-aviso-erro" role="alert">
            <span>{erro}</span>
          </div>
        )}

        {!carregando && !erro && metas.length === 0 && (
          <EstadoVazio
            icone="salvos"
            titulo="Nenhuma meta ainda"
            descricao="Quando sua nutricionista combinar uma meta com você, ela aparece aqui."
          />
        )}

        {ativas.map((m) => (
          <CartaoDeMeta key={m.id} meta={m} aoMudar={carregar} />
        ))}

        {encerradas.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Pausadas e encerradas</h2>
            {encerradas.map((m) => (
              <CartaoDeMeta key={m.id} meta={m} aoMudar={carregar} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}
