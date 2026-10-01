/**
 * O "carregando" da Central: três faixas que pulsam de leve no lugar do texto
 * "Carregando…". Mostra a FORMA do que vai chegar (uma lista), o que dá
 * sensação de rapidez e evita o salto de layout quando o conteúdo aparece.
 *
 * Para leitor de tela continua sendo um aviso de estado ("Carregando"), e quem
 * prefere menos movimento recebe as faixas paradas (ver `central.css`).
 */
export function Esqueleto({ linhas = 3, rotulo = "Carregando…" }: { linhas?: number; rotulo?: string }) {
  return (
    <div className="c-esqueleto" role="status" aria-live="polite">
      <span className="c-so-leitor">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className="c-esqueleto-faixa" style={{ width: `${100 - i * 14}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}
