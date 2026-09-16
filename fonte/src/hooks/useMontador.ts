import { useMemo, useState } from "react";
import { fichaAlimentoService, montadorService } from "@/services";
import { useAsync } from "./useAsync";

export function useMontador(pacienteId: string) {
  const [estadoPool, recarregarPool] = useAsync(() => fichaAlimentoService.buscarPoolMontador(pacienteId), [pacienteId]);
  const [selecionados, setSelecionados] = useState<number[]>([]);

  const alternar = (codigoTaco: number) => {
    setSelecionados((s) => (s.includes(codigoTaco) ? s.filter((c) => c !== codigoTaco) : [...s, codigoTaco]));
  };

  const resultado = useMemo(() => {
    if (estadoPool.status !== "pronto") return null;
    return montadorService.montarRefeicao(estadoPool.dado, selecionados);
  }, [estadoPool, selecionados]);

  const limpar = () => setSelecionados([]);

  return { estadoPool, recarregarPool, selecionados, alternar, resultado, limpar };
}
