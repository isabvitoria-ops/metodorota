import { useState } from "react";
import type {
  ExercicioParaSalvar,
  PermissaoDeTreino,
  Treino,
} from "@/central/types/treino";
import { repositorio } from "@/central/dados/repositorio";

/**
 * O treino escrito PELA PACIENTE.
 *
 * "Eu escrevo lá dentro o treino do paciente. Ou então ele mesmo pode
 * escrever, não precisa ser eu."
 *
 * Quem treina por conta própria, ou recebeu o treino de um professor de
 * fora, digita o dele aqui. Sem anexar arquivo, sem esperar ninguém.
 *
 * O QUE ESTA TELA NÃO FAZ, e é o motivo de ela ser tão curta:
 *
 *   * não monta treino, não sugere exercício, não propõe carga e não
 *     preenche faixa de repetição sozinha. Campo em branco fica em branco —
 *     inventar uma faixa aqui seria o aplicativo prescrevendo;
 *   * não deixa a paciente encostar no plano da nutricionista. Quando há
 *     plano prescrito ativo, esta tela vira um aviso e nada mais. A recusa
 *     de verdade é do banco (`salvar_treino`); o que está aqui é só a
 *     cortesia de não oferecer um botão que não funcionaria.
 */
const EXERCICIO_VAZIO: ExercicioParaSalvar = {
  nome: "",
  seriesPlanejadas: "",
  repeticoesMin: "",
  repeticoesMax: "",
  observacao: "",
};

export function MeuTreino({
  treino,
  permissao,
  aoMudar,
}: {
  treino: Treino | null;
  permissao: PermissaoDeTreino | null;
  aoMudar: () => Promise<void>;
}) {
  const [editando, definirEditando] = useState(false);

  if (editando) {
    return (
      <Editor
        treino={treino && treino.podeEditar ? treino : null}
        aoFechar={() => definirEditando(false)}
        aoSalvar={async () => {
          definirEditando(false);
          await aoMudar();
        }}
      />
    );
  }

  // Plano da nutricionista no ar: ela lê, e só. O treino próprio que ela
  // tenha escrito antes não foi apagado — dizer isso importa, porque sumir
  // da tela sem explicação parece perda de dado.
  if (treino && !treino.podeEditar) {
    return (
      <section className="c-secao">
        <p className="c-dica">
          Este treino foi montado pela sua nutricionista, então ele não é editado por aqui. Se
          algo estiver diferente do que você faz, fale com ela.
        </p>
        {permissao?.meuTreinoId && (
          <p className="c-dica">
            O treino que você tinha escrito continua guardado, e volta assim que este sair.
          </p>
        )}
      </section>
    );
  }

  if (treino?.podeEditar) {
    return (
      <section className="c-secao">
        <p className="c-dica">Este treino foi escrito por você.</p>
        <div className="c-linha-botoes-treino">
          <button type="button" className="c-botao c-botao-secundario" onClick={() => definirEditando(true)}>
            Editar meu treino
          </button>
          <Apagar treino={treino} aoMudar={aoMudar} />
        </div>
      </section>
    );
  }

  // A aba não foi liberada para ela. Na prática ela nem chega aqui — o
  // atalho não aparece e o banco devolve vazio —, mas quem digitar o
  // endereço na mão merece uma frase em vez de uma tela muda.
  if (permissao?.motivo === "nao_liberado") {
    return (
      <section className="c-secao">
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">A área de treino não está liberada para você</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            Fale com a sua nutricionista se quiser acompanhar treino por aqui.
          </p>
        </div>
      </section>
    );
  }

  if (permissao?.pode) {
    return (
      <section className="c-secao">
        <h2 className="c-secao-titulo">Meu treino</h2>
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">Você ainda não tem um treino aqui</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            Escreva o treino que você já faz — o que seu professor passou, ou o que você segue
            por conta. O aplicativo não monta treino nem sugere peso: ele guarda o seu, e mostra
            a sua evolução sessão a sessão.
          </p>
          <button
            type="button"
            className="c-botao"
            style={{ marginTop: 12 }}
            onClick={() => definirEditando(true)}
          >
            Escrever meu treino
          </button>
        </div>
      </section>
    );
  }

  return null;
}

function Apagar({ treino, aoMudar }: { treino: Treino; aoMudar: () => Promise<void> }) {
  const [confirmando, definirConfirmando] = useState(false);
  const [apagando, definirApagando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <button
        type="button"
        className="c-botao c-botao-secundario"
        onClick={() => definirConfirmando(true)}
      >
        Apagar
      </button>
    );
  }

  return (
    <>
      {/* O que se perde é dito ANTES, não depois: o histórico de sessões
          fica, e quem não sabe disso não apaga com medo de perder meses. */}
      <span className="c-dica">
        Apagar o treino não apaga o que você já registrou. Apagar mesmo?
      </span>
      <button
        type="button"
        className="c-botao c-botao-perigo c-botao-pequeno"
        disabled={apagando}
        onClick={async () => {
          definirApagando(true);
          definirAviso(null);
          try {
            await repositorio.excluirTreino(treino.id);
            await aoMudar();
          } catch (e) {
            definirAviso(e instanceof Error ? e.message : "Não consegui apagar.");
            definirApagando(false);
          }
        }}
      >
        {apagando ? "Apagando…" : "Sim, apagar"}
      </button>
      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        onClick={() => definirConfirmando(false)}
      >
        Não
      </button>
      {aviso && <p className="c-aviso">{aviso}</p>}
    </>
  );
}

function Editor({
  treino,
  aoFechar,
  aoSalvar,
}: {
  treino: Treino | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [nome, definirNome] = useState(treino?.nome ?? "Meu treino");
  const [observacao, definirObservacao] = useState(treino?.observacao ?? "");
  const [exercicios, definirExercicios] = useState<ExercicioParaSalvar[]>(() =>
    treino && treino.exercicios.length > 0
      ? treino.exercicios.map((e) => ({
          nome: e.nome,
          seriesPlanejadas: e.seriesPlanejadas === null ? "" : String(e.seriesPlanejadas),
          repeticoesMin: e.repeticoesMin === null ? "" : String(e.repeticoesMin),
          repeticoesMax: e.repeticoesMax === null ? "" : String(e.repeticoesMax),
          observacao: e.observacao ?? "",
        }))
      : [{ ...EXERCICIO_VAZIO }],
  );
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  const mudar = (i: number, campo: keyof ExercicioParaSalvar, valor: string) =>
    definirExercicios((antes) => antes.map((e, j) => (i === j ? { ...e, [campo]: valor } : e)));

  async function salvar() {
    // Linha em branco não vira exercício — viraria um exercício sem nome na
    // tela de registro, e ela escolheria "—" na lista.
    const limpos = exercicios.filter((e) => e.nome.trim() !== "");
    if (limpos.length === 0) {
      definirAviso("Escreva pelo menos um exercício.");
      return;
    }
    definirSalvando(true);
    definirAviso(null);
    try {
      // `null` no lugar do paciente: é sempre o treino de quem está logado.
      // O banco ignora esse campo para a paciente de qualquer forma — mandar
      // um id aqui não escreveria na ficha de ninguém.
      await repositorio.salvarTreino(treino?.id ?? null, null, nome, observacao, true, limpos);
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
      definirSalvando(false);
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{treino ? "Editar meu treino" : "Escrever meu treino"}</h2>
      <p className="c-dica">
        Escreva só o que você já sabe. Séries e repetições podem ficar em branco — sem eles o
        aplicativo continua registrando a sua evolução, só não avisa sobre topo de faixa.
      </p>

      <div className="c-bloco" style={{ marginTop: 12 }}>
        <label className="c-campo">
          <span>Nome do treino</span>
          <input
            type="text"
            value={nome}
            placeholder="Treino A — pernas"
            onChange={(e) => definirNome(e.target.value)}
          />
        </label>

        <label className="c-campo">
          <span>Observação (opcional)</span>
          <input
            type="text"
            value={observacao}
            placeholder="Segunda, quarta e sexta."
            onChange={(e) => definirObservacao(e.target.value)}
          />
        </label>
      </div>

      {exercicios.map((e, i) => (
        <div className="c-bloco" style={{ marginTop: 12 }} key={i}>
          <div className="c-bloco-topo">
            <strong>{e.nome.trim() || `Exercício ${i + 1}`}</strong>
            {exercicios.length > 1 && (
              <button
                type="button"
                className="c-botao c-botao-pequeno c-botao-secundario"
                onClick={() => definirExercicios((antes) => antes.filter((_, j) => j !== i))}
              >
                Tirar
              </button>
            )}
          </div>

          <label className="c-campo">
            <span>Exercício</span>
            <input
              type="text"
              value={e.nome}
              placeholder="Agachamento"
              onChange={(ev) => mudar(i, "nome", ev.target.value)}
            />
          </label>

          <div className="c-duas-colunas">
            <label className="c-campo">
              <span>Séries</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="—"
                value={e.seriesPlanejadas}
                onChange={(ev) => mudar(i, "seriesPlanejadas", ev.target.value)}
              />
            </label>
            <label className="c-campo">
              <span>Repetições</span>
              <div className="c-faixa-repeticoes">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="de"
                  aria-label="Repetições, de"
                  value={e.repeticoesMin}
                  onChange={(ev) => mudar(i, "repeticoesMin", ev.target.value)}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="até"
                  aria-label="Repetições, até"
                  value={e.repeticoesMax}
                  onChange={(ev) => mudar(i, "repeticoesMax", ev.target.value)}
                />
              </div>
            </label>
          </div>

          <label className="c-campo">
            <span>Observação (opcional)</span>
            <input
              type="text"
              value={e.observacao}
              placeholder="Sem descer demais."
              onChange={(ev) => mudar(i, "observacao", ev.target.value)}
            />
          </label>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario"
        style={{ marginTop: 10 }}
        onClick={() => definirExercicios((antes) => [...antes, { ...EXERCICIO_VAZIO }])}
      >
        + Outro exercício
      </button>

      {aviso && <p className="c-aviso">{aviso}</p>}

      <div className="c-linha-botoes-treino" style={{ marginTop: 14 }}>
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar meu treino"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
