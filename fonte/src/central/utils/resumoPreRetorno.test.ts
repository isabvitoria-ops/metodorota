import test from "node:test";
import assert from "node:assert/strict";
import { bristolMaisFrequente, lacunas, notaAntesEAgora } from "./resumoPreRetorno.ts";

test("acha os trechos de 3 dias ou mais sem registro", () => {
  const l = lacunas(["2026-11-06", "2026-11-07", "2026-11-12", "2026-11-13"], "2026-11-05", "2026-11-18");
  assert.deepEqual(l, [
    { de: "2026-11-08", ate: "2026-11-11", dias: 4 },
    { de: "2026-11-14", ate: "2026-11-17", dias: 4 },
  ]);
});

test("dois dias sem registro não contam", () => {
  assert.deepEqual(lacunas(["2026-11-06", "2026-11-09"], "2026-11-05", "2026-11-10"), []);
});

test("o Bristol mais frequente", () => {
  assert.deepEqual(bristolMaisFrequente({ "4": 9, "6": 3 }), { tipo: 4, vezes: 9 });
  assert.equal(bristolMaisFrequente({}), null);
});

test("nota antes e depois da consulta, sem as atrasadas", () => {
  const r = notaAntesEAgora(
    [
      { data: "2026-10-31", nota: 58 },
      { data: "2026-11-04", nota: 62 },
      { data: "2026-11-14", nota: 66 },
      { data: "2026-11-21", nota: 71 },
      { data: "2026-11-22", nota: null },
    ],
    "2026-11-05",
  );
  assert.deepEqual(r, { antes: { data: "2026-11-04", nota: 62 }, agora: { data: "2026-11-21", nota: 71 } });
  assert.deepEqual(notaAntesEAgora([], "2026-11-05"), { antes: null, agora: null });
});
