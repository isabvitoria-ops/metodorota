/**
 * Os protocolos de dobras cutâneas que a ferramenta de cálculo oferece —
 * só para saber quais dobras cada um usa, não para calcular nada.
 *
 * A CONTA CONTINUA ACONTECENDO NA CALCULADORA. Aqui não se recalcula
 * percentual de gordura nenhum: o formulário só recebe o resultado pronto
 * (ver o cabeçalho de `AvaliacoesDaPaciente` em `admin/Protocolos.tsx`).
 * Esta lista serve só para decidir QUAIS CAMPOS mostrar primeiro, para não
 * repetir nove dobras quando o protocolo usou três.
 *
 * A LISTA DE DOBRAS DE CADA PROTOCOLO É A UNIÃO das versões masculina e
 * feminina (ver `nutri/protocolos.mjs`, a fonte da verdade das equações).
 * A Central não guarda o sexo da paciente — não é um dado cadastrado — e o
 * erro que não se pode cometer aqui é ESCONDER um campo que ela precisava.
 * Mostrar um a mais é só um campo extra na tela; esconder um a menos é uma
 * medida que ela mediu e não tem onde lançar.
 */
export interface ProtocoloDeAvaliacao {
  id: string;
  rotulo: string;
  /** Nomes exatamente como em `DOBRAS` (utils/medidasCorporais.ts). */
  dobras: string[];
}

export const PROTOCOLOS_DE_AVALIACAO: ProtocoloDeAvaliacao[] = [
  {
    id: "pollock3",
    rotulo: "Jackson & Pollock — 3 dobras",
    dobras: ["Peitoral / tórax", "Abdominal", "Coxa", "Tríceps", "Supra-ilíaca"],
  },
  {
    id: "pollock7",
    rotulo: "Jackson, Pollock & Ward — 7 dobras",
    dobras: [
      "Peitoral / tórax",
      "Axilar média",
      "Tríceps",
      "Subescapular",
      "Abdominal",
      "Supra-ilíaca",
      "Coxa",
    ],
  },
  {
    id: "pollock4",
    rotulo: "Jackson, Pollock & Ward — 4 dobras (mulheres)",
    dobras: ["Tríceps", "Abdominal", "Supra-ilíaca", "Coxa"],
  },
  {
    id: "durnin",
    rotulo: "Durnin & Womersley — 4 dobras",
    dobras: ["Bíceps", "Tríceps", "Subescapular", "Supra-ilíaca"],
  },
  {
    id: "durninRahaman",
    rotulo: "Durnin & Rahaman — 4 dobras",
    dobras: ["Bíceps", "Tríceps", "Subescapular", "Supra-ilíaca"],
  },
  {
    id: "lean",
    rotulo: "Lean et al. — 4 dobras",
    dobras: ["Bíceps", "Tríceps", "Subescapular", "Supra-ilíaca"],
  },
  {
    id: "petroski",
    rotulo: "Petroski — 4 dobras",
    dobras: ["Subescapular", "Tríceps", "Supra-ilíaca", "Panturrilha"],
  },
  {
    id: "guedes",
    rotulo: "Guedes — 3 dobras",
    dobras: ["Tríceps", "Supra-ilíaca", "Abdominal", "Coxa", "Subescapular"],
  },
  {
    id: "katch",
    rotulo: "Katch & McArdle — 3 dobras",
    dobras: ["Tríceps", "Subescapular", "Abdominal"],
  },
  {
    id: "thorland3",
    rotulo: "Thorland — 3 dobras (atletas)",
    dobras: ["Tríceps", "Subescapular", "Axilar média"],
  },
  {
    id: "thorland7",
    rotulo: "Thorland — 7 dobras (atletas)",
    dobras: [
      "Peitoral / tórax",
      "Axilar média",
      "Tríceps",
      "Subescapular",
      "Abdominal",
      "Supra-ilíaca",
      "Coxa",
    ],
  },
  {
    id: "slaughter",
    rotulo: "Slaughter — 2 dobras",
    dobras: ["Tríceps", "Subescapular"],
  },
  {
    id: "faulkner",
    rotulo: "Faulkner — 4 dobras",
    dobras: ["Tríceps", "Subescapular", "Supra-ilíaca", "Abdominal"],
  },
];

/** Nem sempre o método é um destes — ela pode medir de outro jeito. */
export const OUTRO_METODO = "outro";

/** O protocolo cujo rótulo bate com o que está gravado, se houver. */
export function protocoloDoMetodo(metodo: string): ProtocoloDeAvaliacao | null {
  return PROTOCOLOS_DE_AVALIACAO.find((p) => p.rotulo === metodo.trim()) ?? null;
}
