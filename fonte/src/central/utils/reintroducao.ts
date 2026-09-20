import type {
  ItemDeReintroducao,
  MarcadorDoAlimento,
  NivelDoMarcador,
  RegistroDeReintroducao,
  SintomaReintroducao,
  StatusReintroducao,
} from "@/central/types";

/**
 * Vocabulário da rastreabilidade.
 *
 * Os rótulos moram aqui porque as duas telas — a da paciente e a da
 * nutricionista — precisam chamar a mesma coisa pelo mesmo nome. E porque a
 * escolha das palavras é parte da regra: nenhuma delas diz "proibido",
 * "falhou" ou "atrasado".
 */

export const SINTOMAS: { chave: SintomaReintroducao; rotulo: string }[] = [
  { chave: "nenhum", rotulo: "Nenhum sintoma" },
  { chave: "distensao", rotulo: "Distensão abdominal" },
  { chave: "gases", rotulo: "Gases" },
  { chave: "dor_abdominal", rotulo: "Dor abdominal" },
  { chave: "colica", rotulo: "Cólica" },
  { chave: "alteracao_evacuacao", rotulo: "Alteração da evacuação" },
  { chave: "diarreia", rotulo: "Diarreia" },
  { chave: "constipacao", rotulo: "Constipação" },
  { chave: "urgencia", rotulo: "Urgência evacuatória" },
  { chave: "nausea", rotulo: "Náusea" },
  { chave: "refluxo", rotulo: "Refluxo" },
  { chave: "manchas_pele", rotulo: "Manchas pelo corpo" },
  { chave: "outros", rotulo: "Outro" },
];

export function rotuloSintoma(chave: string): string {
  return SINTOMAS.find((s) => s.chave === chave)?.rotulo ?? chave;
}

/**
 * Os estados possíveis de um alimento.
 *
 * Todos neutros, de propósito: o app mostra o que foi registrado, e quem
 * interpreta é a nutricionista. "Sintomas observados" é um registro do que
 * aconteceu — não é diagnóstico, e não vira exclusão.
 */
export const STATUS: {
  chave: StatusReintroducao;
  rotulo: string;
  /** Como a paciente lê aquele estado, sem jargão e sem susto. */
  paciente: string;
  tom: "neutro" | "bom" | "atencao" | "apagado";
}[] = [
  { chave: "nao_iniciado", rotulo: "Não iniciado", paciente: "Ainda não testei", tom: "neutro" },
  { chave: "em_teste", rotulo: "Em teste", paciente: "Em teste", tom: "neutro" },
  { chave: "bem_tolerado", rotulo: "Bem tolerado", paciente: "Bem tolerado", tom: "bom" },
  {
    chave: "tolerancia_parcial",
    rotulo: "Tolerância parcial",
    paciente: "Tolerância parcial",
    tom: "atencao",
  },
  {
    chave: "sintomas_observados",
    rotulo: "Sintomas observados",
    paciente: "Sintomas registrados",
    tom: "atencao",
  },
  {
    chave: "necessita_reavaliacao",
    rotulo: "Necessita reavaliação",
    paciente: "Vamos rever juntas",
    tom: "atencao",
  },
  { chave: "pausado", rotulo: "Pausado", paciente: "Pausado", tom: "apagado" },
  {
    chave: "nao_relevante",
    rotulo: "Não relevante para a paciente",
    paciente: "Não faz parte da minha alimentação",
    tom: "apagado",
  },
];

export function status(chave: StatusReintroducao) {
  return STATUS.find((s) => s.chave === chave) ?? STATUS[0]!;
}

export const CATEGORIAS: Record<string, string> = {
  carboidratos: "Carboidratos",
  gorduras: "Gorduras",
  proteinas: "Proteínas",
  frutas: "Frutas",
  vegetais: "Vegetais",
  outros: "Outros",
};

/** A escala de Bristol do protocolo dela, 1 a 7. */
export const BRISTOL: { tipo: number; descricao: string }[] = [
  { tipo: 1, descricao: "Pequenos fragmentos duros, semelhantes a nozes" },
  { tipo: 2, descricao: "Em forma de salsicha, mas com grumos" },
  { tipo: 3, descricao: "Em forma de salsicha, com fissuras à superfície" },
  { tipo: 4, descricao: "Em forma de salsicha ou cobra, suave e macia" },
  { tipo: 5, descricao: "Fragmentadas, em pedaços com contornos definidos e macias" },
  { tipo: 6, descricao: "Em pedaços esfarrapados" },
  { tipo: 7, descricao: "Líquidas" },
];

/**
 * Como a intensidade é lida.
 *
 * A escala é a que ela pediu: 0 nenhum, 1–3 leve, 4–6 moderado, 7–10 intenso.
 */
export function faixaDaIntensidade(valor: number): string {
  if (valor <= 0) return "Nenhum";
  if (valor <= 3) return "Leve";
  if (valor <= 6) return "Moderado";
  return "Intenso";
}

/** Agrupa os registros por semana, da mais recente para a mais antiga. */
export function porSemana(
  registros: RegistroDeReintroducao[],
): { semana: number; registros: RegistroDeReintroducao[] }[] {
  const mapa = new Map<number, RegistroDeReintroducao[]>();
  for (const registro of registros) {
    const atual = mapa.get(registro.semana);
    if (atual) atual.push(registro);
    else mapa.set(registro.semana, [registro]);
  }
  return [...mapa.entries()]
    .map(([semana, lista]) => ({ semana, registros: lista }))
    .sort((a, b) => b.semana - a.semana);
}

/**
 * Os alimentos que a paciente vê na hora de registrar.
 *
 * Sai de cena o que ela marcou como não relevante — é o §4 do pedido dela: o
 * app não fica oferecendo o que ela não come. Nada é "escondido": a lista
 * completa continua na tela, com o item marcado, e ela desfaz quando quiser.
 */
export function itensParaRegistrar(itens: ItemDeReintroducao[]): ItemDeReintroducao[] {
  return itens.filter((i) => i.status !== "nao_relevante");
}

/**
 * A frase de abertura do histórico.
 *
 * Nunca conta o que falta. Quando não há registro, convida; quando há, diz o
 * que existe — porque "3 de 12 testados" transformaria a lista em tarefa, que
 * é exatamente o que ela pediu para não acontecer.
 */
export function fraseDoHistorico(registros: number, alimentos: number): string {
  if (registros === 0) {
    return alimentos === 0
      ? "Sua nutricionista ainda não montou a sua lista. Você já pode registrar qualquer alimento que tenha comido."
      : "Quando você testar algum alimento, é só registrar aqui.";
  }
  const r = registros === 1 ? "1 registro" : `${registros} registros`;
  const a = alimentos === 1 ? "1 alimento" : `${alimentos} alimentos`;
  return `${r} até agora, em ${a}.`;
}

// --------------------------------------- oxalato, histamina e lectina

/**
 * O símbolo de cada nível.
 *
 * Seta dupla para "muito alta", simples para "alta", nenhuma para "média" —
 * a intensidade se lê de relance, sem precisar comparar palavras. Nenhum
 * ícone de alerta, nenhum vermelho: isto não é aviso de perigo.
 */
const SIMBOLO: Partial<Record<NivelDoMarcador, string>> = {
  muito_alta: "↑↑",
  alta: "↑",
};

const NIVEL: Record<NivelDoMarcador, string> = {
  muito_baixa: "muito baixa",
  baixa: "baixa",
  media: "média",
  alta: "alta",
  muito_alta: "muito alta",
};

/**
 * A linha que aparece embaixo do registro com sintoma.
 *
 * Exemplo: "↑↑ Histamina muito alta · ↑↑ Oxalato muito alta".
 *
 * Devolve string vazia quando não há nada em média ou acima — e a tela não
 * desenha nada nesse caso. Um espaço reservado que fica em branco chamaria
 * atenção para a ausência, que é justamente o contrário do pedido.
 */
export function textoDaMarcacao(marcacao: MarcadorDoAlimento[]): string {
  return marcacao
    .map((m) => {
      const simbolo = SIMBOLO[m.nivel];
      return `${simbolo ? `${simbolo} ` : ""}${m.nome} ${NIVEL[m.nivel]}`;
    })
    .join(" · ");
}

/**
 * Se aquele registro deve mostrar a marcação.
 *
 * A regra é dela e é uma só: aparece apenas quando a paciente sentiu algum
 * sintoma. Registro sem sintoma não ganha rótulo nenhum — o alimento caiu
 * bem, e não há o que investigar.
 */
export function mostrarMarcacao(registro: RegistroDeReintroducao): boolean {
  return temSintoma(registro) && registro.marcacao.length > 0;
}

/** Se o registro tem algum sintoma de verdade. */
export function temSintoma(registro: {
  sintomas: SintomaReintroducao[] | string[];
}): boolean {
  return registro.sintomas.length > 0 && registro.sintomas[0] !== "nenhum";
}

/**
 * O panorama de marcadores de uma paciente — só para a nutricionista.
 *
 * PARA QUE SERVE, nas palavras dela: "preciso para ajudar a fechar
 * diagnósticos". Até aqui a marcação só aparecia embaixo de um registro com
 * sintoma, espalhada pela linha do tempo semana a semana. Dava para ver um
 * alimento de cada vez, nunca o padrão — e o padrão é a pergunta: os
 * alimentos que caíram mal têm algo em comum?
 *
 * O QUE ISTO É: contagem. Quantos registros de alimentos altos em cada
 * marcador tiveram sintoma, e em quais alimentos. Nada aqui conclui, e por
 * isso o denominador vem junto: "4 de 4" e "4 de 12" contam histórias
 * opostas, e mostrar só o "4" esconderia qual das duas.
 *
 * O QUE ISTO NÃO É: diagnóstico, nem sugestão de diagnóstico. Um alimento
 * alto em histamina que caiu mal pode ter caído mal por qualquer outro
 * motivo, e um alimento pode ser alto em dois marcadores ao mesmo tempo —
 * nesse caso ele conta nas duas linhas, porque a pergunta é "quais
 * marcadores aparecem", não "qual é o culpado".
 *
 * Fica fora da tela da paciente, e de propósito. Ela vê o que o corpo dela
 * relatou; ler padrão em cima disso é trabalho de quem tem formação.
 */
export interface LinhaDoPanorama {
  /** "Oxalato", "Histamina", "Lectina" ou `null` para os sem marcação. */
  marcador: string | null;
  /** O nível mais alto visto neste marcador, entre os alimentos contados. */
  nivelMaisAlto: NivelDoMarcador | null;
  registros: number;
  registrosComSintoma: number;
  /** Os alimentos que entraram nesta linha, em ordem alfabética. */
  alimentos: string[];
}

const ORDEM_NIVEL: NivelDoMarcador[] = ["muito_baixa", "baixa", "media", "alta", "muito_alta"];

export function panoramaDeMarcadores(
  itens: ItemDeReintroducao[],
  registros: RegistroDeReintroducao[],
): LinhaDoPanorama[] {
  const porItem = new Map(itens.map((i) => [i.id, i]));
  const linhas = new Map<string, LinhaDoPanorama & { nomes: Set<string> }>();

  const linha = (marcador: string | null) => {
    const chave = marcador ?? "";
    if (!linhas.has(chave)) {
      linhas.set(chave, {
        marcador,
        nivelMaisAlto: null,
        registros: 0,
        registrosComSintoma: 0,
        alimentos: [],
        nomes: new Set(),
      });
    }
    return linhas.get(chave)!;
  };

  for (const registro of registros) {
    // A marcação do registro é a do alimento. Quando o registro não a
    // trouxer, o item ainda pode ter — é o mesmo alimento.
    const item = porItem.get(registro.itemId);
    const marcacao = registro.marcacao.length ? registro.marcacao : (item?.marcacao ?? []);
    const comSintoma = temSintoma(registro);

    const destinos: (MarcadorDoAlimento | null)[] = marcacao.length ? marcacao : [null];
    for (const m of destinos) {
      const alvo = linha(m ? m.nome : null);
      alvo.registros += 1;
      if (comSintoma) alvo.registrosComSintoma += 1;
      alvo.nomes.add(registro.itemNome);
      if (m) {
        const atual = alvo.nivelMaisAlto ? ORDEM_NIVEL.indexOf(alvo.nivelMaisAlto) : -1;
        if (ORDEM_NIVEL.indexOf(m.nivel) > atual) alvo.nivelMaisAlto = m.nivel;
      }
    }
  }

  return [...linhas.values()]
    .map(({ nomes, ...resto }) => ({
      ...resto,
      alimentos: [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }))
    .sort((a, b) => {
      // Os sem marcação vão para o fim: são o que falta saber, não o achado.
      if ((a.marcador === null) !== (b.marcador === null)) return a.marcador === null ? 1 : -1;
      return (
        b.registrosComSintoma - a.registrosComSintoma ||
        b.registros - a.registros ||
        String(a.marcador).localeCompare(String(b.marcador), "pt-BR")
      );
    });
}

/** Quantos alimentos da lista foram digitados à mão e por isso não têm marcação. */
export function alimentosSemLigacao(itens: ItemDeReintroducao[]): string[] {
  return itens
    .filter((i) => !i.doCatalogo)
    .map((i) => i.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function nivelPorExtenso(nivel: NivelDoMarcador): string {
  return NIVEL[nivel];
}
