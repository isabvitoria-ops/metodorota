import { fichaAlimentoService } from "@/services";
import { useAsync } from "./useAsync";

export function useFicha(codigoTaco: number | null) {
  const [estado] = useAsync(
    () => (codigoTaco === null ? Promise.resolve(null) : fichaAlimentoService.buscarFicha(codigoTaco)),
    [codigoTaco],
  );
  return estado;
}
