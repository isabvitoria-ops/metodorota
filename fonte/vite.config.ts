import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// PWA cache strategy (briefing §16): assets estáticos e conteúdo já publicado
// (biblioteca, feed) podem ser cacheados agressivamente. Dado clínico
// (check-ins, mensagens, fotos, plano ativo) nunca é cacheado pelo Service
// Worker — cada domínio busca via Supabase (network) com fallback para a
// fila local do IndexedDB (ver src/lib/db.ts), nunca via Cache Storage.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Os builds de prévia (`demo`, servido de uma subpasta, e `unico`, um
    // arquivo só) rodam sem PWA: com rotas por hash e endereço de teste, um
    // Service Worker instalado só atrapalharia.
    ...(mode === "demo" || mode === "unico" || mode === "pages"
      ? []
      : [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Central do Paciente",
        short_name: "Central",
        description: "Troca de alimentos, comer fora, substituições e guias do seu acompanhamento.",
        theme_color: "#3A6355",
        background_color: "#F6F4F1",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Só assets do build (JS/CSS/fontes/ícones) entram no precache.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Fontes do Google Fonts: cacheável agressivamente, é asset estático de baixa sensibilidade.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Conteúdo de biblioteca/feed já publicado: baixa sensibilidade, network-first com fallback curto.
            urlPattern: ({ url }) => url.pathname.startsWith("/storage/v1/object/public/biblioteca"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "biblioteca-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Qualquer outra chamada à API do Supabase (dado clínico: check-in, chat,
            // plano, fotos) é sempre network-first e nunca fica em cache — só passa
            // pelo Service Worker para não travar 100% offline; não há TTL de cache aqui.
            urlPattern: ({ url }) => url.pathname.startsWith("/rest/v1") || url.pathname.startsWith("/auth/v1"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
        ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /**
   * O modo `unico` gera a Central num arquivo HTML só, que abre com dois
   * cliques e funciona sem servidor nenhum. Para isso, duas coisas mudam:
   * nada de dividir o código em pedaços carregados sob demanda (não haveria
   * de onde carregá-los), e todo recurso vira base64 dentro do próprio
   * pacote, fontes inclusive.
   */
  /**
   * `unico` e `pages` geram a Central num arquivo HTML só. Para isso, nada
   * de dividir o código em pedaços carregados sob demanda (não haveria de
   * onde carregá-los) e todo recurso vira base64 dentro do pacote, fontes
   * inclusive.
   *
   * A diferença entre os dois é só onde o arquivo vai morar: `unico` abre
   * do disco, `pages` é servido de `/metodorota/` no GitHub Pages.
   */
  build:
    mode === "unico" || mode === "pages"
      ? {
          outDir: mode === "pages" ? "dist-pages" : "dist-unico",
          assetsInlineLimit: 20_000_000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {},

  server: {
    port: 5173,
  },
}));
