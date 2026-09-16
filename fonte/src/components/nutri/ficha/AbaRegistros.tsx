import { corBristol } from "@/constants/bristol";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { useHistoricoCheckin } from "@/hooks/useCheckin";
import { pacienteService, questionarioService } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { formatarDataCurta } from "@/utils/datas";

export function AbaRegistros() {
  const { paciente } = useFichaPaciente();
  const { estado } = useHistoricoCheckin(paciente.id, 14);
  const [estadoResumos] = useAsync(() => pacienteService.listarPacientesComResumo(), []);
  const [estadoResposta] = useAsync(
    () => questionarioService.buscarUltimaRespostaLegivel(paciente.id),
    [paciente.id],
  );
  const avisar = useToast();

  const resumo = estadoResumos.status === "pronto" ? estadoResumos.dado.find((r) => r.paciente.id === paciente.id)?.resumo : null;
  const historico = estado.status === "pronto" ? estado.dado : [];
  const ultimaResposta = estadoResposta.status === "pronto" ? estadoResposta.dado : null;

  return (
    <>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Últimos 14 dias</div>
        {estado.status === "carregando" && <p style={{ color: "var(--ink-2)", margin: 0 }}>Carregando…</p>}
        {estado.status === "pronto" && (
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 50 }}>
            {historico.map((c, i) => (
              <div
                key={i} title={c.bristol ? `Tipo ${c.bristol}` : "Sem registro"}
                style={{ flex: 1, borderRadius: 5, background: c.bristol ? corBristol(c.bristol) : "var(--line)", height: c.bristol ? 34 + Math.abs(4 - c.bristol) * 3 : 20 }}
              />
            ))}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 14, lineHeight: 1.5 }}>
          Adesão de {resumo?.adesaoPercentual ?? "—"}% no período. Último check-in {resumo?.ultimoCheckinRotulo ?? "sem registro"}.
        </div>
      </div>

      <div style={{ height: 12 }} />
      <div className="card" style={{ borderLeft: "3px solid var(--sage)" }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Preparação de consulta · última resposta
          {ultimaResposta && ` · ${formatarDataCurta(new Date(ultimaResposta.respondidoEm))}`}
        </div>
        {estadoResposta.status === "carregando" && <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>Carregando…</p>}
        {estadoResposta.status === "pronto" && !ultimaResposta?.itens.length && (
          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
            {paciente.nome.split(" ")[0]} ainda não respondeu ao questionário mensal.
          </p>
        )}
        {ultimaResposta && ultimaResposta.itens.length > 0 && (
          <div style={{ display: "grid", gap: 8, fontSize: 14, lineHeight: 1.5 }}>
            {ultimaResposta.itens.map((i) => (
              <div key={i.pergunta}><strong>{i.pergunta}:</strong> {i.resposta}</div>
            ))}
          </div>
        )}
      </div>

      {/*
        O bloco "Preferências dentro do que você liberou" mostrava contagens
        fixas escritas no código ("Batata 7×", "Ovo 8×") como se fossem os
        registros da paciente — número inventado apresentado a uma
        profissional que decide prescrição em cima dele. O diário hoje grava
        `refeicaoId` + adesão, não qual opção foi escolhida, então o dado
        ainda não existe. Fica o estado honesto até o registro da escolha
        entrar no modelo.
      */}
      <div style={{ height: 12 }} />
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 4 }}>Preferências dentro do que você liberou</div>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "6px 0 0", lineHeight: 1.5 }}>
          Ainda não disponível. O diário registra a adesão de cada refeição, mas não qual opção foi escolhida — sem isso não dá para dizer o que {paciente.nome.split(" ")[0]} prefere quando tem alternativa.
        </p>
      </div>

      <div style={{ height: 12 }} />
      <div className="grid2">
        <button className="card" onClick={() => avisar("Diário alimentar completo abriria aqui.")} style={{ border: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Diário alimentar</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>Ver registros da semana</div>
        </button>
        <button className="card" onClick={() => avisar("Fotos abririam aqui, com acesso registrado em auditoria.")} style={{ border: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Fotos de evolução</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>Acesso auditado</div>
        </button>
      </div>
    </>
  );
}
