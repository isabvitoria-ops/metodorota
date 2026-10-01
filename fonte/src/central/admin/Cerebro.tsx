import { useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type {
  FonteDoCerebro,
  PendenciasDoCerebro,
  TrechoCitado,
} from "@/central/types/cerebro";
import { partirEmTrechos, porQueNaoServe, tamanhoBonito } from "@/central/utils/cerebroDoNutri";
import { extrairTextoDoPdf } from "@/central/utils/extrairPdf";
import { AreaTexto, Campo, Texto } from "./componentes/Campos";
import { Esqueleto } from "@/central/components/Esqueleto";

/**
 * Cérebro do Nutri: a base de conhecimento privada da nutricionista.
 *
 * A tela tem três blocos:
 *   1. NOVA FONTE — colar texto ou soltar um PDF; o texto é extraído no
 *      navegador com pdf.js e vira trechos de ~800 palavras;
 *   2. LISTA — o que já foi guardado, com botão de apagar;
 *   3. BUSCA DE TESTE — para ela conferir "o Cérebro sabe sobre X?".
 *
 * A paciente NUNCA vê esta tela. O RLS do banco impede o acesso mesmo
 * se ela abrir `/admin/cerebro` no navegador (é redirecionada pela
 * `AdminApp`), e as políticas recusam qualquer chamada.
 */
export function CerebroDoNutri() {
  const [fontes, definirFontes] = useState<FonteDoCerebro[]>([]);
  const [pendencias, definirPendencias] = useState<PendenciasDoCerebro>({
    total: 0,
    pendentes: 0,
    fontes: 0,
  });
  const [erro, definirErro] = useState<string | null>(null);
  const [carregando, definirCarregando] = useState(true);

  async function recarregar() {
    try {
      const [fs, ps] = await Promise.all([
        repositorio.fontesDoCerebro(),
        repositorio.pendenciasDoCerebro(),
      ]);
      definirFontes(fs);
      definirPendencias(ps);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Cérebro do Nutri
      </h1>
      <p className="c-subtitulo">
        O material que você guarda aqui vira citação nas condutas propostas.
        Nada disto aparece para a paciente.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <BlocoAdicionar aoSalvar={recarregar} />

      <BlocoLista
        fontes={fontes}
        pendencias={pendencias}
        carregando={carregando}
        aoApagar={async (id) => {
          await repositorio.apagarFonte(id);
          await recarregar();
        }}
      />

      <BlocoBusca />
    </>
  );
}

// -----------------------------------------------------------------------------
// Adicionar
// -----------------------------------------------------------------------------

function BlocoAdicionar({ aoSalvar }: { aoSalvar: () => Promise<void> }) {
  const [tipo, definirTipo] = useState<"pdf" | "texto">("texto");
  const [titulo, definirTitulo] = useState("");
  const [fonte, definirFonte] = useState("");
  const [texto, definirTextoDaFonte] = useState("");
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  function limpar() {
    definirTitulo("");
    definirFonte("");
    definirTextoDaFonte("");
    definirArquivo(null);
  }

  async function salvar() {
    definirAviso(null);
    if (!titulo.trim()) {
      definirAviso("Faltou o título.");
      return;
    }
    if (tipo === "pdf" && !arquivo) {
      definirAviso("Escolha o PDF.");
      return;
    }
    if (tipo === "texto" && !texto.trim()) {
      definirAviso("Cole o texto.");
      return;
    }

    definirSalvando(true);
    try {
      let conteudo = texto;
      if (tipo === "pdf" && arquivo) {
        definirAviso("Lendo o PDF…");
        conteudo = await extrairTextoDoPdf(arquivo);
        if (conteudo.trim().length < 50) {
          throw new Error(
            "Este PDF parece ser só imagem (escaneado). O Cérebro precisa de texto para buscar.",
          );
        }
      }

      definirAviso("Guardando…");
      const fonteId = await repositorio.registrarFonte({
        titulo: titulo.trim(),
        fonte: fonte.trim() || null,
        tipo,
        arquivo,
        conteudo,
      });

      const trechos = partirEmTrechos(conteudo).map((t, i) => ({ ordem: i, trecho: t }));
      if (trechos.length === 0) {
        throw new Error("O texto ficou sem trechos aproveitáveis. Confira o conteúdo.");
      }
      await repositorio.salvarTrechos(fonteId, trechos);

      definirAviso(`Guardado com ${trechos.length} trechos.`);
      limpar();
      await aoSalvar();
    } catch (e) {
      definirAviso((e as Error).message);
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <section className="c-bloco" style={{ marginTop: 18 }}>
      <h2>Adicionar ao Cérebro</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={`c-chip ${tipo === "texto" ? "c-chip-selecionado" : ""}`}
          onClick={() => definirTipo("texto")}
        >
          Colar texto
        </button>
        <button
          type="button"
          className={`c-chip ${tipo === "pdf" ? "c-chip-selecionado" : ""}`}
          onClick={() => definirTipo("pdf")}
        >
          Soltar PDF
        </button>
      </div>

      <div style={{ maxWidth: 620 }}>
        <Campo rotulo="Título">
          <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Ex.: Dieta baixo FODMAP" />
        </Campo>
        <Campo rotulo="Fonte" dica="Autor, revista, ano. Fica junto da citação.">
          <Texto valor={fonte} aoMudar={definirFonte} placeholder="Ex.: Halmos et al. 2014" />
        </Campo>

        {tipo === "texto" ? (
          <Campo rotulo="Texto">
            <AreaTexto
              valor={texto}
              aoMudar={definirTextoDaFonte}
              placeholder="Cole aqui o texto que você quer no Cérebro."
              linhas={10}
            />
          </Campo>
        ) : (
          <Campo rotulo="PDF" dica="Até 20 MB. PDF de texto (não escaneado).">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f) {
                  const recusa = porQueNaoServe(f);
                  if (recusa) {
                    definirAviso(recusa);
                    definirArquivo(null);
                    return;
                  }
                }
                definirAviso(null);
                definirArquivo(f);
              }}
            />
            {arquivo && (
              <span className="c-dica">
                {arquivo.name} — {tamanhoBonito(arquivo.size)}
              </span>
            )}
          </Campo>
        )}

        {aviso && (
          <div
            className={`c-aviso ${
              aviso.startsWith("Guardado") ? "c-aviso-ok" : "c-aviso-erro"
            }`}
            role="status"
          >
            <span>{aviso}</span>
          </div>
        )}

        <button
          type="button"
          className="c-botao"
          onClick={() => void salvar()}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : "Guardar no Cérebro"}
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Lista
// -----------------------------------------------------------------------------

function BlocoLista({
  fontes,
  pendencias,
  carregando,
  aoApagar,
}: {
  fontes: FonteDoCerebro[];
  pendencias: PendenciasDoCerebro;
  carregando: boolean;
  aoApagar: (id: string) => Promise<void>;
}) {
  return (
    <section className="c-bloco" style={{ marginTop: 18 }}>
      <h2>Já no Cérebro</h2>

      <p className="c-dica" style={{ marginTop: -6 }}>
        {pendencias.fontes} {pendencias.fontes === 1 ? "fonte" : "fontes"}, {pendencias.total}{" "}
        {pendencias.total === 1 ? "trecho" : "trechos"}
        {pendencias.pendentes > 0
          ? ` — ${pendencias.pendentes} ainda esperando o embedding (busca por sentido). Enquanto isso, a busca por palavra funciona.`
          : "."}
      </p>

      {carregando ? (
        <Esqueleto />
      ) : fontes.length === 0 ? (
        <p className="c-dica">Vazio. Adicione a primeira fonte acima.</p>
      ) : (
        <table className="c-tabela" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Fonte</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>Trechos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fontes.map((f) => (
              <tr key={f.id}>
                <td>{f.titulo}</td>
                <td>{f.fonte ?? "—"}</td>
                <td>{f.tipo === "pdf" ? "PDF" : "texto"}</td>
                <td style={{ textAlign: "right" }}>
                  {f.comEmbedding}/{f.trechos}
                </td>
                <td>
                  <button
                    type="button"
                    className="c-chip"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Apagar "${f.titulo}" do Cérebro? As citações antigas continuam nas sugestões guardadas, mas novas buscas não vão mais achar esta fonte.`,
                        )
                      ) {
                        void aoApagar(f.id);
                      }
                    }}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Busca de teste
// -----------------------------------------------------------------------------

function BlocoBusca() {
  const [pergunta, definirPergunta] = useState("");
  const [resultados, definirResultados] = useState<TrechoCitado[]>([]);
  const [buscando, definirBuscando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const modo = useMemo(
    () => (resultados[0]?.distancia !== undefined ? "sentido" : "palavra"),
    [resultados],
  );

  async function buscar() {
    definirErro(null);
    definirBuscando(true);
    try {
      // Sem chave de embeddings, cai em busca textual. Quando ela contratar
      // Voyage, o cliente vai gerar o embedding aqui e passar por p_embedding.
      const trechos = await repositorio.buscarNoCerebro(pergunta);
      definirResultados(trechos);
    } catch (e) {
      definirErro((e as Error).message);
    } finally {
      definirBuscando(false);
    }
  }

  return (
    <section className="c-bloco" style={{ marginTop: 18 }}>
      <h2>Testar a busca</h2>
      <p className="c-dica" style={{ marginTop: -6 }}>
        Escreva uma pergunta para ver o que o Cérebro traria. É a mesma busca
        que a sugestão de conduta usa.
      </p>

      <div style={{ display: "flex", gap: 8, maxWidth: 620 }}>
        <input
          className="c-input"
          value={pergunta}
          onChange={(e) => definirPergunta(e.target.value)}
          placeholder="Ex.: dieta para SII com constipação"
          onKeyDown={(e) => {
            if (e.key === "Enter") void buscar();
          }}
        />
        <button
          type="button"
          className="c-botao"
          onClick={() => void buscar()}
          disabled={buscando || !pergunta.trim()}
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {resultados.length > 0 && (
        <>
          <p className="c-dica" style={{ marginTop: 12 }}>
            {resultados.length} {resultados.length === 1 ? "trecho" : "trechos"} —{" "}
            {modo === "sentido"
              ? "busca por sentido (embedding)"
              : "busca por palavra (tsvector)"}
            .
          </p>
          <ol style={{ paddingLeft: 20 }}>
            {resultados.map((r) => (
              <li key={r.id} style={{ marginBottom: 12 }}>
                <strong>{r.titulo}</strong>
                {r.fonte && <span className="c-dica"> — {r.fonte}</span>}
                <p style={{ marginTop: 4 }}>{r.trecho}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
