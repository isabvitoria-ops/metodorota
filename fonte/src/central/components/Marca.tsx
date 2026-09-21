import horizontalUrl from "@/central/marca/isabela-marcal.svg";
import horizontalClaraUrl from "@/central/marca/isabela-marcal-clara.svg";
import monogramaUrl from "@/central/marca/monograma.svg";
import monogramaClaroUrl from "@/central/marca/monograma-claro.svg";

/**
 * A logo da Isabela Marçal.
 *
 * O ARQUIVO É O OFICIAL, e é a arte original — extraída em vetor do manual
 * que a designer entregou. Não foi redesenhada, não foi refeita com outra
 * fonte, e nem símbolo, nem proporção, nem cor foram mexidos. Ver
 * `public/marca/LEIA-ME.md`.
 *
 * POR QUE `<img>` E NÃO O SVG COLADO NO MEIO DO JSX: a logo tem 30 traços.
 * Colada, ela entraria no HTML de toda tela que a usa, e o mesmo desenho
 * apareceria quatro vezes no arquivo único que o site publica. Como
 * arquivo, entra uma vez e o navegador reaproveita.
 *
 * A ALTURA manda, e a largura vem sozinha: é o que garante que a logo nunca
 * apareça esticada. Passar as duas era o caminho mais curto para deformar.
 */

export type VarianteDaMarca = "horizontal" | "horizontal-clara" | "monograma" | "monograma-claro";

/**
 * IMPORTADAS, e não escritas como caminho de `public/`.
 *
 * O site é publicado como UM arquivo HTML só, e o que o empacotador importa
 * ele embute; o que está em `public/` ele só copia para o lado. Escritas
 * como caminho, as quatro logos ficariam de fora do arquivo publicado e o
 * site abriria com quatro imagens quebradas — exatamente o tipo de falha
 * que só aparece em produção.
 *
 * Importadas, elas viram `data:` dentro do pacote e sobem junto.
 */
const ARQUIVOS: Record<VarianteDaMarca, string> = {
  horizontal: horizontalUrl,
  "horizontal-clara": horizontalClaraUrl,
  monograma: monogramaUrl,
  "monograma-claro": monogramaClaroUrl,
};

export function Marca({
  variante = "horizontal",
  altura = 34,
  className,
}: {
  variante?: VarianteDaMarca;
  /** Em pixels. A largura sai da proporção do arquivo, sozinha. */
  altura?: number;
  className?: string;
}) {
  return (
    <img
      className={className ? `c-marca-logo ${className}` : "c-marca-logo"}
      src={ARQUIVOS[variante]}
      /* O nome já está desenhado dentro da imagem. Repetir "Isabela Marçal
         — nutricionista" no `alt` faria o leitor de tela ler o nome duas
         vezes quando ele aparece escrito ao lado. */
      alt="Isabela Marçal — Nutricionista"
      style={{ height: altura }}
      /* Largura e altura de referência (a proporção real, 4,58:1 e 1:1) para
         o navegador reservar o espaço antes de carregar: sem isso, a tela
         pula quando a logo chega. */
      width={variante.startsWith("monograma") ? altura : Math.round(altura * 4.581)}
      height={altura}
      decoding="async"
    />
  );
}
