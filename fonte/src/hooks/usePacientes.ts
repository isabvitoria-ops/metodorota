import { useMemo, useState } from "react";
import { pacienteService } from "@/services";
import { useAsync } from "./useAsync";

export function usePacientes() {
  const [estado, recarregar] = useAsync(() => pacienteService.listarPacientesComResumo(), []);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);

  const filtrados = useMemo(() => {
    if (estado.status !== "pronto") return [];
    return pacienteService.filtrarPacientes(estado.dado, busca, incluirInativos);
  }, [estado, busca, incluirInativos]);

  return { estado, filtrados, busca, setBusca, incluirInativos, setIncluirInativos, recarregar };
}
