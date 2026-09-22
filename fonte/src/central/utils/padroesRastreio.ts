import type { RegistroDeReintroducao } from "@/central/types";
import { rotuloSintoma, temSintoma } from "./reintroducao";

/**
 * Padrões no rastreio: o que os registros dela mostram quando lidos juntos.
 *
 * A escada de tolerância (`utils/rastreio.ts`) responde "este alimento, como
 * foi?". Isto aqui responde outra pergunta, que nenhuma tela respondia:
 * "olhando TUDO que ela registrou, o que se repete?".
 *
 * TRÊS REGRAS, E NENHUMA DELAS É NEGOCIÁVEL
 *
 * 1. NADA É INVENTADO. Toda frase é uma contagem sobre o que a paciente
 *    escreveu, e traz os números dentro dela: "em 4 dos 6 registros". Quem
 *    lê consegue conferir; e se a conta estiver estranha, ela percebe.
 *
 * 2. NADA É CAUSA. Não existe "o leite causou a distensão" em lugar nenhum.
 *    Existe "em 4 de 5 registros com leite houve distensão". A diferença não
 *    é de estilo: estabelecer causa é ato clínico da nutricionista, com a
 *    paciente na frente, e um aplicativo que afirma causa atropela isso.
 *
 * 3. POUCO DADO NÃO VIRA PADRÃO. Um registro não é tendência, e dois
 *    também não. Abaixo do mínimo a resposta é "ainda não dá para dizer" —
 *    que é uma resposta honesta e útil. Um padrão tirado de dois registros
 *    seria lido como achado clínico e mandaria alguém cortar um alimento.
 *
 * Sem IA, sem custo, e sem coleta nova: tudo isto já está sendo guardado
 * desde o primeiro registro — data, horário, sintomas, intensidade, Bristol
 * e a marcação do alimento.
 */

/** Abaixo disto não se afirma nada. Dois registros não são tendência. */
export const MINIMO_DE_REGISTROS = 3;

/** Quanto de concentração num balde para ele virar observação. */
const CONCENTRACAO = 0.6;

export interface Padrao {
  /** Uma chave estável, para a tela dar `key` sem usar o texto. */
  id: string;
  texto: string;
  /** Quantos registros sustentam a frase. A tela mostra; ela confere. */
  registros: number;
}

export interface LeituraDoRastreio {
  /** Falso quando não há registro suficiente para dizer qualquer coisa. */
  temDados: boolean;
  totalDeRegistros: number;
  registrosComSintoma: number;
  padroes: Padrao[];
}

function periodoDo(horario: string | null): "manhã" | "tarde" | "noite" | null {
  if (!horario) return null;
  const hora = Number(horario.slice(0, 2));
  if (!Number.isFinite(hora)) return null;
  // A noite vai até as 4h59 de propósito: quem come às 23h e passa mal às
  // 2h está no mesmo episódio, e cortar à meia-noite partiria em dois.
  if (hora >= 5 && hora < 12) return "manhã";
  if (hora >= 12 && hora < 18) return "tarde";
  return "noite";
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function diaDaSemana(dataIso: string): string | null {
  // `T12:00:00Z` pelo motivo de sempre: com meia-noite o fuso dela (UTC−3)
  // joga a data para o dia anterior, e sexta vira quinta.
  const d = new Date(`${dataIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return DIAS[d.getUTCDay()] ?? null;
}

/** O balde com mais itens, e se ele passa da concentração mínima. */
function maisFrequente<T extends string>(
  valores: T[],
): { valor: T; quantidade: number; concentrado: boolean } | null {
  if (valores.length === 0) return null;
  const contagem = new Map<T, number>();
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);

  let melhor: T | null = null;
  let maior = 0;
  for (const [v, n] of contagem) {
    if (n > maior) {
      maior = n;
      melhor = v;
    }
  }
  if (melhor === null) return null;
  return {
    valor: melhor,
    quantidade: maior,
    // Um único balde sozinho não é concentração: se TODOS os registros
    // caíram na noite porque ela só registra de noite, isso não diz nada
    // sobre sintoma. Por isso a conta é feita só sobre os COM sintoma, e
    // comparada com o total deles.
    concentrado: maior / valores.length >= CONCENTRACAO,
  };
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * Lê todos os registros juntos e devolve o que se repete.
 *
 * A ordem das observações é a da utilidade clínica dela: primeiro o quanto
 * houve sintoma, depois qual sintoma, depois quando, depois o que os
 * alimentos têm em comum, e por fim o intestino.
 */
export function lerPadroes(registros: RegistroDeReintroducao[]): LeituraDoRastreio {
  const total = registros.length;
  const comSintoma = registros.filter(temSintoma);

  if (total < MINIMO_DE_REGISTROS) {
    return {
      temDados: false,
      totalDeRegistros: total,
      registrosComSintoma: comSintoma.length,
      padroes: [],
    };
  }

  const padroes: Padrao[] = [];

  // ---------------------------------------------------------- com que frequência
  if (comSintoma.length === 0) {
    padroes.push({
      id: "sem-sintoma",
      texto: `Nenhum sintoma relatado em ${total} ${plural(total, "registro", "registros")}.`,
      registros: total,
    });
  } else {
    padroes.push({
      id: "frequencia",
      texto:
        `Sintomas relatados em ${comSintoma.length} de ${total} ` +
        `${plural(total, "registro", "registros")}.`,
      registros: comSintoma.length,
    });
  }

  // ---------------------------------------------------------------- qual sintoma
  const todosOsSintomas = comSintoma.flatMap((r) => r.sintomas.filter((s) => s !== "nenhum"));
  const sintomaTop = maisFrequente(todosOsSintomas);
  if (sintomaTop && sintomaTop.quantidade >= 2) {
    padroes.push({
      id: "sintoma-frequente",
      texto:
        `${rotuloSintoma(sintomaTop.valor)} foi o mais relatado: ` +
        `${sintomaTop.quantidade} ${plural(sintomaTop.quantidade, "vez", "vezes")}.`,
      registros: sintomaTop.quantidade,
    });
  }

  // ------------------------------------------------------------------- que horas
  const periodos = comSintoma
    .map((r) => periodoDo(r.horario))
    .filter((p): p is "manhã" | "tarde" | "noite" => p !== null);
  // Só vale se a maioria dos registros com sintoma tiver horário anotado;
  // senão a "concentração" seria sobre os poucos que têm hora.
  if (periodos.length >= MINIMO_DE_REGISTROS && periodos.length >= comSintoma.length / 2) {
    const topo = maisFrequente(periodos);
    if (topo?.concentrado) {
      padroes.push({
        id: "periodo",
        texto:
          `${topo.quantidade} de ${periodos.length} registros com sintoma foram ` +
          `à ${topo.valor === "manhã" ? "manhã" : topo.valor}.`,
        registros: topo.quantidade,
      });
    }
  }

  // --------------------------------------------------------- que dia da semana
  const dias = comSintoma
    .map((r) => diaDaSemana(r.data))
    .filter((d): d is string => d !== null);
  if (dias.length >= MINIMO_DE_REGISTROS) {
    const topo = maisFrequente(dias);
    if (topo?.concentrado) {
      padroes.push({
        id: "dia-da-semana",
        texto:
          `${topo.quantidade} de ${dias.length} registros com sintoma caíram ` +
          `${topo.valor === "sábado" || topo.valor === "domingo" ? "no" : "na"} ${topo.valor}.`,
        registros: topo.quantidade,
      });
    }
  }

  // ------------------------------------------------- o que os alimentos têm em comum
  //
  // O achado mais útil da tela, e o mais delicado: se quatro dos cinco
  // alimentos que deram sintoma são altos no mesmo marcador, isso é uma
  // pergunta clínica boa. Continua sendo pergunta, não conclusão.
  const alimentosComSintoma = new Map<string, RegistroDeReintroducao>();
  for (const r of comSintoma) if (!alimentosComSintoma.has(r.itemId)) alimentosComSintoma.set(r.itemId, r);

  if (alimentosComSintoma.size >= MINIMO_DE_REGISTROS) {
    const marcadores = [...alimentosComSintoma.values()].flatMap((r) =>
      // Só ALTA e MUITO ALTA. O material dela já entrega de média para
      // cima, e contar a média faria quase todo alimento carregar quase
      // todo marcador — aí o "padrão" apareceria sempre, que é o mesmo que
      // não aparecer nunca.
      r.marcacao.filter((m) => m.nivel === "alta" || m.nivel === "muito_alta").map((m) => m.nome),
    );
    const topo = maisFrequente(marcadores);
    if (topo && topo.quantidade >= 2 && topo.quantidade / alimentosComSintoma.size >= CONCENTRACAO) {
      padroes.push({
        id: "marcador",
        texto:
          `${topo.quantidade} de ${alimentosComSintoma.size} alimentos com sintoma são ` +
          `altos ou moderados em ${topo.valor}.`,
        registros: topo.quantidade,
      });
    }
  }

  // -------------------------------------------------------------------- Bristol
  const bristol = registros.map((r) => r.bristol).filter((b): b is number => b !== null);
  if (bristol.length >= MINIMO_DE_REGISTROS) {
    const ressecado = bristol.filter((b) => b <= 2).length;
    const amolecido = bristol.filter((b) => b >= 6).length;
    if (ressecado / bristol.length >= CONCENTRACAO) {
      padroes.push({
        id: "bristol-ressecado",
        texto: `${ressecado} de ${bristol.length} registros com Bristol 1 ou 2.`,
        registros: ressecado,
      });
    } else if (amolecido / bristol.length >= CONCENTRACAO) {
      padroes.push({
        id: "bristol-amolecido",
        texto: `${amolecido} de ${bristol.length} registros com Bristol 6 ou 7.`,
        registros: amolecido,
      });
    }
  }

  return {
    temDados: true,
    totalDeRegistros: total,
    registrosComSintoma: comSintoma.length,
    padroes,
  };
}

/** A frase de quando ainda não há o que ler. */
export function faltaParaLer(total: number): string {
  const faltam = MINIMO_DE_REGISTROS - total;
  if (faltam <= 0) return "";
  return `Com mais ${faltam} ${plural(faltam, "registro", "registros")} dá para começar a ler padrões.`;
}
