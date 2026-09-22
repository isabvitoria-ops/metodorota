/**
 * A versão do arquivo que o navegador está mostrando AGORA.
 *
 * POR QUE ISTO EXISTE
 *
 * A Central publicada é um arquivo HTML só, de um mega e meio. Quando o
 * navegador guarda uma cópia, ele guarda o aplicativo INTEIRO — e a tela
 * continua abrindo normalmente, sem erro nenhum, só que na versão de
 * ontem. Do lado de quem olha, é idêntico a uma publicação que falhou.
 *
 * Isso já custou uma conversa inteira: ela abriu, não viu a mudança, e nós
 * dois passamos a procurar defeito num arquivo publicado que estava certo.
 *
 * O carimbo é escrito pelo gerador na hora de montar a página, e lido aqui
 * do próprio documento. Ele responde a única pergunta que importa nesse
 * momento: "a data que eu estou vendo é a que ele me disse?"
 *
 * Em desenvolvimento não existe carimbo — o arquivo não passou pelo
 * gerador. Aí a resposta é honesta: "versão de desenvolvimento", e não uma
 * data inventada.
 */
export function versaoDoSite(): string {
  if (typeof document === "undefined") return "versão de desenvolvimento";
  const marca = document.querySelector('meta[name="versao-do-site"]');
  const valor = marca?.getAttribute("content")?.trim();
  return valor && valor.length > 0 ? valor : "versão de desenvolvimento";
}

/** A mesma coisa em dia/mês/ano, que é como ela lê data. */
export function versaoLegivel(): string {
  const bruta = versaoDoSite();
  const m = bruta.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
  if (!m) return bruta;
  const [, ano, mes, dia, hora] = m;
  return `${dia}/${mes}/${ano} às ${hora} (UTC)`;
}
