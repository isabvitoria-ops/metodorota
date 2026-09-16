/**
 * Transforma o build de demonstração numa página publicável como Artifact.
 *
 * O serviço de Artifacts embrulha o arquivo enviado num esqueleto próprio de
 * `<html><head>…<body>`, então o que sobe aqui é só o miolo: título, folha de
 * estilo, script do app e a âncora onde o React monta. Enviar o index.html
 * inteiro produziria um documento com dois `<html>` dentro.
 *
 * Rode depois de `npm run build:demo`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const origem = fileURLToPath(new URL("../dist-demo/index.html", import.meta.url));
const html = readFileSync(origem, "utf8");

function capturar(expressao) {
  return [...html.matchAll(expressao)].map((m) => m[0]);
}

const titulo = capturar(/<title>[\s\S]*?<\/title>/g);
const descricao = capturar(/<meta name="description"[^>]*>/g);
// Os ícones ficam de fora: o Artifact tem o emoji dele, e um caminho de ícone
// que não existe no host só renderia erro no console.
const folhas = capturar(/<link rel="stylesheet"[^>]*>/g);
const scripts = capturar(/<script type="module"[^>]*><\/script>/g);

if (folhas.length === 0 || scripts.length === 0) {
  throw new Error("build de demonstração sem CSS ou sem script — rode `npm run build:demo` antes");
}

const fragmento = [...titulo, ...descricao, ...folhas, '<div id="root"></div>', ...scripts].join("\n");

const destino = fileURLToPath(new URL("../dist-demo/artefato.html", import.meta.url));
writeFileSync(destino, `${fragmento}\n`);
console.log("artefato.html gerado");
