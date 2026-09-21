import { useCallback, useEffect, useState } from "react";
import type {
  AlimentoDoMaterial,
  ItemDeReintroducao,
  Paciente,
  RegistroDeReintroducao,
  SintomaReintroducao,
  StatusReintroducao,
} from "@/central/types";
import { repositorio } from "@/central/dados/repositorio";
import { useReintroducao } from "@/central/hooks/useReintroducao";
import {
  BRISTOL,
  CATEGORIAS,
  SINTOMAS,
  STATUS,
  alimentosSemLigacao,
  buscarNoMapa,
  etapasDoMaterial,
  faixaDaIntensidade,
  inicioParaSemana,
  opcoesDeSemana,
  nivelPorExtenso,
  panoramaDeMarcadores,
  porSemana,
  rotuloSintoma,
  semanaEm,
  status as infoStatus,
  temSintoma,
  textoDaMarcacao,
} from "@/central/utils/reintroducao";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { Campo, Selecao, Texto, AreaTexto } from "./componentes/Campos";
import { Modal } from "./componentes/Modal";
import { RastreioAlimentar } from "@/central/components/RastreioAlimentar";

/**
 * Rastreabilidade alimentar — área da nutricionista.
 *
 * Três trabalhos: montar a lista daquela paciente, ler a linha do tempo dela
 * e classificar cada alimento.
 *
 * O painel mostra o que foi registrado e nada além disso. Ele não sugere
 * status, não marca alimento como problema por causa de um sintoma e não
 * calcula "tolerância". A leitura clínica é dela — o aplicativo só organiza o
 * que a paciente escreveu para que essa leitura seja possível.
 */
const ABAS = ["Linha do tempo", "Lista da paciente", "Acompanhamento"] as const;
type Aba = (typeof ABAS)[number];

export function RastreabilidadeAdmin() {
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [escolhida, definirEscolhida] = useState<string>("");
  const [busca, definirBusca] = useState("");
  const [aba, definirAba] = useState<Aba>("Linha do tempo");
  const [ligados, definirLigados] = useState<string[]>([]);
  const [erroLista, definirErroLista] = useState<string | null>(null);

  const carregarLigados = useCallback(async () => {
    definirLigados(await repositorio.rastreiosAtivos().catch(() => []));
  }, []);

  useEffect(() => {
    void repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch((e: unknown) =>
        definirErroLista(e instanceof Error ? e.message : "Não consegui carregar as pacientes."),
      );
    void carregarLigados();
  }, [carregarLigados]);

  const visiveis = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const paciente = pacientes.find((p) => p.id === escolhida) ?? null;

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          Rastreabilidade alimentar
        </h1>
        <p className="c-subtitulo">
          A lista é de cada paciente, e o ritmo também. Aqui você monta a lista dela, lê o que ela
          registrou e classifica cada alimento — o aplicativo não conclui nada sozinho.
        </p>
      </div>

      {erroLista && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erroLista}</span>
        </div>
      )}

      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>
      <p className="c-dica" style={{ marginTop: -4 }}>
        {ligados.length === 0
          ? "Nenhuma paciente com rastreio ligado ainda."
          : `${ligados.length} ${
              ligados.length === 1 ? "paciente está" : "pacientes estão"
            } com o rastreio ligado.`}
      </p>

      <Campo rotulo="Paciente">
        <Selecao
          valor={escolhida}
          aoMudar={definirEscolhida}
          opcoes={[
            { valor: "", rotulo: "Escolha a paciente" },
            ...visiveis.map((p) => ({
              valor: p.id,
              rotulo: ligados.includes(p.id) ? `${p.nome} · rastreio ligado` : p.nome,
            })),
          ]}
        />
      </Campo>

      {paciente && (
        <>
          <div className="c-admin-abas" style={{ marginTop: 16 }}>
            {ABAS.map((a) => (
              <button
                key={a}
                type="button"
                className={`c-admin-aba ${a === aba ? "ativo" : ""}`}
                onClick={() => definirAba(a)}
              >
                {a}
              </button>
            ))}
          </div>
          {/* `key` pelo id da paciente, e isso é correção de defeito, não
              enfeite. Sem ela o painel não remonta na troca: o campo de
              orientação continuaria com o texto da paciente anterior, e
              salvar gravaria o recado de uma na ficha da outra. A mesma
              armadilha que já apareceu em "Lançar pontos" — aqui ela
              custaria mais caro, porque a paciente lê esse texto. */}
          <PainelDaPaciente
            key={paciente.id}
            paciente={paciente}
            aba={aba}
            aoMudarRastreio={() => void carregarLigados()}
          />
        </>
      )}
    </>
  );
}

function PainelDaPaciente({
  paciente,
  aba,
  aoMudarRastreio,
}: {
  paciente: Paciente;
  aba: Aba;
  aoMudarRastreio: () => void;
}) {
  const { dados, carregando, erro, ocupado, comRecarga } = useReintroducao(paciente.id);
  const [lancando, definirLancando] = useState(false);
  // Carregado aqui e emprestado às três telas que precisam dele: a semana
  // (que não pode oferecer etapa que o material não tem), a lista e a
  // ligação ao Mapa.
  const [material, definirMaterial] = useState<AlimentoDoMaterial[]>([]);

  useEffect(() => {
    void repositorio
      .listarAlimentosDoMaterial()
      .then(definirMaterial)
      .catch(() => definirMaterial([]));
  }, []);

  if (carregando) return <p className="c-contagem">Carregando…</p>;

  const ativo = dados?.ativo ?? false;

  return (
    <div style={{ marginTop: 18 }}>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {/* O interruptor fica em cima de tudo e em toda aba: é a primeira coisa
          a conferir quando ela achar que "não apareceu para a paciente". */}
      <div className="c-bloco" style={{ marginBottom: 14 }}>
        <div className="c-bloco-topo">
          <strong style={{ fontSize: 14 }}>
            {ativo
              ? `${paciente.nome} vê a Rastreabilidade`
              : `${paciente.nome} não vê a Rastreabilidade`}
          </strong>
          <button
            type="button"
            className={`c-botao c-botao-pequeno ${ativo ? "c-botao-secundario" : ""}`}
            disabled={ocupado}
            onClick={() =>
              void comRecarga(() =>
                repositorio.definirRastreioDoPaciente(paciente.id, !ativo),
              ).then((deuCerto) => {
                if (deuCerto) aoMudarRastreio();
              })
            }
          >
            {ativo ? "Desligar" : "Ligar para ela"}
          </button>
        </div>
        <p className="c-dica">
          {ativo
            ? "O atalho aparece na tela inicial dela e ela pode registrar. Desligar não apaga nada: o histórico fica guardado e volta se você religar."
            : "Nem toda paciente precisa de rastreamento. Desligado, o atalho não aparece para ela e o módulo é como se não existisse. Adicionar alimentos à lista dela liga sozinho."}
        </p>

        {/* A semana fica aqui, junto do interruptor, e não numa aba adentro:
            é no momento de liberar para a paciente que ela sabe em que
            semana a pessoa está. Quem começou no papel chega no aplicativo
            no meio do caminho. */}
        {ativo && (
          <SemanaDaPaciente
            key={paciente.id}
            paciente={paciente}
            inicio={dados?.inicio ?? null}
            orientacao={dados?.orientacao ?? null}
            etapas={etapasDoMaterial(material)}
            ocupado={ocupado}
            aoMudar={comRecarga}
          />
        )}
      </div>

      {aba === "Linha do tempo" && (
        <>
          {/* O mesmo rastreio que a paciente vê, com a mesma conta e as
              mesmas palavras. Duas leituras diferentes da mesma coisa seria
              o começo de uma conversa em que as duas estão certas. */}
          <div className="c-admin-topo-linha" style={{ marginBottom: 12 }}>
            <p className="c-dica" style={{ margin: 0 }}>
              {(dados?.registros.length ?? 0) === 0
                ? "Nenhum registro ainda."
                : `${dados?.registros.length} ${dados?.registros.length === 1 ? "registro" : "registros"} no diário dela.`}
            </p>
            <button
              type="button"
              className="c-botao c-botao-pequeno"
              onClick={() => definirLancando(true)}
            >
              Lançar registro
            </button>
          </div>

          {lancando && (
            <ModalRetroativo
              paciente={paciente}
              itens={dados?.itens ?? []}
              aoFechar={() => definirLancando(false)}
              aoSalvar={comRecarga}
            />
          )}

          <PanoramaDeMarcadores itens={dados?.itens ?? []} registros={dados?.registros ?? []} />
          <RastreioAlimentar
            itens={dados?.itens ?? []}
            registros={dados?.registros ?? []}
            nome={paciente.nome}
          />
          <LinhaDoTempo dados={dados} />
        </>
      )}
      {aba === "Lista da paciente" && (
        <ListaDaPaciente
          paciente={paciente}
          itens={dados?.itens ?? []}
          material={material}
          ocupado={ocupado}
          aoMudar={comRecarga}
        />
      )}
      {aba === "Acompanhamento" && (
        <Acompanhamento
          paciente={paciente}
          inicio={dados?.inicio ?? null}
          orientacao={dados?.orientacao ?? null}
          ocupado={ocupado}
          aoMudar={comRecarga}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------- panorama de marcadores

/**
 * O que os alimentos que caíram mal têm em comum — só para ela.
 *
 * Ela pediu: "preciso para ajudar a fechar diagnósticos". Até aqui a
 * marcação só aparecia embaixo de um registro com sintoma, espalhada pela
 * linha do tempo semana a semana: dava para ver um alimento de cada vez,
 * nunca o conjunto.
 *
 * Isto conta, e só conta. O denominador vem sempre junto — "4 de 4" e "4 de
 * 20" contam histórias opostas, e mostrar só o "4" esconderia qual das duas.
 * Nenhuma linha aqui conclui nada; quem conclui é ela.
 */
function PanoramaDeMarcadores({
  itens,
  registros,
}: {
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
}) {
  const linhas = panoramaDeMarcadores(itens, registros);
  const semLigacao = alimentosSemLigacao(itens);
  if (linhas.length === 0) return null;

  const comMarcador = linhas.filter((l) => l.marcador !== null);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">O que esses alimentos têm em comum</h2>
      <div className="c-bloco">
        {linhas.map((linha) => (
          <div className="c-item-protocolo" key={linha.marcador ?? "sem"}>
            <div className="c-item-protocolo-linha">
              <span className="c-item-protocolo-nome">
                {linha.marcador ?? "Sem marcação no Mapa"}
              </span>
              <span className="c-item-protocolo-quantidade">
                {linha.registrosComSintoma} de {linha.registros} com sintoma
              </span>
            </div>
            <p className="c-item-protocolo-trocas">
              {linha.nivelMaisAlto ? `até ${nivelPorExtenso(linha.nivelMaisAlto)} · ` : ""}
              {linha.alimentos.join(", ")}
            </p>
          </div>
        ))}
      </div>

      <p className="c-dica" style={{ marginTop: 8 }}>
        Isto é contagem, não conclusão.
        {comMarcador.length > 1
          ? " Um alimento alto em dois marcadores conta nas duas linhas, porque a pergunta é quais marcadores aparecem — não qual é o culpado."
          : ""}{" "}
        Um alimento pode ter caído mal por qualquer outro motivo.
      </p>

      {semLigacao.length > 0 && (
        <p className="c-nota-protocolo">
          {semLigacao.length === 1
            ? "1 alimento desta lista foi digitado à mão"
            : `${semLigacao.length} alimentos desta lista foram digitados à mão`}{" "}
          e por isso não têm marcação de oxalato, histamina ou lectina:{" "}
          {semLigacao.join(", ")}. Adicionando o equivalente pelo Mapa, na aba ao lado, eles
          passam a entrar nesta conta.
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------ ligar ao Mapa

/**
 * Apontar para o Mapa um alimento que ela digitou à mão.
 *
 * O QUE ISTO CONSERTA, e a descoberta foi olhando os dados da paciente dela:
 * a lista da Daniela tinha seis alimentos e os seis digitados à mão — Carne
 * de porco, Mussarela de búfala e companhia. Alimento digitado não tem
 * ligação com o Mapa, e sem ligação não há oxalato, histamina nem lectina.
 * Era isso, e não a numeração das semanas.
 *
 * A BUSCA AUTOMÁTICA POR NOME NÃO VOLTA. Ela foi tirada porque "champagne"
 * achava "champignon": um marcador errado é pior que marcador nenhum, porque
 * vira pista falsa numa investigação clínica. Quem escolhe é ela, olhando.
 */
function ModalLigarAoMapa({
  item,
  material,
  jaNaLista,
  aoFechar,
  aoSalvar,
}: {
  item: ItemDeReintroducao;
  material: AlimentoDoMaterial[];
  jaNaLista: string[];
  aoFechar: () => void;
  aoSalvar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [busca, definirBusca] = useState(item.nome);
  const [escolhido, definirEscolhido] = useState("");
  const [salvando, definirSalvando] = useState(false);

  // Por palavra, não pela frase inteira: ela escreve "Mussarela de búfala" e
  // o Mapa chama "Queijos de búfala". Ver `buscarNoMapa`.
  const achados = buscarNoMapa(material, busca).slice(0, 40);

  return (
    <Modal titulo={`Ligar “${item.nome}” ao Mapa`} aoFechar={aoFechar}>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Escolha o alimento do Mapa que corresponde a este. Ele passa a trazer a marcação de
        oxalato, histamina e lectina — e o nome que {item.nome.toLowerCase()} tem na lista
        dela não muda.
      </p>

      <Campo rotulo="Buscar no Mapa">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome do alimento" />
      </Campo>

      {achados.length === 0 ? (
        <p className="c-contagem">
          Nenhum alimento do Mapa com essas palavras. Tente uma só — “búfala”, “queijo”,
          “porco” — ou apague a busca para ver o Mapa inteiro.
        </p>
      ) : (
        <div className="c-chips" style={{ marginTop: 4 }}>
          {achados.map((a) => {
            const ocupado = jaNaLista.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className="c-chip"
                aria-pressed={escolhido === a.id}
                disabled={ocupado}
                title={
                  ocupado
                    ? "Esta paciente já tem este alimento na lista, vindo do Mapa."
                    : undefined
                }
                onClick={() => definirEscolhido(a.id)}
              >
                {a.nome}
                {a.semanaSugerida ? ` · etapa ${a.semanaSugerida}` : ""}
                {ocupado ? " · já na lista" : ""}
              </button>
            );
          })}
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="c-botao"
          disabled={!escolhido || salvando}
          onClick={() => {
            definirSalvando(true);
            void aoSalvar(() => repositorio.ligarItemAoMapa(item.id, escolhido)).then(
              (deuCerto) => {
                definirSalvando(false);
                if (deuCerto) aoFechar();
              },
            );
          }}
        >
          {salvando ? "Ligando…" : "Ligar"}
        </button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------- lançar retroativo

/**
 * Lançar no diário da paciente um alimento que ela já testou.
 *
 * Ela pediu: "pelo meu acesso eu quero conseguir lançar os retroativos. Ela
 * já testou uma gama de alimentos, teve um que já testou mais de uma vez."
 *
 * Quem fez rastreio no papel antes de o aplicativo existir tem semanas de
 * diário do lado de fora. A alternativa a esta tela seria pedir à paciente
 * que redigitasse tudo — pedir a quem menos tem obrigação de fazê-lo.
 *
 * "Salvar e lançar outro" existe por causa do "uma gama de alimentos": ela
 * vai transcrever vários de uma vez, e guardar a data entre um e outro é o
 * que separa transcrever de brigar com a tela.
 */
function ModalRetroativo({
  paciente,
  itens,
  aoFechar,
  aoSalvar,
}: {
  paciente: Paciente;
  itens: ItemDeReintroducao[];
  aoFechar: () => void;
  aoSalvar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const hoje = hojeSaoPaulo();
  const [itemId, definirItemId] = useState("");
  const [nomeNovo, definirNomeNovo] = useState("");
  const [data, definirData] = useState(hoje);
  const [horario, definirHorario] = useState("");
  const [quantidade, definirQuantidade] = useState("");
  const [preparo, definirPreparo] = useState("");
  const [sintomas, definirSintomas] = useState<SintomaReintroducao[]>(["nenhum"]);
  const [intensidade, definirIntensidade] = useState("");
  const [bristol, definirBristol] = useState("");
  const [observacao, definirObservacao] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [lancados, definirLancados] = useState<string[]>([]);

  const comSintoma = sintomas.length > 0 && sintomas[0] !== "nenhum";
  const escolhido = itens.find((i) => i.id === itemId);
  const nome = escolhido?.nome ?? nomeNovo.trim();
  const podeSalvar = Boolean(nome) && Boolean(data) && data <= hoje && !salvando;

  function alternarSintoma(chave: SintomaReintroducao) {
    definirSintomas((atual) => {
      // "Nenhum" e qualquer outro é contradição — a mesma regra do banco,
      // aplicada aqui para ela não montar um registro que será recusado.
      if (chave === "nenhum") return ["nenhum"];
      const sem = atual.filter((c) => c !== "nenhum");
      return sem.includes(chave) ? sem.filter((c) => c !== chave) : [...sem, chave];
    });
  }

  function limparParaOProximo() {
    definirItemId("");
    definirNomeNovo("");
    definirHorario("");
    definirQuantidade("");
    definirPreparo("");
    definirSintomas(["nenhum"]);
    definirIntensidade("");
    definirBristol("");
    definirObservacao("");
    // A data FICA: transcrevendo um dia de diário, ela é o que menos muda.
  }

  function lancar(continuar: boolean) {
    definirSalvando(true);
    const rotulo = `${nome} · ${dataBonita(data)}`;
    void aoSalvar(() =>
      repositorio.registrarReintroducaoPorPaciente(paciente.id, {
        itemId: itemId || null,
        nomeNovo: itemId ? null : nomeNovo.trim() || null,
        data,
        horario: horario || null,
        quantidade: quantidade.trim() || null,
        preparo: preparo.trim() || null,
        sintomas: comSintoma ? sintomas : ["nenhum"],
        intensidade: comSintoma && intensidade ? Number(intensidade) : null,
        bristol: bristol ? Number(bristol) : null,
        observacao: observacao.trim() || null,
      }),
    ).then((deuCerto) => {
      definirSalvando(false);
      if (!deuCerto) return;
      definirLancados((atual) => [...atual, rotulo]);
      if (continuar) limparParaOProximo();
      else aoFechar();
    });
  }

  return (
    <Modal titulo={`Lançar registro de ${paciente.nome}`} aoFechar={aoFechar}>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Para transcrever o que ela já testou fora do aplicativo. Entra no diário dela como
        qualquer outro registro, na data que você puser.
      </p>

      <Campo rotulo="Alimento">
        <Selecao
          valor={itemId}
          aoMudar={definirItemId}
          opcoes={[
            { valor: "", rotulo: "Outro — escrever o nome abaixo" },
            ...itens.map((i) => ({ valor: i.id, rotulo: i.nome })),
          ]}
        />
      </Campo>
      {!itemId && (
        <Campo
          rotulo="Nome do alimento"
          dica="Entra na lista dela. O mesmo alimento pode ser lançado quantas vezes ela tiver testado."
        >
          <Texto valor={nomeNovo} aoMudar={definirNomeNovo} placeholder="Iogurte de cabra" />
        </Campo>
      )}

      <div className="c-duas-colunas">
        <Campo rotulo="Data">
          <Texto valor={data} aoMudar={definirData} tipo="date" />
        </Campo>
        <Campo rotulo="Horário (opcional)">
          <Texto valor={horario} aoMudar={definirHorario} tipo="time" />
        </Campo>
      </div>
      {data > hoje && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>Esta data está no futuro. Registro retroativo é para trás.</span>
        </div>
      )}

      {/* Os mesmos chips da tela da paciente, de propósito: ela transcreve
          olhando para um diário que a paciente preencheu ali. */}
      <div className="c-campo">
        <span className="c-rotulo">O que ela sentiu</span>
        <div className="c-chips">
          {SINTOMAS.map((s) => (
            <button
              key={s.chave}
              type="button"
              className="c-chip"
              aria-pressed={sintomas.includes(s.chave)}
              onClick={() => alternarSintoma(s.chave)}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
      </div>

      {comSintoma && (
        <div className="c-duas-colunas">
          <Campo rotulo="Intensidade (0 a 10)">
            <Selecao
              valor={intensidade}
              aoMudar={definirIntensidade}
              opcoes={[
                { valor: "", rotulo: "Não anotada" },
                ...Array.from({ length: 11 }, (_, n) => ({
                  valor: String(n),
                  rotulo: `${n} — ${faixaDaIntensidade(n)}`,
                })),
              ]}
            />
          </Campo>
          <Campo rotulo="Bristol (opcional)">
            <Selecao
              valor={bristol}
              aoMudar={definirBristol}
              opcoes={[
                { valor: "", rotulo: "Não anotado" },
                ...BRISTOL.map((b) => ({ valor: String(b.tipo), rotulo: `Tipo ${b.tipo} — ${b.descricao}` })),
              ]}
            />
          </Campo>
        </div>
      )}

      <div className="c-duas-colunas">
        <Campo rotulo="Quantidade (opcional)">
          <Texto valor={quantidade} aoMudar={definirQuantidade} placeholder="1 pote" />
        </Campo>
        <Campo rotulo="Preparo (opcional)">
          <Texto valor={preparo} aoMudar={definirPreparo} placeholder="Cru" />
        </Campo>
      </div>

      <Campo rotulo="Observação (opcional)">
        <AreaTexto valor={observacao} aoMudar={definirObservacao} linhas={2} />
      </Campo>

      {lancados.length > 0 && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>
            {lancados.length === 1 ? "Lançado: " : `${lancados.length} lançados: `}
            {lancados.join(" · ")}
          </span>
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          {lancados.length > 0 ? "Fechar" : "Cancelar"}
        </button>
        <button
          type="button"
          className="c-botao c-botao-secundario"
          disabled={!podeSalvar}
          onClick={() => lancar(true)}
        >
          Salvar e lançar outro
        </button>
        <button type="button" className="c-botao" disabled={!podeSalvar} onClick={() => lancar(false)}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ linha do tempo

function LinhaDoTempo({ dados }: { dados: ReturnType<typeof useReintroducao>["dados"] }) {
  // A marcação é do ALIMENTO, não do registro. Quando o registro chegar sem
  // ela, o item ainda sabe — e é o mesmo alimento.
  const marcacaoDoItem = new Map((dados?.itens ?? []).map((i) => [i.id, i.marcacao]));
  const registros = dados?.registros ?? [];
  const itens = dados?.itens ?? [];
  const [semanaVisivel, definirSemanaVisivel] = useState<number | "todas">("todas");

  const semanas = porSemana(registros);
  const visiveis =
    semanaVisivel === "todas" ? semanas : semanas.filter((s) => s.semana === semanaVisivel);

  // Contagens por estado. São descrição do que existe, não cobrança do que
  // falta: "não iniciado" aparece do lado dos outros, sem destaque e sem
  // sugerir ação. Contagem direta, sem memo: são poucas dezenas de itens, e
  // memorizar sobre um array recriado a cada render não pouparia nada.
  const contagem = new Map<StatusReintroducao, number>();
  for (const item of itens) contagem.set(item.status, (contagem.get(item.status) ?? 0) + 1);

  if (itens.length === 0 && registros.length === 0) {
    return (
      <p className="c-contagem">
        Esta paciente ainda não tem lista nem registro. Monte a lista dela na aba ao lado — ou
        deixe como está: ela já pode registrar qualquer alimento que tenha comido.
      </p>
    );
  }

  return (
    <>
      <div className="c-numeros">
        {STATUS.filter((s) => (contagem.get(s.chave) ?? 0) > 0).map((s) => (
          <div key={s.chave} className="c-numero">
            <strong>{contagem.get(s.chave)}</strong>
            <span>{s.rotulo}</span>
          </div>
        ))}
        <div className="c-numero">
          <strong>{registros.length}</strong>
          <span>{registros.length === 1 ? "Registro" : "Registros"}</span>
        </div>
      </div>

      {semanas.length > 1 && (
        <div className="c-chips" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="c-chip"
            aria-pressed={semanaVisivel === "todas"}
            onClick={() => definirSemanaVisivel("todas")}
          >
            Todos os registros
          </button>
          {semanas.map((s) => (
            <button
              key={s.semana}
              type="button"
              className="c-chip"
              aria-pressed={semanaVisivel === s.semana}
              onClick={() => definirSemanaVisivel(s.semana)}
            >
              Semana {s.semana}
            </button>
          ))}
        </div>
      )}

      {registros.length === 0 ? (
        <p className="c-contagem" style={{ marginTop: 14 }}>
          Nenhum registro ainda.
        </p>
      ) : (
        visiveis.map((grupo) => (
          <div key={grupo.semana} style={{ marginTop: 18 }}>
            <strong style={{ fontSize: 14 }}>Semana {grupo.semana}</strong>
            <div className="c-acoes" style={{ marginTop: 8 }}>
              {grupo.registros.map((r) => {
                const semSintoma = !temSintoma(r);
                return (
                  <article className="c-acao" key={r.id}>
                    <div className="c-acao-topo">
                      <span className="c-acao-texto">
                        <strong>{r.itemNome}</strong>
                        <span className="c-acao-descricao">
                          {dataBonita(r.data)}
                          {r.horario ? ` · ${r.horario}` : ""}
                          {r.quantidade ? ` · ${r.quantidade}` : ""}
                          {r.preparo ? ` · ${r.preparo}` : ""}
                        </span>
                      </span>
                      <span className={`c-selo ${semSintoma ? "melhor" : "ocasional"}`}>
                        {semSintoma ? "Sem sintomas" : "Sintomas registrados"}
                      </span>
                    </div>
                    {!semSintoma && (
                      <p className="c-dica">
                        {r.sintomas.map(rotuloSintoma).join(", ")}
                        {r.intensidade != null
                          ? ` · ${faixaDaIntensidade(r.intensidade)} (${r.intensidade}/10)`
                          : ""}
                      </p>
                    )}
                    {r.bristol != null && <p className="c-dica">Bristol tipo {r.bristol}</p>}
                    {r.observacao && <p className="c-dica">“{r.observacao}”</p>}
                    {/* Na tela da paciente a marcação só aparece com sintoma,
                        e continua assim. Aqui não: esconder de quem tem
                        formação que o alimento é alto em histamina não
                        protege ninguém — atrapalha justamente quem precisa
                        comparar um registro com o outro. */}
                    {(() => {
                      const marcacao = r.marcacao.length
                        ? r.marcacao
                        : (marcacaoDoItem.get(r.itemId) ?? []);
                      return marcacao.length > 0 ? (
                        <p className="c-marcacao">{textoDaMarcacao(marcacao)}</p>
                      ) : null;
                    })()}
                  </article>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ----------------------------------------------------------- lista e status

function ListaDaPaciente({
  paciente,
  itens,
  material,
  ocupado,
  aoMudar,
}: {
  paciente: Paciente;
  itens: ItemDeReintroducao[];
  material: AlimentoDoMaterial[];
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [adicionando, definirAdicionando] = useState(false);
  const [classificando, definirClassificando] = useState<ItemDeReintroducao | null>(null);
  const [ligando, definirLigando] = useState<ItemDeReintroducao | null>(null);
  const semLigacao = itens.filter((i) => !i.doCatalogo);

  return (
    <>
      <div className="c-admin-topo-linha" style={{ marginBottom: 10 }}>
        <p className="c-dica" style={{ margin: 0 }}>
          {itens.length === 0
            ? "Nenhum alimento na lista desta paciente."
            : `${itens.length} ${itens.length === 1 ? "alimento" : "alimentos"} na lista dela.`}
        </p>
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => definirAdicionando(true)}
        >
          Adicionar alimentos
        </button>
      </div>

      {/* O motivo real de a marcação não aparecer para ela. Dito aqui, na
          tela onde se resolve, e não só no painel. */}
      {semLigacao.length > 0 && (
        <p className="c-nota-protocolo" style={{ marginBottom: 10 }}>
          {semLigacao.length === 1
            ? "1 alimento desta lista foi digitado à mão"
            : `${semLigacao.length} alimentos desta lista foram digitados à mão`}{" "}
          e por isso não tem marcação de oxalato, histamina ou lectina. Use “Ligar ao Mapa”
          em cada um para trazer a marcação — o nome que a paciente conhece não muda.
        </p>
      )}

      <div className="c-acoes">
        {itens.map((item) => {
          const info = infoStatus(item.status);
          return (
            <article className="c-acao" key={item.id}>
              <div className="c-acao-topo">
                <span className="c-acao-texto">
                  <strong>{item.nome}</strong>
                  <span className="c-acao-descricao">
                    {CATEGORIAS[item.categoria] ?? item.categoria}
                    {item.semanaSugerida ? ` · etapa ${item.semanaSugerida} do material` : ""}
                    {item.porcaoReferencia ? ` · ${item.porcaoReferencia}` : ""}
                    {item.doCatalogo ? "" : " · fora do material"}
                  </span>
                  <span className="c-acao-descricao">
                    {item.totalDeRegistros === 0
                      ? "Sem registros"
                      : `${item.totalDeRegistros} ${
                          item.totalDeRegistros === 1 ? "registro" : "registros"
                        }${item.ultimoRegistro ? ` · último em ${dataBonita(item.ultimoRegistro)}` : ""}`}
                  </span>
                  {/* A marcação do alimento, sempre — é informação de
                      referência sobre o alimento, não sobre a paciente. */}
                  {item.marcacao.length > 0 ? (
                    <span className="c-acao-descricao">{textoDaMarcacao(item.marcacao)}</span>
                  ) : (
                    !item.doCatalogo && (
                      <span className="c-acao-descricao">
                        Sem marcação — digitado à mão, fora do Mapa
                      </span>
                    )
                  )}
                  {item.notaNutri && <span className="c-acao-descricao">“{item.notaNutri}”</span>}
                </span>
                <span className={`c-selo ${seloDoTom(info.tom)}`}>{info.rotulo}</span>
              </div>
              <div className="c-acao-estado">
                <button
                  type="button"
                  className="c-botao c-botao-secundario c-botao-pequeno"
                  disabled={ocupado}
                  onClick={() => definirClassificando(item)}
                >
                  Classificar
                </button>
                {item.doCatalogo ? (
                  // Só onde há ligação feita por ela para desfazer. Num
                  // alimento escolhido do Mapa desde o começo, "desfazer"
                  // não desfaria nada — transformaria num nome solto o que
                  // ela adicionou de propósito.
                  item.ligadoDepois && (
                    <button
                      type="button"
                      className="c-link"
                      disabled={ocupado}
                      onClick={() =>
                        void aoMudar(() => repositorio.desligarItemDoMapa(item.id))
                      }
                    >
                      Desfazer ligação
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="c-botao c-botao-secundario c-botao-pequeno"
                    disabled={ocupado}
                    onClick={() => definirLigando(item)}
                  >
                    Ligar ao Mapa
                  </button>
                )}
                {item.totalDeRegistros === 0 && (
                  <button
                    type="button"
                    className="c-link"
                    disabled={ocupado}
                    onClick={() =>
                      void aoMudar(() => repositorio.removerItemReintroducao(item.id))
                    }
                  >
                    Tirar da lista
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {adicionando && (
        <ModalAdicionar
          paciente={paciente}
          jaNaLista={itens.map((i) => i.alimentoId).filter((id): id is string => id !== null)}
          aoFechar={() => definirAdicionando(false)}
          aoSalvar={aoMudar}
        />
      )}

      {classificando && (
        <ModalClassificar
          item={classificando}
          aoFechar={() => definirClassificando(null)}
          aoSalvar={aoMudar}
        />
      )}

      {ligando && (
        <ModalLigarAoMapa
          item={ligando}
          material={material}
          jaNaLista={itens.map((i) => i.alimentoId).filter((id): id is string => id !== null)}
          aoFechar={() => definirLigando(null)}
          aoSalvar={aoMudar}
        />
      )}
    </>
  );
}

function seloDoTom(tom: string): string {
  if (tom === "bom") return "melhor";
  if (tom === "atencao") return "ocasional";
  return "neutro";
}

/**
 * Escolher os alimentos do material para aquela paciente.
 *
 * As etapas do PDF organizam a tela, e só isso: ela pode levar um alimento da
 * etapa 4 antes de um da etapa 1 se for o que faz sentido para aquela
 * paciente. Nada aqui exige começar pela semana 1.
 */
function ModalAdicionar({
  paciente,
  jaNaLista,
  aoFechar,
  aoSalvar,
}: {
  paciente: Paciente;
  jaNaLista: string[];
  aoFechar: () => void;
  aoSalvar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [material, definirMaterial] = useState<AlimentoDoMaterial[]>([]);
  const [escolhidos, definirEscolhidos] = useState<string[]>([]);
  const [nomeLivre, definirNomeLivre] = useState("");
  const [busca, definirBusca] = useState("");
  const [salvando, definirSalvando] = useState(false);

  useEffect(() => {
    void repositorio
      .listarAlimentosDoMaterial()
      .then(definirMaterial)
      .catch(() => definirMaterial([]));
  }, []);

  const disponiveis = material.filter(
    (a) =>
      !jaNaLista.includes(a.id) &&
      a.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const etapas = [...new Set(disponiveis.map((a) => a.semanaSugerida ?? 5))].sort();

  const alternar = useCallback((id: string) => {
    definirEscolhidos((atuais) =>
      atuais.includes(id) ? atuais.filter((e) => e !== id) : [...atuais, id],
    );
  }, []);

  async function salvar() {
    definirSalvando(true);
    let deuCerto = true;
    if (escolhidos.length > 0) {
      deuCerto = await aoSalvar(async () => {
        await repositorio.adicionarItensReintroducao(paciente.id, escolhidos);
      });
    }
    if (deuCerto && nomeLivre.trim()) {
      deuCerto = await aoSalvar(() =>
        repositorio.adicionarItemLivreReintroducao(paciente.id, nomeLivre.trim()),
      );
    }
    definirSalvando(false);
    if (deuCerto) aoFechar();
  }

  return (
    <Modal titulo={`Alimentos de ${paciente.nome}`} aoFechar={aoFechar}>
      <p className="c-dica">
        Escolha só o que faz sentido para ela. As etapas abaixo são a ordem sugerida no seu
        material — você pode seguir outra.
      </p>

      <Campo rotulo="Buscar no material">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome do alimento" />
      </Campo>

      {etapas.map((etapa) => (
        <div key={etapa} style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 13 }}>
            {etapa === 5 ? "Fora do material" : `Etapa ${etapa}`}
          </strong>
          <div className="c-chips" style={{ marginTop: 8 }}>
            {disponiveis
              .filter((a) => (a.semanaSugerida ?? 5) === etapa)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="c-chip"
                  aria-pressed={escolhidos.includes(a.id)}
                  onClick={() => alternar(a.id)}
                >
                  {a.nome}
                  {a.porcaoReferencia ? ` (${a.porcaoReferencia})` : ""}
                </button>
              ))}
          </div>
        </div>
      ))}

      <Campo
        rotulo="Um alimento que não está no material"
        dica="O seu material diz que o que não está na lista entra na etapa 5. É por aqui."
      >
        <Texto valor={nomeLivre} aoMudar={definirNomeLivre} placeholder="Ex.: sucrilhos" />
      </Campo>

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="c-botao"
          disabled={salvando || (escolhidos.length === 0 && !nomeLivre.trim())}
          onClick={() => void salvar()}
        >
          {salvando ? "Salvando…" : "Adicionar"}
        </button>
      </div>
    </Modal>
  );
}

/** A classificação é dela. Nenhum destes valores sai de uma conta automática. */
function ModalClassificar({
  item,
  aoFechar,
  aoSalvar,
}: {
  item: ItemDeReintroducao;
  aoFechar: () => void;
  aoSalvar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [status, definirStatus] = useState<StatusReintroducao>(item.status);
  const [nota, definirNota] = useState(item.notaNutri ?? "");
  const [salvando, definirSalvando] = useState(false);

  return (
    <Modal titulo={item.nome} aoFechar={aoFechar}>
      <p className="c-dica">
        A leitura é sua. Um sintoma registrado não significa que o alimento precise sair — o
        material lembra que a quantidade costuma ser o que muda a resposta.
      </p>

      <Campo rotulo="Como está este alimento para ela">
        <Selecao
          valor={status}
          aoMudar={definirStatus}
          opcoes={STATUS.map((s) => ({ valor: s.chave, rotulo: s.rotulo }))}
        />
      </Campo>
      <Campo rotulo="Recado (a paciente vê)" dica="Opcional.">
        <AreaTexto valor={nota} aoMudar={definirNota} linhas={2} />
      </Campo>

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="c-botao"
          disabled={salvando}
          onClick={() => {
            definirSalvando(true);
            void aoSalvar(() =>
              repositorio.definirStatusReintroducao(item.id, status, nota.trim() || null),
            ).then((deuCerto) => {
              definirSalvando(false);
              if (deuCerto) aoFechar();
            });
          }}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------- em que semana ela está

/**
 * Em que semana a paciente está, escolhida por ela.
 *
 * Ela pediu assim: "quando eu libero a rastreabilidade para algum paciente,
 * eu seleciono em qual semana ele tá". Quem fazia rastreio no papel antes de
 * o aplicativo existir chega nele no meio do caminho — a Daniela está na
 * terceira semana e o aplicativo mostra a primeira, porque para ele a
 * contagem começa no primeiro registro digitado.
 *
 * O que fica gravado é a DATA de início, não o número da semana. É o que faz
 * a semana andar sozinha: escolhida a 3 hoje, daqui a sete dias é a 4, sem
 * ninguém voltar aqui. Guardar o número exigiria alguém atualizá-lo toda
 * semana, e o dia em que esquecessem a contagem congelaria em silêncio.
 */
function SemanaDaPaciente({
  paciente,
  inicio,
  orientacao,
  etapas,
  ocupado,
  aoMudar,
}: {
  paciente: Paciente;
  inicio: string | null;
  orientacao: string | null;
  etapas: number[];
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [data, definirData] = useState(inicio ?? "");
  const [feito, definirFeito] = useState(false);
  const hoje = hojeSaoPaulo();
  const semana = semanaEm(data || null, hoje);
  const primeiroNome = paciente.nome.split(" ")[0] ?? paciente.nome;
  const mudou = (data || "") !== (inicio ?? "");
  const passouDoMaterial = semana > etapas.length;

  function guardar(novaData: string) {
    definirData(novaData);
    definirFeito(false);
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div className="c-duas-colunas">
        <Campo rotulo={`Em que semana ${primeiroNome} está hoje`}>
          <Selecao
            valor={String(semana)}
            aoMudar={(v) => guardar(inicioParaSemana(Number(v), hoje))}
            opcoes={opcoesDeSemana(etapas, semana)}
          />
        </Campo>
        <Campo rotulo="Começou em" dica="Sabendo o dia exato, a data acerta mais que a semana.">
          <Texto valor={data} aoMudar={guardar} tipo="date" />
        </Campo>
      </div>

      <p className="c-dica" style={{ marginTop: -2 }}>
        {data
          ? `Contando de ${dataBonita(data)}. Daqui a uma semana ela estará na ${semana + 1}: a contagem anda sozinha, você não precisa voltar aqui.`
          : "Sem data, a semana 1 é a do primeiro registro dela — é por isso que quem começou no papel aparece na semana 1."}
      </p>
      {passouDoMaterial && (
        <p className="c-dica">
          O material tem {etapas.length} etapas, e o calendário dela já passou disso. Não é
          erro: a semana aqui conta dias corridos, e uma paciente pode levar mais tempo em
          cada etapa. Se a conta não bate, acerte pela data.
        </p>
      )}

      {mudou && (
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          style={{ marginTop: 8 }}
          disabled={ocupado}
          onClick={() => {
            void aoMudar(() =>
              // A orientação viaja junto sem ser tocada: a função do banco
              // grava os dois campos de uma vez, e mandar nulo aqui apagaria
              // o recado que ela escreveu para a paciente.
              repositorio.definirAcompanhamentoReintroducao(
                paciente.id,
                data || null,
                orientacao,
              ),
            ).then((deuCerto) => definirFeito(deuCerto));
          }}
        >
          Salvar a semana
        </button>
      )}
      {feito && !mudou && <p className="c-dica">Salvo. A contagem já mudou na tela dela.</p>}
    </div>
  );
}

// ------------------------------------------------------------ acompanhamento

// ------------------------------------------------------------ acompanhamento

function Acompanhamento({
  paciente,
  inicio,
  orientacao,
  ocupado,
  aoMudar,
}: {
  paciente: Paciente;
  inicio: string | null;
  orientacao: string | null;
  ocupado: boolean;
  aoMudar: (acao: () => Promise<void>) => Promise<boolean>;
}) {
  const [texto, definirTexto] = useState(orientacao ?? "");
  const [feito, definirFeito] = useState(false);

  return (
    <>
      <div className="c-bloco" style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 14 }}>Recado para {paciente.nome}</strong>
        <p className="c-dica">
          Aparece no topo da tela dela. Em branco, ela vê o texto geral de acolhimento.
        </p>
        <Campo rotulo="Orientação">
          <AreaTexto valor={texto} aoMudar={definirTexto} linhas={4} />
        </Campo>
      </div>

      {feito && (
        <div className="c-aviso" role="status">
          <span>Salvo.</span>
        </div>
      )}

      <button
        type="button"
        className="c-botao c-botao-pequeno"
        style={{ marginTop: 14 }}
        disabled={ocupado}
        onClick={() => {
          definirFeito(false);
          void aoMudar(() =>
            // `inicio` vai junto sem ser tocado: a função do banco grava os
            // dois campos de uma vez, então mandar nulo aqui apagaria a
            // semana que ela acabou de escolher lá em cima.
            repositorio.definirAcompanhamentoReintroducao(
              paciente.id,
              inicio || null,
              texto.trim() || null,
            ),
          ).then((deuCerto) => definirFeito(deuCerto));
        }}
      >
        Salvar acompanhamento
      </button>
    </>
  );
}
