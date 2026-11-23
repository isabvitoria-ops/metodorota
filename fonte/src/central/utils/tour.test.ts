import test from "node:test";
import assert from "node:assert/strict";
import { passosVisiveis } from "./tour.ts";
import type { PassoDoTour } from "../types/tour.ts";

const p = (ordem: number, area: string | null, ativo = true): PassoDoTour => ({ id: String(ordem), ordem, area, titulo: "t", texto: "x", videoUrl: null, ativo });
const passos = [p(3, "trocas"), p(1, null), p(4, "rastreio"), p(5, "diario", false), p(2, null)];

test("só os ligados, na ordem", () => {
  const v = passosVisiveis(passos, { papel: "paciente", areasDesligadas: [], rastreio: true });
  assert.deepEqual(v.map((x) => x.ordem), [1, 2, 3, 4]);
});

test("área desligada e rastreio desligado saem", () => {
  const v = passosVisiveis(passos, { papel: "paciente", areasDesligadas: ["trocas"], rastreio: false });
  assert.deepEqual(v.map((x) => x.ordem), [1, 2]);
});
