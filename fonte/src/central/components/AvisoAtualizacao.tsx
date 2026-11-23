import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { versaoDoSite } from "@/central/utils/versaoDoSite";
import { versaoPublicada } from "@/central/utils/versaoPublicada";
import { buscarVersaoNovaERecarregar, ehMaisNova } from "@/central/utils/atualizacao";

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
  const [atualizando, definirAtualizando] = useState(false);
  const carimboInicial = useRef<string | null>(null);
  const versaoInicial = useRef(versaoDoSite());
  // A versão nova só vale quando aparece em duas conferências seguidas: logo
  // depois de publicar, o servidor alterna entre a cópia velha e a nova.
  const vistaAntes = useRef<string | null>(null);

  const ativo = acesso.autenticado && !modoDemonstracao;
  // Na área da nutricionista o resumo do conteúdo muda a cada coisa que ELA
  // edita, e a faixa avisaria sobre o que ela mesma acabou de fazer. Lá só
  // vale o aviso de versão nova do aplicativo.
  const naAreaDaNutri = pathname.startsWith(rotas.admin);
  // A nutricionista vendo o lado da paciente: o que muda ali é o que ELA
  // mesma acabou de editar. Para ela, só o aviso de versão nova do app.
  const conferirConteudo = !naAreaDaNutri && acesso.papel !== "admin";

  useEffect(() => {
    if (!ativo || disponivel) return;
    let cancelado = false;

    async function verificar() {
      if (document.visibilityState === "hidden") return;

      if (conferirConteudo) {
        const carimbo = await repositorio.carimboDoConteudo();
        if (cancelado) return;
        if (carimbo !== null) {
          if (carimboInicial.current === null) carimboInicial.current = carimbo;
          else if (carimbo !== carimboInicial.current) return definirDisponivel(true);
        }
      }

      if (versaoInicial.current === SEM_CARIMBO) return;
      const publicada = await versaoPublicada(import.meta.env.BASE_URL);
      if (cancelado) return;
      if (!ehMaisNova(publicada, versaoInicial.current)) {
        vistaAntes.current = null;
        return;
      }
      if (vistaAntes.current === publicada) definirDisponivel(true);
      else vistaAntes.current = publicada;
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
  }, [ativo, disponivel, conferirConteudo]);

  if (!ativo || !disponivel) return null;

  return (
    <div className="c-aviso-atualizacao" role="status">
      <span>Atualização disponível</span>
      <button
        type="button"
        disabled={atualizando}
        onClick={() => {
          definirAtualizando(true);
          void buscarVersaoNovaERecarregar(import.meta.env.BASE_URL);
        }}
      >
        {atualizando ? "Atualizando…" : "Atualizar"}
      </button>
    </div>
  );
}
