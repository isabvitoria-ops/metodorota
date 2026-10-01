import { useEffect, useState } from "react";
import { Marca } from "@/central/components/Marca";
import { Esqueleto } from "@/central/components/Esqueleto";
import { repositorio } from "@/central/dados/repositorio";
import type { TermoDeUso as Termo } from "@/central/types";
import { useSessao } from "./SessaoContexto";
import { TextoDoTermo } from "./TextoDoTermo";

/**
 * A tela do aceite. Aparece no primeiro acesso e sempre que a nutricionista
 * publica um texto novo. Enquanto não houver aceite da versão atual, a paciente
 * não passa daqui — é o que faz o consentimento valer de verdade.
 *
 * A paciente que não quer aceitar pode sair; o texto não a trava para o
 * resto da vida (ela pode voltar e aceitar quando quiser).
 */
export function TermoDeUso() {
  const { termo, aceitarTermo, sair } = useSessao();
  const [texto, definirTexto] = useState<Termo | null>(null);
  const [li, definirLi] = useState(false);
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    void repositorio
      .lerTermo()
      .then(definirTexto)
      .catch(() => definirErro("Não consegui carregar o texto. Verifique a internet e recarregue."));
  }, []);

  async function aceitar() {
    definirEnviando(true);
    definirErro(null);
    try {
      await aceitarTermo();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui registrar o aceite.");
      definirEnviando(false);
    }
  }

  // O texto lido tem que ser o da versão que o banco vai registrar.
  const pronto = texto !== null && termo !== null && texto.versao === termo.versao;

  return (
    <div className="central">
      <div className="c-conta">
        <div className="c-conta-caixa c-termo">
          <Marca altura={40} />
          <h1 className="c-titulo" style={{ fontSize: 26, marginTop: 10 }}>
            Antes de começar
          </h1>
          <p className="c-subtitulo">Leia com calma. É rápido, e você pode rever este texto quando quiser.</p>

          <div className="c-termo-rolagem" tabIndex={0} aria-label="Termo de uso e política de privacidade">
            {texto ? <TextoDoTermo texto={texto.texto} /> : <Esqueleto linhas={6} />}
          </div>

          <label className="c-termo-aceite">
            <input type="checkbox" checked={li} onChange={(e) => definirLi(e.target.checked)} />
            <span>Li e concordo com o termo de uso e a política de privacidade.</span>
          </label>

          {erro && (
            <div className="c-aviso c-aviso-erro" role="alert">
              <span>{erro}</span>
            </div>
          )}

          <button type="button" className="c-botao" disabled={!li || !pronto || enviando} onClick={() => void aceitar()}>
            {enviando ? "Registrando…" : "Aceitar e continuar"}
          </button>
          <button type="button" className="c-link" onClick={() => void sair()}>
            Não aceito, quero sair
          </button>
        </div>
      </div>
    </div>
  );
}
