import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { materialService } from "@/services";

export function AbaMateriais() {
  const { paciente, atualizar } = useFichaPaciente();
  const [estado] = useAsync(() => materialService.listarMateriais(), []);
  const [recomendados, setRecomendados] = useState<Set<string>>(new Set());
  const avisar = useToast();

  const categorias = useMemo(() => {
    if (estado.status !== "pronto") return [];
    return [...new Set(estado.dado.map((m) => m.categoria))];
  }, [estado]);

  const toggle = async (materialId: string) => {
    const liberados = await materialService.alternarLiberacao(paciente.materiaisLiberadosId, materialId);
    atualizar({ ...paciente, materiaisLiberadosId: liberados });
  };

  const toggleRecomendado = (materialId: string) => {
    setRecomendados((r) => {
      const n = new Set(r);
      if (n.has(materialId)) n.delete(materialId);
      else n.add(materialId);
      return n;
    });
  };

  if (estado.status !== "pronto") {
    return <p style={{ color: "var(--ink-2)" }}>Carregando…</p>;
  }

  return (
    <>
      <div className="card" style={{ borderLeft: "3px solid var(--plum)" }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 5 }}>{paciente.materiaisLiberadosId.length} de {estado.dado.length} materiais liberados</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
          Marque a estrela para destacar como "recomendado para esta fase" — esses sobem para o topo da biblioteca dela.
        </p>
      </div>
      <div style={{ height: 14 }} />
      {categorias.map((cat) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 9 }}>{cat}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {estado.dado.filter((m) => m.categoria === cat).map((m) => {
              const on = paciente.materiaisLiberadosId.includes(m.id);
              return (
                <div key={m.id} className="card" style={{ padding: 13 }}>
                  <div className="row">
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: on ? 600 : 400, color: on ? "var(--ink)" : "var(--ink-3)" }}>{m.titulo}</span>
                    {on && (
                      <button
                        onClick={() => toggleRecomendado(m.id)} className="chip sm"
                        style={{ borderColor: recomendados.has(m.id) ? "var(--gold)" : "var(--line)", color: recomendados.has(m.id) ? "var(--gold)" : "var(--ink-3)" }}
                      >
                        {recomendados.has(m.id) ? "★" : "☆"}
                      </button>
                    )}
                    <Switch ativo={on} onClick={() => toggle(m.id)} label={m.titulo} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button className="btn quiet full" onClick={() => avisar("Upload de novo material à biblioteca abriria aqui.")}>Adicionar novo material à biblioteca</button>
    </>
  );
}
