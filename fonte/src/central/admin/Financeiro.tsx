import { useCallback, useEffect, useState } from "react";
import type { Cobranca, PainelFinanceiro, ValorDoPaciente } from "@/central/types/financeiro";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Campo, Texto } from "@/central/admin/componentes/Campos";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import {
  reais,
  dia,
  mesPorExtenso,
  textoDaSituacao,
  diasDeAtraso,
  mensagemDeCobranca,
  linkDoWhatsapp,
} from "@/central/utils/cobranca";

/**
 * Cobrança — área da nutricionista.
 *
 * NÃO É GATEWAY. O dinheiro entra por PIX ou maquininha, como já entra.
 * Isto é o controle: quem deve, quanto, desde quando, e quem já pagou.
 * Ver o cabeçalho da migração 0043 para por que não é gateway.
 *
 * O LEMBRETE É wa.me, E A MENSAGEM NÃO SAI SOZINHA. O botão abre o
 * WhatsApp com o texto escrito; ela lê, edita se quiser, e aperta enviar.
 * Disparo automático de cobrança para quem ela atende clinicamente é
 * exatamente o tipo de coisa que um dia sai errado com a pessoa errada no
 * dia errado. Custa R$ 0 e a arquitetura deixa a API oficial entrar depois
 * sem refazer nada.
 *
 * A PACIENTE NÃO VÊ NADA DISTO — não há função que devolva cobrança para o
 * lado dela. Aviso de dívida dentro do aplicativo de acompanhamento
 * misturaria a relação clínica com a comercial na tela de registrar
 * sintoma.
 */
export function Financeiro() {
  // O nome dela assina o lembrete do WhatsApp. Vem da sessão, que é por
  // onde o resto da Central já lê as configurações.
  const { configuracoes } = useSessao();
  const nutricionista = configuracoes.nomeNutricionista;
  const [painel, definirPainel] = useState<PainelFinanceiro | null>(null);
  const [valores, definirValores] = useState<ValorDoPaciente[]>([]);
  const [aba, definirAba] = useState<"cobrancas" | "valores">("cobrancas");
  const [carregando, definirCarregando] = useState(true);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      const [p, v] = await Promise.all([
        repositorio.painelFinanceiro(null),
        repositorio.valoresDosPacientes(),
      ]);
      definirPainel(p);
      definirValores(v);
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar o financeiro.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function gerar() {
    try {
      const quantas = await repositorio.gerarCobrancas(`${hojeSaoPaulo().slice(0, 7)}-01`);
      // Zero não é erro: quer dizer que este mês já foi gerado. A tela diz
      // isso, em vez de deixar ela achando que o botão não funcionou.
      definirAviso(
        quantas === 0
          ? "Nenhuma cobrança nova — as deste mês já tinham sido geradas."
          : quantas === 1
            ? "1 cobrança criada."
            : `${quantas} cobranças criadas.`,
      );
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui gerar.");
    }
  }

  const semValor = valores.filter((v) => v.valorMensal === null);

  return (
    <>
      <h1 className="c-titulo">Cobrança</h1>
      <p className="c-dica">
        O controle de quem pagou e quem não pagou. O dinheiro continua entrando por fora —
        PIX, maquininha, o que você já usa. Suas pacientes não veem nada desta tela.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}

      {painel && (
        <div className="c-painel-numeros">
          <span>
            <strong>{reais(painel.totais.previstoNoMes)}</strong>
            <small>previsto no mês</small>
          </span>
          <span>
            <strong>{reais(painel.totais.recebidoNoMes)}</strong>
            <small>recebido no mês</small>
          </span>
          <span>
            <strong>{reais(painel.totais.aberto)}</strong>
            <small>em aberto</small>
          </span>
          <span>
            <strong>{reais(painel.totais.atrasado)}</strong>
            <small>atrasado</small>
          </span>
        </div>
      )}

      <div className="c-chips" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="c-chip"
          aria-pressed={aba === "cobrancas"}
          onClick={() => definirAba("cobrancas")}
        >
          Cobranças
        </button>
        <button
          type="button"
          className="c-chip"
          aria-pressed={aba === "valores"}
          onClick={() => definirAba("valores")}
        >
          Valores por paciente{semValor.length > 0 ? ` (${semValor.length} sem valor)` : ""}
        </button>
      </div>

      {carregando && <p className="c-contagem">Carregando…</p>}

      {aba === "cobrancas" && painel && (
        <>
          <div className="c-barra-recolher" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="c-botao" onClick={() => void gerar()}>
              Gerar cobranças de {mesPorExtenso(`${hojeSaoPaulo().slice(0, 7)}-01`)}
            </button>
          </div>
          <p className="c-dica" style={{ marginTop: 0 }}>
            Pode apertar mais de uma vez: quem já tem cobrança deste mês não ganha outra.
          </p>

          {semValor.length > 0 && (
            <p className="c-dica">
              {semValor.length === 1
                ? "1 paciente ainda não tem valor combinado e fica de fora."
                : `${semValor.length} pacientes ainda não têm valor combinado e ficam de fora.`}{" "}
              Veja na aba ao lado.
            </p>
          )}

          {painel.cobrancas.length === 0 && (
            <p className="c-dica">
              Nenhuma cobrança ainda. Defina o valor de cada paciente na aba ao lado e depois
              gere o mês.
            </p>
          )}

          {painel.cobrancas.map((c) => (
            <LinhaDaCobranca
              key={c.id}
              cobranca={c}
              nutricionista={nutricionista}
              aoMudar={carregar}
              aoErrar={definirErro}
            />
          ))}
        </>
      )}

      {aba === "valores" && (
        <>
          <p className="c-dica">
            Quanto cada paciente paga e em que dia vence. Sem valor, ela não entra na geração
            do mês — e é por isso que a lista mostra quem está sem.
          </p>
          {valores.map((v) => (
            <ValorDaPaciente key={v.id} valor={v} aoMudar={carregar} aoErrar={definirErro} />
          ))}
        </>
      )}
    </>
  );
}

function LinhaDaCobranca({
  cobranca,
  nutricionista,
  aoMudar,
  aoErrar,
}: {
  cobranca: Cobranca;
  nutricionista: string;
  aoMudar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [ocupado, definirOcupado] = useState(false);
  const atraso = diasDeAtraso(cobranca, hojeSaoPaulo());
  const link = linkDoWhatsapp(cobranca.telefone, mensagemDeCobranca(cobranca, nutricionista));

  async function agir(acao: () => Promise<unknown>) {
    definirOcupado(true);
    try {
      await acao();
      await aoMudar();
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : "Não consegui.");
    } finally {
      definirOcupado(false);
    }
  }

  return (
    <div className="c-bloco">
      <div className="c-bloco-topo">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="c-lista-item-nome">{cobranca.paciente}</span>
          <span className="c-lista-item-apoio">
            {mesPorExtenso(cobranca.competencia)} · {reais(cobranca.valor)} · vence{" "}
            {dia(cobranca.vencimento)}
            {atraso !== null && ` · ${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso`}
            {cobranca.pagoEm && ` · pago em ${dia(cobranca.pagoEm)}`}
            {cobranca.forma && ` (${cobranca.forma})`}
          </span>
        </span>
        <span className={`c-selo ${cobranca.situacao === "paga" ? "melhor" : "ocasional"}`}>
          {textoDaSituacao(cobranca.situacao)}
        </span>
      </div>

      {cobranca.status !== "cancelada" && (
        <div className="c-chips" style={{ marginTop: 8 }}>
          {cobranca.status === "aberta" ? (
            <>
              <button
                type="button"
                className="c-chip"
                disabled={ocupado}
                onClick={() => void agir(() => repositorio.baixarCobranca(cobranca.id, true, "pix", null))}
              >
                Recebi por PIX
              </button>
              <button
                type="button"
                className="c-chip"
                disabled={ocupado}
                onClick={() =>
                  void agir(() => repositorio.baixarCobranca(cobranca.id, true, "cartão", null))
                }
              >
                Recebi por cartão
              </button>
              {/* Sem telefone o botão NÃO aparece — botão que não faz nada
                  quando clicado é pior do que botão ausente. */}
              {link ? (
                <a className="c-chip" href={link} target="_blank" rel="noreferrer">
                  Lembrar no WhatsApp
                </a>
              ) : (
                <span className="c-dica">Sem telefone cadastrado para lembrar.</span>
              )}
              <button
                type="button"
                className="c-chip"
                disabled={ocupado}
                onClick={() => void agir(() => repositorio.cancelarCobranca(cobranca.id))}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="c-chip"
              disabled={ocupado}
              onClick={() => void agir(() => repositorio.baixarCobranca(cobranca.id, false, null, null))}
            >
              Desfazer baixa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ValorDaPaciente({
  valor,
  aoMudar,
  aoErrar,
}: {
  valor: ValorDoPaciente;
  aoMudar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [quanto, definirQuanto] = useState(
    valor.valorMensal === null ? "" : String(valor.valorMensal).replace(".", ","),
  );
  const [diaVenc, definirDia] = useState(
    valor.diaDeVencimento === null ? "" : String(valor.diaDeVencimento),
  );
  const [salvando, definirSalvando] = useState(false);
  const [salvo, definirSalvo] = useState(false);

  async function salvar() {
    const n = quanto.trim() === "" ? null : Number(quanto.replace(/\./g, "").replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n < 0)) {
      aoErrar("Valor inválido.");
      return;
    }
    const d = diaVenc.trim() === "" ? null : Number(diaVenc);
    if (d !== null && (!Number.isInteger(d) || d < 1 || d > 28)) {
      aoErrar("O dia do vencimento vai de 1 a 28.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.definirValorDoPaciente(valor.id, n, d);
      definirSalvo(true);
      await aoMudar();
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <div className="c-bloco">
      <div className="c-bloco-topo">
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="c-lista-item-nome">{valor.nome}</span>
          {valor.valorMensal === null && (
            <span className="c-lista-item-apoio">sem valor combinado — fica fora da geração</span>
          )}
        </span>
      </div>
      <div className="c-duas-colunas">
        <Campo rotulo="Valor por mês" dica="Em reais. Deixe vazio para tirar da cobrança.">
          <Texto
            valor={quanto}
            aoMudar={(v) => {
              definirQuanto(v);
              definirSalvo(false);
            }}
            placeholder="300,00"
          />
        </Campo>
        <Campo rotulo="Dia do vencimento" dica="De 1 a 28. Vazio usa o dia 10.">
          <Texto
            valor={diaVenc}
            aoMudar={(v) => {
              definirDia(v);
              definirSalvo(false);
            }}
            placeholder="10"
          />
        </Campo>
      </div>
      <button type="button" className="c-botao c-botao-secundario" disabled={salvando} onClick={() => void salvar()}>
        {salvando ? "Salvando…" : salvo ? "Salvo" : "Salvar"}
      </button>
    </div>
  );
}
