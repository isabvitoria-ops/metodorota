import type {
  Alimento,
  Equivalencia,
  EntradaTroca,
  GrupoAlimentar,
  Medida,
  OrigemCalculo,
  RegraEquivalencia,
  ResultadoTroca,
  TrocaSemResultado,
} from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { arredondarExibicao, converter } from "./medidas";
import { emPorcoes, medidaDePorcoes } from "./porcoes";

/**
 * O motor da Troca Inteligente (§7, §9, §10).
 *
 * Nenhuma combinação de alimentos está escrita à mão em lugar nenhum: o
 * resultado sai sempre de uma conta sobre o que está cadastrado. Há três
 * caminhos, tentados nesta ordem:
 *
 *   1. equivalência cadastrada no sentido origem → destino;
 *   2. a mesma equivalência lida ao contrário, quando ela for bidirecional;
 *   3. a razão entre as porções dos dois alimentos, quando eles são do mesmo
 *      grupo — ou de grupos que o material permita cruzar, sempre no sentido
 *      declarado: carboidrato vira fruta, fruta não vira carboidrato.
 *
 * Se nenhum caminho fecha, o retorno é uma falha com motivo — a tela explica
 * ao paciente o que está faltando em vez de mostrar um número chutado.
 */

/** Dependências do cálculo. Existe para os testes rodarem sobre um catálogo de mentira. */
export interface ContextoCalculo {
  alimento(id: string): Alimento | null;
  grupo(id: string): GrupoAlimentar | null;
  equivalenciasDe(id: string): Equivalencia[];
}

export const contextoPadrao: ContextoCalculo = {
  alimento: (id) => catalogo.alimento(id),
  grupo: (id) => catalogo.grupo(id),
  equivalenciasDe: (id) => catalogo.equivalenciasDe(id),
};

function falha(motivo: TrocaSemResultado["motivo"], mensagem: string): TrocaSemResultado {
  return { ok: false, motivo, mensagem };
}

/** Inverte uma regra. Regra fixa não tem inverso definido — devolve `null`. */
export function inverterRegra(regra: RegraEquivalencia): RegraEquivalencia | null {
  switch (regra.tipo) {
    case "proporcional":
      return { tipo: "proporcional", de: regra.para, para: regra.de };
    case "tabela":
      return {
        tipo: "tabela",
        unidadeOrigemId: regra.unidadeDestinoId,
        unidadeDestinoId: regra.unidadeOrigemId,
        pontos: regra.pontos.map((p) => ({ de: p.para, para: p.de })),
      };
    case "fixa":
      return null;
  }
}

interface Aplicacao {
  quantidade: number;
  unidadeId: string;
  observacoes: string[];
}

/** Interpola entre os pontos cadastrados; fora da faixa, trava no extremo. */
function aplicarTabela(valor: number, pontos: { de: number; para: number }[]): Aplicacao | TrocaSemResultado {
  const ordenados = [...pontos].sort((a, b) => a.de - b.de);
  const primeiro = ordenados[0];
  const ultimo = ordenados[ordenados.length - 1];
  if (!primeiro || !ultimo) {
    return falha("sem-equivalencia", "A tabela de equivalência deste par ainda não tem pontos cadastrados.");
  }
  if (valor <= primeiro.de) {
    return {
      quantidade: primeiro.para,
      unidadeId: "",
      observacoes:
        valor < primeiro.de ? ["A quantidade informada está abaixo da faixa cadastrada para esta troca."] : [],
    };
  }
  if (valor >= ultimo.de) {
    return {
      quantidade: ultimo.para,
      unidadeId: "",
      observacoes: valor > ultimo.de ? ["A quantidade informada está acima da faixa cadastrada para esta troca."] : [],
    };
  }
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const a = ordenados[i]!;
    const b = ordenados[i + 1]!;
    if (valor >= a.de && valor <= b.de) {
      const proporcao = (valor - a.de) / (b.de - a.de);
      return { quantidade: a.para + proporcao * (b.para - a.para), unidadeId: "", observacoes: [] };
    }
  }
  return falha("sem-equivalencia", "Não foi possível aplicar a tabela de equivalência.");
}

function aplicarRegra(regra: RegraEquivalencia, origem: Alimento, medida: Medida): Aplicacao | TrocaSemResultado {
  if (regra.tipo === "fixa") {
    return { quantidade: regra.para.quantidade, unidadeId: regra.para.unidadeId, observacoes: [] };
  }

  const unidadeDaRegra = regra.tipo === "proporcional" ? regra.de.unidadeId : regra.unidadeOrigemId;
  const valor = converter(origem, medida, unidadeDaRegra);
  if (valor === null) {
    return falha(
      "unidade-nao-cadastrada",
      `Esta troca está cadastrada em outra unidade e ${origem.nome.toLowerCase()} ainda não tem a conversão registrada.`,
    );
  }

  if (regra.tipo === "proporcional") {
    if (regra.de.quantidade === 0) {
      return falha("sem-equivalencia", "A equivalência cadastrada para este par está incompleta.");
    }
    const fator = valor / regra.de.quantidade;
    return {
      quantidade: regra.para.quantidade * fator,
      unidadeId: regra.para.unidadeId,
      observacoes: [],
    };
  }

  const resultado = aplicarTabela(valor, regra.pontos);
  if ("ok" in resultado) return resultado;
  return { ...resultado, unidadeId: regra.unidadeDestinoId };
}

export function calcularTroca(entrada: EntradaTroca, ctx: ContextoCalculo = contextoPadrao): ResultadoTroca {
  const { alimentoOrigem: origem, alimentoDestino: destino, medida } = entrada;

  if (origem.id === destino.id) {
    return falha("mesmo-alimento", "Escolha um alimento diferente para ver a equivalência.");
  }
  if (!Number.isFinite(medida.quantidade) || medida.quantidade <= 0) {
    return falha("quantidade-invalida", "Informe uma quantidade maior que zero.");
  }

  const tentativas: { regra: RegraEquivalencia; origemCalculo: OrigemCalculo; fonte: string | null }[] = [];
  for (const eq of ctx.equivalenciasDe(origem.id)) {
    if (eq.origemAlimentoId === origem.id && eq.destinoAlimentoId === destino.id) {
      tentativas.push({ regra: eq.regra, origemCalculo: "regra-direta", fonte: eq.fonte });
    } else if (eq.bidirecional && eq.destinoAlimentoId === origem.id && eq.origemAlimentoId === destino.id) {
      const invertida = inverterRegra(eq.regra);
      if (invertida) tentativas.push({ regra: invertida, origemCalculo: "regra-invertida", fonte: eq.fonte });
    }
  }

  for (const tentativa of tentativas) {
    const aplicada = aplicarRegra(tentativa.regra, origem, medida);
    if ("ok" in aplicada) continue;
    return montar(origem, destino, medida, aplicada, tentativa.origemCalculo);
  }

  // Caminho 3: razão entre as porções — no mesmo grupo, ou num grupo que o
  // de origem declare como destino permitido.
  const grupo = ctx.grupo(origem.grupoId);
  const mesmoGrupo = origem.grupoId === destino.grupoId;
  const grupoLiberado = grupo?.trocaParaGrupos.includes(destino.grupoId) ?? false;

  // Mão única: se o caminho de volta estaria liberado e este não, a troca não
  // é "não cadastrada" — ela existe e foi recusada nesse sentido. Dizer isso
  // é o que separa um material respeitado de um sistema que parece quebrado.
  if (!mesmoGrupo && !grupoLiberado) {
    const grupoDestino = ctx.grupo(destino.grupoId);
    if (grupoDestino?.trocaParaGrupos.includes(origem.grupoId)) {
      return falha(
        "sentido-nao-permitido",
        `No seu material esta troca vale no outro sentido: ${grupoDestino.nome.toLowerCase()} pode virar ${grupo?.nome.toLowerCase() ?? "este grupo"}, mas não o contrário.`,
      );
    }
  }

  if (grupo && grupo.trocaPorPorcao && (mesmoGrupo || grupoLiberado)) {
    const destinoEmPorcoes = mesmoGrupo || (ctx.grupo(destino.grupoId)?.trocaPorPorcao ?? false);
    if (!destinoEmPorcoes) {
      return falha("sem-equivalencia", `${destino.nome} não trabalha em porções fechadas.`);
    }
    // Livre e pendente são os dois "sem porção", e dizem coisas opostas:
    // um é decisão do material, o outro é dado que falta.
    const livre = [origem, destino].find((a) => a.quantidadeLivre);
    if (livre) {
      return falha("quantidade-livre", `${livre.nome} é de quantidade livre — não entra em conta de porção.`);
    }

    const porcoes = emPorcoes(origem, medida);
    if (porcoes === null) {
      return falha(
        "porcao-nao-cadastrada",
        `A porção de referência de ${origem.nome.toLowerCase()} ainda não foi cadastrada.`,
      );
    }
    const saida = medidaDePorcoes(destino, porcoes);
    if (!saida) {
      return falha(
        "porcao-nao-cadastrada",
        `A porção de referência de ${destino.nome.toLowerCase()} ainda não foi cadastrada.`,
      );
    }
    return montar(
      origem,
      destino,
      medida,
      { quantidade: saida.quantidade, unidadeId: saida.unidadeId, observacoes: [] },
      "porcoes",
    );
  }

  if (tentativas.length > 0) {
    return falha("unidade-nao-cadastrada", "Esta troca existe, mas não na unidade escolhida.");
  }
  return falha(
    "sem-equivalencia",
    "Esta troca ainda não está cadastrada. Sua nutricionista pode incluí-la no seu material.",
  );
}

function montar(
  origem: Alimento,
  destino: Alimento,
  entrada: Medida,
  aplicada: Aplicacao,
  origemCalculo: OrigemCalculo,
): ResultadoTroca {
  const unidade = catalogo.unidade(aplicada.unidadeId);
  const quantidade = arredondarExibicao(aplicada.quantidade, unidade);
  const observacoes = [...aplicada.observacoes];
  if (origemCalculo === "porcoes") {
    observacoes.push("Calculado pela porção de referência de cada alimento.");
  }
  return {
    ok: true,
    entrada,
    saida: { quantidade, unidadeId: aplicada.unidadeId },
    saidaExata: aplicada.quantidade,
    alimentoOrigem: origem,
    alimentoDestino: destino,
    porcoes: emPorcoes(origem, entrada),
    origem: origemCalculo,
    observacoes,
  };
}

/**
 * Destinos que realmente fecham conta a partir deste alimento — é o que a
 * busca do "novo alimento" oferece. Assim o paciente nunca escolhe uma
 * opção que só depois revela não ter equivalência cadastrada.
 */
export function destinosPossiveis(origem: Alimento, ctx: ContextoCalculo = contextoPadrao): Alimento[] {
  const sonda: Medida = origem.porcao ?? { quantidade: 1, unidadeId: origem.unidadeBaseId };
  return catalogo
    .alimentos()
    .filter((destino) => destino.id !== origem.id)
    .filter((destino) => calcularTroca({ alimentoOrigem: origem, alimentoDestino: destino, medida: sonda }, ctx).ok)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Alimentos que têm pelo menos um destino — os únicos oferecidos no primeiro campo. */
export function origensPossiveis(ctx: ContextoCalculo = contextoPadrao): Alimento[] {
  return catalogo
    .alimentos()
    .filter((a) => destinosPossiveis(a, ctx).length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
