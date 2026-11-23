/*
 * Service worker do MARVIA (GitHub Pages, /metodorota/).
 *
 * O aplicativo inteiro é um arquivo só (index.html). Para abrir:
 *  - pede à internet; se ela responder em até 5 segundos, usa a resposta e
 *    guarda a cópia;
 *  - se a internet falhar ou demorar (viagem, roaming, sinal fraco), abre a
 *    última cópia guardada no aparelho — e a resposta da internet, se chegar
 *    depois, só atualiza a cópia para a próxima vez;
 *  - só guarda resposta que veio inteira e certa: um erro do servidor nunca
 *    substitui a cópia boa.
 * A consulta de versão (?v-site=), o banco (supabase) e as outras pastas do
 * site (a ferramenta de cálculo em /nutri/, a TBCA) passam direto.
 */
// Nome novo: a versão anterior guardava, sem nunca atualizar, os arquivos da
// ferramenta de cálculo (/nutri/) e da TBCA; trocar o nome apaga aquela cópia.
var CACHE = "marvia-20261117";
var BASE = "/metodorota/";
var PAGINA = BASE + "index.html";
var PRAZO_MS = 5000;
// Outras páginas do mesmo site, com vida própria: passam direto, sem cópia.
var OUTRAS_PASTAS = [BASE + "nutri/", BASE + "tbca/"];

function guardar(pedido, resposta, ehPagina) {
  if (!resposta || resposta.status !== 200 || resposta.type !== "basic") return;
  // As cópias saem agora, antes de a página começar a ler a resposta.
  var copia = resposta.clone();
  var copiaDaPagina = ehPagina && new URL(pedido.url).pathname !== PAGINA ? resposta.clone() : null;
  caches.open(CACHE).then(function (c) {
    c.put(pedido, copia);
    // Qualquer rota do app é o mesmo arquivo: a cópia também vale para a página inicial.
    if (copiaDaPagina) c.put(PAGINA, copiaDaPagina);
  });
}

function copiaGuardada(pedido) {
  return caches.match(pedido).then(function (r) {
    if (r) return r;
    return caches.match(PAGINA).then(function (p) { return p || caches.match(BASE); });
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll([BASE, PAGINA]); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var pedido = e.request;
  if (pedido.method !== "GET") return;
  var u = new URL(pedido.url);
  if (u.origin !== self.location.origin) return;
  if (u.searchParams.has("v-site")) return;
  if (u.pathname.indexOf(BASE) !== 0) return;
  for (var i = 0; i < OUTRAS_PASTAS.length; i++) {
    if (u.pathname.indexOf(OUTRAS_PASTAS[i]) === 0) return;
  }

  if (pedido.mode === "navigate") {
    // "no-cache": sempre confere com o servidor (barato quando não mudou).
    // Sem isso, o navegador podia devolver a cópia velha por até 10 minutos
    // depois de publicar, e o "Atualizar" reabria a versão anterior.
    var daRede = fetch(new Request(pedido, { cache: "no-cache" })).then(function (r) { guardar(pedido, r, true); return r; });
    var prazo = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, PRAZO_MS); });
    e.respondWith(
      Promise.race([daRede.catch(function () { return null; }), prazo]).then(function (rapida) {
        if (rapida) return rapida;
        return copiaGuardada(pedido).then(function (copia) {
          if (copia) return copia;
          // Nada guardado ainda: o jeito é esperar a internet mesmo.
          return daRede.catch(function () {
            return new Response("Sem internet. Abra de novo quando a conexão voltar.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          });
        });
      })
    );
    return;
  }

  // Só ícones e manifesto da raiz: o que já está guardado, senão a rede.
  var resto = u.pathname.slice(BASE.length);
  if (resto.indexOf("/") !== -1 || !/\.(png|svg|ico|webmanifest)$/.test(resto)) return;
  e.respondWith(
    caches.match(pedido).then(function (r) {
      return r || fetch(pedido).then(function (re) { guardar(pedido, re, false); return re; });
    })
  );
});
