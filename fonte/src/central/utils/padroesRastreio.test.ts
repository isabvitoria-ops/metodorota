import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RegistroDeReintroducao } from "@/central/types";
import { faltaParaLer, lerPadroes, MINIMO_DE_REGISTROS } from "@/central/utils/padroesRastreio";

function reg(p: Partial<RegistroDeReintroducao> = {}): RegistroDeReintroducao {
  return {
    id: Math.random().toString(36).slice(2),
    itemId: "i1",
    itemNome: "Leite",
    data: "2026-09-16",
    horario: null,
    semana: 1,
    quantidade: null,
    preparo: null,
    sintomas: [],
    intensidade: null,
    bristol: null,
    observacao: null,
    marcacao: [],
    criadoEm: "2026-09-16T12:00:00Z",
    ...p,
  } as RegistroDeReintroducao;
}

const NADA = { sintomas: [] as never[] };

test("abaixo do mínimo não se afirma nada", () => {
  // Um registro não é tendência, e dois também não. Um padrão tirado de dois
  // registros seria lido como achado clínico e mandaria alguém cortar comida.
  const leitura = lerPadroes([reg(NADA), reg(NADA)]);
  assert.equal(leitura.temDados, false);
  assert.equal(leitura.padroes.length, 0);
});

test("no mínimo exato já se lê", () => {
  const leitura = lerPadroes(Array.from({ length: MINIMO_DE_REGISTROS }, () => reg(NADA)));
  assert.equal(leitura.temDados, true);
});

test("sem sintoma nenhum, a frase diz isso em vez de calar", () => {
  const leitura = lerPadroes([reg(NADA), reg(NADA), reg(NADA)]);
  assert.equal(leitura.padroes[0]?.texto, "Nenhum sintoma relatado em 3 registros.");
});

test("a frequência traz os dois números dentro dela", () => {
  // Quem lê consegue conferir a conta; se estiver estranha, ela percebe.
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["distensao"] }),
    reg(NADA),
    reg(NADA),
  ]);
  assert.equal(leitura.padroes[0]?.texto, "Sintomas relatados em 2 de 4 registros.");
});

test("nenhuma frase afirma causa", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"], horario: "21:00" }),
    reg({ sintomas: ["distensao"], horario: "22:00" }),
    reg({ sintomas: ["distensao"], horario: "20:00" }),
  ]);
  const texto = leitura.padroes.map((p) => p.texto).join(" ").toLowerCase();
  for (const proibida of ["causa", "causou", "provoca", "por causa", "responsável"]) {
    assert.ok(!texto.includes(proibida), `a frase não pode dizer "${proibida}": ${texto}`);
  }
});

test("o sintoma mais relatado aparece com a contagem", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["gases"] }),
  ]);
  const p = leitura.padroes.find((x) => x.id === "sintoma-frequente");
  assert.ok(p?.texto.includes("2"), p?.texto);
});

test("sintoma que apareceu uma vez só não vira 'o mais relatado'", () => {
  const leitura = lerPadroes([reg({ sintomas: ["gases"] }), reg(NADA), reg(NADA)]);
  assert.equal(leitura.padroes.find((x) => x.id === "sintoma-frequente"), undefined);
});

test("a concentração por período do dia é observada", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"], horario: "21:00" }),
    reg({ sintomas: ["distensao"], horario: "22:30" }),
    reg({ sintomas: ["gases"], horario: "20:00" }),
  ]);
  const p = leitura.padroes.find((x) => x.id === "periodo");
  assert.ok(p, "esperava observação de período");
  assert.ok(p!.texto.includes("noite"), p!.texto);
});

test("a madrugada conta como noite", () => {
  // Quem come às 23h e passa mal às 2h está no mesmo episódio; cortar à
  // meia-noite partiria o episódio em dois.
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"], horario: "23:00" }),
    reg({ sintomas: ["distensao"], horario: "01:00" }),
    reg({ sintomas: ["distensao"], horario: "02:30" }),
  ]);
  assert.ok(leitura.padroes.find((x) => x.id === "periodo")?.texto.includes("noite"));
});

test("horário espalhado não vira padrão", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"], horario: "08:00" }),
    reg({ sintomas: ["distensao"], horario: "14:00" }),
    reg({ sintomas: ["distensao"], horario: "21:00" }),
  ]);
  assert.equal(leitura.padroes.find((x) => x.id === "periodo"), undefined);
});

test("sem horário anotado não se inventa período", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["distensao"] }),
  ]);
  assert.equal(leitura.padroes.find((x) => x.id === "periodo"), undefined);
});

test("a concentração num dia da semana é observada", () => {
  // 2026-09-18, 09-25 e 10-02 são sextas-feiras.
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"], data: "2026-09-18" }),
    reg({ sintomas: ["distensao"], data: "2026-09-25" }),
    reg({ sintomas: ["gases"], data: "2026-10-02" }),
  ]);
  const p = leitura.padroes.find((x) => x.id === "dia-da-semana");
  assert.ok(p?.texto.includes("sexta"), p?.texto);
});

test("o marcador em comum é observado, contando ALIMENTOS e não registros", () => {
  // Três registros do mesmo leite não são três alimentos. Contando registros,
  // uma paciente que testou o mesmo alimento cinco vezes "descobriria" um
  // padrão que é um alimento só.
  const alta = { nome: "Histamina" as const, nivel: "alta" as const };
  const leitura = lerPadroes([
    reg({ itemId: "a", itemNome: "Queijo", sintomas: ["distensao"], marcacao: [alta] }),
    reg({ itemId: "b", itemNome: "Vinho", sintomas: ["distensao"], marcacao: [alta] }),
    reg({ itemId: "c", itemNome: "Arroz", sintomas: ["gases"], marcacao: [] }),
  ]);
  const p = leitura.padroes.find((x) => x.id === "marcador");
  assert.ok(p?.texto.includes("Histamina"), p?.texto);
  assert.ok(p?.texto.includes("2 de 3 alimentos"), p?.texto);
});

test("o mesmo alimento testado várias vezes não vira padrão de marcador", () => {
  const alta = { nome: "Oxalato" as const, nivel: "alta" as const };
  const leitura = lerPadroes([
    reg({ itemId: "so-um", sintomas: ["distensao"], marcacao: [alta] }),
    reg({ itemId: "so-um", sintomas: ["distensao"], marcacao: [alta] }),
    reg({ itemId: "so-um", sintomas: ["distensao"], marcacao: [alta] }),
  ]);
  assert.equal(leitura.padroes.find((x) => x.id === "marcador"), undefined);
});

test("marcador de nível médio não conta", () => {
  // O material já entrega de média para cima; contar a média faria quase
  // todo alimento carregar quase todo marcador.
  const media = { nome: "Lectina" as const, nivel: "media" as const };
  const leitura = lerPadroes([
    reg({ itemId: "a", sintomas: ["distensao"], marcacao: [media] }),
    reg({ itemId: "b", sintomas: ["distensao"], marcacao: [media] }),
    reg({ itemId: "c", sintomas: ["distensao"], marcacao: [media] }),
  ]);
  assert.equal(leitura.padroes.find((x) => x.id === "marcador"), undefined);
});

test("Bristol ressecado é observado", () => {
  const leitura = lerPadroes([
    reg({ ...NADA, bristol: 1 }),
    reg({ ...NADA, bristol: 2 }),
    reg({ ...NADA, bristol: 2 }),
  ]);
  const p = leitura.padroes.find((x) => x.id === "bristol-ressecado");
  assert.ok(p?.texto.includes("3 de 3"), p?.texto);
});

test("Bristol amolecido é observado", () => {
  const leitura = lerPadroes([
    reg({ ...NADA, bristol: 6 }),
    reg({ ...NADA, bristol: 7 }),
    reg({ ...NADA, bristol: 6 }),
  ]);
  assert.ok(leitura.padroes.find((x) => x.id === "bristol-amolecido"));
});

test("Bristol no meio da escala não vira observação", () => {
  const leitura = lerPadroes([
    reg({ ...NADA, bristol: 3 }),
    reg({ ...NADA, bristol: 4 }),
    reg({ ...NADA, bristol: 4 }),
  ]);
  assert.equal(leitura.padroes.filter((x) => x.id.startsWith("bristol")).length, 0);
});

test("toda observação carrega quantos registros a sustentam", () => {
  const leitura = lerPadroes([
    reg({ sintomas: ["distensao"] }),
    reg({ sintomas: ["distensao"] }),
    reg(NADA),
  ]);
  for (const p of leitura.padroes) {
    assert.ok(p.registros >= 1, `${p.id} veio sem sustentação: ${p.registros}`);
  }
});

test("a frase de 'ainda falta' conta quanto falta", () => {
  assert.equal(faltaParaLer(1), "Com mais 2 registros dá para começar a ler padrões.");
  assert.equal(faltaParaLer(2), "Com mais 1 registro dá para começar a ler padrões.");
  assert.equal(faltaParaLer(3), "");
});
