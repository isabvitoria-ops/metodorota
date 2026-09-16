import { useMemo } from "react";
import { materialService } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";

export function PainelBiblioteca() {
  const [estado] = useAsync(() => materialService.listarMateriais(), []);
  const avisar = useToast();

  const categorias = useMemo(() => {
    if (estado.status !== "pronto") return [];
    return [...new Set(estado.dado.map((m) => m.categoria))];
  }, [estado]);

  return (
    <div className="wrap">
      <div style={{ padding: "26px 0 18px" }}>
        <div className="eyebrow">Conteúdo</div>
        <h1 className="disp" style={{ fontSize: 32, fontWeight: 600, margin: "10px 0 8px" }}>Biblioteca</h1>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
          Todos os materiais ficam aqui. Quem vê cada um é decidido na ficha de cada paciente.
        </p>
      </div>
      <button className="btn full" style={{ marginBottom: 18 }} onClick={() => avisar("Upload de material abriria aqui.")}>Adicionar material</button>

      {estado.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
      {estado.status === "erro" && <p style={{ color: "var(--clay)" }}>Não deu pra carregar a biblioteca agora.</p>}

      {estado.status === "pronto" &&
        categorias.map((cat) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 9 }}>{cat}</div>
            <div className="grid2">
              {estado.dado.filter((m) => m.categoria === cat).map((m) => (
                <div key={m.id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{m.titulo}</div>
                  <div className="row" style={{ gap: 7 }}>
                    <button className="chip sm" onClick={() => avisar(`Editando ${m.titulo}.`)}>Editar</button>
                    <button className="chip sm" onClick={() => avisar(`${m.titulo}: liberado para ${m.recomendadoParaPacienteId.length} pacientes.`)}>Quem tem acesso</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
