import { createContext, useContext, useState, type ReactNode } from "react";
import type { Paciente } from "@/types";

/**
 * Escopo naturalmente hierárquico (briefing §9): a ficha de um paciente
 * aberta no painel. Evita passar `paciente`/`atualizar` manualmente por
 * cada uma das seis abas (Plano, Alimentos, Equivalências, Materiais,
 * Registros, Acesso) — cada aba só chama `useFichaPaciente()`.
 */
interface FichaPacienteContextValue {
  paciente: Paciente;
  atualizar: (paciente: Paciente) => void;
  /** Mensagem da última gravação que falhou, se houve — a tela já voltou ao valor anterior. */
  erroGravacao: string | null;
}

const FichaPacienteContext = createContext<FichaPacienteContextValue | null>(null);

export function FichaPacienteProvider({
  pacienteInicial,
  onAtualizar,
  children,
}: {
  pacienteInicial: Paciente;
  onAtualizar?: (paciente: Paciente) => void | Promise<void>;
  children: ReactNode;
}) {
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);

  /**
   * A promise de `onAtualizar` era descartada: uma gravação que falhasse
   * virava unhandled rejection e a ficha continuava exibindo um valor que o
   * servidor recusou. Agora a falha desfaz a alteração otimista.
   */
  const atualizar = (novo: Paciente) => {
    const anterior = paciente;
    setPaciente(novo);
    setErroGravacao(null);
    Promise.resolve(onAtualizar?.(novo)).catch((e: unknown) => {
      setPaciente(anterior);
      setErroGravacao(e instanceof Error ? e.message : "Não foi possível salvar a alteração.");
    });
  };

  return (
    <FichaPacienteContext.Provider value={{ paciente, atualizar, erroGravacao }}>
      {children}
    </FichaPacienteContext.Provider>
  );
}

export function useFichaPaciente(): FichaPacienteContextValue {
  const ctx = useContext(FichaPacienteContext);
  if (!ctx) throw new Error("useFichaPaciente precisa estar dentro de <FichaPacienteProvider>");
  return ctx;
}
