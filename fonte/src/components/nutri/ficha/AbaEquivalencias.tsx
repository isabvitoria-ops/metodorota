import { useEffect, useMemo, useState } from "react";
import { NUTRIENTE_BASE_POR_GRUPO } from "@/types";
import { NUTRIENTES_EQUIVALENCIA } from "@/constants/alimentos";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { alimentoService } from "@/services";
import { calcularEquivalencias } from "@/services/alimentoService";
import type { Alimento } from "@/types";

const TODOS_OS_GRUPOS: Alimento["grupo"][] = ["carb", "prot", "laticinio", "legum", "fruta", "vegetal", "gordura", "outros"];

export function AbaEquivalencias() {
  const { paciente } = useFichaPaciente();
  const [liberados, setLiberados] = useState<Alimento[]>([]);
  const [deCodigo, setDeCodigo] = useState<number | null>(null);
  const [gramas, setGramas] = useState(100);
  const [nutrienteEscolhido, setNutrienteEscolhido] = useState<keyof Alimento | null>(null);

  useEffect(() => {
    Promise.all(TODOS_OS_GRUPOS.map((g) => alimentoService.listarPorGrupo(g))).then((porGrupo) => {
      const todos = porGrupo.flat();
      const liberadosSet = new Set(paciente.alimentosLiberadosCodigoTaco);
      const lista = todos.filter((a) => liberadosSet.has(a.codigoTaco));
      setLiberados(lista);
      setDeCodigo((atual) => atual ?? lista[0]?.codigoTaco ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.alimentosLiberadosCodigoTaco.join(",")]);

  const de = liberados.find((a) => a.codigoTaco === deCodigo) ?? null;
  const nutrienteBase = de ? NUTRIENTE_BASE_POR_GRUPO[de.grupo] : "carboidrato";
  const nutrienteUsado = nutrienteEscolhido ?? nutrienteBase;

  const equivalencias = useMemo(() => (de ? calcularEquivalencias(de, gramas, liberados, nutrienteUsado) : []), [de, gramas, liberados, nutrienteUsado]);

  return (
    <>
      <div className="card" style={{ borderLeft: "3px solid var(--plum)" }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 5 }}>Equivalências</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
          Isto é uma calculadora de apoio, não a regra do app. Quem manda são as substituições que você escreve no plano. Use aqui quando quiser conferir um número antes de decidir.
        </p>
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Trocar</div>
        <select className="input" value={deCodigo ?? ""} style={{ marginBottom: 12 }} onChange={(e) => { setDeCodigo(Number(e.target.value)); setNutrienteEscolhido(null); }}>
          {liberados.map((b) => <option key={b.codigoTaco} value={b.codigoTaco}>{b.nome}</option>)}
        </select>
        <div className="row" style={{ marginBottom: 14 }}>
          {/* `min` sozinho é só validação do navegador: digitando "-143" o
              estado ia a -143 e a tela oferecia "-143 g" de equivalente. */}
          <input
            className="input" type="number" value={gramas} min={1}
            onChange={(e) => setGramas(Math.max(0, Number(e.target.value) || 0))}
            style={{ flex: 1 }}
          />
          <span className="mono" style={{ fontSize: 14, color: "var(--ink-2)" }}>g</span>
        </div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Equivalência calculada por</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {NUTRIENTES_EQUIVALENCIA.map(([id, l]) => (
            <button key={id} className={`chip ${nutrienteUsado === id ? "on" : ""}`} onClick={() => setNutrienteEscolhido(id)}>
              {l}{id === nutrienteBase ? " · padrão do grupo" : ""}
            </button>
          ))}
        </div>
      </div>

      {de && (
        <>
          <div style={{ height: 12 }} />
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>{gramas} g de {de.nome} equivalem a</div>
            {equivalencias.map((eq) => (
              <div key={eq.alimento.codigoTaco} style={{ padding: "11px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 14.5, flex: 1 }}>{eq.alimento.nome}</span>
                  <span className="mono" style={{ fontSize: 15, color: "var(--plum)", fontWeight: 500, flexShrink: 0 }}>{Math.round(eq.gramasEquivalentes)} g</span>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4 }}>
                  FIBRA {eq.deltaFibraGramas >= 0 ? "+" : ""}{eq.deltaFibraGramas.toFixed(1)} g
                  {" · "}ENERGIA {eq.deltaKcal >= 0 ? "+" : ""}{Math.round(eq.deltaKcal)} KCAL
                </div>
              </div>
            ))}
            {!equivalencias.length && (
              <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
                Não há outro alimento liberado no mesmo grupo. Libere mais opções na aba Alimentos para que a paciente possa trocar.
              </div>
            )}
          </div>

          <div style={{ height: 12 }} />
          <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
              A equivalência iguala um nutriente só. As linhas de fibra e energia acima mostram o que muda de quebra — é onde a troca pode fugir da sua intenção. Se algum desvio não te agradar, tire o alimento da lista dela.
            </p>
          </div>
        </>
      )}
    </>
  );
}
