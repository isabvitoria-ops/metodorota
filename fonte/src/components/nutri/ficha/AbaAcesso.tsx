import { useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { useToast } from "@/hooks/useToast";
import { pacienteService } from "@/services";

export function AbaAcesso() {
  const { paciente, atualizar } = useFichaPaciente();
  const [confirmar, setConfirmar] = useState(false);
  const avisar = useToast();

  const alternar = async () => {
    const atualizado = await pacienteService.definirAcessoAtivo(paciente.id, !paciente.ativo);
    atualizar(atualizado);
    setConfirmar(false);
    avisar(paciente.ativo ? `Acesso de ${paciente.nome} encerrado.` : `Acesso de ${paciente.nome} reativado.`);
  };

  return (
    <>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Acesso {paciente.ativo ? "ativo" : "encerrado"}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 3 }}>
              {paciente.ativo ? "Consegue entrar no app normalmente." : "Não consegue mais fazer login."}
            </div>
          </div>
          <Tag cor={paciente.ativo ? "#6E8168" : "#B0503C"}>{paciente.ativo ? "ATIVO" : "ENCERRADO"}</Tag>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: "0 0 14px" }}>
          Encerrar o acesso não apaga nada. Todo o histórico continua guardado, e no dia em que ela voltar você reativa com um clique — sem cadastro novo, sem perder os registros.
        </p>
        {!confirmar ? (
          <button className={paciente.ativo ? "btn danger" : "btn"} onClick={() => setConfirmar(true)}>
            {paciente.ativo ? "Encerrar acesso" : "Reativar acesso"}
          </button>
        ) : (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className={paciente.ativo ? "btn danger" : "btn"} onClick={alternar}>
              Confirmar · {paciente.ativo ? "encerrar" : "reativar"}
            </button>
          </div>
        )}
      </div>
      <div style={{ height: 12 }} />
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Dados de acesso</div>
        <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
          <div className="row"><span style={{ flex: 1, color: "var(--ink-2)" }}>E-mail</span><span className="mono" style={{ fontSize: 13 }}>{paciente.email}</span></div>
          <div className="row"><span style={{ flex: 1, color: "var(--ink-2)" }}>Último login</span><span className="mono" style={{ fontSize: 13 }}>{paciente.ultimoLoginEm ? new Date(paciente.ultimoLoginEm).toLocaleString("pt-BR") : "Nunca entrou"}</span></div>
          <div className="row"><span style={{ flex: 1, color: "var(--ink-2)" }}>Apelido no feed</span><span className="mono" style={{ fontSize: 13 }}>Paciente {paciente.apelidoFeed}</span></div>
        </div>
        <button className="btn quiet full" style={{ marginTop: 14 }} onClick={() => avisar("Link de redefinição enviado.")}>Enviar redefinição de senha</button>
      </div>
    </>
  );
}
