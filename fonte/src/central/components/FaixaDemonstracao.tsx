import { useSessao } from "@/central/autenticacao/SessaoContexto";

/**
 * Aviso permanente de modo demonstração.
 *
 * Existe para que ninguém confunda a versão de testes com a que os
 * pacientes usam: sem Supabase configurado não há login, não há paciente de
 * verdade, e o que for salvo fica só neste navegador. É melhor uma faixa
 * insistente do que uma nutricionista cadastrando pacientes reais num lugar
 * que some quando ela limpar o histórico.
 */
export function FaixaDemonstracao() {
  const { modoDemonstracao } = useSessao();
  if (!modoDemonstracao) return null;

  return (
    <div className="c-faixa-demo" role="status">
      Modo demonstração — sem banco de dados conectado. Nada aqui é salvo de verdade.
    </div>
  );
}
