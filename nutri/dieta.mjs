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
 *     opcoes: [{ rotulo, itens: [{ codigo, nome, quantidade, medida }] }],
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
  if (bruto.medida && typeof bruto.medida === "object") {
    return {
      codigo: bruto.codigo,
      nome: bruto.nome ?? "",
      quantidade: Number(bruto.quantidade) || 0,
      medida: { nome: bruto.medida.nome ?? "g", gramas: Number(bruto.medida.gramas) || 1 },
    };
  }
  return {
    codigo: bruto.codigo,
    nome: bruto.nome ?? "",
    quantidade: Number(bruto.gramas ?? bruto.quantidade) || 0,
    medida: { ...MEDIDA_GRAMA },
  };
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
