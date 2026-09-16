import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { rotas } from "@/central/rotas";
import { useSessao } from "./SessaoContexto";

/**
 * Os portões do frontend.
 *
 * Repare que eles esperam `pronto`, não `carregando`: só a PRIMEIRA
 * resolução da sessão trava a tela. Uma recarga posterior (salvar algo,
 * renovar o token) acontece por baixo, sem desmontar o que a pessoa está
 * usando.
 *
 * Vale dizer o que eles são e o que não são: são conveniência de navegação —
 * levam a pessoa para a tela certa em vez de mostrar uma tela vazia. NÃO são
 * a segurança do sistema. Quem impede um paciente vencido de ler conteúdo é
 * a política do banco (supabase/migracoes/0003_rls.sql). Se estes
 * componentes fossem removidos, o app ficaria feio e continuaria seguro.
 */

export function Carregando() {
  return (
    <div className="central">
      <div className="c-carregando">
        <span className="c-girando" aria-hidden="true" />
        <p>Carregando…</p>
      </div>
    </div>
  );
}

/** Exige estar autenticado. */
export function ExigeSessao({ children }: { children: ReactNode }) {
  const { pronto, acesso } = useSessao();
  const local = useLocation();
  if (!pronto) return <Carregando />;
  if (!acesso.autenticado) {
    return <Navigate to={rotas.entrar} replace state={{ de: local.pathname }} />;
  }
  return <>{children}</>;
}

/** Exige acesso liberado: cadastro vinculado, não suspenso, dentro do período. */
export function ExigeAcesso({ children }: { children: ReactNode }) {
  const { pronto, acesso } = useSessao();
  if (!pronto) return <Carregando />;
  if (!acesso.autenticado) return <Navigate to={rotas.entrar} replace />;
  if (!acesso.temAcesso) return <Navigate to={rotas.semAcesso} replace />;
  return <>{children}</>;
}

/** Exige ser a nutricionista. */
export function ExigeAdmin({ children }: { children: ReactNode }) {
  const { pronto, acesso } = useSessao();
  if (!pronto) return <Carregando />;
  if (!acesso.autenticado) return <Navigate to={rotas.entrar} replace />;
  if (acesso.papel !== "admin") return <Navigate to={rotas.home} replace />;
  return <>{children}</>;
}
