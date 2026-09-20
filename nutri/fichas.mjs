/**
 * As fichas: uma paciente, um registro, guardado com nome.
 *
 * DEFEITO QUE ISTO CONSERTA. Antes havia uma gaveta só. A ferramenta
 * guardava o último estado da tela e o devolvia na abertura seguinte, o
 * que produzia duas coisas ruins ao mesmo tempo:
 *
 *   * abrir a ferramenta mostrava a paciente anterior. Daí a calcular a
 *     nova em cima das dobras da antiga é um passo, e nada na tela avisa;
 *   * não havia como guardar o trabalho de ontem. Terminada a consulta,
 *     ou ela imprimia, ou perdia — e foi o que ela relatou fazendo.
 *
 * Havia ainda um terceiro: dieta e composição corporal moravam em gavetas
 * separadas, então a dieta podia ser de uma paciente e as dobras de outra,
 * na mesma tela, sem nada indicando isso. Agora as três abas são uma
 * ficha só.
 *
 * REGRAS
 *
 *   * abrir a ferramenta começa em ficha nova e vazia. A paciente anterior
 *     está a um clique, na lista, mas não aparece sozinha;
 *   * o que ela digita é gravado na hora, na ficha aberta. Não existe
 *     botão "salvar" que ela possa esquecer de apertar;
 *   * ficha em branco não vira registro: só passa a existir quando tem
 *     nome ou algum dado.
 *
 * Isto mora em `localStorage`, que é a gaveta do navegador dela. É rápido
 * e não custa nada, mas some se ela limpar os dados de navegação ou trocar
 * de computador. Por isso existe o backup, e por isso a tela diz isso em
 * voz alta em vez de deixar a descoberta para o dia da perda.
 */

const CHAVE = "nutri:fichas:v1";

/** As gavetas antigas, de antes das fichas. Lidas uma vez, para migrar. */
const CHAVE_DIETA_ANTIGA = "nutri:dieta:v1";
const CHAVE_CORPO_ANTIGA = "nutri:corpo:v1";

function ler() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

function escrever(fichas) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(fichas));
    return true;
  } catch {
    // Gaveta cheia ou bloqueada. Quem chamou decide o que dizer na tela;
    // o que não pode é a conta parar de funcionar por causa disto.
    return false;
  }
}

export function listarFichas() {
  // Desempate pelo id: duas fichas gravadas no mesmo milissegundo sairiam
  // em ordem indefinida, e a lista dela mudaria de ordem sem motivo.
  return ler().sort(
    (a, b) =>
      String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)) ||
      String(b.id).localeCompare(String(a.id)),
  );
}

export function lerFicha(id) {
  return ler().find((f) => f.id === id) ?? null;
}

/** Guarda a ficha (criando ou substituindo) e devolve se coube na gaveta. */
export function salvarFicha(ficha) {
  const fichas = ler();
  const i = fichas.findIndex((f) => f.id === ficha.id);
  const completa = { ...ficha, atualizadoEm: new Date().toISOString() };
  if (i >= 0) fichas[i] = completa;
  else fichas.push(completa);
  return escrever(fichas);
}

export function apagarFicha(id) {
  escrever(ler().filter((f) => f.id !== id));
}

export function novoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Vazia é ficha sem nome e sem nenhum campo preenchido. */
export function fichaVazia(ficha) {
  if (!ficha) return true;
  if (String(ficha.nome ?? "").trim()) return false;
  const temCampo = (campos) => Object.values(campos ?? {}).some((v) => String(v ?? "").trim());
  if (temCampo(ficha.corpo)) return false;
  if (temCampo(ficha.macros)) return false;
  const dieta = ficha.dieta ?? {};
  if (String(dieta.peso ?? "").trim() || String(dieta.meta ?? "").trim()) return false;
  return !(dieta.refeicoes ?? []).some((r) => (r.itens ?? []).length);
}

/**
 * Traz para dentro de uma ficha o que estava nas gavetas antigas.
 *
 * Roda uma vez só: a paciente que estava na tela quando ela atualizou a
 * ferramenta vira a primeira ficha, em vez de sumir. Não sobrescreve nada
 * — se já houver fichas, não faz nada.
 */
export function migrarGavetaAntiga() {
  if (ler().length) return null;
  let dieta = null;
  let corpo = null;
  try {
    dieta = JSON.parse(localStorage.getItem(CHAVE_DIETA_ANTIGA) ?? "null");
  } catch {
    /* ignora */
  }
  try {
    corpo = JSON.parse(localStorage.getItem(CHAVE_CORPO_ANTIGA) ?? "null");
  } catch {
    /* ignora */
  }
  if (!dieta && !corpo) return null;

  const ficha = {
    id: novoId(),
    // O nome podia estar em qualquer uma das duas abas, porque eram dois
    // campos diferentes. Vale o primeiro que existir.
    nome: dieta?.nome || corpo?.campos?.["c-nome"] || "",
    dieta: dieta ?? { peso: "", meta: "", refeicoes: [] },
    corpo: corpo?.campos ?? {},
    macros: {},
    atualizadoEm: new Date().toISOString(),
  };
  // A pergunta vem ANTES do rótulo de reserva. Perguntando depois, uma
  // gaveta antiga vazia viraria uma ficha chamada "Ficha recuperada" sem
  // nada dentro — o nome sozinho já a fazia parecer preenchida.
  if (fichaVazia(ficha)) return null;
  if (!ficha.nome) ficha.nome = "Ficha recuperada";
  salvarFicha(ficha);
  return ficha;
}

/** Tudo, num arquivo, para ela guardar fora do navegador. */
export function textoDoBackup() {
  return JSON.stringify(
    { fonte: "nutri:fichas", versao: 1, baixadoEm: new Date().toISOString(), fichas: ler() },
    null,
    2,
  );
}

/**
 * Restaura um backup ACRESCENTANDO, nunca substituindo.
 *
 * Restaurar não pode ser uma forma de perder: se ela restaurar um backup
 * velho por engano, as fichas de hoje continuam lá. Ficha com o mesmo id
 * fica com a versão mais recente das duas, pela data.
 */
export function restaurarBackup(texto) {
  const lido = JSON.parse(texto);
  const chegando = Array.isArray(lido) ? lido : lido?.fichas;
  if (!Array.isArray(chegando)) throw new Error("Este arquivo não é um backup de fichas.");

  const porId = new Map(ler().map((f) => [f.id, f]));
  let novas = 0;
  let atualizadas = 0;
  for (const f of chegando) {
    if (!f || typeof f !== "object" || !f.id) continue;
    const atual = porId.get(f.id);
    if (!atual) {
      porId.set(f.id, f);
      novas += 1;
    } else if (String(f.atualizadoEm ?? "") > String(atual.atualizadoEm ?? "")) {
      porId.set(f.id, f);
      atualizadas += 1;
    }
  }
  escrever([...porId.values()]);
  return { novas, atualizadas, ignoradas: chegando.length - novas - atualizadas };
}
