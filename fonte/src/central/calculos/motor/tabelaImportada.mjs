/**
 * Uma tabela de composição que ela carrega do computador dela.
 *
 * POR QUE ISTO EXISTE, E NÃO UM ARQUIVO NO SITE
 *
 * A TBCA é publicada sob CC BY-NC-ND 4.0, e a própria planilha que ela
 * montou diz, na aba "Fonte e notas": "seleção pessoal, sem fins
 * comerciais, para apoio à prática clínica. Não redistribuir."
 *
 * NC é não comercial e ND é sem derivados. A Central do Paciente é um
 * serviço cobrado, e o site é público: commitar esses valores no
 * repositório seria publicar uma cópia da base — exatamente o que a
 * licença proíbe, e exatamente o que a regra que ela mesma escreveu manda
 * não fazer sem autorização por escrito.
 *
 * O caminho que a licença permite é este: a cópia é dela, fica no
 * navegador dela, e nada sobe. Ela escolhe o arquivo uma vez; a tabela
 * passa a aparecer na busca junto com a TACO e o IBGE; o site continua sem
 * um byte da TBCA dentro.
 *
 * A TACO (NEPA/UNICAMP) e o IBGE seguem embutidas no site, porque são
 * publicações federais e acadêmicas sem a cláusula NC.
 *
 * O FORMATO do arquivo é o que `scripts/converter-tbca.py` produz:
 *
 *   {
 *     fonte: { sigla, nome, versao, citacao, licenca, obtido_em },
 *     alimentos: [{ codigo, nome, grupo, descricao,
 *                   energia_kcal, carboidrato, proteina, lipideos,
 *                   fibra_alimentar, ...,
 *                   medidas: [{ nome, gramas }] }]
 *   }
 *
 * Valor ausente é NULO, nunca zero — "tr", "NA" e "-" da TBCA querem dizer
 * traço, não analisado e sem informação, e nenhum dos três é zero.
 */

const CHAVE = "nutri:tabela-importada:v1";

/** A tabela guardada, ou null. Arquivo estragado não derruba a tela. */
export function lerTabela() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    if (!guardado || !Array.isArray(guardado.alimentos)) return null;
    return guardado;
  } catch {
    return null;
  }
}

export function apagarTabela() {
  try {
    localStorage.removeItem(CHAVE);
    return true;
  } catch {
    return false;
  }
}

const NUTRIENTES = [
  "energia_kcal",
  "carboidrato",
  "proteina",
  "lipideos",
  "fibra_alimentar",
  "colesterol",
  "sodio",
  "calcio",
  "ferro",
  "potassio",
  "magnesio",
  "zinco",
  "vitamina_c",
];

/**
 * Número ou nulo.
 *
 * Nada de `Number(v) || null`: isso transformaria um zero legítimo — e há
 * muitos, colesterol de vegetal é zero de verdade — em "sem informação".
 */
function numero(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Confere o arquivo antes de guardar, e diz o que há de errado.
 *
 * Um arquivo recusado com "não deu" faria ela tentar de novo com o mesmo
 * arquivo. A mensagem tem que dizer o quê.
 */
export function conferirTabela(dados) {
  if (!dados || typeof dados !== "object") {
    throw new Error("Este arquivo não é uma tabela — não consegui ler nada dentro dele.");
  }
  if (!Array.isArray(dados.alimentos) || dados.alimentos.length === 0) {
    throw new Error("O arquivo não tem nenhum alimento dentro.");
  }

  const fonte = dados.fonte ?? {};
  const sigla = String(fonte.sigla ?? "").trim() || "Importada";

  const vistos = new Set();
  const alimentos = [];
  for (const bruto of dados.alimentos) {
    const nome = String(bruto?.nome ?? "").trim();
    const codigo = String(bruto?.codigo ?? "").trim();
    if (!nome || !codigo) continue;
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);

    const alimento = {
      codigo,
      nome,
      grupo: String(bruto?.grupo ?? "").trim() || sigla,
      descricao: String(bruto?.descricao ?? "").trim(),
      medidas: [],
    };
    for (const chave of NUTRIENTES) alimento[chave] = numero(bruto?.[chave]);

    for (const m of bruto?.medidas ?? []) {
      const nomeM = String(m?.nome ?? "").trim();
      const gramas = numero(m?.gramas);
      if (!nomeM || gramas === null || gramas <= 0) continue;
      if (alimento.medidas.some((x) => x.nome.toLowerCase() === nomeM.toLowerCase())) continue;
      alimento.medidas.push({ nome: nomeM, gramas });
    }
    alimentos.push(alimento);
  }

  if (alimentos.length === 0) {
    throw new Error(
      "Nenhum alimento do arquivo tem nome e código ao mesmo tempo — é o mínimo para entrar na busca.",
    );
  }

  return {
    fonte: {
      sigla,
      nome: String(fonte.nome ?? "").trim() || sigla,
      versao: String(fonte.versao ?? "").trim(),
      citacao: String(fonte.citacao ?? "").trim(),
      licenca: String(fonte.licenca ?? "").trim(),
      obtido_em: String(fonte.obtido_em ?? "").trim(),
    },
    alimentos,
  };
}

/** Guarda a tabela. Substitui a anterior: são duas versões da mesma base. */
export function importarTabela(texto) {
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("Este arquivo não é o arquivo da tabela. Escolha o que eu te mandei.");
  }
  const tabela = conferirTabela(dados);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(tabela));
  } catch {
    throw new Error(
      "A memória do navegador recusou guardar a tabela — ela é grande. Baixe o backup e tente de novo.",
    );
  }
  return tabela;
}
