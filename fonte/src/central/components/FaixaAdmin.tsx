import { useNavigate } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";

/**
 * Aviso de que quem está olhando é a nutricionista, não uma paciente.
 *
 * A nutricionista entra e cai na Central, porque `meu_acesso()` dá acesso a
 * quem é admin — de propósito: ela precisa ver exatamente a tela que a
 * paciente vê. O problema era que nada na tela dizia isso, e o único caminho
 * para a área administrativa era um link no pé da home, abaixo da dobra.
 * Quem acabou de configurar tudo abria o site e concluía, com razão, que
 * tinha entrado como paciente.
 *
 * Então a faixa fica no topo de toda tela da Central, e leva ao painel de um
 * toque. É o par de "Ver a Central", que já existia no caminho contrário.
 */
export function FaixaAdmin() {
  const { acesso } = useSessao();
  const navegar = useNavigate();
  if (acesso.papel !== "admin") return null;

  return (
    <div className="c-faixa-admin">
      <span>Esta é a tela que sua paciente vê.</span>
      <button type="button" onClick={() => navegar(rotas.admin)}>
        Área da nutricionista
      </button>
    </div>
  );
}
