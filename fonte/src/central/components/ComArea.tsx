import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";
import { areaLigada, type ChaveArea } from "@/central/utils/areas";

/**
 * A porta de uma área que a nutricionista pode desligar (utils/areas.ts).
 * Desligada, o endereço digitado volta para o início — a área não existe
 * para essa paciente, em vez de abrir uma tela dizendo que está fechada.
 */
export function ComArea({ chave, children }: { chave: ChaveArea; children: ReactNode }) {
  const { acesso } = useSessao();
  if (!areaLigada(acesso, chave)) return <Navigate to={rotas.home} replace />;
  return <>{children}</>;
}

/**
 * /viagem serve duas coisas: o guia (interruptor próprio, `acesso.viagem`) e,
 * para quem não tem guia, o aviso "tenho uma viagem" (área `aviso_viagem`).
 */
export function PortaDaViagem({ children }: { children: ReactNode }) {
  const { acesso } = useSessao();
  if (!acesso.viagem && !areaLigada(acesso, "aviso_viagem")) return <Navigate to={rotas.home} replace />;
  return <>{children}</>;
}
