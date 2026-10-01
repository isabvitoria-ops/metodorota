import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Marca } from "@/central/components/Marca";
import { Esqueleto } from "@/central/components/Esqueleto";
import { repositorio } from "@/central/dados/repositorio";
import { baixarJson } from "@/central/utils/baixarJson";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";
import type { PedidoLgpd, TermoDeUso } from "@/central/types";
import { useSessao } from "./SessaoContexto";
import { TextoDoTermo } from "./TextoDoTermo";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/**
 * "Privacidade e meus dados". Abre sem login (a paciente lê o termo antes de
 * aceitar) e, para quem está logada como paciente, mostra os dois direitos que
 * mais importam: baixar uma cópia dos dados e pedir a exclusão.
 *
 * O pedido de exclusão NÃO apaga nada na hora, de propósito: apagar prontuário é
 * decisão da profissional (a lei pode obrigá-la a guardar parte dele). O pedido
 * fica registrado e a nutricionista responde.
 */
export function Privacidade() {
  const { acesso, pronto } = useSessao();
  const navegar = useNavigate();
  const [termo, definirTermo] = useState<TermoDeUso | null>(null);
  const [pedidos, definirPedidos] = useState<PedidoLgpd[]>([]);
  const [confirmando, definirConfirmando] = useState(false);
  const [motivo, definirMotivo] = useState("");
  const [ocupado, definirOcupado] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const ehPaciente = pronto && acesso.autenticado && acesso.papel !== "admin";

  useEffect(() => {
    void repositorio.lerTermo().then(definirTermo).catch(() => definirErro("Não consegui carregar o texto."));
  }, []);

  useEffect(() => {
    if (ehPaciente) void repositorio.meusPedidosLgpd().then(definirPedidos).catch(() => undefined);
  }, [ehPaciente]);

  async function baixar() {
    definirOcupado(true);
    definirErro(null);
    definirAviso(null);
    try {
      const dados = await repositorio.exportarMeusDados();
      baixarJson(`meus-dados-${hojeSaoPaulo()}.json`, dados);
      definirAviso("Pronto: o arquivo foi baixado. Ele tem tudo o que você registrou e o que a nutricionista registrou sobre você, exceto as anotações clínicas dela.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui gerar o arquivo.");
    } finally {
      definirOcupado(false);
    }
  }

  async function pedirExclusao() {
    definirOcupado(true);
    definirErro(null);
    definirAviso(null);
    try {
      await repositorio.pedirExclusaoDosMeusDados(motivo.trim() || null);
      definirPedidos(await repositorio.meusPedidosLgpd());
      definirConfirmando(false);
      definirMotivo("");
      definirAviso("Pedido enviado. A nutricionista vai te responder.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui enviar o pedido.");
    } finally {
      definirOcupado(false);
    }
  }

  const aberto = pedidos.find((p) => !p.atendidoEm);

  return (
    <div className="central">
      <div className="c-conta">
        <div className="c-conta-caixa c-termo">
          <Marca altura={40} />
          <h1 className="c-titulo" style={{ fontSize: 26, marginTop: 10 }}>
            Privacidade e meus dados
          </h1>

          <div className="c-termo-rolagem c-termo-rolagem-longa">
            {termo ? <TextoDoTermo texto={termo.texto} /> : <Esqueleto linhas={6} />}
          </div>
          {termo && termo.versao > 0 && (
            <p className="c-dica">
              Versão {termo.versao}
              {termo.publicadoEm ? `, publicada em ${dia(termo.publicadoEm)}` : ""}.
            </p>
          )}

          {ehPaciente && (
            <section className="c-bloco" aria-label="Seus dados">
              <h2 className="c-secao-titulo">Seus dados</h2>
              <button type="button" className="c-botao c-botao-secundario" disabled={ocupado} onClick={() => void baixar()}>
                Baixar meus dados
              </button>

              {aberto ? (
                <p className="c-dica">
                  Você pediu a exclusão dos seus dados em {dia(aberto.criadoEm)}. Aguardando a resposta da nutricionista.
                </p>
              ) : confirmando ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="c-dica">
                    Isto pede a exclusão da sua ficha e do seu histórico. Nada é apagado na hora: a nutricionista recebe o
                    pedido e responde. Alguns registros ela pode ser obrigada por lei a guardar, e nesse caso explica o motivo.
                  </p>
                  <label className="c-rotulo" htmlFor="motivo-exclusao">
                    Quer contar o motivo? (opcional)
                  </label>
                  <textarea
                    id="motivo-exclusao"
                    className="c-input"
                    rows={3}
                    value={motivo}
                    onChange={(e) => definirMotivo(e.target.value)}
                  />
                  <div className="c-modal-acoes">
                    <button type="button" className="c-botao c-botao-secundario" onClick={() => definirConfirmando(false)}>
                      Cancelar
                    </button>
                    <button type="button" className="c-botao c-botao-perigo" disabled={ocupado} onClick={() => void pedirExclusao()}>
                      Enviar pedido
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="c-link" onClick={() => definirConfirmando(true)}>
                  Pedir exclusão dos meus dados
                </button>
              )}

              {pedidos.filter((p) => p.atendidoEm).map((p) => (
                <p className="c-dica" key={p.id}>
                  Pedido de {dia(p.criadoEm)}: atendido em {dia(p.atendidoEm as string)}.
                </p>
              ))}
            </section>
          )}

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

          <button type="button" className="c-link" onClick={() => navegar(acesso.autenticado ? rotas.home : rotas.entrar)}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
