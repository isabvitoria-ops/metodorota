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
