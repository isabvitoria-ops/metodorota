/**
 * Sugestões de acompanhamento ao montar uma refeição.
 *
 * NÃO É INTELIGÊNCIA ARTIFICIAL. É busca sobre o que ela JÁ montou:
 *
 *   1. as dietas que ela já salvou: "quando o pão de forma entrou, o que mais
 *      estava na mesma opção?" — contado por quantas vezes apareceu junto;
 *   2. os GRUPOS FAVORITOS dela: se o alimento está num grupo, os outros
 *      alimentos do grupo viram sugestão.
 *
 * NADA ENTRA NA DIETA SOZINHO. A tela mostra as sugestões com "usar" e
 * "ignorar"; só o "usar" acrescenta o alimento.
 *
 * O QUE ELA ACEITA E IGNORA fica guardado por PAR (alimento de partida →
 * alimento sugerido) e reordena as próximas sugestões: o que ela aceita sobe,
 * o que ela ignora desce até sumir. Isso é só contagem — sem modelo treinado,
 * de propósito. A porta fica aberta para algo mais esperto depois, se fizer
 * sentido, sem trocar o que está guardado.
 */

export const CHAVE_SUGESTOES = "nutri:sugestoes:v1";

export function memoriaVazia() {
  return { pares: {} };
}

const chaveDoPar = (base, sugerido) => `${base}>${sugerido}`;

/** Todas as opções de todas as refeições de uma ficha, no formato antigo e no novo. */
function opcoesDaFicha(ficha) {
  const saida = [];
  for (const r of ficha?.dieta?.refeicoes ?? []) {
    if (Array.isArray(r.opcoes) && r.opcoes.length) {
      for (const o of r.opcoes) saida.push(o.itens ?? []);
    } else if (Array.isArray(r.itens)) {
      // Fichas de antes das opções: a refeição tinha uma lista só.
      saida.push(r.itens);
    }
  }
  return saida;
}

const itemValido = (i) => i && i.codigo && String(i.nome ?? "").trim();

/**
 * O que costuma vir junto de `codigoBase` nas dietas salvas.
 * `fichas` deve vir da mais recente para a mais antiga: a quantidade e a
 * medida sugeridas são as da vez mais recente em que o alimento apareceu.
 */
export function coocorrencias(fichas, codigoBase) {
  const achados = new Map();
  for (const ficha of fichas ?? []) {
    for (const itens of opcoesDaFicha(ficha)) {
      if (!itens.some((i) => i?.codigo === codigoBase)) continue;
      for (const item of itens) {
        if (!itemValido(item) || item.codigo === codigoBase) continue;
        const atual = achados.get(item.codigo);
        if (atual) atual.vezes += 1;
        else
          achados.set(item.codigo, {
            codigo: item.codigo,
            nome: String(item.nome),
            quantidade: Number(item.quantidade) || 0,
            medida: { nome: item.medida?.nome ?? "g", gramas: Number(item.medida?.gramas) || 1 },
            vezes: 1,
          });
      }
    }
  }
  return achados;
}

/** Os outros alimentos dos grupos favoritos em que `codigoBase` está. */
export function sugestoesDeGrupos(grupos, codigoBase) {
  const achados = new Map();
  for (const g of grupos ?? []) {
    if (!(g.itens ?? []).some((i) => i?.codigo === codigoBase)) continue;
    for (const item of g.itens) {
      if (!itemValido(item) || item.codigo === codigoBase) continue;
      const atual = achados.get(item.codigo);
      if (atual) atual.grupos.push(g.nome);
      else
        achados.set(item.codigo, {
          codigo: item.codigo,
          nome: String(item.nome),
          quantidade: Number(item.quantidade) || 0,
          medida: { nome: item.medida?.nome ?? "g", gramas: Number(item.medida?.gramas) || 1 },
          grupos: [g.nome],
        });
    }
  }
  return achados;
}

/** Aparecer junto vale 1 por vez; estar num grupo dela, 1; aceitar, +2; ignorar, −2. */
export function pontuar({ vezes = 0, emGrupo = false, aceitas = 0, ignoradas = 0 }) {
  return vezes + (emGrupo ? 1 : 0) + 2 * aceitas - 2 * ignoradas;
}

/**
 * As sugestões, da mais forte para a mais fraca. Nunca traz o que já está na
 * opção, nem o que ela ignorou o bastante para a pontuação zerar.
 */
export function montarSugestoes({ fichas, grupos, codigoBase, jaNaOpcao = new Set(), memoria = memoriaVazia(), limite = 6 }) {
  const dasFichas = coocorrencias(fichas, codigoBase);
  const dosGrupos = sugestoesDeGrupos(grupos, codigoBase);
  const codigos = new Set([...dasFichas.keys(), ...dosGrupos.keys()]);
  const lista = [];
  for (const codigo of codigos) {
    if (jaNaOpcao.has(codigo)) continue;
    const f = dasFichas.get(codigo);
    const g = dosGrupos.get(codigo);
    const base = f ?? g;
    const historico = memoria.pares?.[chaveDoPar(codigoBase, codigo)] ?? {};
    const pontos = pontuar({
      vezes: f?.vezes ?? 0,
      emGrupo: Boolean(g),
      aceitas: historico.aceitas ?? 0,
      ignoradas: historico.ignoradas ?? 0,
    });
    if (pontos <= 0) continue;
    lista.push({
      codigo,
      nome: base.nome,
      // A quantidade que ela usou na dieta salva vence a do grupo.
      quantidade: (f ?? g).quantidade,
      medida: (f ?? g).medida,
      vezes: f?.vezes ?? 0,
      grupos: g?.grupos ?? [],
      origem: f && g ? "ambos" : f ? "fichas" : "grupo",
      pontos,
    });
  }
  lista.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
  return lista.slice(0, limite);
}

/** Guarda "aceitou" ou "ignorou" para o par. Devolve a memória nova; não muda a antiga. */
export function registrar(memoria, codigoBase, codigoSugerido, acao) {
  const chave = chaveDoPar(codigoBase, codigoSugerido);
  const atual = memoria.pares?.[chave] ?? { aceitas: 0, ignoradas: 0 };
  return {
    pares: {
      ...(memoria.pares ?? {}),
      [chave]: {
        aceitas: atual.aceitas + (acao === "aceita" ? 1 : 0),
        ignoradas: atual.ignoradas + (acao === "ignorada" ? 1 : 0),
      },
    },
  };
}

export function lerMemoria(armazenamento = globalThis.localStorage) {
  try {
    const bruto = JSON.parse(armazenamento.getItem(CHAVE_SUGESTOES) ?? "null");
    return bruto && typeof bruto.pares === "object" && bruto.pares ? bruto : memoriaVazia();
  } catch {
    return memoriaVazia();
  }
}

export function gravarMemoria(memoria, armazenamento = globalThis.localStorage) {
  try {
    armazenamento.setItem(CHAVE_SUGESTOES, JSON.stringify(memoria));
    return true;
  } catch {
    return false;
  }
}
