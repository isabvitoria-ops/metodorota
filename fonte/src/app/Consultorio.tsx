import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
// Os estilos do app antigo (e a fonte que eles buscam no Google) só são
// carregados quando ele é aberto — a Central não paga por eles.
import "@/styles/global.css";
import { useAuth } from "@/hooks/useAuth";
import { Login } from "./Login";
import { Mfa } from "./Mfa";
import { NUTRICIONISTA_ID } from "@/data/mocks/ids";

const AppPaciente = lazy(() => import("./paciente/AppPaciente").then((m) => ({ default: m.AppPaciente })));
const AppNutri = lazy(() => import("./nutricionista/AppNutri").then((m) => ({ default: m.AppNutri })));

/**
 * App de acompanhamento diário (check-in, plano, diário, evolução, painel da
 * nutricionista) — o produto anterior deste repositório.
 *
 * Continua inteiro e funcionando, mas desligado por padrão: ele roda sobre
 * dados fictícios em memória e aceita qualquer senha, então não pode dividir
 * endereço com a Central, que vai ter paciente de verdade. Ligue com
 * VITE_APP_ANTIGO=1 no `.env.local` e acesse /consultorio.
 *
 * Quando for a vez de trazê-lo para o Supabase, o caminho já está aberto:
 * ele fala com `repositories/`, que é o mesmo formato de troca que a Central
 * usa em `dados/repositorio.ts`.
 */
export function Consultorio() {
  const { sessao, carregando, aguardandoMfa } = useAuth();

  if (carregando) return <Espera />;
  if (aguardandoMfa) return <Mfa />;
  if (!sessao) return <Login />;

  return (
    <Suspense fallback={<Espera />}>
      <Routes>
        {sessao.papel === "paciente" && (
          <>
            <Route
              path="paciente/*"
              element={<AppPaciente pacienteId={sessao.perfilId} nutricionistaId={NUTRICIONISTA_ID} />}
            />
            <Route path="*" element={<Navigate to="/consultorio/paciente" replace />} />
          </>
        )}
        {sessao.papel === "nutricionista" && (
          <>
            <Route path="nutricionista/*" element={<AppNutri nutricionistaId={sessao.perfilId} />} />
            <Route path="*" element={<Navigate to="/consultorio/nutricionista" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}

function Espera() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--paper)", color: "var(--ink-2)", fontFamily: "system-ui" }}>
      Carregando…
    </div>
  );
}
