/**
 * O termo como texto corrido: o título, os itens numerados em negrito e os
 * parágrafos. O texto é puro (a nutricionista o edita num campo de texto), e
 * isto só lhe dá forma na tela — nada de HTML vindo do banco.
 */
export function TextoDoTermo({ texto }: { texto: string }) {
  const blocos = texto
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="c-termo-texto">
      {blocos.map((bloco, i) => {
        const [primeira = "", ...resto] = bloco.split("\n");
        if (i === 0 && resto.length === 0) return <h2 key={i}>{primeira}</h2>;
        if (/^\d+\.\s/.test(primeira)) {
          return (
            <div key={i}>
              <h3>{primeira}</h3>
              {resto.length > 0 && <p>{resto.join("\n")}</p>}
            </div>
          );
        }
        return <p key={i}>{bloco}</p>;
      })}
    </div>
  );
}
