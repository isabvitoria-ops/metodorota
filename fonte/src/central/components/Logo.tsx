import { inicialDe } from "@/central/utils/logo";

/**
 * A marca de uma casa ou de uma categoria.
 *
 * Sem logo cadastrada, desenha a inicial num círculo em vez de deixar um
 * buraco ou um ícone quebrado: a lista continua legível enquanto a
 * nutricionista não enviou a imagem, e nada na tela finge ser a marca.
 *
 * `alt` fica vazio de propósito quando o nome já está escrito ao lado — um
 * leitor de tela que anunciasse "McDonald's, McDonald's" só atrapalharia.
 */
export function Logo({
  nome,
  logo,
  tamanho = 40,
  nomeVisivel = true,
}: {
  nome: string;
  logo: string | null;
  tamanho?: number;
  nomeVisivel?: boolean;
}) {
  const estilo = { width: tamanho, height: tamanho };

  if (logo) {
    return (
      <span className="c-logo" style={estilo}>
        <img src={logo} alt={nomeVisivel ? "" : nome} loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className="c-logo c-logo-inicial"
      style={{ ...estilo, fontSize: Math.round(tamanho * 0.42) }}
      aria-hidden={nomeVisivel ? true : undefined}
      role={nomeVisivel ? undefined : "img"}
      aria-label={nomeVisivel ? undefined : nome}
    >
      {inicialDe(nome)}
    </span>
  );
}
