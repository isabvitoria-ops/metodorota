import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { baixarJson } from "@/central/utils/baixarJson";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";
import type { PedidoLgpd, SituacaoDosAceites } from "@/central/types";
import { AreaTexto } from "./componentes/Campos";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/**
 * O termo de uso e os pedidos das pacientes (LGPD), nas Configurações.
 *
 * O texto inicial é um MODELO em linguagem simples, escrito para ser lido e
 * ajustado — não é parecer jurídico. Trocar o texto sobe a versão e todas as
 * pacientes aceitam de novo no próximo acesso; é por isso que o botão avisa.
 */
export function TermoELgpd() {
  const navegar = useNavigate();
  const [textoAtual, definirTextoAtual] = useState("");
  const [texto, definirTexto] = useState("");
  const [versao, definirVersao] = useState(0);
  const [situacao, definirSituacao] = useState<SituacaoDosAceites | null>(null);
  const [pedidos, definirPedidos] = useState<PedidoLgpd[]>([]);
  const [ocupado, definirOcupado] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [t, s, p] = await Promise.all([
        repositorio.lerTermo(),
        repositorio.situacaoDosAceites(),
        repositorio.pedidosLgpd(),
      ]);
      definirTextoAtual(t.texto);
      definirTexto(t.texto);
      definirVersao(t.versao);
      definirSituacao(s);
      definirPedidos(p);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar o termo.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function publicar() {
    definirOcupado(true);
    definirAviso(null);
    definirErro(null);
    try {
      const r = await repositorio.publicarTermo(texto);
      await carregar();
      definirAviso(
        r.mudou
          ? `Versão ${r.versao} publicada. Todas as pacientes vão aceitar de novo no próximo acesso.`
          : "O texto é igual ao atual; nada mudou.",
      );
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui publicar.");
    } finally {
      definirOcupado(false);
    }
  }

  async function baixarFicha(pedido: PedidoLgpd) {
    if (!pedido.pacienteId) return;
    definirOcupado(true);
    try {
      const dados = await repositorio.exportarFichaCompleta(pedido.pacienteId);
      baixarJson(`ficha-${pedido.pacienteNome.replace(/\s+/g, "-").toLowerCase()}-${hojeSaoPaulo()}.json`, dados);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui exportar a ficha.");
    } finally {
      definirOcupado(false);
    }
  }

  async function atender(pedido: PedidoLgpd) {
    definirOcupado(true);
    try {
      await repositorio.atenderPedidoLgpd(pedido.id);
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui marcar como atendido.");
    } finally {
      definirOcupado(false);
    }
  }

  const abertos = pedidos.filter((p) => !p.atendidoEm);
  const mudou = texto.trim() !== textoAtual.trim();

  return (
    <section className="c-bloco" aria-labelledby="t-termo">
      <h2 id="t-termo">Termo de uso e privacidade</h2>
      <p className="c-dica">
        É o texto que a paciente lê e aceita no primeiro acesso. O que está aí é um modelo em linguagem simples: leia,
        ajuste ao seu jeito e, se puder, peça a um advogado que confira. Também fica numa página aberta (
        <button type="button" className="c-link" onClick={() => navegar(rotas.privacidade)}>
          Privacidade
        </button>
        ).
      </p>

      {situacao && (
        <p style={{ margin: "10px 0" }}>
          Versão <strong>{versao}</strong>:{" "}
          <strong>
            {situacao.aceitaram} de {situacao.comConta}
          </strong>{" "}
          pacientes com conta já aceitaram.
          {situacao.pendentes > 0 && " As outras veem o termo no próximo acesso."}
        </p>
      )}

      <AreaTexto valor={texto} aoMudar={definirTexto} linhas={16} />
      <p className="c-dica">
        Mudar o texto sobe a versão e <strong>todas as pacientes aceitam de novo</strong>. A versão antiga fica guardada,
        com quem aceitou e quando.
      </p>

      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <button type="button" className="c-botao" disabled={ocupado || !mudou} onClick={() => void publicar()}>
        {mudou ? "Publicar texto novo" : "Texto publicado"}
      </button>

      <h3 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Pedidos de exclusão {abertos.length > 0 && `(${abertos.length} em aberto)`}
      </h3>
      {abertos.length === 0 ? (
        <p className="c-dica">Nenhum pedido em aberto.</p>
      ) : (
        <div className="c-lista">
          {abertos.map((p) => (
            <div key={p.id} className="c-lista-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div>
                <strong>{p.pacienteNome}</strong> pediu em {dia(p.criadoEm)}
                {p.motivo && <p className="c-dica">“{p.motivo}”</p>}
              </div>
              <div className="c-modal-acoes" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                {p.pacienteId && (
                  <>
                    <button type="button" className="c-chip" onClick={() => navegar(rotas.adminProntuario(p.pacienteId as string))}>
                      Abrir a ficha
                    </button>
                    <button type="button" className="c-chip" disabled={ocupado} onClick={() => void baixarFicha(p)}>
                      Baixar a cópia completa
                    </button>
                  </>
                )}
                <button type="button" className="c-chip" disabled={ocupado} onClick={() => void atender(p)}>
                  Marcar como atendido
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="c-dica">
        Para atender: baixe a cópia se ela quiser, depois apague a paciente na ficha (menu ⋯ → Cadastro → Excluir
        paciente) e marque como atendido. Se a lei obriga você a guardar parte do prontuário, responda a ela explicando.
      </p>
    </section>
  );
}
