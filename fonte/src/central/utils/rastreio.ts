import type { RegistroDeReintroducao } from "@/central/types";
import { rotuloSintoma, temSintoma } from "./reintroducao";

/**
 * A escada de tolerância do Rastreio Alimentar.
 *
 * Vive fora do componente porque é regra clínica dela, não detalhe de tela:
 * é o que decide se a paciente vê verde, amarelo ou vermelho ao lado de um
 * alimento. Aqui ela fica testável — e está testada, com os exemplos que ela
 * mesma deu.
 */

/**
 * A frase embaixo do nome, montada só com o que foi registrado.
 *
 * Nada de texto inventado: se a paciente não relatou sintoma, a frase diz
 * isso; se relatou, a frase nomeia o que ela mesma marcou.
 */
export function fraseDo(registros: RegistroDeReintroducao[]): string {
  const comSintoma = registros.filter(temSintoma);
  if (comSintoma.length === 0) return "Sem sintomas observados.";
  const depois = depoisDoUltimoSintoma(registros).semSintomaDepois > 0;

  const sintomas = [...new Set(comSintoma.flatMap((r) => r.sintomas.filter((s) => s !== "nenhum")))];
  if (sintomas.length === 0) {
    return depois
      ? "Você relatou desconforto em um teste anterior. No último teste, ficou bem."
      : "Você relatou desconforto após o consumo.";
  }

  const nomes = sintomas.map((s) => rotuloSintoma(s).toLocaleLowerCase("pt-BR"));
  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  // O último teste foi tranquilo: a frase conta as duas coisas, na ordem em
  // que aconteceram. Dizer só o sintoma esconderia a parte boa.
  if (depois) return `Seu corpo apresentou ${lista} em um teste anterior. No último teste, você ficou bem.`;
  return `Seu corpo apresentou ${lista} após o consumo.`;
}

/**
 * Sintomas que contam dobrado (regra dela, 17/09).
 *
 * "Esses têm que valer dois pontos porque são mais intensos mesmo." Não é a
 * intensidade que a paciente marca no formulário — essa continua sendo dela
 * para ler; é o peso do próprio sintoma na escada de tolerância.
 */
const PESO_DOBRADO = new Set(["diarreia", "urgencia", "nausea", "refluxo", "manchas_pele"]);

/**
 * A escada de tolerância, a partir do que foi registrado.
 *
 * Soma PONTOS de sintomas diferentes, ao longo de todos os testes daquele
 * alimento: os cinco de cima valem 2, os demais valem 1.
 *
 *   0 ponto        → verde,    "Bem tolerado"
 *   1 ou 2 pontos  → amarelo,  "Comer com atenção"
 *   3 ou mais      → vermelho, "Não tolerado"
 *
 * Os dois exemplos dela batem: abacate só com gases dá 1 ponto (amarelo);
 * gases + distensão + diarreia dá 1+1+2 = 4 (vermelho). E uma diarreia
 * sozinha já vale 2 — fica amarelo, não verde.
 *
 * UMA EXCEÇÃO, decidida em 12/11 (ela deixou a decisão comigo): quando houve
 * sintoma em testes anteriores e o ÚLTIMO teste foi sem sintoma nenhum, a
 * conta não dá veredito — o alimento fica amarelo, como "Rever na consulta".
 *
 *   * Por quê: a soma nunca esquece. Um alimento que caiu mal uma vez
 *     ficava "Não tolerado" para sempre, mesmo com os testes seguintes
 *     tranquilos — o contrário do que o rastreio existe para mostrar.
 *   * Por que não verde: um teste bom não desfaz um ruim. Pode ter sido a
 *     quantidade, o preparo, o dia. Quem decide é a consulta.
 *   * Por que sem número ("3 testes bons"): seria um limite clínico
 *     inventado. "O último foi bom" é fato, não limite.
 *
 * A intensidade (1 a 10) continua fora da conta, como ela definiu em 17/09.
 * E a classificação que a nutricionista dá ganha de tudo isto — inclusive
 * "Não tolerado", que ela agora pode marcar.
 */
export function classificar(registros: RegistroDeReintroducao[]): {
  tom: "bom" | "atencao" | "grave";
  rotulo: string;
} {
  const { tom, rotulo } = contaDaEscada(registros);
  return { tom, rotulo };
}

/** Uma parcela da conta: o sintoma e quantos pontos ele vale. */
export interface ParcelaDaEscada {
  chave: string;
  rotulo: string;
  peso: 1 | 2;
}

/**
 * A mesma escada, com a conta aberta.
 *
 * `classificar` devolve só a cor; aqui vem junto de ONDE ela saiu — quais
 * sintomas entraram e quanto cada um valeu. É o que a nutricionista lê para
 * conferir a conta antes de dar a classificação dela: um "Não tolerado" sem
 * a soma do lado é um veredito, e a escada é uma conta.
 *
 * As parcelas saem das mais pesadas para as mais leves, e em ordem
 * alfabética no empate — a ordem não muda de uma abertura para outra.
 */
export function contaDaEscada(registros: RegistroDeReintroducao[]): {
  tom: "bom" | "atencao" | "grave";
  rotulo: string;
  pontos: number;
  parcelas: ParcelaDaEscada[];
  /** Houve sintoma antes e o último teste foi tranquilo: sem veredito. */
  emRevisao: boolean;
} {
  const sintomas = new Set(
    registros.flatMap((r) => (temSintoma(r) ? r.sintomas.filter((x) => x !== "nenhum") : [])),
  );
  const parcelas: ParcelaDaEscada[] = [...sintomas]
    .map((chave) => ({
      chave,
      rotulo: rotuloSintoma(chave),
      peso: (PESO_DOBRADO.has(chave) ? 2 : 1) as 1 | 2,
    }))
    .sort((a, b) => b.peso - a.peso || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const pontos = parcelas.reduce((soma, p) => soma + p.peso, 0);

  if (pontos === 0) return { tom: "bom", rotulo: "Bem tolerado", pontos, parcelas, emRevisao: false };
  if (depoisDoUltimoSintoma(registros).semSintomaDepois > 0) {
    return { tom: "atencao", rotulo: ROTULO_EM_REVISAO, pontos, parcelas, emRevisao: true };
  }
  if (pontos <= 2) return { tom: "atencao", rotulo: "Comer com atenção", pontos, parcelas, emRevisao: false };
  return { tom: "grave", rotulo: "Não tolerado", pontos, parcelas, emRevisao: false };
}

/** O selo de quando a conta não dá veredito. Sem gênero: há pacientes homens. */
export const ROTULO_EM_REVISAO = "Rever na consulta";

/** "4 pontos: Diarreia (2) + Distensão (1) + Gases (1)". Sem ponto, "0 ponto". */
export function fraseDaConta(conta: { pontos: number; parcelas: ParcelaDaEscada[] }): string {
  if (conta.pontos === 0) return "0 ponto";
  const total = `${conta.pontos} ${conta.pontos === 1 ? "ponto" : "pontos"}`;
  return `${total}: ${conta.parcelas.map((p) => `${p.rotulo} (${p.peso})`).join(" + ")}`;
}

/**
 * O que aconteceu DEPOIS do último teste com sintoma.
 *
 * A escada soma os sintomas de todos os testes, para sempre — é a regra
 * dela. O efeito é que um alimento que caiu mal uma vez continua vermelho
 * mesmo que os cinco testes seguintes tenham sido tranquilos. Mudar a regra
 * é decisão clínica; o que cabe aqui é o FATO: quando foi o último sintoma e
 * quantos testes vieram depois sem nenhum. Quem relê a classificação com
 * isso na mão é a nutricionista.
 *
 * Dois registros no mesmo dia desempatam pela hora em que foram gravados.
 */
export function depoisDoUltimoSintoma(registros: RegistroDeReintroducao[]): {
  /** A data do último teste com sintoma; nulo se nunca houve. */
  ultimoComSintoma: string | null;
  /** Quantos testes sem sintoma vieram depois dele. Zero se nunca houve sintoma. */
  semSintomaDepois: number;
} {
  const emOrdem = [...registros].sort(
    (a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""),
  );
  let ultimo = -1;
  emOrdem.forEach((r, i) => {
    if (temSintoma(r)) ultimo = i;
  });
  if (ultimo < 0) return { ultimoComSintoma: null, semSintomaDepois: 0 };
  return {
    ultimoComSintoma: emOrdem[ultimo]!.data,
    semSintomaDepois: emOrdem.length - 1 - ultimo,
  };
}
