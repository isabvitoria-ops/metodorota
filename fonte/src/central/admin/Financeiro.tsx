import { useCallback, useEffect, useState } from "react";
import type {
  Cobranca,
  PainelFinanceiro,
  ValorDoPaciente,
  Balanco,
  Recebimento,
  FormaDePagamento,
} from "@/central/types/financeiro";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { Campo, Selecao, Texto } from "@/central/admin/componentes/Campos";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import {
  reais,
  dia,
  mesPorExtenso,
  mesCurto,
  textoDaSituacao,
  textoDaForma,
  textoDaVariacaoMensal,
  alturasDasBarras,
  diasDeAtraso,
  mensagemDeCobranca,
  assuntoDaCobranca,
  linkDoWhatsapp,
  linkDoEmail,
  FORMAS_DE_PAGAMENTO,
} from "@/central/utils/cobranca";

/**
 * Cobrança — área da nutricionista.
 *
 * NÃO É GATEWAY. O dinheiro entra por PIX ou maquininha, como já entra.
 * Isto é o controle: quem deve, quanto, desde quando, e quem já pagou.
 * Ver o cabeçalho da migração 0043 para por que não é gateway.
 *
 * O BOTÃO "COBRAR" abre, de uma vez, o WhatsApp (wa.me) e o e-mail
 * (mailto:) da paciente com a mensagem escrita — uma mensagem com cara de
 * aviso do sistema, a pedido dela. O último passo, apertar enviar, continua
 * sendo dela, e isso é o limite do gratuito, não uma escolha de tela:
 *   - WhatsApp que sai sozinho só pela API oficial (Meta/Twilio), que é
 *     paga por mensagem e exige número comercial verificado;
 *   - e-mail que sai sozinho precisa de um serviço de envio (Resend, por
 *     exemplo) com conta e chave dela, numa Edge Function.
 * Se um dia entrar um dos dois, troca-se o que o botão faz; a tela, o
 * texto e o registro do lembrete (migração 0047) ficam como estão.
 *
 * A PACIENTE NÃO VÊ NADA DISTO — não há função que devolva cobrança para o
 * lado dela. Aviso de dívida dentro do aplicativo de acompanhamento
 * misturaria a relação clínica com a comercial na tela de registrar
 * sintoma.
 */
export function Financeiro() {
  // O nome da Central (e não o dela) assina o lembrete, e a chave PIX vai
  // junto. Vêm da sessão, que é por onde o resto da Central lê as
  // configurações.
  const { configuracoes } = useSessao();
  const [painel, definirPainel] = useState<PainelFinanceiro | null>(null);
  const [valores, definirValores] = useState<ValorDoPaciente[]>([]);
  const [balanco, definirBalanco] = useState<Balanco | null>(null);
  const [aba, definirAba] = useState<"balanco" | "cobrancas" | "recebimentos" | "valores">(
    "balanco",
  );
  const [carregando, definirCarregando] = useState(true);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    definirCarregando(true);
    try {
      const [p, v, b] = await Promise.all([
        repositorio.painelFinanceiro(null),
        repositorio.valoresDosPacientes(),
        repositorio.balancoFinanceiro(6),
      ]);
      definirPainel(p);
      definirValores(v);
      definirBalanco(b);
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
        Seu caixa e seu controle de quem pagou. O dinheiro continua entrando por fora — PIX,
        maquininha, o que você já usa. Suas pacientes não veem nada desta tela. O botão
        Cobrar abre o WhatsApp e o e-mail dela com um aviso automático do sistema, sem o seu
        nome — você só toca em enviar.
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

      {/* O painel de cobrança só na aba dele. Na aba Balanço ele repetia
          "entrou no mês" ao lado de "este mês" -- o mesmo número duas vezes
          na mesma tela, que é o começo de alguém achar que são coisas
          diferentes. */}
      {painel && aba === "cobrancas" && (
        <div className="c-painel-numeros">
          <span>
            <strong>{reais(painel.totais.previstoNoMes)}</strong>
            <small>previsto no mês</small>
          </span>
          <span>
            <strong>{reais(painel.totais.recebidoNoMes)}</strong>
            <small>entrou no mês</small>
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
          aria-pressed={aba === "balanco"}
          onClick={() => definirAba("balanco")}
        >
          Balanço
        </button>
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
          aria-pressed={aba === "recebimentos"}
          onClick={() => definirAba("recebimentos")}
        >
          Recebimentos
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
              nomeCentral={configuracoes.nomeCentral}
              chavePix={configuracoes.chavePix}
              aoMudar={carregar}
              aoErrar={definirErro}
            />
          ))}
        </>
      )}

      {aba === "balanco" && balanco && <AbaDoBalanco balanco={balanco} />}

      {aba === "recebimentos" && balanco && (
        <AbaDeRecebimentos
          balanco={balanco}
          pacientes={valores}
          aoMudar={carregar}
          aoErrar={definirErro}
        />
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
  nomeCentral,
  chavePix,
  aoMudar,
  aoErrar,
}: {
  cobranca: Cobranca;
  nomeCentral: string;
  chavePix: string;
  aoMudar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [ocupado, definirOcupado] = useState(false);
  const [lembrete, definirLembrete] = useState({
    em: cobranca.lembradaEm,
    vezes: cobranca.lembretes,
  });
  const atraso = diasDeAtraso(cobranca, hojeSaoPaulo());
  const whatsapp = linkDoWhatsapp(
    cobranca.telefone,
    mensagemDeCobranca(cobranca, { nomeCentral, chavePix, formato: "whatsapp" }),
  );
  const email = linkDoEmail(
    cobranca.email,
    assuntoDaCobranca(cobranca, nomeCentral),
    mensagemDeCobranca(cobranca, { nomeCentral, chavePix, formato: "email" }),
  );

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

  /**
   * Anota o lembrete SEM recarregar a lista: recarregar no meio da ida ao
   * WhatsApp faria a linha piscar, e ela voltaria sem saber se deu certo.
   * Se a anotação falhar, a mensagem já abriu — o erro só avisa que o
   * "lembrada em" não foi gravado.
   */
  function anotar() {
    repositorio
      .registrarLembreteCobranca(cobranca.id)
      .then((r) => definirLembrete({ em: r.lembradaEm, vezes: r.lembretes }))
      .catch((e: unknown) =>
        aoErrar(
          e instanceof Error
            ? `A mensagem abriu, mas não anotei o lembrete: ${e.message}`
            : "A mensagem abriu, mas não anotei o lembrete.",
        ),
      );
  }

  /**
   * Os dois de uma vez. O WhatsApp abre em outra aba; o e-mail, nesta —
   * `mailto:` não sai da página, só chama o aplicativo de e-mail. Abrir os
   * dois como abas novas faria o bloqueador de janelas barrar o segundo.
   * No celular, o e-mail pode só abrir quando ela voltar do WhatsApp; por
   * isso os botões separados continuam logo ao lado.
   */
  function cobrar() {
    if (whatsapp) window.open(whatsapp, "_blank", "noopener");
    if (email) {
      const abrir = () => {
        window.location.href = email;
      };
      if (whatsapp) window.setTimeout(abrir, 700);
      else abrir();
    }
    anotar();
  }

  // O dia do lembrete em São Paulo: o banco grava em UTC, e depois das 21h
  // o "hoje" em UTC já é amanhã.
  const lembradaHoje = lembrete.em !== null && diaEmSaoPaulo(lembrete.em) === hojeSaoPaulo();

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
          {cobranca.status === "aberta" && lembrete.em && (
            <span className="c-lista-item-apoio c-cobranca-lembrete">
              {/* "Cobrou", e não "enviado": o que se sabe é que ela apertou
                  o botão, não que apertou enviar no WhatsApp. */}
              Você cobrou {lembradaHoje ? `hoje, ${horaCurta(lembrete.em)}` : `em ${dataCurta(lembrete.em)}`}
              {lembrete.vezes > 1 && ` · ${lembrete.vezes} vezes no total`}
            </span>
          )}
        </span>
        <span className={`c-selo ${cobranca.situacao === "paga" ? "melhor" : "ocasional"}`}>
          {textoDaSituacao(cobranca.situacao)}
        </span>
      </div>

      {cobranca.status !== "cancelada" && (
        <div className="c-chips" style={{ marginTop: 8 }}>
          {cobranca.status === "aberta" ? (
            <>
              {/* Sem telefone nem e-mail o botão NÃO aparece — botão que
                  não faz nada quando clicado é pior do que botão ausente. */}
              {whatsapp || email ? (
                <button
                  type="button"
                  className="c-chip c-chip-cobrar"
                  onClick={cobrar}
                  title={
                    whatsapp && email
                      ? "Abre o WhatsApp e o e-mail com a mensagem pronta"
                      : whatsapp
                        ? "Abre o WhatsApp com a mensagem pronta (sem e-mail cadastrado)"
                        : "Abre o e-mail com a mensagem pronta (sem telefone cadastrado)"
                  }
                >
                  {lembradaHoje ? "Cobrar de novo" : "Cobrar"}
                </button>
              ) : (
                <span className="c-dica">Sem telefone nem e-mail no cadastro para cobrar.</span>
              )}
              {whatsapp && email && (
                <>
                  <a className="c-chip" href={whatsapp} target="_blank" rel="noreferrer" onClick={anotar}>
                    Só WhatsApp
                  </a>
                  <a className="c-chip" href={email} onClick={anotar}>
                    Só e-mail
                  </a>
                </>
              )}
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

function diaEmSaoPaulo(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function horaCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `às ${d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;
}

/** "23/09 às 14:05", no fuso de São Paulo. */
function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(", ", " às ");
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

/**
 * O balanço: quanto entrou, por mês e por forma de pagamento.
 *
 * TUDO AQUI SAI DO LIVRO-CAIXA, e de mais lugar nenhum. Baixa de cobrança
 * já entra no caixa, então não há soma paralela a fazer — contar duas vezes
 * é impossível por construção, e não por cuidado. Ver a migração 0046.
 *
 * NENHUM NÚMERO VEM COM VEREDITO. "R$ 300,00 a mais que o mês passado" e
 * nunca "ótimo mês": um mês menor pode ser férias, pode ser escolha, pode
 * ser sazonalidade do consultório. Quem sabe é ela.
 */
function AbaDoBalanco({ balanco }: { balanco: Balanco }) {
  const alturas = alturasDasBarras(balanco.meses);
  const houveEntrada = balanco.totais.noPeriodo > 0;

  return (
    <>
      <div className="c-painel-numeros" style={{ marginTop: 14 }}>
        <span>
          <strong>{reais(balanco.totais.noMes)}</strong>
          <small>este mês</small>
        </span>
        <span>
          <strong>{reais(balanco.totais.mesPassado)}</strong>
          <small>mês passado</small>
        </span>
        <span>
          <strong>{reais(balanco.totais.mediaMensal)}</strong>
          <small>média por mês</small>
        </span>
        <span>
          <strong>{reais(balanco.totais.noPeriodo)}</strong>
          <small>nos 6 meses</small>
        </span>
      </div>

      <p className="c-dica">
        {textoDaVariacaoMensal(balanco.totais.noMes, balanco.totais.mesPassado)}. A média não
        conta o mês em curso, que ainda está acontecendo.
      </p>

      {!houveEntrada && (
        <p className="c-dica">
          Nenhuma entrada ainda. Registre um recebimento na aba ao lado, ou dê baixa numa
          cobrança — as duas coisas caem aqui.
        </p>
      )}

      {houveEntrada && (
        <>
          <h2 className="c-secao-titulo">Mês a mês</h2>
          <div className="c-serie-pontuacao" style={{ minHeight: 120 }}>
            {balanco.meses.map((m, i) => (
              <span className="c-barra-semana" key={m.mes}>
                {/* O valor em cima da barra: são seis meses, cabe, e evita
                    ter que adivinhar a altura no olho. */}
                <span className="rotulo">{m.total > 0 ? reais(m.total).replace("R$ ", "") : ""}</span>
                <span className="barra" style={{ height: `${(alturas[i] ?? 0) * 0.8}px` }} />
                <span className="rotulo">{mesCurto(m.mes)}</span>
              </span>
            ))}
          </div>

          <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
            Por forma de pagamento
          </h2>
          <p className="c-dica" style={{ marginTop: 0 }}>
            Nos últimos 6 meses. É o número que responde se vale a pena manter maquininha.
          </p>
          {balanco.porForma.map((f) => (
            <div className="c-bloco" key={f.forma}>
              <div className="c-bloco-topo">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="c-lista-item-nome">{textoDaForma(f.forma)}</span>
                  <span className="c-lista-item-apoio">
                    {f.entradas} {f.entradas === 1 ? "entrada" : "entradas"} ·{" "}
                    {Math.round((f.total / balanco.totais.noPeriodo) * 100)}% do total
                  </span>
                </span>
                <strong>{reais(f.total)}</strong>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

/**
 * O livro-caixa: registrar e ver o que entrou.
 *
 * A ENTRADA QUE NASCEU DE UMA COBRANÇA aparece aqui, porque é dinheiro que
 * entrou — mas não se edita nem se apaga por aqui. Ela é consequência da
 * baixa, e mexer nela pelo lado errado faria os dois lugares discordarem
 * sobre o mesmo dinheiro. O botão some, em vez de aparecer e ser recusado
 * depois do clique.
 */
function AbaDeRecebimentos({
  balanco,
  pacientes,
  aoMudar,
  aoErrar,
}: {
  balanco: Balanco;
  pacientes: ValorDoPaciente[];
  aoMudar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [abrindo, definirAbrindo] = useState(false);
  const [editando, definirEditando] = useState<Recebimento | null>(null);

  return (
    <>
      <p className="c-dica">
        Tudo o que entrou — o que veio de cobrança e o que você registrou à mão. É daqui que
        o balanço sai, então cada entrada aparece uma vez só.
      </p>

      {!abrindo && !editando && (
        <button type="button" className="c-botao" onClick={() => definirAbrindo(true)}>
          + Registrar entrada
        </button>
      )}

      {(abrindo || editando) && (
        <FormularioDeRecebimento
          recebimento={editando}
          pacientes={pacientes}
          aoFechar={() => {
            definirAbrindo(false);
            definirEditando(null);
          }}
          aoSalvar={aoMudar}
          aoErrar={aoErrar}
        />
      )}

      {balanco.recebimentos.length === 0 && (
        <p className="c-dica">Nenhuma entrada nos últimos 6 meses.</p>
      )}

      {balanco.recebimentos.map((r) => (
        <div className="c-bloco" key={r.id}>
          <div className="c-bloco-topo">
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="c-lista-item-nome">
                {r.descricao ?? r.paciente ?? "Entrada"}
              </span>
              <span className="c-lista-item-apoio">
                {dia(r.data)} · {textoDaForma(r.forma)}
                {r.paciente && ` · ${r.paciente}`}
                {r.deCobranca && " · veio de cobrança"}
              </span>
            </span>
            <strong>{reais(r.valor)}</strong>
          </div>
          {!r.deCobranca && (
            <div className="c-chips">
              <button type="button" className="c-chip" onClick={() => definirEditando(r)}>
                Editar
              </button>
              <button
                type="button"
                className="c-chip"
                onClick={() => {
                  void (async () => {
                    try {
                      await repositorio.apagarRecebimento(r.id);
                      await aoMudar();
                    } catch (e) {
                      aoErrar(e instanceof Error ? e.message : "Não consegui apagar.");
                    }
                  })();
                }}
              >
                Apagar
              </button>
            </div>
          )}
          {r.deCobranca && (
            <p className="c-dica">
              Para mudar ou tirar esta entrada, desfaça a baixa na aba Cobranças — assim as
              duas telas continuam contando a mesma coisa.
            </p>
          )}
        </div>
      ))}
    </>
  );
}

function FormularioDeRecebimento({
  recebimento,
  pacientes,
  aoFechar,
  aoSalvar,
  aoErrar,
}: {
  recebimento: Recebimento | null;
  pacientes: ValorDoPaciente[];
  aoFechar: () => void;
  aoSalvar: () => void | Promise<void>;
  aoErrar: (m: string) => void;
}) {
  const [valor, definirValor] = useState(
    recebimento ? String(recebimento.valor).replace(".", ",") : "",
  );
  const [descricao, definirDescricao] = useState(recebimento?.descricao ?? "");
  const [quando, definirQuando] = useState(recebimento?.data ?? hojeSaoPaulo());
  const [forma, definirForma] = useState<FormaDePagamento>(recebimento?.forma ?? "pix");
  const [paciente, definirPaciente] = useState(recebimento?.pacienteId ?? "");
  const [salvando, definirSalvando] = useState(false);

  async function salvar() {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      aoErrar("O valor precisa ser maior que zero.");
      return;
    }
    definirSalvando(true);
    try {
      await repositorio.registrarRecebimento(
        recebimento?.id ?? null,
        paciente || null,
        descricao.trim() || null,
        n,
        quando,
        forma,
        null,
      );
      aoFechar();
      await aoSalvar();
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <div className="c-bloco">
      <div className="c-duas-colunas">
        <Campo rotulo="Valor" dica="Em reais.">
          <Texto valor={valor} aoMudar={definirValor} placeholder="300,00" />
        </Campo>
        <Campo rotulo="Quando">
          <Texto valor={quando} aoMudar={definirQuando} placeholder="2026-09-22" />
        </Campo>
      </div>
      <Campo rotulo="Forma de pagamento">
        <Selecao
          valor={forma}
          aoMudar={(v) => definirForma(v as FormaDePagamento)}
          opcoes={FORMAS_DE_PAGAMENTO.map((f) => ({ valor: f.valor, rotulo: f.rotulo }))}
        />
      </Campo>
      <Campo
        rotulo="De quem (opcional)"
        dica="Deixe vazio quando não vier de paciente — palestra, material, consultoria."
      >
        <Selecao
          valor={paciente}
          aoMudar={definirPaciente}
          opcoes={[
            { valor: "", rotulo: "Não é de paciente" },
            ...pacientes.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
      </Campo>
      <Campo rotulo="O que foi (opcional)">
        <Texto valor={descricao} aoMudar={definirDescricao} placeholder="Pacote trimestral" />
      </Campo>
      <div className="c-chips">
        <button type="button" className="c-chip" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="c-chip" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
