import { useState, useMemo } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { BarraBusca } from "@/central/components/BarraBusca";
import { Icone } from "@/central/components/Icone";
import { CATALOGO_FODMAP } from "@/central/dados/sementes/fodmap";
import {
  ROTULOS_CATEGORIA,
  ROTULOS_FASE,
  ROTULOS_GRUPO,
  ROTULOS_NIVEL,
  DESCRICAO_FASE,
  type AlimentoFodmap,
  type CategoriaFodmap,
  type FaseFodmap,
  type GrupoFodmap,
  type NivelFodmap,
} from "@/central/types/fodmap";
import { filtrarFodmap, alimentosParaFase, contarPorNivel, ordenarPorNivel } from "@/central/utils/fodmap";
import { rotas } from "@/central/rotas";

const CORES_NIVEL: Record<NivelFodmap, string> = {
  verde: "var(--cor-sucesso, #2e7d32)",
  amarelo: "var(--cor-atencao, #ed6c02)",
  vermelho: "var(--cor-erro, #d32f2f)",
};

const BG_NIVEL: Record<NivelFodmap, string> = {
  verde: "var(--cor-sucesso-fundo, #e8f5e9)",
  amarelo: "var(--cor-atencao-fundo, #fff3e0)",
  vermelho: "var(--cor-erro-fundo, #fbe9e7)",
};

const FASES: FaseFodmap[] = ["eliminacao", "reintroducao", "manutencao"];
const CATEGORIAS: CategoriaFodmap[] = [
  "frutas", "verduras_legumes", "graos_cereais", "laticinios",
  "proteinas", "oleaginosas", "condimentos", "bebidas",
];
const GRUPOS: GrupoFodmap[] = ["frutanos", "gos", "lactose", "frutose", "sorbitol", "manitol"];
const NIVEIS_ORDEM: NivelFodmap[] = ["verde", "amarelo", "vermelho"];

export function FodmapSemaforo() {
  const [busca, definirBusca] = useState("");
  const [fase, definirFase] = useState<FaseFodmap>("eliminacao");
  const [categoria, definirCategoria] = useState<CategoriaFodmap | null>(null);
  const [grupo, definirGrupo] = useState<GrupoFodmap | null>(null);
  const [expandido, definirExpandido] = useState<string | null>(null);
  const [nivelAtivo, definirNivelAtivo] = useState<NivelFodmap>("verde");

  const catalogo = useMemo(() => alimentosParaFase(CATALOGO_FODMAP, fase), [fase]);

  const resultados = useMemo(
    () => ordenarPorNivel(filtrarFodmap(catalogo, busca, categoria, grupo, null)),
    [catalogo, busca, categoria, grupo],
  );

  const contagem = useMemo(() => contarPorNivel(resultados), [resultados]);

  const resultadosDoNivel = useMemo(
    () => resultados.filter((a) => a.nivel === nivelAtivo),
    [resultados, nivelAtivo],
  );

  function limpar() {
    definirBusca("");
    definirCategoria(null);
    definirGrupo(null);
  }

  const temFiltro = busca.trim() !== "" || categoria !== null || grupo !== null;

  return (
    <>
      <CabecalhoPagina
        titulo="Semáforo FODMAP"
        descricao="Consulte alimentos, porções seguras e o que evitar em cada fase."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {/* ── Fase ── */}
        <div className="c-fodmap-fases" role="tablist" aria-label="Fase do protocolo FODMAP">
          {FASES.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={fase === f}
              className={`c-chip ${fase === f ? "c-chip-ativo" : ""}`}
              onClick={() => definirFase(f)}
            >
              {ROTULOS_FASE[f]}
            </button>
          ))}
        </div>

        <p className="c-dica" style={{ marginTop: 8 }}>
          {DESCRICAO_FASE[fase]}
        </p>

        {/* ── Busca ── */}
        <div style={{ marginTop: 16 }}>
          <BarraBusca
            valor={busca}
            aoMudar={definirBusca}
            placeholder="Buscar alimento…"
          />
        </div>

        {/* ── Filtros ── */}
        <div className="c-fodmap-filtros">
          <div className="c-chips-scroll" role="group" aria-label="Categoria">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                className={`c-chip c-chip-pequeno ${categoria === c ? "c-chip-ativo" : ""}`}
                onClick={() => definirCategoria(categoria === c ? null : c)}
              >
                {ROTULOS_CATEGORIA[c]}
              </button>
            ))}
          </div>

          <div className="c-chips-scroll" role="group" aria-label="Grupo FODMAP">
            {GRUPOS.map((g) => (
              <button
                key={g}
                type="button"
                className={`c-chip c-chip-pequeno ${grupo === g ? "c-chip-ativo" : ""}`}
                onClick={() => definirGrupo(grupo === g ? null : g)}
              >
                {ROTULOS_GRUPO[g]}
              </button>
            ))}
          </div>
        </div>

        {temFiltro && (
          <button type="button" className="c-link c-link-discreto" style={{ marginTop: 8 }} onClick={limpar}>
            Limpar filtros
          </button>
        )}

        {/* ── Abas por nível ── */}
        <div className="c-fodmap-abas" role="tablist" aria-label="Nível FODMAP">
          {NIVEIS_ORDEM.map((n) => {
            const qtd = contagem[n];
            if (qtd === 0) return null;
            return (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={nivelAtivo === n}
                className={`c-fodmap-aba ${nivelAtivo === n ? "c-fodmap-aba-ativo" : ""}`}
                style={{
                  "--cor-nivel": CORES_NIVEL[n],
                  "--bg-nivel": BG_NIVEL[n],
                } as React.CSSProperties}
                onClick={() => { definirNivelAtivo(n); definirExpandido(null); }}
              >
                <Sinal cor={CORES_NIVEL[n]} grande />
                <span>{ROTULOS_NIVEL[n]}</span>
                <span className="c-contagem">{qtd}</span>
              </button>
            );
          })}
        </div>

        {/* ── Lista do nível selecionado ── */}
        {resultados.length === 0 ? (
          <p className="c-dica" style={{ marginTop: 20, textAlign: "center" }}>
            Nenhum alimento encontrado com esses filtros.
          </p>
        ) : resultadosDoNivel.length === 0 ? (
          <p className="c-dica" style={{ marginTop: 20, textAlign: "center" }}>
            Nenhum alimento {ROTULOS_NIVEL[nivelAtivo].toLowerCase()} com esses filtros.
          </p>
        ) : (
          <div className="c-fodmap-lista" style={{ marginTop: 12 }} aria-live="polite">
            {resultadosDoNivel.map((a) => (
              <CartaoFodmap
                key={a.id}
                alimento={a}
                expandido={expandido === a.id}
                aoExpandir={() => definirExpandido(expandido === a.id ? null : a.id)}
                fase={fase}
              />
            ))}
          </div>
        )}

        {/* ── Legenda ── */}
        <section className="c-secao" style={{ marginTop: 32 }}>
          <h2 className="c-secao-titulo">Legenda</h2>
          <div className="c-fodmap-legenda">
            <div className="c-fodmap-legenda-item">
              <Sinal cor={CORES_NIVEL.verde} grande />
              <div>
                <strong>{ROTULOS_NIVEL.verde}</strong>
                <span>Pode comer na porção indicada.</span>
              </div>
            </div>
            <div className="c-fodmap-legenda-item">
              <Sinal cor={CORES_NIVEL.amarelo} grande />
              <div>
                <strong>{ROTULOS_NIVEL.amarelo}</strong>
                <span>Porção moderada pode ser tolerada. Teste com cuidado.</span>
              </div>
            </div>
            <div className="c-fodmap-legenda-item">
              <Sinal cor={CORES_NIVEL.vermelho} grande />
              <div>
                <strong>{ROTULOS_NIVEL.vermelho}</strong>
                <span>Evite durante a eliminação. Alto em FODMAPs.</span>
              </div>
            </div>
          </div>

          <h3 className="c-secao-titulo" style={{ marginTop: 20, fontSize: "0.85rem" }}>Grupos FODMAP</h3>
          <div className="c-fodmap-grupos-info">
            <p><strong>Oligossacarídeos:</strong> Frutanos (trigo, cebola, alho) e GOS (leguminosas).</p>
            <p><strong>Dissacarídeos:</strong> Lactose (leite e derivados).</p>
            <p><strong>Monossacarídeos:</strong> Frutose em excesso (mel, maçã, manga).</p>
            <p><strong>Polióis:</strong> Sorbitol e Manitol (frutas de caroço, cogumelo, adoçantes).</p>
          </div>
        </section>
      </div>
    </>
  );
}


function Sinal({ cor, grande }: { cor: string; grande?: boolean }) {
  const tam = grande ? 14 : 10;
  return (
    <span
      className="c-fodmap-sinal"
      style={{ width: tam, height: tam, backgroundColor: cor }}
      aria-hidden="true"
    />
  );
}

function CartaoFodmap({
  alimento,
  expandido,
  aoExpandir,
  fase,
}: {
  alimento: AlimentoFodmap;
  expandido: boolean;
  aoExpandir: () => void;
  fase: FaseFodmap;
}) {
  const cor = CORES_NIVEL[alimento.nivel];
  const bg = BG_NIVEL[alimento.nivel];

  const porcao =
    alimento.nivel === "verde"
      ? alimento.porcaoSegura
      : alimento.nivel === "amarelo"
        ? alimento.porcaoModerada
        : null;

  return (
    <button
      type="button"
      className="c-fodmap-cartao"
      style={{ borderLeftColor: cor }}
      onClick={aoExpandir}
      aria-expanded={expandido}
    >
      <div className="c-fodmap-cartao-topo">
        <div className="c-fodmap-cartao-nome">
          <Sinal cor={cor} />
          <span>{alimento.nome}</span>
        </div>
        {porcao && <span className="c-fodmap-cartao-porcao">{porcao}</span>}
        <Icone nome={expandido ? "voltar" : "seta"} tamanho={14}
          style={{ transform: expandido ? "rotate(90deg)" : "none", opacity: 0.4, flexShrink: 0 }} />
      </div>

      {expandido && (
        <div className="c-fodmap-cartao-detalhe" style={{ backgroundColor: bg }}>
          <div className="c-fodmap-cartao-nivel">
            <span style={{ color: cor, fontWeight: 600 }}>{ROTULOS_NIVEL[alimento.nivel]}</span>
            <span className="c-fodmap-cartao-categoria">
              {ROTULOS_CATEGORIA[alimento.categoria]}
            </span>
          </div>

          {alimento.porcaoSegura && (
            <p className="c-fodmap-detalhe-linha">
              <strong>Porção segura:</strong> {alimento.porcaoSegura}
            </p>
          )}
          {alimento.porcaoModerada && (
            <p className="c-fodmap-detalhe-linha">
              <strong>Porção moderada:</strong> {alimento.porcaoModerada}
            </p>
          )}

          {alimento.grupos.length > 0 && (
            <p className="c-fodmap-detalhe-linha">
              <strong>{alimento.grupos.length === 1 ? "Grupo:" : "Grupos:"}</strong>{" "}
              {alimento.grupos.map((g) => ROTULOS_GRUPO[g]).join(", ")}
            </p>
          )}

          {alimento.dica && (
            <p className="c-fodmap-dica">
              <Icone nome="info" tamanho={14} style={{ flexShrink: 0, marginTop: 2 }} />
              {alimento.dica}
            </p>
          )}

          {fase === "reintroducao" && alimento.nivel !== "verde" && alimento.grupos.length > 0 && (
            <p className="c-fodmap-detalhe-linha c-dica" style={{ fontSize: "0.78rem", marginTop: 8 }}>
              Teste um grupo por vez, em porção pequena, durante 3 dias. Anote os sintomas.
            </p>
          )}
        </div>
      )}
    </button>
  );
}
