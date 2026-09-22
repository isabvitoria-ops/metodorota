import { useState } from "react";
import type { Meta } from "@/central/types/meta";
import { repositorio } from "@/central/dados/repositorio";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import {
  historico,
  progressoNoPeriodo,
  resumoDoProgresso,
  sequencia,
} from "@/central/utils/progressoMetas";

/**
 * Uma meta, do jeito que a paciente vê.
 *
 * A barra, o número e o rodapé são os MESMOS de `PainelDaSemana` — mesma
 * classe, mesmo desenho. Duas barras de progresso diferentes na mesma tela
 * fariam parecer que medem coisas diferentes.
 *
 * A TELA NÃO JULGA. Barra baixa não vira alerta, não fica vermelha e não
 * ganha texto de cobrança. Ela diz quanto foi feito e quanto era o alvo;
 * quem interpreta é a profissional, na consulta.
 */
export function CartaoDeMeta({
  meta,
  aoMudar,
  somenteLeitura,
}: {
  meta: Meta;
  aoMudar: () => Promise<void>;
  /** Na tela da nutricionista, ela lê o progresso e não marca por aqui. */
  somenteLeitura?: boolean;
}) {
  const hoje = hojeSaoPaulo();
  const p = progressoNoPeriodo(meta, hoje);
  const seguidos = sequencia(meta, hoje);
  const ultimos = historico(meta, hoje, meta.frequencia === "semanal" ? 6 : 7);
  const [aberto, definirAberto] = useState(false);

  const periodo = meta.frequencia === "semanal" ? "desta semana" : "de hoje";

  return (
    <div className="c-bloco c-meta">
      <div className="c-meta-topo">
        <span className="c-meta-nome">{meta.titulo}</span>
        <span className="c-meta-numero">{resumoDoProgresso(p, meta.unidade)}</span>
      </div>

      <div className="c-meta-barra" role="img" aria-label={`${p.percentual}% da meta ${periodo}`}>
        <span style={{ width: `${p.percentual}%` }} />
      </div>

      <p className="c-meta-rodape">
        {p.cumprida ? `Meta ${periodo} cumprida.` : `${p.percentual}% da meta ${periodo}.`}
        {/* A sequência só aparece a partir de dois: "1 dia seguido" não é
            sequência, é um dia. */}
        {seguidos >= 2 && ` ${seguidos} ${meta.frequencia === "semanal" ? "semanas" : "dias"} seguidos.`}
      </p>

      {meta.descricao && <p className="c-meta-rodape">{meta.descricao}</p>}

      {meta.status !== "ativa" && (
        <p className="c-meta-rodape">
          {meta.status === "pausada"
            ? "Esta meta está pausada pela sua nutricionista."
            : meta.status === "concluida"
              ? "Meta concluída."
              : "Meta encerrada."}
        </p>
      )}

      {/* Os últimos sete períodos em quadradinhos: é a MESMA régua da
          consistência do treino — mesma classe, mesmo tamanho, mesma cor —
          e é o que mostra o buraco de três dias que um número sozinho
          esconde.

          Sempre sete, mesmo que alguns fiquem vazios: uma régua que muda de
          tamanho a cada semana faz comparar uma semana com a outra deixar
          de funcionar de olho. */}
      <div className="c-consistencia" aria-hidden="true" style={{ marginTop: 10 }}>
        {[...ultimos].reverse().map((h) => (
          <span
            key={h.periodo.inicio}
            className={"c-dia" + (h.cumprida ? " c-dia-treino" : "")}
            title={h.periodo.inicio.split("-").reverse().join("/")}
          >
            {/* Na meta semanal o quadradinho fica sem letra: o número do dia
                da segunda-feira ("31", "07") não diz nada sobre a semana e
                só polui. O que informa ali é o quadrado estar cheio. */}
            {meta.frequencia === "diaria" ? letraDoDia(h.periodo.inicio) : ""}
          </span>
        ))}
      </div>

      <p className="c-meta-rodape">
        {ultimos.filter((h) => h.cumprida).length} de {ultimos.length}{" "}
        {meta.frequencia === "semanal" ? "semanas cumpridas" : "dias cumpridos"}.
      </p>

      {!somenteLeitura && meta.status === "ativa" && (
        <>
          {!aberto ? (
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              style={{ marginTop: 12 }}
              onClick={() => definirAberto(true)}
            >
              Marcar
            </button>
          ) : (
            <Marcar
              meta={meta}
              aoFechar={() => definirAberto(false)}
              aoSalvar={async () => {
                definirAberto(false);
                await aoMudar();
              }}
            />
          )}
        </>
      )}

      {meta.registros.length > 0 && (
        <p className="c-meta-rodape">
          Última marcação em {meta.registros[0]!.data.split("-").reverse().join("/")}.
        </p>
      )}
    </div>
  );
}

/**
 * A inicial do dia da semana daquela data.
 *
 * `T12:00:00Z` pelo motivo de sempre: com meia-noite, o fuso do navegador
 * dela (UTC−3) jogaria a data para o dia anterior e a semana inteira sairia
 * com a letra errada.
 */
function letraDoDia(dataIso: string): string {
  const d = new Date(`${dataIso}T12:00:00Z`);
  return ["D", "S", "T", "Q", "Q", "S", "S"][d.getUTCDay()] ?? "";
}

function Marcar({
  meta,
  aoFechar,
  aoSalvar,
}: {
  meta: Meta;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const hoje = hojeSaoPaulo();
  const [data, definirData] = useState(hoje);
  const [quantidade, definirQuantidade] = useState("");
  const [observacao, definirObservacao] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  async function salvar() {
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.registrarMeta(meta.id, data, quantidade, observacao);
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui marcar.");
      definirSalvando(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="c-duas-colunas">
        <label className="c-campo">
          <span>Quando</span>
          {/* `max` de hoje: o banco recusa data futura, e é melhor o
              calendário nem oferecer do que a mensagem de erro depois. */}
          <input type="date" value={data} max={hoje} onChange={(e) => definirData(e.target.value)} />
        </label>
        {meta.alvo !== null && (
          <label className="c-campo">
            <span>Quanto{meta.unidade ? ` (${meta.unidade})` : ""}</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="1"
              value={quantidade}
              onChange={(e) => definirQuantidade(e.target.value)}
            />
          </label>
        )}
      </div>

      <label className="c-campo">
        <span>Quer anotar alguma coisa? (opcional)</span>
        <input
          type="text"
          value={observacao}
          onChange={(e) => definirObservacao(e.target.value)}
        />
      </label>

      {aviso && <p className="c-aviso">{aviso}</p>}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Marcando…" : "Marcar"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
