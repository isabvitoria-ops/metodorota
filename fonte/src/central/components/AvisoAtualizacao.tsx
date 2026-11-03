import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { versaoDoSite } from "@/central/utils/versaoDoSite";
import { versaoPublicada } from "@/central/utils/versaoPublicada";

const A_CADA_MS = 60_000;
const SEM_CARIMBO = "versão de desenvolvimento";

/**
 * "Atualização disponível."
 *
 * Aparece quando a nutricionista muda algo que o paciente vê (o banco devolve
 * um resumo diferente) ou quando sai uma versão nova do aplicativo. Um toque em
 * Atualizar recarrega a página. Não interrompe o que a pessoa está fazendo: é
 * só uma faixa.
 */
export function AvisoAtualizacao() {
  const { acesso, modoDemonstracao } = useSessao();
  const { pathname } = useLocation();
  const [disponivel, definirDisponivel] = useState(false);
  const carimboInicial = useRef<string | null>(null);
  const versaoInicial = useRef(versaoDoSite());

  const ativo = acesso.autenticado && !modoDemonstracao && !pathname.startsWith(rotas.admin);

  useEffect(() => {
    if (!ativo || disponivel) return;
    let cancelado = false;

    async function verificar() {
      if (document.visibilityState === "hidden") return;

      const carimbo = await repositorio.carimboDoConteudo();
      if (cancelado) return;
      if (carimbo !== null) {
        if (carimboInicial.current === null) carimboInicial.current = carimbo;
        else if (carimbo !== carimboInicial.current) return definirDisponivel(true);
      }

      if (versaoInicial.current === SEM_CARIMBO) return;
      const publicada = await versaoPublicada(import.meta.env.BASE_URL);
      if (cancelado) return;
      if (publicada && publicada !== versaoInicial.current) definirDisponivel(true);
    }

    void verificar();
    const intervalo = window.setInterval(() => void verificar(), A_CADA_MS);
    const aoVoltar = () => void verificar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
    };
  }, [ativo, disponivel]);

  if (!ativo || !disponivel) return null;

  return (
    <div className="c-aviso-atualizacao" role="status">
      <span>Atualização disponível</span>
      <button type="button" onClick={() => window.location.reload()}>
        Atualizar
      </button>
    </div>
  );
}
