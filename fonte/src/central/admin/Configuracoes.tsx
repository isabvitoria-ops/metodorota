import { useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useCatalogo } from "@/central/hooks/useCatalogo";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Campo, Texto } from "./componentes/Campos";

/**
 * Configurações do app (§46, §47 do briefing).
 *
 * O WhatsApp está aqui por um motivo prático: ele aparece na tela de acesso
 * encerrado, que é exatamente onde a paciente vai querer falar com você. Se
 * o número estivesse escrito no código, trocá-lo exigiria um deploy.
 */
export function ConfiguracoesAdmin() {
  const { configuracoes, recarregar } = useSessao();
  const { comSalvamento, salvando, erro } = useCatalogo();
  const [nomeCentral, definirNomeCentral] = useState(configuracoes.nomeCentral);
  const [fraseHome, definirFraseHome] = useState(configuracoes.fraseHome);
  const [lema, definirLema] = useState(configuracoes.lema);
  const [comerFora, definirComerFora] = useState(configuracoes.comerForaIntroducao);
  const [whatsapp, definirWhatsapp] = useState(configuracoes.whatsapp);
  const [nomeNutricionista, definirNome] = useState(configuracoes.nomeNutricionista);
  const [alerta, definirAlerta] = useState(String(configuracoes.alertaVencimentoDias));
  const [aviso, definirAviso] = useState<string | null>(null);

  const numeroLimpo = whatsapp.replace(/\D/g, "");
  const numeroValido = numeroLimpo === "" || numeroLimpo.length >= 12;

  async function salvar() {
    definirAviso(null);
    if (!numeroValido) {
      definirAviso("O WhatsApp precisa ter país e DDD, só números. Exemplo: 5511999999999.");
      return;
    }
    const deuCerto = await comSalvamento(async () => {
      await repositorio.salvarConfiguracoes({
        nomeCentral: nomeCentral.trim() || "Central do Paciente",
        fraseHome: fraseHome.trim(),
        lema: lema.trim(),
        comerForaIntroducao: comerFora.trim(),
        whatsapp: numeroLimpo,
        nomeNutricionista: nomeNutricionista.trim(),
        alertaVencimentoDias: Math.max(1, Number(alerta) || 15),
      });
    });
    if (deuCerto) {
      await recarregar();
      definirAviso("Configurações salvas.");
    }
  }

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Configurações
      </h1>
      <p className="c-subtitulo">O que muda aqui vale para toda a Central, sem precisar publicar de novo.</p>

      <div style={{ maxWidth: 520, marginTop: 18 }}>
        <Campo rotulo="Nome da Central">
          <Texto valor={nomeCentral} aoMudar={definirNomeCentral} />
        </Campo>
        <Campo rotulo="Frase da tela inicial">
          <Texto valor={fraseHome} aoMudar={definirFraseHome} />
        </Campo>
        <Campo rotulo="Lema" dica="Frase curta de identidade. Deixe em branco para não mostrar.">
          <Texto valor={lema} aoMudar={definirLema} />
        </Campo>
        <Campo
          rotulo="Frase de Comer fora"
          dica="Aparece no topo da tela de Comer fora. Deixe em branco para não mostrar."
        >
          <Texto valor={comerFora} aoMudar={definirComerFora} />
        </Campo>
        <Campo rotulo="Seu nome">
          <Texto valor={nomeNutricionista} aoMudar={definirNome} />
        </Campo>
        <Campo
          rotulo="WhatsApp"
          dica="Só números, com país e DDD. Exemplo: 5511999999999. Aparece para quem tem acesso vencido."
        >
          <Texto valor={whatsapp} aoMudar={definirWhatsapp} placeholder="5511999999999" />
        </Campo>
        <Campo
          rotulo="Avisar vencimento com quantos dias"
          dica="Quantos dias antes do fim o paciente entra na lista de 'precisam de atenção'."
        >
          <Texto valor={alerta} aoMudar={definirAlerta} />
        </Campo>

        {(aviso || erro) && (
          <div className={`c-aviso ${erro ? "c-aviso-erro" : "c-aviso-ok"}`} role="status">
            <span>{aviso ?? erro}</span>
          </div>
        )}

        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </>
  );
}
