/**
 * O formato de uma dieta, e as regras que mexem nela.
 *
 * Mora fora da tela porque é aqui que o erro seria caro: uma opção de
 * refeição contada duas vezes no total do dia é uma prescrição errada que
 * parece certa. A tela só desenha; quem decide o que soma é este arquivo.
 *
 * O FORMATO
 *
 *   refeicao = {
 *     nome, horario, recolhida,
 *     opcoes: [{ rotulo, itens: [{ codigo, nome, quantidade, medida,
 *                                  substitutos?, igualarPor?, verSubstitutos? }] }],
 *     opcaoAtiva: 0
 *   }
 *
 * OPÇÃO NÃO É REFEIÇÃO A MAIS. "Quero poder colocar duas opções de café da
 * manhã": as duas são o MESMO café, e a paciente come uma. Se as duas
 * entrassem no total, o dia somaria dois cafés da manhã — e o número que
 * ela usa para fechar a prescrição sairia inflado sem nada na tela
 * denunciando. Só a opção ativa conta.
 */

export const MEDIDA_GRAMA = { nome: "g", gramas: 1 };

/** Uma refeição vazia, pronta para receber alimento. */
export function refeicaoNova(nome = "Nova refeição", horario = "") {
  return {
    nome,
    horario,
    recolhida: false,
    opcoes: [{ rotulo: "Principal", itens: [] }],
    opcaoAtiva: 0,
  };
}

/**
 * Traz para o formato de hoje o que foi salvo antes das opções.
 *
 * Ficha guardada quando a refeição era `{nome, itens}` continua abrindo: os
 * itens viram a opção "Principal". Sem isto, toda dieta já montada perderia
 * os alimentos de uma vez — e ela tem fichas de pacientes reais salvas.
 */
export function normalizarRefeicao(bruta) {
  if (!bruta || typeof bruta !== "object") return refeicaoNova();
  const base = {
    nome: bruta.nome ?? "Refeição",
    horario: bruta.horario ?? "",
    recolhida: Boolean(bruta.recolhida),
  };
  if (Array.isArray(bruta.opcoes) && bruta.opcoes.length > 0) {
    const opcoes = bruta.opcoes.map((o, i) => ({
      rotulo: o?.rotulo ?? (i === 0 ? "Principal" : `Opção ${i + 1}`),
      itens: (o?.itens ?? []).map(normalizarItem),
    }));
    const ativa = Number(bruta.opcaoAtiva);
    return {
      ...base,
      opcoes,
      opcaoAtiva: Number.isInteger(ativa) && ativa >= 0 && ativa < opcoes.length ? ativa : 0,
    };
  }
  return {
    ...base,
    opcoes: [{ rotulo: "Principal", itens: (bruta.itens ?? []).map(normalizarItem) }],
    opcaoAtiva: 0,
  };
}

/**
 * Item no formato de hoje.
 *
 * Antes havia só `gramas`. Agora há `quantidade` e `medida` — "2 unidades"
 * em vez de "120 g" —, e as gramas passam a ser conta, não campo. O item
 * antigo vira quantidade em gramas, que é exatamente o que ele era.
 */
export function normalizarItem(bruto) {
  if (!bruto || typeof bruto !== "object") return null;
  const base =
    bruto.medida && typeof bruto.medida === "object"
      ? {
          codigo: bruto.codigo,
          nome: bruto.nome ?? "",
          quantidade: Number(bruto.quantidade) || 0,
          medida: { nome: bruto.medida.nome ?? "g", gramas: Number(bruto.medida.gramas) || 1 },
        }
      : {
          codigo: bruto.codigo,
          nome: bruto.nome ?? "",
          quantidade: Number(bruto.gramas ?? bruto.quantidade) || 0,
          medida: { ...MEDIDA_GRAMA },
        };
  // Substitutos só aparecem quando existem: o item de sempre continua do
  // tamanho que era, e a ficha salva não ganha campo vazio à toa.
  const substitutos = Array.isArray(bruto.substitutos)
    ? bruto.substitutos.map(normalizarSubstituto).filter(Boolean)
    : [];
  if (substitutos.length) {
    base.substitutos = substitutos;
    base.igualarPor = CRITERIOS[bruto.igualarPor] ? bruto.igualarPor : CRITERIO_PADRAO;
    base.verSubstitutos = bruto.verSubstitutos !== false;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Substitutos
// ---------------------------------------------------------------------------

/**
 * SUBSTITUTO NÃO É ITEM A MAIS, pelo mesmo motivo da opção: "frango 120 g,
 * ou peixe, ou patinho" é UM prato de proteína, e a paciente come um. O
 * substituto mora dentro do item (`item.substitutos`), e por isso
 * `itensDoDia` nunca o vê — o total do dia continua contando só o frango.
 *
 * A QUANTIDADE NÃO É CAMPO, É CONTA. Ela escolhe "patinho" e a gramatura sai
 * sozinha, igualando o item principal pelo critério escolhido (kcal, por
 * padrão). Mudou o frango de 120 g para 150 g? Os substitutos acompanham.
 * Guardar as gramas deixaria a lista desatualizada no primeiro ajuste — e
 * ninguém confere substituto depois de mexer no principal.
 */

/** Pelo que se iguala. As chaves são as da tabela (`valorDe`). */
export const CRITERIOS = {
  energia_kcal: "kcal",
  proteina: "proteína",
  carboidrato: "carboidrato",
  lipideos: "gordura",
};
export const CRITERIO_PADRAO = "energia_kcal";

export function normalizarSubstituto(bruto) {
  if (!bruto || typeof bruto !== "object" || bruto.codigo === undefined) return null;
  const m = bruto.medida && typeof bruto.medida === "object" ? bruto.medida : MEDIDA_GRAMA;
  return {
    codigo: bruto.codigo,
    nome: bruto.nome ?? "",
    medida: { nome: m.nome ?? "g", gramas: Number(m.gramas) || 1 },
  };
}

/**
 * Arredonda como se escreve numa dieta: em gramas, de 5 em 5 (de 1 em 1
 * abaixo de 20 g, onde 5 g de azeite a mais já é muita coisa); em medida
 * caseira, de meia em meia unidade. Nunca zero: "0 unidade de ovo" não é
 * substituto de nada.
 */
export function arredondarPorcao(quantidade, medida) {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null;
  if ((Number(medida?.gramas) || 1) === 1) {
    const passo = quantidade < 20 ? 1 : 5;
    return Math.max(passo, Math.round(quantidade / passo) * passo);
  }
  return Math.max(0.5, Math.round(quantidade * 2) / 2);
}

/**
 * Quanto do substituto equivale ao item.
 *
 *   alvo      — quanto o item principal tem do critério (ex.: 195 kcal)
 *   por100    — quanto o substituto tem do critério em 100 g
 *   medida    — a medida em que o substituto vai escrito
 *
 * Devolve `{ quantidade, gramas }`, ou `null` quando a conta não existe:
 * a tabela não traz o valor, ou o substituto não tem nada daquilo (igualar
 * proteína com azeite). Sem conta, a tela diz que não deu — inventar um
 * número seria prescrever errado com cara de certo.
 */
export function porcaoEquivalente(alvo, por100, medida = MEDIDA_GRAMA) {
  if (alvo === null || alvo === undefined || !Number.isFinite(alvo) || alvo <= 0) return null;
  if (por100 === null || por100 === undefined || !Number.isFinite(por100) || por100 <= 0) return null;
  const gramasDaMedida = Number(medida?.gramas) || 1;
  const gramasExatas = (alvo / por100) * 100;
  const quantidade = arredondarPorcao(gramasExatas / gramasDaMedida, medida);
  if (quantidade === null) return null;
  return { quantidade, gramas: quantidade * gramasDaMedida };
}

/** Quantos gramas aquele item tem, de verdade. */
export function gramasDoItem(item) {
  if (!item) return 0;
  const q = Number(item.quantidade) || 0;
  const g = Number(item.medida?.gramas) || 1;
  return q * g;
}

/** A opção que está valendo naquela refeição. */
export function opcaoAtiva(refeicao) {
  return refeicao?.opcoes?.[refeicao.opcaoAtiva ?? 0] ?? { rotulo: "Principal", itens: [] };
}

/**
 * Os itens que entram no total do dia: só os da opção ativa de cada refeição.
 *
 * É a regra inteira deste arquivo, e a razão de ele existir.
 */
export function itensDoDia(refeicoes) {
  return (refeicoes ?? []).flatMap((r) => opcaoAtiva(r).itens ?? []);
}

/** Uma cópia da refeição, para "duplicar refeição". */
export function duplicarRefeicao(refeicao) {
  const copia = JSON.parse(JSON.stringify(normalizarRefeicao(refeicao)));
  copia.nome = `${copia.nome} (cópia)`;
  copia.recolhida = false;
  return copia;
}

/**
 * Acrescenta uma opção àquela refeição, copiando a que está aberta.
 *
 * Copiar em vez de começar vazia: "Opção 2" do café da manhã costuma ser o
 * mesmo café com uma troca, não um café do zero.
 */
export function acrescentarOpcao(refeicao) {
  const r = normalizarRefeicao(refeicao);
  const base = opcaoAtiva(r);
  r.opcoes = [
    ...r.opcoes,
    {
      rotulo: `Opção ${r.opcoes.length + 1}`,
      itens: JSON.parse(JSON.stringify(base.itens ?? [])),
    },
  ];
  r.opcaoAtiva = r.opcoes.length - 1;
  return r;
}

/**
 * Tira uma opção. A última nunca sai — refeição sem opção nenhuma não
 * existe, e a tela não teria o que desenhar.
 */
export function removerOpcao(refeicao, indice) {
  const r = normalizarRefeicao(refeicao);
  if (r.opcoes.length <= 1) return r;
  r.opcoes = r.opcoes.filter((_, i) => i !== indice);
  r.opcaoAtiva = Math.min(r.opcaoAtiva, r.opcoes.length - 1);
  return r;
}
