import { useCallback, useEffect, useState } from "react";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Esqueleto } from "@/central/components/Esqueleto";
import { rotas } from "@/central/rotas";
import { repositorio } from "@/central/dados/repositorio";
import type { Protocolo, RefeicaoProtocolo } from "@/central/types/protocolo";

interface ItemCompra {
  alimento: string;
  quantidade: string;
  refeicao: string;
}

function extrairItens(protocolo: Protocolo): ItemCompra[] {
  const itens: ItemCompra[] = [];
  for (const refeicao of protocolo.conteudo.refeicoes) {
    for (const opcao of refeicao.opcoes) {
      for (const item of opcao.itens) {
        itens.push({
          alimento: item.alimento.trim(),
          quantidade: item.quantidade.trim(),
          refeicao: refeicao.nome,
        });
        for (const sub of item.substituicoes) {
          const partes = sub.split(/\s*[-–—]\s*/);
          const nome = partes[0]?.trim();
          const qtd = partes.slice(1).join(" - ").trim();
          if (nome) {
            itens.push({
              alimento: nome,
              quantidade: qtd || item.quantidade.trim(),
              refeicao: refeicao.nome,
            });
          }
        }
      }
    }
  }
  return itens;
}

interface AlimentoAgrupado {
  nome: string;
  normalizado: string;
  detalhes: { quantidade: string; refeicao: string }[];
}

function agruparAlimentos(itens: ItemCompra[]): AlimentoAgrupado[] {
  const mapa = new Map<string, AlimentoAgrupado>();
  for (const item of itens) {
    const normalizado = item.alimento.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const existente = mapa.get(normalizado);
    if (existente) {
      const jaTem = existente.detalhes.some(
        (d) => d.quantidade === item.quantidade && d.refeicao === item.refeicao,
      );
      if (!jaTem) existente.detalhes.push({ quantidade: item.quantidade, refeicao: item.refeicao });
    } else {
      mapa.set(normalizado, {
        nome: item.alimento,
        normalizado,
        detalhes: [{ quantidade: item.quantidade, refeicao: item.refeicao }],
      });
    }
  }
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function lerMarcados(): Set<string> {
  try {
    const v = localStorage.getItem("compras-marcados");
    if (v) return new Set(JSON.parse(v) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function salvarMarcados(marcados: Set<string>) {
  try {
    localStorage.setItem("compras-marcados", JSON.stringify([...marcados]));
  } catch { /* ignore */ }
}

type Modo = "unificada" | "por-refeicao";

export function ListaDeCompras() {
  const [protocolo, definirProtocolo] = useState<Protocolo | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [marcados, definirMarcados] = useState<Set<string>>(lerMarcados);
  const [modo, definirModo] = useState<Modo>("unificada");
  const [busca, definirBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    void repositorio
      .meuProtocolo()
      .then((p) => vivo && definirProtocolo(p))
      .catch(() => {})
      .finally(() => vivo && definirCarregando(false));
    return () => { vivo = false; };
  }, []);

  const alternarMarcado = useCallback((nome: string) => {
    definirMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(nome)) novo.delete(nome); else novo.add(nome);
      salvarMarcados(novo);
      return novo;
    });
  }, []);

  const limparMarcados = useCallback(() => {
    definirMarcados(new Set());
    salvarMarcados(new Set());
  }, []);

  if (carregando) {
    return (
      <>
        <CabecalhoPagina titulo="Lista de compras" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <Esqueleto linhas={6} />
        </div>
      </>
    );
  }

  if (!protocolo || protocolo.conteudo.refeicoes.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Lista de compras" voltarPara={rotas.home} />
        <div className="c-conteudo">
          <EstadoVazio
            icone="lista"
            titulo="Sem protocolo publicado"
            descricao="A lista de compras é gerada a partir do seu protocolo alimentar. Quando sua nutricionista publicar o plano, a lista aparece aqui."
          />
        </div>
      </>
    );
  }

  const todosItens = extrairItens(protocolo);
  const agrupados = agruparAlimentos(todosItens);
  const filtro = busca.trim().toLowerCase();
  const filtrados = filtro
    ? agrupados.filter((a) => a.normalizado.includes(filtro.normalize("NFD").replace(/[̀-ͯ]/g, "")))
    : agrupados;

  const total = filtrados.length;
  const marcadosNaLista = filtrados.filter((a) => marcados.has(a.normalizado)).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Lista de compras"
        descricao="Gerada a partir do seu protocolo alimentar."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <div className="c-compras-topo">
          <input
            type="search"
            className="c-campo-input"
            placeholder="Buscar alimento…"
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
          />
          <div className="c-compras-controles">
            <div className="c-compras-abas">
              <button
                type="button"
                className={`c-compras-aba ${modo === "unificada" ? "c-compras-aba-ativa" : ""}`}
                onClick={() => definirModo("unificada")}
              >
                Lista única
              </button>
              <button
                type="button"
                className={`c-compras-aba ${modo === "por-refeicao" ? "c-compras-aba-ativa" : ""}`}
                onClick={() => definirModo("por-refeicao")}
              >
                Por refeição
              </button>
            </div>
            {marcadosNaLista > 0 && (
              <button type="button" className="c-link c-link-discreto" onClick={limparMarcados}>
                Limpar ({marcadosNaLista}/{total})
              </button>
            )}
          </div>
          <p className="c-dica">
            {marcadosNaLista} de {total} {total === 1 ? "item marcado" : "itens marcados"}
          </p>
        </div>

        {modo === "unificada" ? (
          <ListaUnificada itens={filtrados} marcados={marcados} aoAlternar={alternarMarcado} />
        ) : (
          <ListaPorRefeicao
            refeicoes={protocolo.conteudo.refeicoes}
            todosItens={todosItens}
            marcados={marcados}
            aoAlternar={alternarMarcado}
            filtro={filtro}
          />
        )}

        <p className="c-dica" style={{ marginTop: 20, textAlign: "center" }}>
          Inclui os alimentos e suas substituições do seu protocolo.
        </p>
      </div>
    </>
  );
}

function ListaUnificada({
  itens,
  marcados,
  aoAlternar,
}: {
  itens: AlimentoAgrupado[];
  marcados: Set<string>;
  aoAlternar: (nome: string) => void;
}) {
  const naoMarcados = itens.filter((a) => !marcados.has(a.normalizado));
  const jaMarcados = itens.filter((a) => marcados.has(a.normalizado));

  return (
    <div className="c-compras-lista">
      {naoMarcados.map((a) => (
        <ItemLinha key={a.normalizado} item={a} marcado={false} aoAlternar={aoAlternar} />
      ))}
      {jaMarcados.length > 0 && (
        <>
          <div className="c-compras-separador">
            <span>Já no carrinho ({jaMarcados.length})</span>
          </div>
          {jaMarcados.map((a) => (
            <ItemLinha key={a.normalizado} item={a} marcado aoAlternar={aoAlternar} />
          ))}
        </>
      )}
    </div>
  );
}

function ListaPorRefeicao({
  refeicoes,
  todosItens,
  marcados,
  aoAlternar,
  filtro,
}: {
  refeicoes: RefeicaoProtocolo[];
  todosItens: ItemCompra[];
  marcados: Set<string>;
  aoAlternar: (nome: string) => void;
  filtro: string;
}) {
  return (
    <>
      {refeicoes.map((ref) => {
        const itensDaRefeicao = todosItens.filter((i) => i.refeicao === ref.nome);
        const agrupados = agruparAlimentos(itensDaRefeicao);
        const filtrados = filtro
          ? agrupados.filter((a) => a.normalizado.includes(filtro.normalize("NFD").replace(/[̀-ͯ]/g, "")))
          : agrupados;
        if (filtrados.length === 0) return null;
        return (
          <section key={ref.nome} className="c-secao">
            <h2 className="c-secao-titulo">{ref.nome}</h2>
            <div className="c-compras-lista">
              {filtrados.map((a) => (
                <ItemLinha key={a.normalizado} item={a} marcado={marcados.has(a.normalizado)} aoAlternar={aoAlternar} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ItemLinha({
  item,
  marcado,
  aoAlternar,
}: {
  item: AlimentoAgrupado;
  marcado: boolean;
  aoAlternar: (nome: string) => void;
}) {
  return (
    <button
      type="button"
      className={`c-compras-item ${marcado ? "c-compras-item-marcado" : ""}`}
      onClick={() => aoAlternar(item.normalizado)}
    >
      <span className={`c-compras-check ${marcado ? "c-compras-check-ativo" : ""}`}>
        {marcado ? "✓" : ""}
      </span>
      <span className="c-compras-item-texto">
        <strong>{item.nome}</strong>
        {item.detalhes.length === 1 && item.detalhes[0]?.quantidade && (
          <span className="c-compras-qtd">{item.detalhes[0]?.quantidade}</span>
        )}
        {item.detalhes.length > 1 && (
          <span className="c-compras-qtd">
            {item.detalhes.map((d) => `${d.refeicao}: ${d.quantidade}`).join(" · ")}
          </span>
        )}
      </span>
    </button>
  );
}
