import { useCallback, useEffect, useState } from "react";
import type { Paciente } from "@/central/types";
import type {
  CardioSessao,
  ExercicioParaSalvar,
  MetaSemanal,
  SessaoDeTreino,
  TipoDeMeta,
  Treino,
} from "@/central/types/treino";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto } from "@/central/admin/componentes/Campos";
import { EvolucaoTreino } from "@/central/components/EvolucaoTreino";
import { PainelDeTreino } from "@/central/components/PainelDeTreino";
import { hojeSaoPaulo, dataBonita } from "@/central/utils/situacao";
import { domingoDaSemana, segundaDaSemana } from "@/central/utils/metasSemanais";

/**
 * Treino — área da nutricionista.
 *
 * Ela escreve o PLANO: exercício, quantas séries, a faixa de repetições. E
 * lê a EVOLUÇÃO: o que a paciente registrou, sessão a sessão, com o que
 * mudou entre elas.
 *
 * A tela não prescreve nada, e não é para prescrever: a nutricionista não é
 * personal trainer, e o treino chega pronto de quem o montou. O que o
 * aplicativo faz é estruturar e acompanhar a execução.
 *
 * Por que o plano é editado como uma LISTA e salvo de uma vez: é assim que
 * ela lê um treino no papel, de cima para baixo. Salvar exercício a
 * exercício deixaria o plano pela metade se a conexão caísse no meio.
 */
export function Treinos() {
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [escolhida, definirEscolhida] = useState("");
  const [busca, definirBusca] = useState("");

  useEffect(() => {
    void repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch(() => definirPacientes([]));
  }, []);

  const visiveis = pacientes.filter((p) =>
    busca.trim() ? p.nome.toLowerCase().includes(busca.trim().toLowerCase()) : true,
  );
  const paciente = pacientes.find((p) => p.id === escolhida) ?? null;

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          Treino e evolução
        </h1>
        <p className="c-subtitulo">
          O treino chega pronto de quem o montou; aqui ele vira estrutura, e a paciente
          registra o que fez. O aplicativo não prescreve exercício nem sugere carga.
        </p>
      </div>

      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>

      <Campo rotulo="Paciente">
        <Selecao
          valor={escolhida}
          aoMudar={definirEscolhida}
          opcoes={[
            { valor: "", rotulo: "Escolha a paciente" },
            ...visiveis.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
      </Campo>

      {paciente && (
        /* `key` pelo id, pelo mesmo motivo do protocolo: sem ela, trocar de
           paciente com a tela aberta deixaria o rascunho de uma aparecendo
           no lugar do da outra — e salvar gravaria o treino errado na ficha
           errada. */
        <PainelDoTreino key={paciente.id} paciente={paciente} />
      )}
    </>
  );
}

function PainelDoTreino({ paciente }: { paciente: Paciente }) {
  const [aba, definirAba] = useState<"plano" | "metas" | "painel" | "evolucao">("plano");
  const [treinos, definirTreinos] = useState<Treino[]>([]);
  const [carregando, definirCarregando] = useState(true);

  const carregar = useCallback(async () => {
    definirTreinos(await repositorio.treinosDoPaciente(paciente.id).catch(() => []));
    definirCarregando(false);
  }, [paciente.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <>
      <div className="c-admin-abas" style={{ marginTop: 16, marginBottom: 4 }}>
        <button
          type="button"
          className={`c-admin-aba ${aba === "plano" ? "ativo" : ""}`}
          onClick={() => definirAba("plano")}
        >
          Plano de treino
        </button>
        <button
          type="button"
          className={`c-admin-aba ${aba === "metas" ? "ativo" : ""}`}
          onClick={() => definirAba("metas")}
        >
          Metas da semana
        </button>
        <button
          type="button"
          className={`c-admin-aba ${aba === "painel" ? "ativo" : ""}`}
          onClick={() => definirAba("painel")}
        >
          Painel
        </button>
        <button
          type="button"
          className={`c-admin-aba ${aba === "evolucao" ? "ativo" : ""}`}
          onClick={() => definirAba("evolucao")}
        >
          Sessão a sessão
        </button>
      </div>

      {/* As duas ficam montadas, só uma aparece — como no protocolo.
          Desmontar a do plano ao ir para a evolução jogaria fora o que ela
          acabou de escrever. */}
      <div hidden={aba !== "plano"}>
        {carregando ? (
          <p className="c-dica">Carregando…</p>
        ) : (
          <EditorDoPlano
            paciente={paciente}
            treinos={treinos}
            aoMudar={() => void carregar()}
          />
        )}
      </div>

      <div hidden={aba !== "metas"}>
        <MetasDaSemana key={paciente.id} paciente={paciente} />
      </div>

      <div hidden={aba !== "painel"}>
        <Painel key={paciente.id} pacienteId={paciente.id} />
      </div>

      <div hidden={aba !== "evolucao"}>
        <EvolucaoTreino key={paciente.id} pacienteId={paciente.id} />
      </div>
    </>
  );
}

const EXERCICIO_VAZIO: ExercicioParaSalvar = {
  nome: "",
  seriesPlanejadas: "",
  repeticoesMin: "",
  repeticoesMax: "",
  observacao: "",
};

function EditorDoPlano({
  paciente,
  treinos,
  aoMudar,
}: {
  paciente: Paciente;
  treinos: Treino[];
  aoMudar: () => void;
}) {
  const ativo = treinos.find((t) => t.ativo) ?? null;

  const [id, definirId] = useState<string | null>(ativo?.id ?? null);
  const [nome, definirNome] = useState(ativo?.nome ?? "Treino A");
  const [observacao, definirObservacao] = useState(ativo?.observacao ?? "");
  const [exercicios, definirExercicios] = useState<ExercicioParaSalvar[]>(() =>
    ativo ? deTreino(ativo) : [{ ...EXERCICIO_VAZIO }],
  );
  const [salvando, definirSalvando] = useState(false);
  const [estado, definirEstado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const mudar = (i: number, campo: keyof ExercicioParaSalvar, valor: string) =>
    definirExercicios((antes) => antes.map((e, j) => (i === j ? { ...e, [campo]: valor } : e)));

  const salvar = async () => {
    // Exercício sem nome não vira exercício: é o que sobra de uma linha em
    // branco, e viraria um exercício fantasma no treino dela.
    const limpos = exercicios.filter((e) => e.nome.trim() !== "");
    if (limpos.length === 0) {
      definirErro("Escreva pelo menos um exercício.");
      return;
    }
    definirSalvando(true);
    definirErro(null);
    try {
      await repositorio.salvarTreino(id, paciente.id, nome, observacao, true, limpos);
      definirEstado("Treino salvo e ativo. Ela já vê na tela dela.");
      aoMudar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  };

  const trocarDeTreino = (novoId: string) => {
    const t = treinos.find((x) => x.id === novoId);
    definirId(t?.id ?? null);
    definirNome(t?.nome ?? "Treino novo");
    definirObservacao(t?.observacao ?? "");
    definirExercicios(t ? deTreino(t) : [{ ...EXERCICIO_VAZIO }]);
    definirEstado(null);
  };

  return (
    <>
      {treinos.length > 0 && (
        <Campo rotulo="Treino">
          <Selecao
            valor={id ?? ""}
            aoMudar={trocarDeTreino}
            opcoes={[
              ...treinos.map((t) => ({
                valor: t.id,
                rotulo: `${t.nome}${t.ativo ? " — ativo" : ""}`,
              })),
              { valor: "", rotulo: "+ Montar um treino novo" },
            ]}
          />
        </Campo>
      )}

      <Campo rotulo="Nome do treino">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Treino A — inferiores" />
      </Campo>

      <Campo rotulo="Observação (opcional)" dica="Aparece no topo da tela dela.">
        <Texto valor={observacao} aoMudar={definirObservacao} placeholder="Aquecer 5 min antes." />
      </Campo>

      <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Exercícios
      </h2>
      <p className="c-dica" style={{ marginTop: -4 }}>
        Séries e faixa de repetições são o que veio do treino dela. Deixe a faixa em branco se
        não houver — sem faixa, o aplicativo não avisa sobre topo de faixa.
      </p>

      {exercicios.map((e, i) => (
        <div className="c-bloco" key={i}>
          <div className="c-bloco-topo">
            <strong>{e.nome.trim() || `Exercício ${i + 1}`}</strong>
            <button
              type="button"
              className="c-botao c-botao-pequeno c-botao-perigo"
              onClick={() => definirExercicios((antes) => antes.filter((_, j) => j !== i))}
            >
              Tirar
            </button>
          </div>

          <Campo rotulo="Nome">
            <Texto valor={e.nome} aoMudar={(v) => mudar(i, "nome", v)} placeholder="Agachamento" />
          </Campo>

          <div className="c-linha-medidas">
            <Campo rotulo="Séries">
              <Texto valor={e.seriesPlanejadas} aoMudar={(v) => mudar(i, "seriesPlanejadas", v)} />
            </Campo>
            <Campo rotulo="Repetições de">
              <Texto valor={e.repeticoesMin} aoMudar={(v) => mudar(i, "repeticoesMin", v)} />
            </Campo>
            <Campo rotulo="até">
              <Texto valor={e.repeticoesMax} aoMudar={(v) => mudar(i, "repeticoesMax", v)} />
            </Campo>
          </div>

          <Campo rotulo="Observação (opcional)">
            <Texto valor={e.observacao} aoMudar={(v) => mudar(i, "observacao", v)} />
          </Campo>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario"
        style={{ marginTop: 10 }}
        onClick={() => definirExercicios((antes) => [...antes, { ...EXERCICIO_VAZIO }])}
      >
        + Acrescentar exercício
      </button>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {estado && !erro && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{estado}</span>
        </div>
      )}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar e ativar"}
        </button>
        {id && (
          <button
            type="button"
            className="c-botao c-botao-perigo"
            onClick={() => {
              if (!window.confirm(`Apagar o treino "${nome}"?`)) return;
              void repositorio.excluirTreino(id).then(() => {
                definirId(null);
                definirExercicios([{ ...EXERCICIO_VAZIO }]);
                definirEstado("Treino apagado. As sessões que ela registrou continuam lá.");
                aoMudar();
              });
            }}
          >
            Apagar este treino
          </button>
        )}
      </div>
    </>
  );
}

function deTreino(t: Treino): ExercicioParaSalvar[] {
  const texto = (v: number | null) => (v === null ? "" : String(v));
  return t.exercicios.map((e) => ({
    nome: e.nome,
    seriesPlanejadas: texto(e.seriesPlanejadas),
    repeticoesMin: texto(e.repeticoesMin),
    repeticoesMax: texto(e.repeticoesMax),
    observacao: e.observacao ?? "",
  }));
}

/**
 * As metas da semana — e elas são decisão DELA.
 *
 * O aplicativo não cria meta, não ajusta e não sugere. "4 treinos por
 * semana" é clínico, tomado olhando para a paciente; uma barra cheia na
 * tela da paciente não vira "aumente para 5" em lugar nenhum.
 *
 * A SEMANA É SEMPRE A SEGUNDA. Quem define numa quarta e ajusta na quinta
 * está falando da MESMA semana, e sem normalizar viravam duas — a tela da
 * paciente mostraria "3/4" e "3/5" lado a lado, e nenhuma seria a resposta.
 * O banco normaliza também; aqui é só para a tela dizer a data certa antes
 * de salvar.
 */
function MetasDaSemana({ paciente }: { paciente: Paciente }) {
  const hoje = hojeSaoPaulo();
  const [semana, definirSemana] = useState(segundaDaSemana(hoje));
  const [metas, definirMetas] = useState<MetaSemanal[]>([]);
  const [treino, definirTreino] = useState("");
  const [cardio, definirCardio] = useState("");
  const [estado, definirEstado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const lista = await repositorio.metasSemanais(paciente.id).catch(() => []);
    definirMetas(lista);
  }, [paciente.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Os campos acompanham a semana escolhida: trocar de semana sem isso
  // deixaria na tela o alvo da semana anterior, e salvar o copiaria para a
  // nova sem ela perceber.
  useEffect(() => {
    const daSemana = metas.filter((m) => segundaDaSemana(m.semanaInicio) === semana);
    definirTreino(String(daSemana.find((m) => m.tipo === "treino")?.alvo ?? ""));
    definirCardio(String(daSemana.find((m) => m.tipo === "cardio")?.alvo ?? ""));
    definirEstado(null);
  }, [metas, semana]);

  async function guardar(tipo: TipoDeMeta, alvo: string, unidade: string) {
    if (alvo.trim() === "") return;
    definirSalvando(true);
    definirErro(null);
    try {
      await repositorio.definirMetaSemanal(paciente.id, semana, tipo, alvo, unidade);
      await carregar();
      definirEstado("Meta salva. Ela já vê na tela dela.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  const semanas = ultimasSemanas(hoje, 6);

  return (
    <>
      <Campo rotulo="Semana" dica="A semana vai de segunda a domingo.">
        <Selecao
          valor={semana}
          aoMudar={definirSemana}
          opcoes={semanas.map((s) => ({
            valor: s,
            rotulo:
              `${dataBonita(s)} a ${dataBonita(domingoDaSemana(s))}` +
              (s === segundaDaSemana(hoje) ? " — esta semana" : ""),
          }))}
        />
      </Campo>

      <div className="c-bloco">
        <div className="c-bloco-topo">
          <strong>Treino de força</strong>
        </div>
        <Campo rotulo="Quantos treinos nesta semana" dica="Deixe em branco para não ter meta.">
          <Texto valor={treino} aoMudar={definirTreino} />
        </Campo>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          disabled={salvando || treino.trim() === ""}
          onClick={() => void guardar("treino", treino, "treinos")}
        >
          Salvar a meta de treino
        </button>
      </div>

      <div className="c-bloco">
        <div className="c-bloco-topo">
          <strong>Cardio</strong>
        </div>
        {/* MINUTOS, e não sessões: contar sessão diria que três caminhadas
            de dez minutos valem o mesmo que três de trinta. */}
        <Campo rotulo="Quantos minutos nesta semana" dica="Somados: três de 30 fecham 90.">
          <Texto valor={cardio} aoMudar={definirCardio} />
        </Campo>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          disabled={salvando || cardio.trim() === ""}
          onClick={() => void guardar("cardio", cardio, "minutos")}
        >
          Salvar a meta de cardio
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {estado && !erro && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{estado}</span>
        </div>
      )}

      <p className="c-dica" style={{ marginTop: 14 }}>
        O progresso é contado sozinho, do que ela registrar. Você não precisa voltar aqui para
        marcar nada — e apagar um registro por engano não deixa o contador travado, porque ele
        não é guardado: é contado na hora.
      </p>
    </>
  );
}

/** As últimas N segundas, da mais nova para a mais antiga. */
function ultimasSemanas(hoje: string, quantas: number): string[] {
  const inicio = segundaDaSemana(hoje);
  return Array.from({ length: quantas }, (_, i) => {
    const d = new Date(`${inicio}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * O painel carrega o seu próprio dado.
 *
 * Poderia receber pronto de cima, mas aí a aba "Sessão a sessão" e esta
 * estariam sempre buscando as duas coisas juntas, e quem só abre o plano
 * pagaria por três consultas que não vai ver.
 */
function Painel({ pacienteId }: { pacienteId: string }) {
  const [treinos, definirTreinos] = useState<SessaoDeTreino[]>([]);
  const [cardio, definirCardio] = useState<CardioSessao[]>([]);
  const [metas, definirMetas] = useState<MetaSemanal[]>([]);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void Promise.all([
      repositorio.sessoesDeTreino(pacienteId).catch(() => []),
      repositorio.sessoesDeCardio(pacienteId).catch(() => []),
      repositorio.metasSemanais(pacienteId).catch(() => []),
    ]).then(([t, c, m]) => {
      if (!vivo) return;
      definirTreinos(t);
      definirCardio(c);
      definirMetas(m);
      definirCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  if (carregando) return <p className="c-dica">Carregando…</p>;
  return <PainelDeTreino treinos={treinos} cardio={cardio} metas={metas} />;
}
