/**
 * Hot Slim — o teste que impede contradição.
 *
 * Se uma tela, um texto ou o cardápio contrariar a conduta do desafio, este
 * arquivo falha e o site não é publicado. Cada teste diz qual regra caiu.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ALIMENTOS, alimento } from "./alimentos.ts";
import { CARDAPIO_ETAPA_1 } from "./cardapio.ts";
import { listaDeCompras, macrosDaOpcao, trocasDe } from "./calculo.ts";
import { ADOCANTES_PROIBIDOS, AVISOS_DE_ROTULO, CHAS_ETAPA_1, FORA_ETAPA_1, META_KCAL, REFEICOES, REGRAS_ETAPA_1, TEMPEROS_ETAPA_1, TOLERANCIA_KCAL } from "./regras.ts";
import { FAQ, ROTINA, SINTOMAS } from "./textos.ts";
import { CATALOGO_FODMAP } from "@/central/dados/sementes/fodmap.ts";

const SEMAFORO = new Map(CATALOGO_FODMAP.map((a) => [a.id, a]));

test("hot slim: ids da base são únicos", () => {
  const ids = ALIMENTOS.map((a) => a.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("hot slim: todo alimento da base está VERDE no Semáforo FODMAP, ou explica por quê", () => {
  for (const a of ALIMENTOS) {
    if (a.fodmapId === null) {
      assert.ok(a.notaFodmap && a.notaFodmap.length > 10, `${a.id}: sem item no semáforo e sem nota explicando`);
      continue;
    }
    const s = SEMAFORO.get(a.fodmapId);
    assert.ok(s, `${a.id}: "${a.fodmapId}" não existe no Semáforo FODMAP`);
    assert.equal(s.nivel, "verde", `${a.id}: está "${s.nivel}" no semáforo, mas o Hot Slim libera`);
  }
});

test("hot slim: as metas das 4 refeições somam a meta do dia", () => {
  assert.equal(REFEICOES.reduce((s, r) => s + r.kcal, 0), META_KCAL);
});

for (const ref of REFEICOES) {
  for (const op of CARDAPIO_ETAPA_1[ref.id]) {
    test(`hot slim etapa 1: ${ref.nome} — ${op.nome}`, () => {
      for (const item of op.itens) {
        const a = alimento(item.alimento);
        assert.equal(a.semana, 1, `${a.nome} só entra na semana ${a.semana}`);
        if (a.limiteG !== null) {
          assert.ok(item.g <= a.limiteG, `${a.nome}: ${item.g} g passa do limite low FODMAP de ${a.limiteG} g`);
        }
      }
      const m = macrosDaOpcao(op);
      const desvio = (m.kcal - ref.kcal) / ref.kcal;
      assert.ok(Math.abs(desvio) <= TOLERANCIA_KCAL, `${Math.round(m.kcal)} kcal: fora de ±5% de ${ref.kcal}`);
      assert.ok(m.proteina >= ref.proteinaMinG, `proteína ${m.proteina.toFixed(1)} g < ${ref.proteinaMinG} g`);
      assert.ok(m.fibra >= ref.fibraMinG, `fibra ${m.fibra.toFixed(1)} g < ${ref.fibraMinG} g`);
    });
  }
}

test("hot slim etapa 1: qualquer combinação de opções fica perto de 1.600 kcal", () => {
  const minimo = REFEICOES.reduce((s, r) => s + Math.min(...CARDAPIO_ETAPA_1[r.id].map((o) => macrosDaOpcao(o).kcal)), 0);
  const maximo = REFEICOES.reduce((s, r) => s + Math.max(...CARDAPIO_ETAPA_1[r.id].map((o) => macrosDaOpcao(o).kcal)), 0);
  assert.ok(minimo >= META_KCAL * 0.95 && maximo <= META_KCAL * 1.05, `de ${Math.round(minimo)} a ${Math.round(maximo)} kcal`);
});

test("hot slim etapa 1: nenhuma troca sugerida passa do limite de FODMAP", () => {
  for (const opcoes of Object.values(CARDAPIO_ETAPA_1)) {
    for (const op of opcoes) {
      for (const item of op.itens) {
        for (const t of trocasDe(item, 1)) {
          if (t.alimento.limiteG !== null) assert.ok(t.g <= t.alimento.limiteG, `${t.alimento.nome} ${t.g} g`);
          assert.equal(t.alimento.semana, 1);
        }
      }
    }
  }
});

test("hot slim etapa 1: a lista de compras é exatamente o que o cardápio usa", () => {
  const naLista = new Set(listaDeCompras(CARDAPIO_ETAPA_1).flatMap((s) => s.itens.map((a) => a.id)));
  const noCardapio = new Set(Object.values(CARDAPIO_ETAPA_1).flatMap((ops) => ops.flatMap((o) => o.itens.map((i) => i.alimento))));
  assert.deepEqual([...naLista].sort(), [...noCardapio].sort());
});

test("hot slim: chás liberados estão verdes no semáforo", () => {
  for (const c of CHAS_ETAPA_1) {
    const s = SEMAFORO.get(c.fodmapId);
    assert.ok(s, c.fodmapId);
    assert.equal(s.nivel, "verde", `${c.nome} não está verde`);
  }
});

/** Todos os textos que a participante lê, juntos, para as varreduras abaixo. */
function todosOsTextos(): string {
  const partes: string[] = [];
  for (const a of ALIMENTOS) partes.push(a.nome, a.aviso ?? "", a.medida ?? "");
  for (const opcoes of Object.values(CARDAPIO_ETAPA_1)) for (const o of opcoes) partes.push(o.nome, o.preparo ?? "");
  for (const r of REGRAS_ETAPA_1) partes.push(r.titulo, r.texto);
  partes.push(...TEMPEROS_ETAPA_1, ...CHAS_ETAPA_1.map((c) => `${c.nome} ${c.obs ?? ""}`));
  for (const s of ROTINA) partes.push(s.titulo, ...s.itens);
  for (const s of SINTOMAS) partes.push(s.titulo, s.porque, ...s.oQueFazer);
  for (const f of FAQ) partes.push(f.pergunta, f.resposta);
  return partes.join("\n").toLowerCase();
}

test("hot slim: nenhum texto libera adoçante além de stevia e taumatina", () => {
  const texto = todosOsTextos();
  // A lista de avisos e a lista do que fica fora podem CITAR os proibidos.
  for (const proibido of ADOCANTES_PROIBIDOS) {
    const linhas = texto.split("\n").filter((l) => l.includes(proibido));
    for (const l of linhas) {
      assert.match(l, /sem |não |nada de|evite|nunca|fora/, `"${proibido}" aparece liberado: ${l}`);
    }
  }
});

test("hot slim: o que a conduta tirou não volta em nenhum texto", () => {
  const texto = todosOsTextos();
  for (const termo of ["camomila", "ameixa", "tâmara", "maçã", "mel ", "melado", "ghee no chá", "shot", "die-off", "toxina", "detox", "milagre"]) {
    const linhas = texto.split("\n").filter((l) => l.includes(termo));
    for (const l of linhas) assert.match(l, /sem |não |nunca|fora|evite|nada de/, `"${termo}" aparece: ${l}`);
  }
});

test("hot slim: avisos de rótulo cobrem curry, granola e banana", () => {
  const itens = AVISOS_DE_ROTULO.map((a) => a.item.toLowerCase()).join(" ");
  for (const t of ["curry", "granola", "banana", "aveia"]) assert.ok(itens.includes(t), t);
  assert.ok(FORA_ETAPA_1.some((f) => f.item.toLowerCase().includes("camomila")));
});
