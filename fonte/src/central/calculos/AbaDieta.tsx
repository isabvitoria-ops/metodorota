/**
 * A dieta: refeições, total do dia (macros) e — novo — os micronutrientes
 * do dia, com os dados que as tabelas já trazem. Regras de soma iguais às de
 * nutri/: valor que a tabela não traz não entra como zero (marca *), e o
 * traço da TACO (Tr) não soma nem deixa o total incompleto.
 */
import { useEffect, useState } from "react";
import { distribuicao, porGramas, porQuilo } from "./motor/calculos.mjs";
import { MEDIDA_GRAMA, gramasDoItem, itensDoDia, normalizarRefeicao, refeicaoNova } from "./motor/dieta.mjs";
import type { Dieta, Refeicao } from "./estado";
import { CartaoRefeicao, MACROS, type SugestaoAberta } from "./Refeicao";
import { MeusAlimentos } from "./MeusAlimentos";
import {
  alimentoPorId,
  base,
  medidasDoAlimento,
  mostrar,
  num,
  porcaoDoSubstituto,
  porcaoEmTexto,
  somaDoNutriente,
  valorDe,
  type ItemDaDieta,
  type Medida,
} from "./tabela";
import { Avisos, BotaoConfirmar, CampoTexto, Grade, Pares, Secao } from "./ui";

/**
 * Os micronutrientes que as tabelas trazem. Unidades das próprias tabelas
 * (ver nutri/scripts/extrair-taco.py e extrair-usda.py): minerais, vitaminas
 * do complexo B, vitamina C e colesterol em mg; retinol e vitamina A em µg;
 * ácidos graxos em g. O IBGE só traz os macros — nele tudo isto é "—".
 */
const MICROS: { chave: string; nome: string; unidade: string; casas: number }[] = [
  { chave: "sodio", nome: "Sódio", unidade: "mg", casas: 0 },
  { chave: "potassio", nome: "Potássio", unidade: "mg", casas: 0 },
  { chave: "calcio", nome: "Cálcio", unidade: "mg", casas: 0 },
  { chave: "fosforo", nome: "Fósforo", unidade: "mg", casas: 0 },
  { chave: "magnesio", nome: "Magnésio", unidade: "mg", casas: 0 },
  { chave: "ferro", nome: "Ferro", unidade: "mg", casas: 1 },
  { chave: "zinco", nome: "Zinco", unidade: "mg", casas: 1 },
  { chave: "cobre", nome: "Cobre", unidade: "mg", casas: 2 },
  { chave: "manganes", nome: "Manganês", unidade: "mg", casas: 2 },
  { chave: "vitamina_c", nome: "Vitamina C", unidade: "mg", casas: 1 },
  { chave: "vitamina_a_rae", nome: "Vitamina A (RAE)", unidade: "µg", casas: 0 },
  { chave: "retinol", nome: "Retinol", unidade: "µg", casas: 0 },
  { chave: "tiamina", nome: "Tiamina (B1)", unidade: "mg", casas: 2 },
  { chave: "riboflavina", nome: "Riboflavina (B2)", unidade: "mg", casas: 2 },
  { chave: "niacina", nome: "Niacina (B3)", unidade: "mg", casas: 1 },
  { chave: "piridoxina", nome: "Piridoxina (B6)", unidade: "mg", casas: 2 },
  { chave: "colesterol", nome: "Colesterol", unidade: "mg", casas: 0 },
  { chave: "ag_saturados", nome: "Gordura saturada", unidade: "g", casas: 1 },
  { chave: "ag_monoinsaturados", nome: "Gordura monoinsaturada", unidade: "g", casas: 1 },
  { chave: "ag_poliinsaturados", nome: "Gordura poli-insaturada", unidade: "g", casas: 1 },
];

/** A dieta em texto, para colar no WhatsApp — com TODAS as opções. */
function textoDaDieta(nome: string, dieta: Dieta): string {
  const linhas: string[] = [];
  if (nome.trim()) linhas.push(nome.trim(), "");
  for (const r of dieta.refeicoes) {
    if (!r.opcoes.some((o) => o.itens.length)) continue;
    linhas.push(`${r.horario ? `${r.horario} · ` : ""}${r.nome.toUpperCase()}`);
    r.opcoes.forEach((opcao, i) => {
      if (!opcao.itens.length) return;
      if (r.opcoes.length > 1) linhas.push(`  [${opcao.rotulo}]`);
      for (const item of opcao.itens) {
        const a = alimentoPorId(item.codigo);
        const g = gramasDoItem(item);
        const kcal = a ? (porGramas(valorDe(a, "energia_kcal"), g) as number | null) : null;
        linhas.push(`    ${a ? a.nome : item.nome} — ${porcaoEmTexto(item.quantidade, item.medida, g)}${kcal !== null ? ` · ${mostrar(kcal, 0)} kcal` : ""}`);
        for (const sub of item.substitutos ?? []) {
          const porcao = porcaoDoSubstituto(item, sub);
          if (!porcao) continue;
          const troca = alimentoPorId(sub.codigo);
          linhas.push(`      ou ${troca ? troca.nome : sub.nome} — ${porcaoEmTexto(porcao.quantidade, sub.medida, porcao.gramas)}`);
        }
      }
      if (i < r.opcoes.length - 1 && r.opcoes[i + 1]!.itens.length) linhas.push("    — ou —");
    });
    linhas.push("");
  }
  return linhas.join("\n");
}

/**
 * A medida guardada é reencontrada pelo nome e acompanha a lista atual (se
 * ela mudou o scoop de 30 para 32 g, vale 32). A ferramenta antiga fazia isto
 * ao desenhar; aqui é feito uma vez, ao abrir, e gravado.
 */
function comMedidasAtuais(d: Dieta): Dieta {
  const ajustar = (codigo: string, medida: { nome: string; gramas: number }) => {
    const lista = medidasDoAlimento(codigo);
    const achada: Medida = lista.find((m) => m.nome.toLowerCase() === String(medida?.nome ?? "").toLowerCase()) ?? lista[0] ?? (MEDIDA_GRAMA as Medida);
    return { nome: achada.nome, gramas: achada.gramas, ...(achada.ref ? { ref: achada.ref } : {}) };
  };
  const copia: Dieta = JSON.parse(JSON.stringify(d));
  for (const r of copia.refeicoes)
    for (const o of r.opcoes)
      for (const it of o.itens as ItemDaDieta[]) {
        const m = ajustar(it.codigo, it.medida);
        if (m.nome !== it.medida?.nome || m.gramas !== it.medida?.gramas) it.medida = m;
        for (const sub of it.substitutos ?? []) sub.medida = ajustar(sub.codigo, sub.medida);
      }
  return copia;
}

export function AbaDieta({
  nome,
  dieta,
  mudarDieta,
}: {
  nome: string;
  dieta: Dieta;
  mudarDieta: (f: (d: Dieta) => Dieta) => void;
}) {
  const [pronta, definirPronta] = useState(base.alimentos.length > 0);
  const [erro, definirErro] = useState<string | null>(null);
  const [versao, definirVersao] = useState(0);
  const [sugestao, definirSugestao] = useState<SugestaoAberta | null>(null);
  const [copiado, definirCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    base
      .carregar()
      .then(() => vivo && definirPronta(true))
      .catch(() => vivo && definirErro("Não consegui carregar a tabela de alimentos. Recarregue a página; se continuar, me avise."));
    return () => {
      vivo = false;
    };
  }, []);

  // Medidas atualizadas: ao carregar a base, ao trocar de ficha e quando ela cria ou edita medida.
  const chaveDaDieta = JSON.stringify(dieta.refeicoes.map((r) => r.opcoes.map((o) => o.itens.map((i) => [i.codigo, i.medida?.nome, i.medida?.gramas]))));
  useEffect(() => {
    if (!pronta) return;
    const nova = comMedidasAtuais(dieta);
    if (JSON.stringify(nova) !== JSON.stringify(dieta)) mudarDieta(() => nova);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta, versao, chaveDaDieta]);

  const editar = (f: (d: Dieta) => void) =>
    mudarDieta((d) => {
      const copia: Dieta = JSON.parse(JSON.stringify(d));
      f(copia);
      return copia;
    });

  if (erro) return <Avisos linhas={[erro]} tom="erro" />;
  if (!pronta) return <p className="c-calc-espera">Carregando as tabelas de alimentos…</p>;

  // ---- total do dia: só a opção aberta de cada refeição ----
  const todos = itensDoDia(dieta.refeicoes) as ItemDaDieta[];
  const soma: Record<string, number | null> = {};
  const incompleto: Record<string, boolean> = {};
  let faltouAlgo = 0;
  let tracosNoDia = 0;
  for (const [chave] of MACROS) {
    const { total, faltando, tracos } = somaDoNutriente(todos, chave);
    soma[chave] = total;
    incompleto[chave] = faltando > 0;
    faltouAlgo += faltando;
    tracosNoDia += tracos;
  }
  const marca = (chave: string) => (incompleto[chave] ? " *" : "");
  const peso = Math.max(0, num(dieta.peso));
  const meta = Math.max(0, num(dieta.meta));
  const dist = distribuicao(soma.carboidrato, soma.proteina, soma.lipideos) as Record<string, number> | null;
  const gramas = (v: number | null, chave: string) => (v === null ? "—" : `${mostrar(v, 1)} g${marca(chave)}`);
  const apoio = (chave: string, valor: number | null) =>
    dist ? `${mostrar(dist[chave], 0)}%` + (peso ? ` · ${mostrar(porQuilo(valor, peso) as number | null, 1)} g/kg` : "") : "";

  const micros = MICROS.map((m) => ({ ...m, ...somaDoNutriente(todos, m.chave) }));
  const algumMicro = micros.some((m) => m.total !== null);
  const r = base.resumo;

  return (
    <div className="c-calc">
      <Secao numero={1} titulo="Paciente">
        <Grade>
          <CampoTexto rotulo="Peso (kg) — para o g/kg" valor={dieta.peso} placeholder="65" aoMudar={(v) => mudarDieta((d) => ({ ...d, peso: v }))} invalido={num(dieta.peso) < 0} />
          <CampoTexto rotulo="Meta de calorias (opcional)" valor={dieta.meta} placeholder="1600" aoMudar={(v) => mudarDieta((d) => ({ ...d, meta: v }))} invalido={num(dieta.meta) < 0} />
        </Grade>
      </Secao>

      <Secao
        numero={2}
        titulo="Refeições"
        dica="Busque o alimento e aperte Enter. A opção aberta de cada refeição é a que entra no total do dia."
        acoes={
          <BotaoConfirmar
            rotulo="Limpar dieta"
            pergunta="Limpar mesmo?"
            titulo="A avaliação física desta ficha continua."
            aoConfirmar={() => {
              mudarDieta(() => ({ peso: "", meta: "", refeicoes: [normalizarRefeicao(refeicaoNova("Café da manhã", "07:00")) as Refeicao] }));
              definirSugestao(null);
            }}
          />
        }
      >
        <div className="c-cx-refeicoes">
          {dieta.refeicoes.map((refeicao, iR) => (
            <CartaoRefeicao
              key={iR}
              refeicao={refeicao}
              iR={iR}
              editar={editar}
              sugestao={sugestao}
              definirSugestao={definirSugestao}
              aoMudarMedidas={() => definirVersao((v) => v + 1)}
            />
          ))}
        </div>
        <button type="button" className="c-botao c-botao-secundario c-calc-preencher" onClick={() => editar((d) => void d.refeicoes.push(refeicaoNova() as Refeicao))}>
          + Nova refeição
        </button>
      </Secao>

      <Secao numero={3} titulo="Total do dia">
        <Pares
          itens={[
            [
              "Calorias",
              mostrar(soma.energia_kcal, 0) + marca("energia_kcal"),
              meta && soma.energia_kcal !== null && soma.energia_kcal !== undefined
                ? `meta ${mostrar(meta, 0)} · ${mostrar(Math.abs(soma.energia_kcal - meta), 0)} ${soma.energia_kcal >= meta ? "acima" : "abaixo"}`
                : "",
            ],
            ["Carboidrato", gramas(soma.carboidrato ?? null, "carboidrato"), apoio("carboidrato", soma.carboidrato ?? null)],
            ["Proteína", gramas(soma.proteina ?? null, "proteina"), apoio("proteina", soma.proteina ?? null)],
            ["Gordura", gramas(soma.lipideos ?? null, "lipideos"), apoio("lipideo", soma.lipideos ?? null)],
            ["Fibra", gramas(soma.fibra_alimentar ?? null, "fibra_alimentar")],
          ]}
        />
        {faltouAlgo > 0 && (
          <Avisos
            linhas={[
              `${faltouAlgo} ${faltouAlgo === 1 ? "valor não existe" : "valores não existem"} na tabela para os alimentos escolhidos (marcados com *). Eles não entraram como zero — o total está incompleto nesses nutrientes, e é bom saber disso antes de fechar a prescrição.`,
            ]}
          />
        )}
        {tracosNoDia > 0 && (
          <p className="c-calc-dica" style={{ marginTop: 10 }}>
            {tracosNoDia} {tracosNoDia === 1 ? "valor é" : "valores são"} <strong>Tr</strong> (traço, na TACO): presente em quantidade
            mínima, sem número para somar. Não entram no total e não o deixam incompleto.
          </p>
        )}

        <details className="c-cx-detalhe" open={algumMicro}>
          <summary>Micronutrientes do dia</summary>
          {todos.length === 0 ? (
            <p className="c-calc-dica">Monte as refeições para ver os micronutrientes.</p>
          ) : (
            <>
              <div className="c-calc-rolagem">
                <table className="c-calc-macros-tabela c-cx-micros">
                  <thead>
                    <tr>
                      <th scope="col">Nutriente</th>
                      <th scope="col">No dia</th>
                      <th scope="col">Alimentos sem o dado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {micros.map((m) => (
                      <tr key={m.chave}>
                        <th scope="row">{m.nome}</th>
                        <td>
                          {m.total === null ? (m.tracos ? "Tr" : "—") : `${mostrar(m.total, m.casas)} ${m.unidade}`}
                          {m.faltando ? " *" : ""}
                        </td>
                        <td>{m.faltando ? m.faltando : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="c-calc-dica" style={{ marginTop: 8 }}>
                Os mesmos dados das tabelas, somados com a mesma regra: o que a tabela não traz não entra como zero (*). A TACO
                traz todos estes; o IBGE só os macros; a USDA traz sódio, potássio, cálcio, ferro, magnésio, zinco, vitamina C e
                colesterol.
              </p>
            </>
          )}
        </details>

        <div className="c-cx-linha" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={async () => {
              const texto = textoDaDieta(nome, dieta);
              try {
                await navigator.clipboard.writeText(texto);
                definirCopiado(true);
                window.setTimeout(() => definirCopiado(false), 1600);
              } catch {
                window.prompt("Copie daqui:", texto);
              }
            }}
          >
            {copiado ? "Copiado" : "Copiar como texto"}
          </button>
        </div>
        {r && (
          <p className="c-calc-dica" style={{ marginTop: 12 }}>
            Tabelas carregadas (valores por 100 g): <strong>TACO</strong> {r.taco.quantos} alimentos ({r.taco.nome}, {r.taco.instituicao})
            {r.ibge && (
              <>
                {" "}
                · <strong>IBGE</strong> {r.ibge.quantos} ({r.ibge.nome})
              </>
            )}
            {r.usda && (
              <>
                {" "}
                · <strong>USDA</strong> {r.usda.quantos} ({r.usda.fonte}) — com o nome em inglês, como vieram; procurar por
                “manteiga” acha “butter”
              </>
            )}
            . Cada alimento mostra de qual tabela veio. Valor que a tabela não traz aparece como “—” e não entra como zero na soma.
          </p>
        )}
      </Secao>

      <MeusAlimentos dieta={dieta} aoMudar={() => definirVersao((v) => v + 1)} />
    </div>
  );
}
