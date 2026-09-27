import type { DadosAvaliacao } from "@/central/types/protocolo";

/**
 * Os números da avaliação são lançados à mão, um por um, a partir da
 * calculadora. Nada conferia se eles fecham entre si: um 16 digitado no
 * lugar de 15,6 na massa gorda passava, e a paciente via 24,25% num cartão e
 * outra coisa na barra.
 *
 * Esta conferência NÃO calcula por ela nem corrige sozinha — só aponta o que
 * não bate, e diz qual seria o número que fecha.
 */
export interface Divergencia {
  campo: "imc" | "massas" | "percentual";
  mensagem: string;
  /** O valor que fecharia a conta, quando existe um só. */
  sugestao: number | null;
}

const umaCasa = (n: number) => Math.round(n * 10) / 10;
const duasCasas = (n: number) => Math.round(n * 100) / 100;
const br = (n: number, casas = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

export function conferirAvaliacao(d: DadosAvaliacao): Divergencia[] {
  const saida: Divergencia[] = [];
  const { peso, altura, imc, massaGorda, massaMagra, percentualGordura } = d;

  if (peso && altura && imc !== null) {
    const calculado = peso / (altura / 100) ** 2;
    if (Math.abs(calculado - imc) > 0.15) {
      saida.push({
        campo: "imc",
        mensagem: `IMC lançado ${br(imc, 2)}, mas ${br(peso)} kg e ${br(altura)} cm dão ${br(duasCasas(calculado), 2)}.`,
        sugestao: duasCasas(calculado),
      });
    }
  }

  if (peso && massaGorda !== null && massaMagra !== null) {
    const soma = massaGorda + massaMagra;
    if (Math.abs(soma - peso) > 0.25) {
      saida.push({
        campo: "massas",
        mensagem: `Massa gorda + massa magra = ${br(umaCasa(soma))} kg, e o peso é ${br(peso)} kg.`,
        sugestao: null,
      });
    }
  }

  if (peso && massaGorda !== null && percentualGordura !== null) {
    const pelaMassa = (massaGorda / peso) * 100;
    if (Math.abs(pelaMassa - percentualGordura) > 0.5) {
      saida.push({
        campo: "percentual",
        mensagem:
          `Gordura lançada ${br(percentualGordura, 2)}%, mas ${br(massaGorda)} kg de ${br(peso)} kg ` +
          `são ${br(duasCasas(pelaMassa), 2)}%.`,
        sugestao: null,
      });
    }
  }

  return saida;
}
