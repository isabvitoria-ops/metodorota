import { useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useCatalogo } from "@/central/hooks/useCatalogo";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Campo, Texto } from "./componentes/Campos";
import { BaixarBackup } from "@/central/components/BaixarBackup";
import { versaoLegivel } from "@/central/utils/versaoDoSite";
import type { Cupom } from "@/central/types";

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
  const [chavePix, definirChavePix] = useState(configuracoes.chavePix);
  const [cupons, definirCupons] = useState<Cupom[]>(configuracoes.cupons);
  const [aviso, definirAviso] = useState<string | null>(null);

  function mudarCupom(i: number, campo: keyof Cupom, valor: string) {
    definirCupons((atuais) => atuais.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  }

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
        chavePix: chavePix.trim(),
        // Linha pela metade (só marca ou só código) não serve para comprar:
        // some ao salvar, em vez de aparecer quebrada para a paciente.
        cupons: cupons
          .map((c) => ({ marca: c.marca.trim(), codigo: c.codigo.trim() }))
          .filter((c) => c.marca && c.codigo),
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
        <Campo
          rotulo="Chave PIX"
          dica="Vai no lembrete automático de cobrança. Deixe em branco para o lembrete não falar de PIX."
        >
          <Texto valor={chavePix} aoMudar={definirChavePix} placeholder="e-mail, CPF, CNPJ ou telefone" />
        </Campo>

        <Campo
          rotulo="Seus cupons"
          dica="Aparecem pequenos na tela do desafio, logo abaixo das ações da semana. A paciente toca e o código é copiado."
        >
          <div className="c-cupons-edicao">
            {cupons.map((c, i) => (
              <div key={i} className="c-cupom-edicao-linha">
                <input
                  className="c-input"
                  value={c.marca}
                  placeholder="Marca"
                  aria-label={`Marca do cupom ${i + 1}`}
                  onChange={(e) => mudarCupom(i, "marca", e.target.value)}
                />
                <input
                  className="c-input"
                  value={c.codigo}
                  placeholder="Código"
                  aria-label={`Código do cupom ${i + 1}`}
                  onChange={(e) => mudarCupom(i, "codigo", e.target.value)}
                />
                <button
                  type="button"
                  className="c-chip"
                  aria-label={`Tirar o cupom ${c.marca || i + 1}`}
                  onClick={() => definirCupons((atuais) => atuais.filter((_, j) => j !== i))}
                >
                  Tirar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="c-chip"
              onClick={() => definirCupons((atuais) => [...atuais, { marca: "", codigo: "" }])}
            >
              + Adicionar cupom
            </button>
          </div>
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

      <BaixarBackup />

      {/* O carimbo fica no fim das Configuracoes, o lugar onde ela ja vem
          conferir coisa do sistema. E a resposta para "sera que eu recebi a
          atualizacao?" -- pergunta que ela nao tinha como responder antes,
          porque copia velha do navegador abre sem dar erro nenhum. */}
      <div className="c-bloco c-bloco-discreto">
        <h2>Versão deste site</h2>
        <p className="c-versao-carimbo">{versaoLegivel()}</p>
        <p className="c-dica">
          Se esta data for mais antiga do que a que eu te informei, seu navegador
          está mostrando uma cópia guardada. Recarregue segurando <strong>Shift</strong>{" "}
          (no computador) ou feche e reabra a aba (no celular).
        </p>
      </div>
    </>
  );
}
