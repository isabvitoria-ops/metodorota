/**
 * Texto de número para a tela e para a explicação do cálculo: vírgula decimal,
 * sem zeros sobrando ("6,25", não "6,2500"). Só EXIBE — nenhuma conta passa
 * por aqui, então nada é arredondado antes da hora.
 */
export function fmt(n, maximo = 5) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: maximo });
}

/**
 * Monta uma equação linear "c + a×X + b×Y …" e devolve o valor, a fórmula
 * com símbolos e a substituição com os números do paciente — da MESMA lista
 * de termos, para a explicação mostrada nunca divergir da conta feita.
 *
 * `termos`: [[coeficiente, símbolo, valor]]. Coeficiente negativo vira " − ".
 */
export function linear(constante, termos) {
  let valor = constante;
  let formula = fmt(constante);
  let subst = fmt(constante);
  for (const [coef, simbolo, v] of termos) {
    valor += coef * v;
    const sinal = coef < 0 ? " − " : " + ";
    formula += `${sinal}${fmt(Math.abs(coef))}×${simbolo}`;
    subst += `${sinal}${fmt(Math.abs(coef))}×${fmt(v)}`;
  }
  return { valor, formula: formula.replace(/^−/, "−"), substituicao: subst };
}
