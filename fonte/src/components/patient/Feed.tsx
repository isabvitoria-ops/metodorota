import { Eyebrow, Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { SkeletonCard, EstadoErro } from "@/components/ui/EstadoAsync";
import { corPorId } from "@/constants/cores";
import { tempoRelativo } from "@/utils/tempoRelativo";
import { useFeed } from "@/hooks/useFeed";
import { useToast } from "@/hooks/useToast";

export function Feed({ pacienteId }: { pacienteId: string }) {
  const { estado, curtir } = useFeed(pacienteId);
  const avisar = useToast();

  return (
    <div className="scroll">
      <section style={{ paddingTop: 4 }}>
        <Eyebrow>Comunidade</Eyebrow>
        <h1 className="disp" style={{ fontSize: 30, fontWeight: 600, margin: "10px 0 8px" }}>Entre quem entende</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px", lineHeight: 1.5 }}>
          Ninguém aparece com nome ou foto. Todo mundo é um número — inclusive você.
        </p>
      </section>

      {estado.status === "carregando" && <SkeletonCard />}
      {estado.status === "erro" && <EstadoErro mensagem={estado.erro} />}

      {estado.status === "pronto" && (
        <div style={{ display: "grid", gap: 12 }}>
          {estado.dado.map(({ post, curtidas, curtidoPorMim }) => {
            const cor = corPorId(post.corId);
            const autorRotulo = post.autorTipo === "nutricionista" ? "Nutri" : `Paciente ${post.autorApelido}`;
            const inicial = post.autorTipo === "nutricionista" ? "N" : (post.autorApelido ?? "?");
            return (
              <article key={post.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: cor, display: "grid", placeItems: "center", color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, flexShrink: 0 }}>
                    {inicial}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{autorRotulo}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{post.tipo} · {tempoRelativo(post.publicadoEm)}</div>
                  </div>
                </div>
                <h3 className="disp" style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px" }}>{post.titulo}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "0 0 14px" }}>{post.texto}</p>
                <button
                  type="button" onClick={() => curtir(post.id)} className="chip"
                  aria-pressed={curtidoPorMim}
                  style={{
                    fontSize: 13,
                    background: curtidoPorMim ? "var(--plum-wash)" : "transparent",
                    borderColor: curtidoPorMim ? "var(--plum-wash)" : "var(--line)",
                    color: curtidoPorMim ? "var(--plum)" : "var(--ink-2)",
                  }}
                >
                  {curtidoPorMim ? "Curtido" : "Curtir"} · {curtidas}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <Card style={{ marginTop: 12, textAlign: "center" }}>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Quer compartilhar uma receita ou uma conquista? Sua nutri lê antes de publicar.
        </p>
        <Btn variante="quiet" onClick={() => avisar("Escrever um post abriria aqui.")}>Escrever um post</Btn>
      </Card>
    </div>
  );
}
