import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// O service worker (sw.js, na raiz do site) guarda a última cópia do app no
// aparelho, para ele abrir mesmo sem internet ou com sinal ruim. Só existe na
// versão publicada (GitHub Pages); o registro tinha se perdido quando a
// montagem do index.html mudou de script, em novembro de 2026.
if (import.meta.env.MODE === "pages" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* sem service worker o app funciona igual, só não abre sem internet */
    });
  });
}
