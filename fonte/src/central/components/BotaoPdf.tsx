import { useEffect, useState, type ReactNode } from "react";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { gerarPdfDoDocumento } from "@/central/utils/pdf/gerarPdfDoDocumento";
import { CRN_DA_NUTRICIONISTA, INSTAGRAM_DA_MARCA, TELEFONE_DA_MARCA } from "@/central/utils/marcaDosDocumentos";
import { Icone } from "./Icone";

/**
 * "Baixar em PDF" fora da tela Meus documentos — a receita, o pedido de
 * exames. Faz o mesmo caminho que Documentos.tsx: monta o documento (uma
 * `FolhaDeDocumento`, invisível na tela), desenha folha a folha em
 * `gerarPdfDoDocumento` e entrega o arquivo com um toque dela (é o que o
 * celular exige para salvar ou compartilhar).
 *
 * `documento` só é montado enquanto o arquivo está sendo feito: montado o
 * tempo todo, entraria em toda impressão da página.
 */
type Estado =
  | { tipo: "parado" }
  | { tipo: "montando"; pagina: number; total: number }
  | { tipo: "pronto"; arquivo: File; url: string }
  | { tipo: "erro" };

function esperarDocumento(prazoMs = 4000): Promise<HTMLElement | null> {
  return new Promise((resolver) => {
    const inicio = Date.now();
    const olhar = () => {
      const folha = document.querySelector<HTMLElement>(".folha-documento");
      if (folha?.querySelector(".doc")) return resolver(folha);
      if (Date.now() - inicio > prazoMs) return resolver(null);
      requestAnimationFrame(olhar);
    };
    olhar();
  });
}

function podeCompartilhar(arquivo: File): boolean {
  try {
    return typeof navigator.share === "function" && navigator.canShare?.({ files: [arquivo] }) === true;
  } catch {
    return false;
  }
}

export function BotaoPdf({
  titulo,
  documento,
  rotulo = "Baixar em PDF",
  classe = "c-botao",
  desligado = false,
  aoGerar,
}: {
  /** "Receita — Frango com abobrinha": rodapé do PDF e nome do arquivo. */
  titulo: string;
  documento: ReactNode;
  rotulo?: string;
  classe?: string;
  desligado?: boolean;
  /** Chamado quando o PDF fica pronto (o relatório para o médico guarda a cópia aqui). */
  aoGerar?: () => void;
}) {
  const { configuracoes } = useSessao();
  const [estado, definirEstado] = useState<Estado>({ tipo: "parado" });
  const [montado, definirMontado] = useState(false);
  const [recado, definirRecado] = useState<string | null>(null);

  const url = estado.tipo === "pronto" ? estado.url : null;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  // Mudou o documento (outra receita, outro exame marcado): o arquivo antigo não vale mais.
  useEffect(() => {
    definirEstado((e) => (e.tipo === "pronto" || e.tipo === "erro" ? { tipo: "parado" } : e));
  }, [titulo, documento]);

  async function montar() {
    if (estado.tipo === "montando") return;
    definirRecado(null);
    definirEstado({ tipo: "montando", pagina: 0, total: 0 });
    definirMontado(true);
    try {
      const folha = await esperarDocumento();
      if (!folha) throw new Error("O documento não ficou pronto.");
      const blob = await gerarPdfDoDocumento({
        folha,
        titulo,
        assinatura: [
          `${configuracoes.nomeNutricionista || "Isabela Marçal"} · Nutricionista`,
          `${CRN_DA_NUTRICIONISTA} · ${INSTAGRAM_DA_MARCA} · ${TELEFONE_DA_MARCA}`,
        ],
        aoAvancar: (pagina, total) => definirEstado({ tipo: "montando", pagina, total }),
      });
      const arquivo = new File([blob], `${titulo.replace(" — ", " - ")}.pdf`, { type: "application/pdf" });
      definirEstado({ tipo: "pronto", arquivo, url: URL.createObjectURL(arquivo) });
      aoGerar?.();
    } catch {
      definirEstado({ tipo: "erro" });
    } finally {
      definirMontado(false);
    }
  }

  async function compartilhar(arquivo: File) {
    definirRecado(null);
    try {
      await navigator.share({ files: [arquivo], title: titulo });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      definirRecado("Não consegui abrir a tela de compartilhar. Use “Baixar”.");
    }
  }

  return (
    <div className="c-pdf">
      {estado.tipo !== "pronto" && (
        <button
          type="button"
          className={classe}
          disabled={desligado || estado.tipo === "montando"}
          onClick={() => void montar()}
        >
          <Icone nome="documentos" tamanho={17} />
          {estado.tipo === "montando"
            ? estado.total > 0
              ? `Montando… página ${estado.pagina} de ${estado.total}`
              : "Montando o PDF…"
            : rotulo}
        </button>
      )}
      {estado.tipo === "erro" && (
        <p className="c-doc-recado" role="alert">
          Não consegui montar o PDF. Tente de novo.
        </p>
      )}
      {estado.tipo === "pronto" && (
        <div className="c-doc-pronto" role="status">
          <p className="c-doc-pronto-titulo">
            <Icone nome="feito" tamanho={16} /> PDF pronto
          </p>
          <div className="c-doc-acoes">
            {podeCompartilhar(estado.arquivo) && (
              <button type="button" className="c-botao c-botao-pequeno" onClick={() => void compartilhar(estado.arquivo)}>
                Salvar ou compartilhar
              </button>
            )}
            <a
              className={`c-botao c-botao-pequeno${podeCompartilhar(estado.arquivo) ? " c-botao-secundario" : ""}`}
              href={estado.url}
              download={estado.arquivo.name}
            >
              Baixar
            </a>
          </div>
          {recado && (
            <p className="c-doc-recado" role="alert">
              {recado}
            </p>
          )}
        </div>
      )}
      {montado && documento}
    </div>
  );
}
