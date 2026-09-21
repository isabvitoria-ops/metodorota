import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { classificar } from "./rastreio";
import { faixaDaIntensidade, rotuloSintoma, temSintoma } from "./reintroducao";

/**
 * Os dados do documento de Rastreabilidade — a camada entre o app e o papel.
 *
 * POR QUE ISTO EXISTE SEPARADO DA TELA. O documento que ela pediu não é a
 * tela impressa: "se ainda estiver parecendo uma exportação da tela do
 * aplicativo, refaça". A tela responde "o que aconteceu hoje"; o papel
 * responde "o que eu tolero", e as duas perguntas pedem organizações
 * diferentes dos mesmos registros. Aqui mora a organização do papel.
 *
 * TRÊS REGRAS QUE VALEM PARA TUDO NESTE ARQUIVO
 *
 *   * NADA de conclusão que não esteja nos dados. Não existe "você não
 *     tolera X", "X causa o sintoma" nem "retire X". O documento diz o que
 *     foi registrado: "resposta registrada após o consumo", "não foram
 *     relatados sintomas neste registro";
 *   * a palavra PROIBIDO não aparece, e nenhum alimento vira vilão. As três
 *     faixas são "bem tolerados", "observar" e "resposta registrada";
 *   * REGISTRO REPETIDO SE CONSOLIDA. Quatro linhas de "mussarela de
 *     búfala, sem sintomas" são quatro vezes a mesma informação; viram uma
 *     linha com "3 testes registrados" e a data do último.
 */

export type FaixaDoDocumento = "bem_tolerado" | "observar" | "resposta";

export interface LinhaDoDocumento {
  alimento: string;
  faixa: FaixaDoDocumento;
  /** Quantos testes daquele alimento entraram na conta. */
  testes: number;
  /** A quantidade do último teste — é a que a paciente vai repetir. */
  quantidade: string;
  /** Data do último teste, "AAAA-MM-DD". */
  ultimaData: string;
  /** Data do primeiro, para quem quer ver desde quando. */
  primeiraData: string;
  /** "Gases, distensão" — vazio quando nenhum sintoma foi relatado. */
  sintomas: string;
  /** "Leve", "Moderado", "Intenso" — a maior registrada. Vazio se não houver. */
  intensidade: string;
  /** O que a paciente escreveu, sem ser reescrito. */
  observacao: string;
  /** A frase neutra da coluna "como me senti". */
  comoSeSentiu: string;
}

export interface ResumoDoDocumento {
  bemTolerados: number;
  observar: number;
  respostas: number;
  /** Quantos REGISTROS, não quantos alimentos. */
  testes: number;
  /** Os sintomas mais relatados, do mais frequente para o menos. */
  maisRelatados: { nome: string; vezes: number }[];
}

export interface DocumentoDeRastreio {
  paciente: string;
  /** A data do primeiro e do último registro. Nulas sem registro nenhum. */
  inicio: string | null;
  fim: string | null;
  semana: number;
  resumo: ResumoDoDocumento;
  bemTolerados: LinhaDoDocumento[];
  observar: LinhaDoDocumento[];
  respostas: LinhaDoDocumento[];
  /** O que ela pôs na lista e a paciente ainda não testou. */
  aTestar: string[];
}

const ROTULO_DA_FAIXA: Record<FaixaDoDocumento, string> = {
  bem_tolerado: "Bem tolerados",
  observar: "Observar",
  resposta: "Resposta registrada",
};

export function rotuloDaFaixa(faixa: FaixaDoDocumento): string {
  return ROTULO_DA_FAIXA[faixa];
}

/**
 * A faixa do documento sai da MESMA escada da tela.
 *
 * Duas réguas diferentes fariam o papel e o aplicativo discordarem sobre o
 * mesmo alimento — e a paciente ficaria com duas respostas, sem saber qual
 * vale. Só os nomes mudam: no papel não existe "não tolerado".
 */
function faixaDe(registros: RegistroDeReintroducao[]): FaixaDoDocumento {
  const { tom } = classificar(registros);
  if (tom === "bom") return "bem_tolerado";
  if (tom === "atencao") return "observar";
  return "resposta";
}

/** "Gases, distensão" — cada sintoma uma vez, na ordem em que apareceram. */
function sintomasDe(registros: RegistroDeReintroducao[]): string {
  const vistos: string[] = [];
  for (const r of registros) {
    if (!temSintoma(r)) continue;
    for (const s of r.sintomas) {
      if (s === "nenhum") continue;
      const nome = rotuloSintoma(s);
      if (!vistos.includes(nome)) vistos.push(nome);
    }
  }
  return vistos.join(", ");
}

/** A MAIOR intensidade registrada. A menor esconderia o pior dia. */
function intensidadeDe(registros: RegistroDeReintroducao[]): string {
  const valores = registros
    .filter(temSintoma)
    .map((r) => r.intensidade)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (valores.length === 0) return "";
  return faixaDaIntensidade(Math.max(...valores));
}

/**
 * A frase da coluna "como me senti".
 *
 * NEUTRA por obrigação: descreve o registro, nunca a pessoa. "Resposta
 * registrada após o consumo" é fato; "você não tolera" seria diagnóstico —
 * e diagnóstico é da consulta, não de uma célula de tabela.
 */
function comoSeSentiu(registros: RegistroDeReintroducao[], faixa: FaixaDoDocumento): string {
  if (faixa === "bem_tolerado") return "Não foram relatados sintomas.";
  const sintomas = sintomasDe(registros);
  if (!sintomas) return "Resposta registrada após o consumo.";
  return faixa === "observar"
    ? `${sintomas}. Vale observar em novos testes.`
    : `${sintomas}. Resposta registrada após o consumo.`;
}

/** As observações da paciente, sem repetir e sem reescrever o que ela disse. */
function observacoesDe(registros: RegistroDeReintroducao[]): string {
  const vistas: string[] = [];
  for (const r of registros) {
    const texto = (r.observacao ?? "").trim();
    if (texto && !vistas.includes(texto)) vistas.push(texto);
  }
  return vistas.join(" · ");
}

/**
 * Uma linha por ALIMENTO, não por registro.
 *
 * É o pedido 11: quatro linhas de "mussarela de búfala, sem sintomas" são
 * quatro vezes a mesma informação. Viram uma, com quantos testes e a data
 * do último.
 */
function consolidar(nome: string, registros: RegistroDeReintroducao[]): LinhaDoDocumento {
  const emOrdem = [...registros].sort((a, b) => a.data.localeCompare(b.data));
  const ultimo = emOrdem[emOrdem.length - 1]!;
  const primeiro = emOrdem[0]!;
  const faixa = faixaDe(emOrdem);

  return {
    alimento: nome,
    faixa,
    testes: emOrdem.length,
    // A quantidade do ÚLTIMO teste: é a que a paciente repetiria hoje. A do
    // primeiro pode ter sido uma tentativa menor, já superada.
    quantidade: (ultimo.quantidade ?? "").trim(),
    ultimaData: ultimo.data,
    primeiraData: primeiro.data,
    sintomas: sintomasDe(emOrdem),
    intensidade: intensidadeDe(emOrdem),
    observacao: observacoesDe(emOrdem),
    comoSeSentiu: comoSeSentiu(emOrdem, faixa),
  };
}

/** Os sintomas mais relatados, contando UM por registro em que apareceram. */
function maisRelatados(registros: RegistroDeReintroducao[]): { nome: string; vezes: number }[] {
  const conta = new Map<string, number>();
  for (const r of registros) {
    if (!temSintoma(r)) continue;
    // `Set` dentro do registro: um sintoma marcado duas vezes no mesmo
    // registro é um relato, não dois.
    for (const s of new Set(r.sintomas)) {
      if (s === "nenhum") continue;
      const nome = rotuloSintoma(s);
      conta.set(nome, (conta.get(nome) ?? 0) + 1);
    }
  }
  return [...conta.entries()]
    .map(([nome, vezes]) => ({ nome, vezes }))
    .sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Ordem do papel: o mais recente primeiro; empatando, por nome. */
function porRecencia(a: LinhaDoDocumento, b: LinhaDoDocumento): number {
  return b.ultimaData.localeCompare(a.ultimaData) || a.alimento.localeCompare(b.alimento, "pt-BR");
}

export function montarDocumento({
  paciente,
  semana,
  itens,
  registros,
}: {
  paciente: string;
  semana: number;
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
}): DocumentoDeRastreio {
  const porItem = new Map<string, RegistroDeReintroducao[]>();
  for (const r of registros) {
    const lista = porItem.get(r.itemId);
    if (lista) lista.push(r);
    else porItem.set(r.itemId, [r]);
  }

  const linhas: LinhaDoDocumento[] = [];
  for (const item of itens) {
    const meus = porItem.get(item.id);
    // Só entra o que foi TESTADO. Uma lista de alimentos ainda não testados
    // no meio do mapa de tolerância seria cobrança disfarçada — e o que
    // falta tem a própria seção, "próximos testes".
    if (!meus || meus.length === 0) continue;
    linhas.push(consolidar(item.nome, meus));
  }

  // Registro cujo item saiu da lista não some do papel: a paciente testou,
  // e o que ela viveu continua valendo.
  const nomesDeItem = new Set(itens.map((i) => i.id));
  const orfaos = new Map<string, RegistroDeReintroducao[]>();
  for (const r of registros) {
    if (nomesDeItem.has(r.itemId)) continue;
    const chave = r.itemNome || "Alimento sem nome";
    const lista = orfaos.get(chave);
    if (lista) lista.push(r);
    else orfaos.set(chave, [r]);
  }
  for (const [nome, meus] of orfaos) linhas.push(consolidar(nome, meus));

  const datas = registros.map((r) => r.data).sort();

  return {
    paciente,
    inicio: datas[0] ?? null,
    fim: datas[datas.length - 1] ?? null,
    semana,
    resumo: {
      bemTolerados: linhas.filter((l) => l.faixa === "bem_tolerado").length,
      observar: linhas.filter((l) => l.faixa === "observar").length,
      respostas: linhas.filter((l) => l.faixa === "resposta").length,
      testes: registros.length,
      maisRelatados: maisRelatados(registros),
    },
    bemTolerados: linhas.filter((l) => l.faixa === "bem_tolerado").sort(porRecencia),
    observar: linhas.filter((l) => l.faixa === "observar").sort(porRecencia),
    respostas: linhas.filter((l) => l.faixa === "resposta").sort(porRecencia),
    aTestar: itens
      .filter((i) => !porItem.has(i.id))
      .map((i) => i.nome)
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
