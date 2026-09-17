import { useState } from "react";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { faixaDaIntensidade, rotuloSintoma, status as infoStatus, temSintoma } from "@/central/utils/reintroducao";
import { classificar, fraseDo } from "@/central/utils/rastreio";
import { dataBonita } from "@/central/utils/situacao";

/**
 * Rastreio Alimentar — o material que a paciente vai juntando.
 *
 * Ele se monta sozinho a cada registro: não espera fechar semana, não espera
 * fechar mês. O alimento aparece aqui no dia em que foi testado, e a lista
 * vai engordando — que é o que ela pediu para conseguir enxergar problema no
 * primeiro dia, e não daqui a um mês.
 *
 * COMO A COR SAI (regra dela, 17/09):
 *
 *   * 0 ponto        → verde,    "Bem tolerado";
 *   * 1 ou 2 pontos  → amarelo,  "Comer com atenção";
 *   * 3 ou mais      → vermelho, "Não tolerado".
 *
 * Cada sintoma DIFERENTE vale um ponto, somando todos os testes daquele
 * alimento — e cinco deles valem dois, por serem mais intensos (ver
 * `PESO_DOBRADO`).
 *
 * E a classificação dela ganha da conta, sempre. Quando a nutricionista
 * classifica o alimento na área dela, é aquilo que a paciente lê — a conta
 * serve só enquanto ninguém olhou.
 *
 * A REGRA DE LINGUAGEM continua valendo:
 *
 *   * a frase embaixo do nome é fato registrado — "você relatou gases e
 *     distensão" —, nunca diagnóstico sobre a pessoa. Em lugar nenhum
 *     aparece "você é intolerante" ou "esse alimento faz mal a você";
 *   * amarelo não quer dizer "corta", quer dizer "coma com atenção". A
 *     mensagem fixa no topo existe para isso não ficar só implícito.
 */

type Filtro = "todos" | "bom" | "atencao" | "grave";

interface Linha {
  item: ItemDeReintroducao;
  registros: RegistroDeReintroducao[];
  tom: "bom" | "atencao" | "grave" | "neutro" | "apagado";
  rotulo: string;
  frase: string;
}

function montarLinhas(
  itens: ItemDeReintroducao[],
  registros: RegistroDeReintroducao[],
): Linha[] {
  return itens
    .map((item) => {
      const meus = registros
        .filter((r) => r.itemId === item.id)
        .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? 1 : -1));
      return { item, meus };
    })
    // Só entra o que já foi testado: o rastreio é o que aconteceu, e uma
    // lista de alimentos ainda não testados seria cobrança disfarçada.
    .filter(({ meus }) => meus.length > 0)
    .map(({ item, meus }) => {
      const classificado = item.status !== "em_teste" && item.status !== "nao_iniciado";
      const info = infoStatus(item.status);
      const automatico = classificar(meus);
      return {
        item,
        registros: meus,
        // A classificação dela ganha da conta. A conta vale enquanto ela
        // ainda não olhou aquele alimento.
        tom: classificado ? info.tom : automatico.tom,
        rotulo: classificado ? info.paciente : automatico.rotulo,
        frase: fraseDo(meus),
      };
    })
    .sort((a, b) => a.item.nome.localeCompare(b.item.nome, "pt-BR"));
}

/**
 * Os blocos do material, na ordem em que ela quer ler: verde, amarelo,
 * vermelho, e no fim o que ela mesma classificou fora dessa escada.
 *
 * Agrupar foi pedido dela depois de gerar o primeiro PDF: com os alimentos
 * um atrás do outro, uma folha com trinta linhas misturadas não responde
 * "o que eu tolero?" — que é a pergunta que a paciente leva para a consulta.
 */
const GRUPOS: { tom: Linha["tom"]; titulo: string; apoio: string }[] = [
  {
    tom: "bom",
    titulo: "Bem tolerados",
    apoio: "Você testou e não relatou sintomas.",
  },
  {
    tom: "atencao",
    titulo: "Comer com atenção",
    apoio:
      "Pouco tolerados: houve alguma resposta do corpo que vale observar. Não quer dizer cortar.",
  },
  {
    tom: "grave",
    titulo: "Não tolerados",
    // Ela pediu, com estas palavras: "adiciona algo para ele saber que se
    // quiser comer, come, mas tem consequências — de um jeito sutil". A
    // frase diz isso sem mandar e sem ameaçar: a escolha é da paciente, e o
    // rastreio existe para ela escolher sabendo.
    apoio:
      "Foram relatados três ou mais sintomas depois destes. Comer continua sendo escolha sua — " +
      "o rastreio serve para você saber o que costuma vir junto.",
  },
  { tom: "neutro", titulo: "Outros", apoio: "" },
  { tom: "apagado", titulo: "Fora da sua alimentação", apoio: "" },
];

const CLASSE_DO_TOM: Record<Linha["tom"], string> = {
  bom: "melhor",
  atencao: "boa",
  grave: "ocasional",
  neutro: "neutro",
  apagado: "neutro",
};

export function RastreioAlimentar({
  itens,
  registros,
  nome,
}: {
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
  nome: string | null;
}) {
  const [filtro, definirFiltro] = useState<Filtro>("todos");
  const [aberto, definirAberto] = useState<string | null>(null);

  const linhas = montarLinhas(itens, registros);
  if (linhas.length === 0) {
    return (
      <section className="c-secao">
        <h2 className="c-secao-titulo">Meu rastreio alimentar</h2>
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">Seu rastreio começa aqui</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            Conforme você testa novos alimentos, vamos registrando como seu corpo responde a cada
            um deles. O primeiro registro já aparece nesta lista.
          </p>
        </div>
      </section>
    );
  }

  const visiveis = linhas.filter((l) => filtro === "todos" || l.tom === filtro);
  const quantos = (tom: Linha["tom"]) => linhas.filter((l) => l.tom === tom).length;

  return (
    <section className="c-secao c-rastreio">
      <h2 className="c-secao-titulo">Meu rastreio alimentar</h2>

      <p className="c-dica">
        Esta lista não é de alimentos proibidos. Ela mostra como seu corpo respondeu ao que você
        já testou, para você escolher com mais consciência. Nenhum alimento aqui está cortado:
        se quiser comer, você come — o rastreio existe para que você saiba o que pode vir depois.
      </p>

      <div className="c-chips" style={{ marginTop: 12 }}>
        {(
          [
            ["todos", `Todos (${linhas.length})`],
            ["bom", `Bem tolerados (${quantos("bom")})`],
            ["atencao", `Com atenção (${quantos("atencao")})`],
            ["grave", `Não tolerados (${quantos("grave")})`],
          ] as [Filtro, string][]
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            className="c-chip"
            aria-pressed={filtro === chave}
            onClick={() => definirFiltro(chave)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {GRUPOS.map(({ tom, titulo, apoio }) => {
        const doGrupo = visiveis.filter((l) => l.tom === tom);
        if (doGrupo.length === 0) return null;
        return (
          <div key={tom} className="c-rastreio-grupo">
            <h3 className="c-rastreio-grupo-titulo">
              <span className={`c-selo ${CLASSE_DO_TOM[tom]}`}>{titulo}</span>
              <span className="c-rastreio-grupo-conta">
                {doGrupo.length} {doGrupo.length === 1 ? "alimento" : "alimentos"}
              </span>
            </h3>
            {apoio && <p className="c-rastreio-grupo-apoio">{apoio}</p>}

            <div className="c-bloco" style={{ marginTop: 8 }}>
              {doGrupo.map((linha) => (
                <div className="c-rastreio-item" key={linha.item.id}>
                  <button
                    type="button"
                    className="c-rastreio-toque"
                    aria-expanded={aberto === linha.item.id}
                    onClick={() => definirAberto(aberto === linha.item.id ? null : linha.item.id)}
                  >
                    <span className="c-item-protocolo-nome">{linha.item.nome}</span>
                    <span className="c-rastreio-frase">{linha.frase}</span>
                  </button>

                  {/* O detalhe é sempre montado e escondido por CSS, nunca
                      removido. É o que faz o PDF sair completo: no papel não
                      há como tocar para abrir, e um rastreio salvo pela
                      metade não serviria para levar à consulta. */}
                  <div
                    className={`c-rastreio-detalhe ${aberto === linha.item.id ? "" : "fechado"}`}
                  >
                    {linha.registros.map((r) => (
                      <div key={r.id} className="c-rastreio-teste">
                        <p className="c-rastreio-data">
                          {dataBonita(r.data)}
                          {r.quantidade ? ` · ${r.quantidade}` : ""}
                          {r.preparo ? ` · ${r.preparo}` : ""}
                        </p>
                        <p className="c-rastreio-sintomas">
                          {temSintoma(r)
                            ? r.sintomas
                                .filter((x) => x !== "nenhum")
                                .map(rotuloSintoma)
                                .join(" · ")
                            : "Sem sintomas"}
                          {temSintoma(r) && r.intensidade
                            ? ` — intensidade ${faixaDaIntensidade(r.intensidade)}`
                            : ""}
                        </p>
                        {r.observacao && (
                          <p className="c-rastreio-observacao">{r.observacao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Guardar o material: sem biblioteca de PDF e sem servidor. A janela
          de impressão do próprio aparelho vira PDF em qualquer celular ou
          computador, e isso continua custando zero com dez ou com mil
          pacientes — que foi a preocupação dela. */}
      <button
        type="button"
        className="c-botao c-botao-secundario c-sem-impressao"
        style={{ width: "100%", marginTop: 14 }}
        onClick={() => window.print()}
      >
        Salvar meu rastreio em PDF
      </button>
      <p className="c-dica c-sem-impressao">
        No iPhone, escolha “Salvar em Arquivos” na tela que abrir. No computador, “Salvar como
        PDF”.
      </p>

      {/* Só aparece no papel: identifica de quem é a folha. */}
      <p className="c-so-impressao">
        Rastreio alimentar{nome ? ` de ${nome}` : ""} · {dataBonita(new Date().toISOString().slice(0, 10))}
      </p>
    </section>
  );
}
