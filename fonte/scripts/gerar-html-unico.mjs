/**
 * Junta o build `unico` num único arquivo HTML: `site/index.html`.
 *
 * O resultado abre com dois cliques, sem servidor, sem internet e sem pasta
 * de apoio — dá para mandar por e-mail, guardar num pendrive ou subir em
 * qualquer hospedagem que sirva arquivo estático.
 *
 * NÃO escreve na raiz do projeto: o `index.html` de lá é o molde que o Vite
 * usa para montar o app. Sobrescrever aquele arquivo quebraria o build.
 *
 * Rode com `npm run html-unico`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// `pages` sai para o GitHub Pages (subpasta /metodorota/), `unico` abre do
// disco. O conteúdo é o mesmo; muda o destino e o segundo arquivo.
const paraPages = process.argv.includes("--pages");
const pasta = fileURLToPath(new URL(paraPages ? "../dist-pages/" : "../dist-unico/", import.meta.url));
const html = readFileSync(path.join(pasta, "index.html"), "utf8");

function unico(expressao, oQue) {
  const achados = [...html.matchAll(expressao)];
  if (achados.length !== 1) {
    throw new Error(
      `esperava exatamente 1 ${oQue} no build e encontrei ${achados.length} — rode \`npm run build:unico\` antes`,
    );
  }
  return achados[0][1];
}

const caminhoCss = unico(/<link rel="stylesheet"[^>]*href="([^"]+)"/g, "folha de estilo");
const caminhoJs = unico(/<script type="module"[^>]*src="([^"]+)"/g, "script");

// A referência no HTML vem como "./assets/x" no build local e como
// "/metodorota/assets/x" no build para o Pages. No disco os dois são a mesma
// coisa: `assets/x` dentro da pasta do build. Cortar tudo que vem antes de
// "assets/" resolve os dois sem o gerador precisar saber qual base foi usada.
const ler = (referencia) => {
  const relativo = referencia.replace(/^.*?(?=assets\/)/, "");
  const caminho = path.join(pasta, relativo);
  if (!existsSync(caminho)) {
    throw new Error(`não achei ${relativo} em ${pasta} — rode o build antes`);
  }
  return readFileSync(caminho, "utf8");
};

// O arquivo único carrega TODO o código junto, inclusive o do app antigo de
// acompanhamento — e o CSS dele importa fontes do Google. Num arquivo que se
// promete offline, essa linha é a única coisa que ainda sairia para a
// internet, então ela cai aqui. O app antigo (desligado por padrão) fica com
// a fonte do sistema dentro deste arquivo; na versão publicada normal ele
// continua com as fontes dele.
// Duas formas: `@import url("https://…");` como o CSS é escrito, e
// `@import"https://…";` como o minificador o reescreve.
//
// O corte vai de aspa a aspa, e não até o próximo ponto e vírgula: a URL do
// Google Fonts tem ponto e vírgula DENTRO dela (separando os pesos da
// fonte), e parar no primeiro deixava metade do endereço solto no meio do
// CSS — o que quebrava tudo que vinha depois, as minhas fontes inclusive.
const css = ler(caminhoCss)
  .replace(/@import\s*(?:url\(\s*)?(['"])https?:[\s\S]*?\1\s*\)?\s*;/gi, "")
  .replace(/@import\s*url\(\s*https?:[^)]*\)\s*;/gi, "");

const remoto = css.match(/@import[^;]*https?:|url\(\s*['"]?https?:/i);
if (remoto) {
  throw new Error(`o CSS ainda busca algo na internet (${remoto[0]}) — o arquivo não seria autossuficiente`);
}

// O corte acima mexe num CSS minificado de um quarto de megabyte. Conferir
// que as fontes continuam lá é o que separa "cortei a linha certa" de
// "estraguei a folha de estilo inteira e só vou descobrir abrindo".
for (const esperado of ["@font-face", "Fraunces", "Public Sans"]) {
  if (!css.includes(esperado)) {
    throw new Error(`o CSS perdeu "${esperado}" no corte do import remoto — não publique assim`);
  }
}
// Dentro de um <script>, a sequência "</script" encerra o bloco onde quer que
// apareça — inclusive dentro de uma string do próprio código. A barra
// escapada continua sendo a mesma string para o JavaScript e deixa de
// terminar a tag para o HTML.
const js = ler(caminhoJs).replace(/<\/script/gi, "<\\/script");

const favicon = readFileSync(path.join(pasta, "favicon.svg"), "utf8");
const faviconEmDados = `data:image/svg+xml;base64,${Buffer.from(favicon).toString("base64")}`;

const titulo = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Central do Paciente";
const descricao = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";

const pagina = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#3A6355" />
    <meta name="description" content="${descricao}" />
    <link rel="icon" href="${faviconEmDados}" />
    <title>${titulo}</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">${js}</script>
  </body>
</html>
`;

const destino = fileURLToPath(new URL(paraPages ? "../site-pages/" : "../site/", import.meta.url));
mkdirSync(destino, { recursive: true });
writeFileSync(path.join(destino, "index.html"), pagina);

// O GitHub Pages não sabe devolver o index.html para um caminho que não
// existe como arquivo, então `/metodorota/trocas` daria 404. Servindo a
// mesma página como 404.html, o app assume a rota e tudo funciona com
// endereços normais — o que o fluxo de convite por e-mail exige, porque o
// token volta no fim da URL e brigaria com rotas por hash.
if (paraPages) {
  writeFileSync(path.join(destino, "404.html"), pagina);
}

const mb = (pagina.length / 1024 / 1024).toFixed(2);
const nome = paraPages ? "site-pages" : "site";
console.log(
  `${nome}/index.html gerado — ${mb} MB, arquivo único${paraPages ? " (+ 404.html idêntico)" : ""}`,
);
