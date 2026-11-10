import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_VAZIOS,
  camposDoServidor,
  diasPendentes,
  lerDiarioLocal,
  mesclarDiario,
  migrarDiarioPorNumero,
  numeroNaFaixa,
  temAlgoPreenchido,
} from "./diarioDeViagem.ts";
import type { DiaDoDiarioDeViagem } from "@/central/types/viagem.ts";

const doBanco = (dia: string, onde: string, inchaco: number | null = null): DiaDoDiarioDeViagem => ({
  dia,
  onde,
  inchaco,
  dor: null,
  azia: null,
  evacuacoes: null,
  bristol: null,
  observacoes: null,
  atualizadoEm: "2026-11-11T20:00:00Z",
});

test("número: fica dentro da faixa que o banco aceita", () => {
  assert.equal(numeroNaFaixa("inchaco", "12"), "10");
  assert.equal(numeroNaFaixa("inchaco", "-3"), "0");
  assert.equal(numeroNaFaixa("bristol", "0"), "1");
  assert.equal(numeroNaFaixa("bristol", "9"), "7");
  assert.equal(numeroNaFaixa("evacuacoes", "2"), "2");
});

test("número: vírgula arredonda; texto e vazio viram vazio", () => {
  assert.equal(numeroNaFaixa("dor", "3,6"), "4");
  assert.equal(numeroNaFaixa("dor", "muita"), "");
  assert.equal(numeroNaFaixa("dor", ""), "");
  assert.equal(numeroNaFaixa("dor", "0"), "0");
});

test("preenchido: zero conta, espaço não", () => {
  assert.equal(temAlgoPreenchido({ ...CAMPOS_VAZIOS, dor: "0" }), true);
  assert.equal(temAlgoPreenchido({ ...CAMPOS_VAZIOS, onde: "   " }), false);
  assert.equal(temAlgoPreenchido(undefined), false);
});

test("servidor: nulo vira campo vazio, zero continua zero", () => {
  assert.deepEqual(camposDoServidor(doBanco("2026-11-11", "Lisboa", 0)), {
    ...CAMPOS_VAZIOS,
    onde: "Lisboa",
    inchaco: "0",
  });
});

test("mesclar: o dia pendente do aparelho ganha do banco", () => {
  const local = { "2026-11-11": { ...CAMPOS_VAZIOS, onde: "Porto (editado sem internet)", pendente: true } };
  const junto = mesclarDiario(local, [doBanco("2026-11-11", "Lisboa")]);
  assert.equal(junto["2026-11-11"]?.onde, "Porto (editado sem internet)");
  assert.deepEqual(diasPendentes(junto), ["2026-11-11"]);
});

test("mesclar: sem pendência vale o banco, e dia novo do banco entra", () => {
  const local = { "2026-11-11": { ...CAMPOS_VAZIOS, onde: "velho", pendente: false } };
  const junto = mesclarDiario(local, [doBanco("2026-11-11", "Lisboa"), doBanco("2026-11-12", "Roma", 4)]);
  assert.equal(junto["2026-11-11"]?.onde, "Lisboa");
  assert.equal(junto["2026-11-12"]?.inchaco, "4");
  assert.deepEqual(diasPendentes(junto), []);
});

test("mesclar: dia só do aparelho não é apagado", () => {
  const local = { "2026-11-13": { ...CAMPOS_VAZIOS, onde: "Madri", pendente: true } };
  assert.equal(mesclarDiario(local, [])["2026-11-13"]?.onde, "Madri");
});

test("migração: o diário antigo, por número do dia, passa para a data e fica pendente", () => {
  const datas = ["2026-11-11", "2026-11-12", "2026-11-13"];
  const novo = migrarDiarioPorNumero(
    { 1: { onde: "Lisboa", inchaco: "3", bristol: "9" }, 2: { onde: "", inchaco: "" }, 7: { onde: "fora da viagem" } },
    datas,
  );
  assert.deepEqual(Object.keys(novo), ["2026-11-11"]);
  assert.equal(novo["2026-11-11"]?.bristol, "7");
  assert.equal(novo["2026-11-11"]?.pendente, true);
  assert.deepEqual(migrarDiarioPorNumero("lixo", datas), {});
});

test("aparelho: lixo guardado vira diário vazio, sem lançar", () => {
  assert.deepEqual(lerDiarioLocal(null), {});
  assert.deepEqual(lerDiarioLocal("{não é json"), {});
  assert.deepEqual(lerDiarioLocal("[1,2]"), {});
  const lido = lerDiarioLocal(JSON.stringify({ "2026-11-11": { onde: "Lisboa", pendente: true }, torto: { onde: "x" } }));
  assert.deepEqual(Object.keys(lido), ["2026-11-11"]);
  assert.equal(lido["2026-11-11"]?.inchaco, "");
  assert.equal(lido["2026-11-11"]?.pendente, true);
});
