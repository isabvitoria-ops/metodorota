/**
 * Número escrito do jeito daqui — com vírgula, às vezes com a unidade junto.
 *
 * Mora fora do componente de campo porque é aqui que o erro seria caro: se
 * "10,9" virar nulo, um percentual de gordura some do prontuário sem
 * ninguém ver. Regra fora do .tsx é regra que dá para testar.
 *
 * UMA LEITURA SÓ PARA O APP INTEIRO. Antes cada tela lia do seu jeito, e o
 * mesmo "99.90" valia 99,9 na avaliação e R$ 9.990 na cobrança; "22,5" de
 * carga derrubava o treino; "72,5 kg" virava vazio sem aviso.
 */

/**
 * "10,9", "10.9", "72,5 kg", "R$ 1.500,00", "1.500" e "3,5km" viram número.
 *
 * - Vírgula é decimal. Com ponto E vírgula, o último separador é o decimal.
 * - Só ponto: é milhar quando os grupos têm exatamente três dígitos
 *   ("1.500", "12.000"); senão é decimal ("99.90", "72.5").
 * - A unidade escrita antes ou depois ("kg", "cm", "R$", "%") é ignorada.
 *
 * O que não for número vira nulo — nunca zero.
 */
export function numeroDeTexto(texto: string): number | null {
  let t = String(texto ?? "")
    .trim()
    .replace(/^r\$\s*/i, "")
    .replace(/\s*[a-zA-Zµ°%²³/]+\.?\s*$/u, "")
    .replace(/\s+/g, "");
  if (t === "" || !/\d/.test(t)) return null;

  const temVirgula = t.includes(",");
  const temPonto = t.includes(".");
  if (temVirgula && temPonto) {
    t =
      t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
  } else if (temVirgula) {
    if ((t.match(/,/g) ?? []).length > 1) return null;
    t = t.replace(",", ".");
  } else if (temPonto && /^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }

  if (!/^-?\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** O caminho de volta: 10.9 vira "10,9", nulo vira campo vazio. */
export function textoDeNumero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
}

/** Preenchido e não entendido — é o caso em que a tela precisa avisar. */
export function naoEntendido(texto: string): boolean {
  return String(texto ?? "").trim() !== "" && numeroDeTexto(texto) === null;
}
