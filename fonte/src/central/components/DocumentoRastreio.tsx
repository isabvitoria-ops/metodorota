import type { ReactNode } from "react";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { dataBonita } from "@/central/utils/situacao";
import type { DocumentoDeRastreio, LinhaDoDocumento } from "@/central/utils/documentoRastreio";
import { montarDocumento } from "@/central/utils/documentoRastreio";
import { Marca } from "./Marca";

/**
 * O documento de Rastreabilidade Alimentar — para o papel, não para a tela.
 *
 * "Se ainda estiver parecendo uma exportação da tela do aplicativo,
 * refaça." Então ele não é a tela impressa. Não tem menu, não tem barra,
 * não tem botão, não tem "Central do Paciente", não tem endereço de site.
 * Tem cabeçalho com o nome da paciente, três tabelas, um mapa de
 * tolerância e espaço para continuar usando.
 *
 * COMO ELE VIRA PDF: pelo "Salvar como PDF" do próprio navegador. Uma
 * biblioteca de PDF custaria centenas de kilobytes no celular dela para
 * fazer pior — o diálogo do sistema respeita a fonte, a quebra de página e
 * a impressora de verdade, e é o mesmo caminho que a tela de rastreio já
 * usava. O que muda é o que vai para o papel.
 *
 * ELE SÓ EXISTE NA IMPRESSÃO. Na tela fica escondido (`aria-hidden` e
 * `display: none` fora do `@media print`): são os mesmos dados da tela,
 * organizados de outro jeito, e mostrar os dois ao mesmo tempo seria pedir
 * para a paciente ler tudo duas vezes.
 */
export function DocumentoRastreio({
  paciente,
  semana,
  itens,
  registros,
  nutricionista,
}: {
  paciente: string;
  semana: number;
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
  nutricionista: string;
}) {
  const doc = montarDocumento({ paciente, semana, itens, registros });

  return (
    <article className="doc" aria-hidden="true">
      <Cabecalho doc={doc} />
      <Resumo doc={doc} />
      <MapaDeTolerancia doc={doc} />
      <OQueAprendi doc={doc} />

      <TabelaBemTolerados linhas={doc.bemTolerados} />
      <TabelaObservar linhas={doc.observar} />
      <TabelaRespostas linhas={doc.respostas} />

      <ProximosTestes aTestar={doc.aTestar} />
      <Rodape paciente={doc.paciente} nutricionista={nutricionista} />
    </article>
  );
}

// ---------------------------------------------------------------- cabeçalho

function Cabecalho({ doc }: { doc: DocumentoDeRastreio }) {
  return (
    <header className="doc-capa">
      <Marca altura={40} className="doc-marca" />
      <p className="doc-sobretitulo">Rastreabilidade Alimentar</p>
      {/* O nome grande: o documento é dela, e é a primeira coisa que se lê. */}
      <h1 className="doc-nome">{doc.paciente}</h1>
      <p className="doc-lema">Seu mapa pessoal de tolerância alimentar</p>
      <p className="doc-periodo">
        {doc.inicio && doc.fim
          ? `Período analisado: ${dataBonita(doc.inicio)} a ${dataBonita(doc.fim)}`
          : "Período analisado: ainda sem registros"}
        {" · "}
        Semana de acompanhamento: {doc.semana}
      </p>

      {/* A explicação que não pode sair, e por isso vem no alto. */}
      <p className="doc-aviso">
        Esta lista não representa alimentos proibidos. Ela registra como o seu corpo respondeu
        aos alimentos que você testou, para que você possa fazer escolhas mais conscientes.
      </p>
    </header>
  );
}

// ------------------------------------------------------------------- resumo

function Resumo({ doc }: { doc: DocumentoDeRastreio }) {
  const { resumo } = doc;
  return (
    <section className="doc-secao">
      <h2 className="doc-titulo">Seu rastreio até agora</h2>
      <div className="doc-resumo">
        <Numero n={resumo.bemTolerados} rotulo="bem tolerados" faixa="bem" />
        <Numero n={resumo.observar} rotulo="para observar" faixa="obs" />
        <Numero n={resumo.respostas} rotulo="com resposta registrada" faixa="resp" />
        <Numero n={resumo.testes} rotulo={resumo.testes === 1 ? "teste feito" : "testes feitos"} />
      </div>
    </section>
  );
}

function Numero({
  n,
  rotulo,
  faixa,
}: {
  n: number;
  rotulo: string;
  faixa?: "bem" | "obs" | "resp";
}) {
  return (
    <div className={faixa ? `doc-numero doc-${faixa}` : "doc-numero"}>
      <strong>{n}</strong>
      <span>
        {n === 1 ? rotulo.replace("alimentos", "alimento").replace(/^(\w)/, (c) => c) : rotulo}
      </span>
    </div>
  );
}

// -------------------------------------------------------- mapa de tolerância

/**
 * A "cola" da cozinha: os nomes, e só os nomes.
 *
 * É a página que ela disse que a paciente vai imprimir e deixar na geladeira
 * — nela não cabe data, quantidade nem sintoma, senão deixa de servir para
 * olhar de relance.
 */
function MapaDeTolerancia({ doc }: { doc: DocumentoDeRastreio }) {
  const vazio =
    doc.bemTolerados.length === 0 && doc.observar.length === 0 && doc.respostas.length === 0;
  if (vazio) return null;

  return (
    <section className="doc-secao doc-mapa">
      <h2 className="doc-titulo">Meu mapa de tolerância</h2>
      <div className="doc-mapa-colunas">
        <ColunaDoMapa
          faixa="bem"
          titulo="Meu corpo tolerou bem"
          nomes={doc.bemTolerados.map((l) => l.alimento)}
        />
        <ColunaDoMapa
          faixa="obs"
          titulo="Para observar"
          nomes={doc.observar.map((l) => l.alimento)}
        />
        <ColunaDoMapa
          faixa="resp"
          titulo="Apresentaram resposta"
          nomes={doc.respostas.map((l) => l.alimento)}
        />
      </div>
    </section>
  );
}

function ColunaDoMapa({
  faixa,
  titulo,
  nomes,
}: {
  faixa: "bem" | "obs" | "resp";
  titulo: string;
  nomes: string[];
}) {
  return (
    <div className={`doc-coluna doc-${faixa}`}>
      {/* A bolinha é decorativa; quem carrega a informação é o título
          escrito. Impresso em preto e branco, a cor some e o texto fica. */}
      <p className="doc-coluna-titulo">
        <span className="doc-bola" aria-hidden="true" />
        {titulo}
      </p>
      {nomes.length === 0 ? (
        <p className="doc-vazio">Nenhum até aqui.</p>
      ) : (
        <ul>
          {nomes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------- o que eu aprendi

function OQueAprendi({ doc }: { doc: DocumentoDeRastreio }) {
  const { maisRelatados } = doc.resumo;
  if (maisRelatados.length === 0) return null;
  return (
    <section className="doc-secao">
      <h2 className="doc-titulo">Até agora, meus registros mostram</h2>
      <p className="doc-linha-aprendi">
        <strong>Sintomas registrados com maior frequência:</strong>{" "}
        {maisRelatados
          .slice(0, 5)
          .map((s) => `${s.nome} (${s.vezes}${s.vezes === 1 ? " vez" : " vezes"})`)
          .join(", ")}
        .
      </p>
      <p className="doc-nota">
        A contagem é dos seus registros. Ela não aponta causa: um sintoma pode vir de mais de um
        alimento, e de coisas que não são alimento.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ tabelas

/**
 * Uma tabela que não se corta no meio da página.
 *
 * `break-inside: avoid` na LINHA, não na tabela: evitar na tabela inteira
 * empurraria uma tabela de trinta alimentos para a página seguinte e
 * deixaria meia página em branco. O `<thead>` se repete sozinho quando a
 * tabela passa de uma página — é comportamento de impressão do navegador
 * para `<thead>`, e é por isso que o cabeçalho é `<thead>` de verdade.
 */
function Tabela({
  faixa,
  titulo,
  explicacao,
  colunas,
  children,
  vazio,
}: {
  faixa: "bem" | "obs" | "resp";
  titulo: string;
  explicacao: string;
  colunas: string[];
  children: ReactNode;
  vazio: boolean;
}) {
  return (
    <section className="doc-secao doc-quebra">
      <h2 className={`doc-titulo doc-titulo-faixa doc-${faixa}`}>
        <span className="doc-bola" aria-hidden="true" />
        {titulo}
      </h2>
      <p className="doc-nota">{explicacao}</p>
      {vazio ? (
        <p className="doc-vazio">Nenhum alimento nesta faixa até aqui.</p>
      ) : (
        <table
          className={`doc-tabela doc-${faixa}${colunas.length > 4 ? " doc-tabela-larga" : ""}`}
        >
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      )}
    </section>
  );
}

/** "3 testes · desde 10/09" — o que a consolidação tem a dizer. */
function Testes({ linha }: { linha: LinhaDoDocumento }) {
  if (linha.testes <= 1) return null;
  return (
    <span className="doc-testes">
      {linha.testes} testes registrados · desde {dataBonita(linha.primeiraData)}
    </span>
  );
}

function TabelaBemTolerados({ linhas }: { linhas: LinhaDoDocumento[] }) {
  return (
    <Tabela
      faixa="bem"
      titulo="Bem tolerados"
      explicacao="Alimentos que você testou e nos quais não foram relatados sintomas."
      colunas={["Alimento", "Quantidade testada", "Data", "Como me senti"]}
      vazio={linhas.length === 0}
    >
      {linhas.map((l) => (
        <tr key={l.alimento}>
          <th scope="row">
            {l.alimento}
            <Testes linha={l} />
          </th>
          <td>{l.quantidade || "—"}</td>
          <td className="doc-data">{dataBonita(l.ultimaData)}</td>
          <td>{l.comoSeSentiu}</td>
        </tr>
      ))}
    </Tabela>
  );
}

function TabelaObservar({ linhas }: { linhas: LinhaDoDocumento[] }) {
  return (
    <Tabela
      faixa="obs"
      titulo="Observar"
      explicacao="Houve alguma resposta do corpo. Vale observar em novos testes, com atenção à quantidade e ao preparo."
      colunas={["Alimento", "O que aconteceu", "Intensidade", "Quantidade", "Data", "Observação"]}
      vazio={linhas.length === 0}
    >
      {linhas.map((l) => (
        <tr key={l.alimento}>
          <th scope="row">
            {l.alimento}
            <Testes linha={l} />
          </th>
          <td>{l.sintomas || "Resposta registrada"}</td>
          <td>{l.intensidade || "—"}</td>
          <td>{l.quantidade || "—"}</td>
          <td className="doc-data">{dataBonita(l.ultimaData)}</td>
          <td>{l.observacao || "—"}</td>
        </tr>
      ))}
    </Tabela>
  );
}

function TabelaRespostas({ linhas }: { linhas: LinhaDoDocumento[] }) {
  return (
    <Tabela
      faixa="resp"
      titulo="Resposta registrada"
      explicacao="Sintomas mais claros ou repetidos após o consumo. O registro é do que aconteceu — não é diagnóstico, e não quer dizer que o alimento seja o causador."
      colunas={["Alimento", "Sintomas", "Intensidade", "Quantidade", "Data", "Observação"]}
      vazio={linhas.length === 0}
    >
      {linhas.map((l) => (
        <tr key={l.alimento}>
          <th scope="row">
            {l.alimento}
            <Testes linha={l} />
          </th>
          <td>{l.sintomas || "Resposta registrada"}</td>
          <td>{l.intensidade || "—"}</td>
          <td>{l.quantidade || "—"}</td>
          <td className="doc-data">{dataBonita(l.ultimaData)}</td>
          <td>{l.observacao || "—"}</td>
        </tr>
      ))}
    </Tabela>
  );
}

// ---------------------------------------------------------- próximos testes

/**
 * Linhas em branco para escrever à mão.
 *
 * É o que faz o documento continuar servindo depois de impresso: ele deixa
 * de ser um relatório do que passou e vira a folha em que ela anota o
 * próximo teste, na cozinha, sem o celular na mão.
 */
function ProximosTestes({ aTestar }: { aTestar: string[] }) {
  const linhas = Math.max(6, Math.min(aTestar.length, 12));
  return (
    <section className="doc-secao doc-quebra">
      <h2 className="doc-titulo">Próximos testes</h2>
      <p className="doc-nota">
        {aTestar.length > 0
          ? `Da sua lista, ainda não testados: ${aTestar.join(", ")}.`
          : "Use as linhas abaixo para anotar os próximos testes."}
      </p>
      <table className="doc-tabela doc-vazia doc-tabela-larga">
        <thead>
          <tr>
            <th scope="col">Alimento a testar</th>
            <th scope="col">Quantidade</th>
            <th scope="col">Data do teste</th>
            <th scope="col">Sintoma observado</th>
            <th scope="col">Intensidade</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: linhas }, (_, i) => (
            <tr key={i}>
              {/* A primeira coluna já vem com o nome quando há o que
                  sugerir: é a lista que ela montou, e recopiar à mão o que
                  o sistema já sabe é trabalho à toa. */}
              <th scope="row">{aTestar[i] ?? ""}</th>
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ------------------------------------------------------------------- rodapé

function Rodape({ paciente, nutricionista }: { paciente: string; nutricionista: string }) {
  return (
    <footer className="doc-rodape">
      <p>
        <strong>Rastreabilidade Alimentar — {paciente}</strong>
      </p>
      <p>Nutricionista: {nutricionista}</p>
    </footer>
  );
}
