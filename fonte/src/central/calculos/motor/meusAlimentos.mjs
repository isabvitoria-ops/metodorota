/**
 * Os alimentos que ela cadastra, os grupos favoritos e as medidas caseiras.
 *
 * TRÊS COISAS QUE AS TABELAS NÃO DÃO, e que ela pediu:
 *
 *   * "adicionar na hora no banco de dados alimentos que não existem e
 *     escrever lá as infos nutricionais, tipo algum whey específico, ou
 *     algum pão". Nenhuma tabela traz marca — nem a TACO, nem o IBGE;
 *   * "salvar grupos de favoritos dos que mais uso, tipo criar um grupo de
 *     frutas já pré-pronto e poder excluir o que quero";
 *   * "criar porções tipo 100g de milho = 1 unidade".
 *
 * Tudo isto mora no navegador dela, como as fichas, e entra no mesmo
 * backup. Um alimento cadastrado que sumisse no dia seguinte seria pior
 * que não existir.
 */

const CHAVE_ALIMENTOS = "nutri:meus-alimentos:v1";
const CHAVE_GRUPOS = "nutri:grupos:v1";
const CHAVE_MEDIDAS = "nutri:medidas:v1";

function ler(chave) {
  try {
    const guardado = JSON.parse(localStorage.getItem(chave) ?? "null");
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

function escrever(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function novoId(prefixo) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- alimentos dela --------------------------------------------------------

/**
 * Confere o que veio da tela antes de gravar.
 *
 * Campo em branco vira NULO, não zero: um whey sem fibra anotada não tem
 * zero de fibra, tem fibra desconhecida. É a mesma regra das tabelas, e
 * quebrá-la aqui faria o alimento dela mentir onde a TACO não mente.
 */
export function conferirAlimento(bruto) {
  const nome = String(bruto?.nome ?? "").trim();
  if (!nome) throw new Error("Escreva o nome do alimento.");

  const numero = (v) => {
    const t = String(v ?? "").trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error(`Valor que não sei ler: ${v}`);
    if (n < 0) throw new Error("Valor negativo não existe em composição de alimento.");
    return n;
  };

  return {
    id: bruto?.id || novoId("meu"),
    nome,
    grupo: String(bruto?.grupo ?? "").trim() || "Meus alimentos",
    energia_kcal: numero(bruto?.energia_kcal),
    proteina: numero(bruto?.proteina),
    lipideos: numero(bruto?.lipideos),
    carboidrato: numero(bruto?.carboidrato),
    fibra_alimentar: numero(bruto?.fibra_alimentar),
    medidas: conferirMedidas(bruto?.medidas),
  };
}

export function listarAlimentos() {
  return ler(CHAVE_ALIMENTOS).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export function salvarAlimento(bruto) {
  const alimento = conferirAlimento(bruto);
  const todos = ler(CHAVE_ALIMENTOS);
  const i = todos.findIndex((a) => a.id === alimento.id);
  if (i >= 0) todos[i] = alimento;
  else todos.push(alimento);
  escrever(CHAVE_ALIMENTOS, todos);
  return alimento;
}

export function excluirAlimento(id) {
  escrever(CHAVE_ALIMENTOS, ler(CHAVE_ALIMENTOS).filter((a) => a.id !== id));
}

// --- medidas caseiras ------------------------------------------------------

/** "1 unidade = 100 g". Nome sem gramas, ou gramas sem nome, não entra. */
export function conferirMedidas(brutas) {
  const saida = [];
  for (const m of brutas ?? []) {
    const nome = String(m?.nome ?? "").trim();
    const gramas = Number(String(m?.gramas ?? "").replace(",", "."));
    if (!nome) continue;
    if (!Number.isFinite(gramas) || gramas <= 0) continue;
    if (saida.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) continue;
    saida.push({ nome, gramas });
  }
  return saida;
}

/** As medidas que ela criou para um alimento das tabelas. */
export function medidasDe(codigo) {
  const linha = ler(CHAVE_MEDIDAS).find((m) => m.codigo === codigo);
  return linha?.medidas ?? [];
}

export function salvarMedidas(codigo, medidas) {
  const conferidas = conferirMedidas(medidas);
  const todas = ler(CHAVE_MEDIDAS).filter((m) => m.codigo !== codigo);
  if (conferidas.length > 0) todas.push({ codigo, medidas: conferidas });
  escrever(CHAVE_MEDIDAS, todas);
  return conferidas;
}

// --- grupos favoritos ------------------------------------------------------

export function listarGrupos() {
  return ler(CHAVE_GRUPOS).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

export function salvarGrupo(bruto) {
  const nome = String(bruto?.nome ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao grupo.");
  const grupo = {
    id: bruto?.id || novoId("grupo"),
    nome,
    itens: (bruto?.itens ?? [])
      .filter((i) => i && i.codigo)
      .map((i) => ({
        codigo: i.codigo,
        nome: String(i.nome ?? ""),
        quantidade: Number(i.quantidade) || 0,
        medida: { nome: i.medida?.nome ?? "g", gramas: Number(i.medida?.gramas) || 1 },
      })),
  };
  const todos = ler(CHAVE_GRUPOS);
  const i = todos.findIndex((g) => g.id === grupo.id);
  if (i >= 0) todos[i] = grupo;
  else todos.push(grupo);
  escrever(CHAVE_GRUPOS, todos);
  return grupo;
}

export function excluirGrupo(id) {
  escrever(CHAVE_GRUPOS, ler(CHAVE_GRUPOS).filter((g) => g.id !== id));
}

/** Tudo dela, para o backup das fichas levar junto. */
export function tudoParaBackup() {
  return {
    meusAlimentos: ler(CHAVE_ALIMENTOS),
    grupos: ler(CHAVE_GRUPOS),
    medidas: ler(CHAVE_MEDIDAS),
  };
}

/**
 * Restaura ACRESCENTANDO, como o backup das fichas: restaurar um backup
 * velho por engano não pode apagar o alimento cadastrado hoje.
 */
export function restaurarDoBackup(dados) {
  const juntar = (chave, chegando, campoId) => {
    const atuais = ler(chave);
    const porId = new Map(atuais.map((x) => [x[campoId], x]));
    let novos = 0;
    for (const x of chegando ?? []) {
      if (!x || !x[campoId] || porId.has(x[campoId])) continue;
      porId.set(x[campoId], x);
      novos += 1;
    }
    escrever(chave, [...porId.values()]);
    return novos;
  };
  return {
    alimentos: juntar(CHAVE_ALIMENTOS, dados?.meusAlimentos, "id"),
    grupos: juntar(CHAVE_GRUPOS, dados?.grupos, "id"),
    medidas: juntar(CHAVE_MEDIDAS, dados?.medidas, "codigo"),
  };
}
