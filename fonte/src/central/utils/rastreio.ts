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

  const sintomas = [...new Set(comSintoma.flatMap((r) => r.sintomas.filter((s) => s !== "nenhum")))];
  if (sintomas.length === 0) return "Você relatou desconforto após o consumo.";

  const nomes = sintomas.map((s) => rotuloSintoma(s).toLocaleLowerCase("pt-BR"));
  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
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
 *   3 ou mais      → vermelho, "Pouco tolerado"
 *
 * Os dois exemplos dela batem: abacate só com gases dá 1 ponto (amarelo);
 * gases + distensão + diarreia dá 1+1+2 = 4 (vermelho). E uma diarreia
 * sozinha já vale 2 — fica amarelo, não verde.
 */
export function classificar(registros: RegistroDeReintroducao[]): {
  tom: "bom" | "atencao" | "grave";
  rotulo: string;
} {
  const sintomas = new Set(
    registros.flatMap((r) => (temSintoma(r) ? r.sintomas.filter((x) => x !== "nenhum") : [])),
  );
  let pontos = 0;
  for (const sintoma of sintomas) pontos += PESO_DOBRADO.has(sintoma) ? 2 : 1;

  if (pontos === 0) return { tom: "bom", rotulo: "Bem tolerado" };
  if (pontos <= 2) return { tom: "atencao", rotulo: "Comer com atenção" };
  return { tom: "grave", rotulo: "Pouco tolerado" };
}

