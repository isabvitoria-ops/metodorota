/**
 * Composição corporal e gasto energético.
 *
 * As contas são as de nutri/ sem mudança: `calculos.mjs` (densidade,
 * conversões, índices), `protocolos.mjs` (as equações de dobras) e
 * `motor/` (gasto energético, MET). Aqui só se lê a tela — e se mostra.
 */
import { useEffect, useId, useMemo } from "react";
import {
  ATIVIDADE,
  CONVERSOES,
  classificarIMC,
  imc,
  massaGorda,
  massaMagra,
  pesoIdeal,
  relacaoCinturaQuadril,
  riscoCintura,
  riscoRCQ,
} from "./motor/calculos.mjs";
import { PROTOCOLOS } from "./motor/protocolos.mjs";
import { CATEGORIAS, equacaoPorId } from "./motor/gasto/equacoes.mjs";
import { calcularGasto, compararEquacoes } from "./motor/gasto/gasto.mjs";
import { fmt as fmtMotor } from "./motor/gasto/formato.mjs";
import { ATIVIDADES_MET } from "./motor/gasto/met-dados.mjs";
import { metPeloNome } from "./motor/gasto/met.mjs";
import { LINHAS_MET, equacoesOrdenadas, hojeLocal, type Campos } from "./estado";
import { mostrar, num } from "./tabela";
import { Avisos, BotaoConfirmar, CampoSelecao, CampoTexto, Grade, Pares, Secao } from "./ui";

export const DOBRAS: [string, string][] = [
  ["biceps", "Bíceps"],
  ["triceps", "Tríceps"],
  ["peitoral", "Peitoral / tórax"],
  ["subescapular", "Subescapular"],
  ["axilar", "Axilar média"],
  ["suprailiaca", "Supra-ilíaca"],
  ["abdominal", "Abdominal"],
  ["coxa", "Coxa"],
  ["panturrilha", "Panturrilha"],
];

export const CIRCUNFERENCIAS: [string, string][] = [
  ["peitoral", "Peitoral"],
  ["cintura", "Cintura"],
  ["abdomen", "Abdômen"],
  ["quadril", "Quadril"],
  ["braco_dir", "Braço direito"],
  ["braco_contraido", "Braço contraído"],
  ["coxa_dir", "Coxa direita"],
  ["coxa_esq", "Coxa esquerda"],
  ["pant_dir", "Panturrilha direita"],
  ["pant_esq", "Panturrilha esquerda"],
];

/** Limites de DIGITAÇÃO, não clínicos (ver nutri/app.mjs). */
const FAIXAS = {
  idade: { min: 2, max: 110, nome: "Idade", unidade: "anos" },
  peso: { min: 10, max: 350, nome: "Peso", unidade: "kg" },
  altura: { min: 80, max: 230, nome: "Altura", unidade: "cm" },
  dobra: { min: 1, max: 80, nome: "Dobra", unidade: "mm" },
  circunferencia: { min: 10, max: 250, nome: "Circunferência", unidade: "cm" },
};
type Faixa = (typeof FAIXAS)[keyof typeof FAIXAS];

function lerMedida(bruto0: string | undefined, faixa: Faixa, avisos: string[], rotulo: string = faixa.nome): number {
  const bruto = String(bruto0 ?? "").trim();
  if (!bruto) return 0;
  const n = Number(bruto.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) {
    avisos.push(`${rotulo}: não entendi "${bruto}" como número — não entrou na conta.`);
    return 0;
  }
  if (n === 0) return 0;
  if (n < 0) {
    avisos.push(`${rotulo}: valor negativo (${bruto}) não existe — não entrou na conta.`);
    return 0;
  }
  if (faixa === FAIXAS.altura && n > 0.5 && n < 2.6) {
    avisos.push(`Altura: ${bruto} parece estar em metros. O campo é em centímetros — escreva ${mostrar(n * 100, 0)}.`);
    return 0;
  }
  if (n < faixa.min || n > faixa.max) {
    avisos.push(
      `${rotulo}: ${bruto} ${faixa.unidade} está fora do que dá para medir ` +
        `(${faixa.min} a ${faixa.max} ${faixa.unidade}) — confira a digitação. Não entrou na conta.`,
    );
    return 0;
  }
  return n;
}

type Protocolo = {
  rotulo: string;
  nota: string;
  dobras: Record<string, string[]>;
  conversao?: string;
  usaIdade?: boolean;
  idade?: [number, number];
  soMasculinaConferida?: boolean;
  percentual?: (a: object) => number | null;
  densidade?: (a: object) => number | null;
};

type Equacao = {
  id: string;
  nome: string;
  status?: string;
  resultado?: string;
  entradas: string[];
  fonte?: string;
  observacao?: string;
  conferida?: string;
  atividade?: { tipo?: string; niveis?: { chave: string; rotulo: string }[] };
};

const EXPLICA_MODO: Record<string, string> = {
  fa: "Um fator só para a atividade do dia inteiro (GET = GEB × fator). Nas equações que já trazem o nível de atividade dentro da fórmula, o nível é o da própria equação.",
  met: "A base é SEDENTÁRIA (GEB × 1,2) e os exercícios entram à parte pelo MET líquido. O fator de atividade some de propósito: usar os dois contaria a atividade duas vezes.",
};

export function AbaCorpo({ corpo, mudar }: { corpo: Campos; mudar: (c: Campos) => void }) {
  const idLista = useId();
  const c = (id: string) => corpo[id] ?? "";
  const protocolos = PROTOCOLOS as unknown as Record<string, Protocolo>;
  const protocoloId = protocolos[c("c-protocolo")] ? c("c-protocolo") : (Object.keys(protocolos)[0] as string);
  const dados = protocolos[protocoloId] as Protocolo;

  // Trocar de equação de dobras puxa a conversão do autor dela (Siri, Brozek…):
  // herdar a do protocolo anterior daria um percentual errado com cara de certo.
  useEffect(() => {
    if (!dados.percentual && dados.conversao && c("c-equacao") !== dados.conversao) {
      mudar({ "c-equacao": dados.conversao });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocoloId]);

  // Categoria → equação → nível: a escolha guardada vale se ainda existir.
  const equacoes = equacoesOrdenadas(c("g-categoria")) as unknown as Equacao[];
  const eq = (equacaoPorId(c("g-equacao")) as Equacao | undefined) ?? equacoes[0];
  useEffect(() => {
    if (eq && eq.id !== c("g-equacao")) mudar({ "g-equacao": eq.id });
    const niveis = eq?.atividade?.tipo === "pa" ? (eq.atividade.niveis ?? []) : [];
    if (niveis.length && !niveis.some((n) => n.chave === c("g-pa"))) mudar({ "g-pa": niveis[0]!.chave });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eq?.id]);

  const r = useMemo(() => {
    const sexo = c("c-sexo") || "feminino";
    const avisosDados: string[] = [];
    const idade = lerMedida(c("c-idade"), FAIXAS.idade, avisosDados);
    const faixaPeso = !idade || idade < 10 ? { ...FAIXAS.peso, min: 2 } : FAIXAS.peso;
    const peso = lerMedida(c("c-peso"), faixaPeso, avisosDados);
    const alturaCm = lerMedida(c("c-altura"), FAIXAS.altura, avisosDados);
    const usadas = dados.dobras[sexo] ?? [];
    const nomes = usadas.map((k) => (DOBRAS.find(([x]) => x === k)?.[1] ?? k).toLowerCase()).join(", ");
    const quaisDobras = usadas.length
      ? `${dados.rotulo}: ${dados.percentual || protocoloId === "katch" ? "usa" : "soma"} ${nomes}. ${dados.nota}`
      : dados.soMasculinaConferida
        ? `${dados.rotulo}: aqui está só a versão masculina. A feminina tem outros coeficientes e ainda não foi conferida contra a fonte — escolha outra equação para mulher.`
        : `${dados.rotulo} não tem equação publicada para este sexo. Escolha outro protocolo.`;

    const dobraLida: Record<string, number> = {};
    for (const [k, rotulo] of DOBRAS) {
      dobraLida[k] = lerMedida(c(`dob-${k}`), FAIXAS.dobra, avisosDados, `Dobra ${rotulo.toLowerCase()}`);
    }
    for (const [k, rotulo] of CIRCUNFERENCIAS) lerMedida(c(`cir-${k}`), FAIXAS.circunferencia, avisosDados, rotulo);

    const valores = Object.fromEntries(usadas.map((k) => [k, dobraLida[k] ?? 0]));
    const lista = usadas.map((k) => valores[k] ?? 0);
    const faltando = lista.filter((v) => !v).length;
    const soma = lista.reduce((t, v) => t + v, 0);
    const conversoes = CONVERSOES as Record<string, { rotulo: string; calcular: (d: number) => number }>;
    const conversao = conversoes[c("c-equacao")] ?? conversoes.siri!;

    let percentual: number | null = null;
    let densidade: number | null = null;
    if (!faltando && soma > 0) {
      if (dados.percentual) percentual = dados.percentual({ soma, idade, sexo, valores });
      else if (dados.densidade) {
        densidade = dados.densidade({ soma, idade, sexo, valores });
        percentual = densidade === null ? null : conversao.calcular(densidade);
      }
    }
    const gorda = massaGorda(peso, percentual) as number | null;
    const magra = massaMagra(peso, percentual) as number | null;
    const indice = imc(peso, alturaCm / 100) as number | null;

    const avisosCorpo: string[] = [];
    const semFaixaDurnin = protocoloId === "durnin" && idade && idade < 17;
    if (faltando && soma > 0) {
      avisosCorpo.push(
        `Falta preencher ${faltando} ${faltando === 1 ? "dobra" : "dobras"} deste protocolo. ` +
          "Não calculo o percentual com dobra faltando — o resultado sairia errado sem avisar.",
      );
    } else if (!idade && soma > 0 && dados.usaIdade) {
      avisosCorpo.push("Esta equação usa a idade. Preencha para o percentual aparecer.");
    }
    if (semFaixaDurnin && soma > 0) avisosCorpo.push("Durnin & Womersley não tem coeficientes abaixo de 17 anos — escolha outra equação.");
    if (!semFaixaDurnin && idade && dados.idade && usadas.length && (idade < dados.idade[0] || idade > dados.idade[1])) {
      avisosCorpo.push(
        `${dados.rotulo} foi validada de ${dados.idade[0]} a ${dados.idade[1]} anos, e a idade informada é ` +
          `${mostrar(idade, 0)}. A conta sai, mas o resultado pode não valer para esta pessoa.`,
      );
    }

    const cintura = lerMedida(c("cir-cintura"), FAIXAS.circunferencia, []);
    const quadril = lerMedida(c("cir-quadril"), FAIXAS.circunferencia, []);
    const rcq = relacaoCinturaQuadril(cintura, quadril) as number | null;
    const faixaPeso2 = pesoIdeal(alturaCm / 100) as { minimo: number; maximo: number } | null;

    return {
      sexo, idade, peso, alturaCm, quaisDobras, avisosDados, avisosCorpo, usadas, soma, dobraLida,
      densidade, percentual, gorda, magra, indice, conversao, cintura, rcq, faixaPeso: faixaPeso2,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpo, protocoloId]);

  const gasto = useMemo(() => {
    if (!eq) return null;
    const modo = c("g-modo") || "fa";
    const mm = num(c("c-mm"));
    const entrada = {
      sexo: r.sexo,
      idade: r.idade,
      peso: r.peso,
      alturaCm: r.alturaCm,
      massaMagra: mm > 0 ? mm : r.magra || 0,
      semanaGestacional: num(c("g-sg")),
      pesoPreGestacional: num(c("g-pre")),
      idadeMeses: c("g-meses").trim() === "" ? NaN : num(c("g-meses")),
    };
    const exercicios = [];
    for (let i = 0; i < LINHAS_MET; i++) {
      const met = num(c(`met-valor-${i}`));
      const minutos = num(c(`met-min-${i}`));
      const vezes = num(c(`met-vezes-${i}`));
      if (met || minutos || vezes || c(`met-nome-${i}`).trim()) {
        exercicios.push({ nome: c(`met-nome-${i}`).trim(), met, minutos, vezes });
      }
    }
    const atividade = { modo, fa: num(c("c-atividade")) || 1, fao: c("c-fao") || "leve", pa: c("g-pa") || "sedentario", exercicios };
    return {
      modo,
      res: calcularGasto(eq, entrada, atividade) as {
        ok: boolean; motivo?: string; geb: number; fator?: number; modo?: string; kcalMet?: number; get: number;
        avisos: string[]; passos: { rotulo: string; texto: string }[];
        atividades: { nome: string; met: number; minutos: number; vezes: number; kcal: number | null }[];
      },
      comp: compararEquacoes(entrada, atividade) as { equacao: Equacao; resultado: { geb: number; get: number } }[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpo, eq?.id, r]);

  const tipo = eq?.atividade?.tipo;
  const modo = c("g-modo") || "fa";
  const campo = (id: string, rotulo: string, extra: { dica?: string; placeholder?: string } = {}) => (
    <CampoTexto key={id} rotulo={rotulo} valor={c(id)} aoMudar={(v) => mudar({ [id]: v })} {...extra} />
  );

  function limpar() {
    const vazios: Campos = {};
    for (const [k, v] of Object.entries(corpo)) {
      if (!SELECOES.has(k) && v) vazios[k] = "";
    }
    vazios["c-data"] = hojeLocal();
    mudar(vazios);
  }

  const conv = CONVERSOES as Record<string, { rotulo: string }>;

  return (
    <div className="c-calc">
      <Secao
        numero={1}
        titulo="Dados gerais"
        acoes={<BotaoConfirmar rotulo="Limpar avaliação" pergunta="Limpar mesmo?" aoConfirmar={limpar} titulo="A dieta desta ficha continua." />}
      >
        <Grade>
          {campo("c-data", "Data da avaliação")}
          <CampoSelecao
            rotulo="Sexo"
            valor={c("c-sexo") || "feminino"}
            aoMudar={(v) => mudar({ "c-sexo": v })}
            opcoes={[
              { valor: "feminino", rotulo: "Feminino" },
              { valor: "masculino", rotulo: "Masculino" },
            ]}
          />
          {campo("c-idade", "Idade (anos)")}
          {campo("c-peso", "Peso (kg)")}
          {campo("c-altura", "Altura (cm)")}
        </Grade>
        <Avisos linhas={r.avisosDados} />
      </Secao>

      <Secao numero={2} titulo="Dobras cutâneas" dica="Em milímetros. Preencha as do protocolo; as outras somam no total.">
        <Grade>{DOBRAS.map(([k, rotulo]) => campo(`dob-${k}`, rotulo))}</Grade>
      </Secao>

      <Secao numero={3} titulo="Circunferências" dica="Em centímetros.">
        <Grade>{CIRCUNFERENCIAS.map(([k, rotulo]) => campo(`cir-${k}`, rotulo))}</Grade>
      </Secao>

      <Secao numero={4} titulo="Protocolo e resultado" dica={r.quaisDobras}>
        <Grade>
          <CampoSelecao
            rotulo="Equação de dobras"
            valor={protocoloId}
            aoMudar={(v) => mudar({ "c-protocolo": v })}
            opcoes={Object.entries(protocolos).map(([k, p]) => ({ valor: k, rotulo: p.rotulo }))}
          />
          <CampoSelecao
            rotulo="Conversão em percentual"
            valor={c("c-equacao") || "siri"}
            aoMudar={(v) => mudar({ "c-equacao": v })}
            desligado={Boolean(dados.percentual)}
            opcoes={Object.entries(conv).map(([k, x]) => ({ valor: k, rotulo: x.rotulo }))}
            dica={
              dados.percentual
                ? "Esta equação devolve o percentual direto — não passa por conversão."
                : `${dados.rotulo} foi publicada com ${conv[dados.conversao ?? "siri"]?.rotulo}.`
            }
          />
        </Grade>
        <Pares
          itens={[
            [
              "Soma do protocolo",
              mostrar(r.soma, 1, " mm"),
              protocoloId === "katch"
                ? `${r.usadas.length} dobras · esta equação NÃO usa a soma — cada dobra entra com o seu coeficiente`
                : `${r.usadas.length} dobras · é esta que entra na conta`,
            ],
            ["Soma de todas", mostrar(DOBRAS.reduce((t, [k]) => t + (r.dobraLida[k] ?? 0), 0), 1, " mm"), "todas as dobras anotadas"],
            ["Densidade", r.densidade ? mostrar(r.densidade, 4) : "—", r.densidade ? "g/cm³" : ""],
            [
              "Gordura",
              r.percentual === null ? "—" : mostrar(r.percentual, 2, "%"),
              r.percentual === null ? "" : dados.percentual ? "da própria equação" : `por ${r.conversao.rotulo}`,
            ],
            ["Massa gorda", mostrar(r.gorda, 1, " kg")],
            ["Massa magra", mostrar(r.magra, 1, " kg")],
          ]}
        />
        <Avisos linhas={r.avisosCorpo} />
      </Secao>

      <Secao
        numero={5}
        titulo="Índices e faixas"
        dica="IMC e cintura pela OMS; relação cintura/quadril pelos cortes da OMS (0,85 na mulher, 0,90 no homem). O peso ideal é o que corresponde ao IMC 18,5 – 24,9 naquela altura."
      >
        <Pares
          itens={[
            ["IMC", mostrar(r.indice, 1), (classificarIMC(r.indice) as string | null) ?? "kg/m²"],
            [
              "Peso ideal",
              r.faixaPeso ? `${mostrar(r.faixaPeso.minimo, 1)} – ${mostrar(r.faixaPeso.maximo, 1)}` : "—",
              r.faixaPeso ? "kg · IMC 18,5–24,9" : "",
            ],
            ["Cintura", r.cintura ? mostrar(r.cintura, 1, " cm") : "—", (riscoCintura(r.cintura, r.sexo) as string | null) ?? ""],
            ["Cintura/quadril", r.rcq === null ? "—" : mostrar(r.rcq, 2), (riscoRCQ(r.rcq, r.sexo) as string | null) ?? ""],
          ]}
        />
      </Secao>

      <Secao numero={6} titulo="Gasto energético" dica={EXPLICA_MODO[modo]}>
        <Grade>
          <CampoSelecao
            rotulo="Categoria"
            valor={c("g-categoria") || "geral"}
            aoMudar={(v) => mudar({ "g-categoria": v })}
            opcoes={(CATEGORIAS as { chave: string; rotulo: string }[]).map((x) => ({ valor: x.chave, rotulo: x.rotulo }))}
          />
          <CampoSelecao
            rotulo="Equação"
            valor={eq?.id ?? ""}
            aoMudar={(v) => mudar({ "g-equacao": v })}
            opcoes={equacoes.map((x) => ({
              valor: x.id,
              rotulo: (x as Equacao).nome + (x.status === "aguardando_fonte" ? " — aguardando fonte" : ""),
            }))}
          />
          {eq?.entradas.includes("massaMagra") && campo("c-mm", "Massa magra (kg)", { placeholder: "vazio = a das dobras" })}
          {eq?.entradas.includes("semanaGestacional") && campo("g-sg", "Semana gestacional", { placeholder: "ex.: 20" })}
          {eq?.id === "dri2023_gestante" && campo("g-pre", "Peso antes da gravidez (kg)", { placeholder: "vazio = peso atual" })}
          {eq?.entradas.includes("idadeMeses") && campo("g-meses", "Idade em meses (0 a 35)", { placeholder: "ex.: 8" })}
        </Grade>
        <Grade>
          <CampoSelecao
            rotulo="Como contar a atividade física"
            valor={modo}
            aoMudar={(v) => mudar({ "g-modo": v })}
            opcoes={[
              { valor: "fa", rotulo: "Fator de atividade (um número só)" },
              { valor: "met", rotulo: "Sedentário + exercícios (MET)" },
            ]}
          />
          {modo !== "met" && tipo !== "pa" && tipo !== "fao" && (
            <CampoSelecao
              rotulo="Fator de atividade"
              valor={c("c-atividade") || "1.375"}
              aoMudar={(v) => mudar({ "c-atividade": v })}
              opcoes={(ATIVIDADE as { rotulo: string; fator: number }[]).map((a) => ({ valor: String(a.fator), rotulo: `${a.rotulo} — ×${a.fator}` }))}
            />
          )}
          {modo !== "met" && tipo === "fao" && (
            <CampoSelecao
              rotulo="Atividade ocupacional (FAO/OMS)"
              valor={c("c-fao") || "leve"}
              aoMudar={(v) => mudar({ "c-fao": v })}
              opcoes={[
                { valor: "leve", rotulo: "Leve" },
                { valor: "moderada", rotulo: "Moderada" },
                { valor: "intensa", rotulo: "Intensa" },
              ]}
            />
          )}
          {modo !== "met" && tipo === "pa" && (
            <CampoSelecao
              rotulo="Nível de atividade (da equação)"
              valor={c("g-pa")}
              aoMudar={(v) => mudar({ "g-pa": v })}
              opcoes={(eq?.atividade?.niveis ?? []).map((n) => ({ valor: n.chave, rotulo: n.rotulo }))}
            />
          )}
        </Grade>

        {modo === "met" && (
          <div className="c-cx-met">
            <p className="c-calc-dica">
              Exercícios, pelo MET do Compêndio de Atividades Físicas. Conta só o que passa do repouso — (MET − 1) — porque o
              gasto basal já inclui o repouso. Comece a digitar o nome da atividade ({(ATIVIDADES_MET as unknown[]).length}{" "}
              opções) e escolha na lista: o MET entra sozinho e pode ser corrigido.
            </p>
            <datalist id={idLista}>
              {(ATIVIDADES_MET as [unknown, string, number][]).map(([, nome], i) => (
                <option key={i} value={nome} />
              ))}
            </datalist>
            {Array.from({ length: LINHAS_MET }, (_, i) => (
              <div className="c-cx-met-linha" key={i}>
                <input
                  className="c-input"
                  list={idLista}
                  autoComplete="off"
                  placeholder="Atividade (ex.: corrida)"
                  aria-label={`Atividade ${i + 1}`}
                  value={c(`met-nome-${i}`)}
                  onChange={(e) => {
                    const nome = e.target.value;
                    const met = metPeloNome(nome, ATIVIDADES_MET) as number | null;
                    mudar(met !== null ? { [`met-nome-${i}`]: nome, [`met-valor-${i}`]: String(met).replace(".", ",") } : { [`met-nome-${i}`]: nome });
                  }}
                />
                {(["met-valor", "met-min", "met-vezes"] as const).map((p) => (
                  <input
                    key={p}
                    className="c-input"
                    inputMode="decimal"
                    placeholder={p === "met-valor" ? "MET" : p === "met-min" ? "min/sessão" : "vezes/sem."}
                    aria-label={`${p === "met-valor" ? "MET" : p === "met-min" ? "Minutos por sessão" : "Vezes por semana"} da atividade ${i + 1}`}
                    value={c(`${p}-${i}`)}
                    onChange={(e) => mudar({ [`${p}-${i}`]: e.target.value })}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {gasto && eq && (
          <>
            <p className="c-cx-equacao">
              {eq.nome}{" "}
              <span className={`c-cx-selo${eq.status === "aguardando_fonte" ? " c-cx-selo--espera" : ""}`}>
                {eq.status === "aguardando_fonte" ? "aguardando fonte" : "em vistoria"}
              </span>
            </p>
            {!gasto.res.ok ? (
              <p className="c-calc-dica">{gasto.res.motivo}</p>
            ) : (
              <>
                <Pares
                  itens={[
                    [eq.resultado === "get" ? "Gasto da fórmula (TEE/EER)" : "GEB (gasto basal)", mostrar(gasto.res.geb, 0, " kcal")],
                    ...(gasto.res.fator
                      ? ([["Fator de atividade", mostrar(gasto.res.fator, 3), gasto.res.modo === "met" ? "sedentário" : ""]] as [string, string, string][])
                      : []),
                    ...(gasto.res.modo === "met"
                      ? ([["Exercícios (MET líquido)", mostrar(gasto.res.kcalMet, 0, " kcal"), "por dia, em média"]] as [string, string, string][])
                      : []),
                    ["GET (gasto total)", mostrar(gasto.res.get, 0, " kcal"), "por dia"],
                  ]}
                />
                <Avisos linhas={gasto.res.avisos} />
              </>
            )}
            <details className="c-cx-detalhe" open>
              <summary>Como este cálculo é feito</summary>
              {gasto.res.ok && (
                <ul className="c-cx-passos">
                  {gasto.res.passos.map((p, i) => (
                    <li key={i}>
                      <strong>{p.rotulo}:</strong> <code>{p.texto}</code>
                    </li>
                  ))}
                  {gasto.res.modo === "met" &&
                    gasto.res.atividades.map((a, i) => (
                      <li key={`met-${i}`}>
                        <strong>MET:</strong>{" "}
                        <code>
                          {a.nome || "atividade"} — ({fmtMotor(a.met)} − 1) × {fmtMotor(r.peso)} kg × {fmtMotor(a.minutos)}/60 h ×{" "}
                          {fmtMotor(a.vezes)}/7 = {a.kcal === null ? "faltam dados" : `${fmtMotor(a.kcal, 1)} kcal/dia`}
                        </code>
                      </li>
                    ))}
                </ul>
              )}
              <p className="c-calc-dica">
                <strong>Fonte:</strong> {eq.fonte}
              </p>
              {eq.observacao && <p className="c-calc-dica">{eq.observacao}</p>}
              {eq.conferida && (
                <p className="c-calc-dica">
                  <strong>Conferência:</strong> {eq.conferida}
                </p>
              )}
            </details>
            <details className="c-cx-detalhe">
              <summary>Comparar com as outras equações</summary>
              {gasto.comp.length ? (
                <div className="c-calc-rolagem">
                  <table className="c-calc-macros-tabela">
                    <thead>
                      <tr>
                        <th scope="col">Equação</th>
                        <th scope="col">GEB</th>
                        <th scope="col">GET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gasto.comp.map(({ equacao, resultado }) => (
                        <tr key={equacao.id}>
                          <th scope="row">{equacao.nome}</th>
                          <td>{mostrar(resultado.geb, 0)}</td>
                          <td>{mostrar(resultado.get, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="c-calc-dica">Preencha sexo, idade, peso e altura para comparar.</p>
              )}
            </details>
            <p className="c-calc-dica">
              Cada equação mostra a fonte e o estado: <strong>em vistoria</strong> quer dizer que os coeficientes ainda
              precisam ser conferidos por você contra a fonte. <strong>Aguardando fonte</strong>: a fórmula não foi exposta e não
              será inventada.
            </p>
          </>
        )}
      </Secao>
    </div>
  );
}

/** Os campos que são listas: "limpar" não os esvazia (lista vazia não existe). */
const SELECOES = new Set(["c-sexo", "c-protocolo", "c-equacao", "c-atividade", "c-fao", "g-categoria", "g-equacao", "g-pa", "g-modo"]);
