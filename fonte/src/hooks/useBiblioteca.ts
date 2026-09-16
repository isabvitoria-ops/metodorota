import { useMemo } from "react";
import type { SintomaId } from "@/types";
import { materialService } from "@/services";
import { useAsync } from "./useAsync";

export function useBiblioteca(sintomasHoje: SintomaId[]) {
  const [estado, recarregar] = useAsync(() => materialService.listarArtigos(), []);

  const sugeridos = useMemo(() => {
    if (estado.status !== "pronto") return [];
    return materialService.artigosSugeridosPorSintomas(estado.dado, sintomasHoje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, sintomasHoje.join(",")]);

  return { estado, sugeridos, recarregar };
}
