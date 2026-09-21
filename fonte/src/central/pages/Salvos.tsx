import { useNavigate } from "react-router-dom";
import type { TipoFavorito } from "@/central/types";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone, type NomeIcone } from "@/central/components/Icone";
import { useFavoritos } from "@/central/hooks/useFavoritos";
import { rotas } from "@/central/rotas";

/**
 * Salvos (§23) — tudo que o paciente guardou, de qualquer área.
 *
 * Como o favorito guarda só a referência (tipo + id + rota), o que aparece
 * aqui é sempre a versão atual do conteúdo; se a nutricionista corrigir uma
 * equivalência, o item salvo já abre corrigido.
 */
const ICONES: Record<TipoFavorito, NomeIcone> = {
  alimento: "balanca",
  troca: "troca",
  grupo: "lista",
  categoria: "comerFora",
  opcao: "comerFora",
  guia: "guias",
};

/**
 * Os guias saíram da Central, e por isso saem daqui.
 *
 * O `guia` continua no tipo do favorito de propósito: quem já tinha guardado
 * um guia ainda tem a linha salva no navegador. Ela simplesmente não é
 * listada — listar abriria uma rota que não existe mais, e a paciente cairia
 * na tela inicial sem entender. Se a aba voltar, os salvos dela voltam com
 * ela, porque nada foi apagado.
 */
const SECOES: { tipo: TipoFavorito; rotulo: string }[] = [
  { tipo: "troca", rotulo: "Trocas" },
  { tipo: "alimento", rotulo: "Alimentos" },
  { tipo: "categoria", rotulo: "Comer fora" },
  { tipo: "opcao", rotulo: "Opções" },
];

export function Salvos() {
  const navegar = useNavigate();
  const itens = useFavoritos((estado) => estado.itens);
  const remover = useFavoritos((estado) => estado.remover);

  if (itens.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Salvos" descricao="Seus conteúdos guardados." voltarPara={rotas.home} />
        <div className="c-conteudo">
          <EstadoVazio
            icone="salvos"
            titulo="Nada guardado ainda"
            descricao="Toque no coração em qualquer troca, alimento ou conteúdo para encontrá-lo aqui depois."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina titulo="Salvos" descricao="Seus conteúdos guardados." voltarPara={rotas.home} />

      <div className="c-conteudo">
        {SECOES.map(({ tipo, rotulo }) => {
          const doTipo = itens.filter((f) => f.tipo === tipo);
          if (doTipo.length === 0) return null;
          return (
            <section className="c-secao" key={tipo}>
              <h2 className="c-secao-titulo">{rotulo}</h2>
              <div className="c-lista">
                {doTipo.map((favorito) => (
                  <div key={favorito.id} className="c-linha">
                    <button type="button" className="c-linha-alvo" onClick={() => navegar(favorito.rota)}>
                      <span style={{ color: "var(--icone)", display: "flex", flex: "none" }}>
                        <Icone nome={ICONES[favorito.tipo]} tamanho={19} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span className="c-lista-item-nome">{favorito.titulo}</span>
                        {favorito.subtitulo && <span className="c-lista-item-apoio">{favorito.subtitulo}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="c-favoritar"
                      aria-label={`Remover ${favorito.titulo} dos salvos`}
                      onClick={() => remover(favorito.id)}
                    >
                      <Icone nome="fechar" tamanho={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
