import { dashboardService } from "@/services";
import { useAsync } from "./useAsync";

export function useDashboard(nutricionistaId: string) {
  const [estado, recarregar] = useAsync(() => dashboardService.buscarResumoDashboard(nutricionistaId), [nutricionistaId]);
  return { estado, recarregar };
}
