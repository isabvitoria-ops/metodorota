/**
 * Cálculos — a ferramenta de cálculo dela (dieta, composição corporal,
 * macros e gasto) dentro da área da nutricionista, num lugar só.
 *
 * A ferramenta continua sendo a mesma página (/nutri/), aberta aqui dentro:
 * o que ela já guardou lá aparece igual, porque é o mesmo endereço do mesmo
 * site, e os dados das pacientes seguem só no navegador dela, como sempre
 * foram. Nenhuma paciente chega a esta tela: ela fica atrás do papel de
 * nutricionista, como o resto do /admin.
 */
const ENDERECO = `${import.meta.env.BASE_URL}nutri/`;

export function Calculos() {
  return (
    <div className="c-calculos">
      <div className="c-calculos-cabeca">
        <div>
          <h1 className="c-titulo" style={{ fontSize: 28 }}>
            Cálculos
          </h1>
          <p className="c-subtitulo" style={{ marginTop: 4 }}>
            Dieta, composição corporal, macros e gasto. O que você salva aqui fica neste navegador.
          </p>
        </div>
        <a className="c-botao c-botao-secundario c-botao-pequeno" href={ENDERECO} target="_blank" rel="noreferrer">
          Abrir em tela cheia
        </a>
      </div>
      {import.meta.env.DEV ? (
        <p className="c-calc-espera">
          A ferramenta de cálculo só existe na versão publicada (pasta nutri/ do site). No ambiente de
          desenvolvimento este quadro fica vazio.
        </p>
      ) : (
        <iframe className="c-calculos-quadro" src={ENDERECO} title="Ferramenta de cálculo" />
      )}
    </div>
  );
}
