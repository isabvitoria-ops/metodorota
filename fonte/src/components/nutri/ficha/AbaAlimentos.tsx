import { useEffect, useState } from "react";
import { NOME_GRUPO } from "@/constants/alimentos";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { alimentoService } from "@/services";
import type { Alimento, GrupoAlimento } from "@/types";

const GRUPOS = Object.keys(NOME_GRUPO) as GrupoAlimento[];

export function AbaAlimentos() {
  const { paciente, atualizar } = useFichaPaciente();
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState<GrupoAlimento>("carb");
  const [resultados, setResultados] = useState<Alimento[]>([]);
  const [liberadosDetalhes, setLiberadosDetalhes] = useState<Alimento[]>([]);

  useEffect(() => {
    let ativo = true;
    if (q.trim()) {
      alimentoService.buscar(q, 40).then((r) => {
        if (ativo) setResultados(r.map((x) => x.alimento));
      });
    } else {
      alimentoService.listarPorGrupo(grupo).then((r) => {
        if (ativo) setResultados(r.slice(0, 200));
      });
    }
    return () => {
      ativo = false;
    };
  }, [q, grupo]);

  useEffect(() => {
    Promise.all(GRUPOS.map((g) => alimentoService.listarPorGrupo(g))).then((porGrupo) => {
      const todos = porGrupo.flat();
      const liberadosSet = new Set(paciente.alimentosLiberadosCodigoTaco);
      setLiberadosDetalhes(todos.filter((a) => liberadosSet.has(a.codigoTaco)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.alimentosLiberadosCodigoTaco.join(",")]);

  const toggle = (codigoTaco: number) => {
    const liberados = paciente.alimentosLiberadosCodigoTaco.includes(codigoTaco)
      ? paciente.alimentosLiberadosCodigoTaco.filter((c) => c !== codigoTaco)
      : [...paciente.alimentosLiberadosCodigoTaco, codigoTaco];
    atualizar({ ...paciente, alimentosLiberadosCodigoTaco: liberados });
  };

  const liberadosDoGrupo = (g: GrupoAlimento) => liberadosDetalhes.filter((a) => a.grupo === g).length;

  return (
    <>
      <div className="card" style={{ borderLeft: "3px solid var(--plum)" }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 5 }}>{paciente.alimentosLiberadosCodigoTaco.length} alimentos liberados</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5 }}>
          Base TACO 4ª edição. Só o que estiver marcado aparece no app de {paciente.nome.split(" ")[0]} — nas trocas, no montador e na busca. O resto não existe para ela.
        </p>
      </div>

      <div style={{ height: 14 }} />
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na base — ex.: arroz cozido, patinho, mamão" style={{ marginBottom: 12 }} />

      {!q.trim() && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 12 }}>
          {GRUPOS.map((g) => (
            <button key={g} className={`chip ${grupo === g ? "on" : ""}`} onClick={() => setGrupo(g)} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
              {NOME_GRUPO[g]} · {liberadosDoGrupo(g)}
            </button>
          ))}
        </div>
      )}

      <div className="lista">
        {resultados.map((b) => {
          const on = paciente.alimentosLiberadosCodigoTaco.includes(b.codigoTaco);
          return (
            <button key={b.codigoTaco} className="li" onClick={() => toggle(b.codigoTaco)}>
              <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${on ? "var(--sage)" : "var(--line)"}`, background: on ? "var(--sage)" : "transparent" }} />
              <span style={{ flex: 1, fontWeight: on ? 600 : 400 }}>{b.nome}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", flexShrink: 0 }}>{NOME_GRUPO[b.grupo].slice(0, 4).toUpperCase()}</span>
            </button>
          );
        })}
        {!resultados.length && <div style={{ padding: 16, fontSize: 14, color: "var(--ink-2)" }}>Nada encontrado.</div>}
      </div>

      <div style={{ height: 14 }} />
      <div className="eyebrow" style={{ marginBottom: 9 }}>Liberados para {paciente.nome.split(" ")[0]}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {liberadosDetalhes.map((b) => (
          <button key={b.codigoTaco} className="chip sage on" onClick={() => toggle(b.codigoTaco)}>{b.nome} ×</button>
        ))}
      </div>
    </>
  );
}
