import test from "node:test";
import assert from "node:assert/strict";
import type { EntradaDaBase, MedicamentoDaPaciente } from "@/central/types/medicamentos";
import { entradasDoMedicamento, examesComONome, montarPdfDeMedicamentos, nutrientesAAcompanhar } from "./medicamentos.ts";

const IBP: EntradaDaBase = {
  id: "ibp",
  nome: "IBP",
  termos: ["omeprazol", "pantoprazol"],
  nutrientes: [
    { nutriente: "Vitamina B12", fonte: "Lam 2013" },
    { nutriente: "Ferro", fonte: "Lam 2017" },
  ],
  conferidoEm: "2026-11-23",
  anotacao: null,
};
const MET: EntradaDaBase = { id: "met", nome: "Metformina", termos: ["metformina"], nutrientes: [{ nutriente: "Vitamina B12", fonte: "Aroda 2016" }], conferidoEm: null, anotacao: null };
const med = (nome: string, ativo = true): MedicamentoDaPaciente => ({ id: nome, pacienteId: "p", nome, tipo: "medicamento", dose: null, horario: null, desde: null, prescritoPor: null, anotacao: null, ativo });

test("casa pelo nome, sem acento e com a dose junto", () => {
  assert.deepEqual(entradasDoMedicamento("Omeprazol 20 mg", [IBP, MET]).map((e) => e.id), ["ibp"]);
  assert.deepEqual(entradasDoMedicamento("PANTOPRAZOL", [IBP, MET]).map((e) => e.id), ["ibp"]);
  assert.deepEqual(entradasDoMedicamento("Espinheira-santa", [IBP, MET]), []);
});

test("só entra a entrada conferida, e só remédio ativo", () => {
  const r = nutrientesAAcompanhar([med("Omeprazol 20 mg"), med("Metformina 850 mg")], [IBP, MET]);
  assert.deepEqual(r.map((x) => x.nutriente), ["Vitamina B12", "Ferro"]);
  assert.deepEqual(r[0]!.medicamentos, ["Omeprazol 20 mg"]);
  assert.deepEqual(nutrientesAAcompanhar([med("Omeprazol", false)], [IBP]), []);
});

test("junta o mesmo nutriente de dois remédios conferidos", () => {
  const r = nutrientesAAcompanhar([med("Omeprazol"), med("Metformina")], [IBP, { ...MET, conferidoEm: "2026-11-23" }]);
  const b12 = r.find((x) => x.nutriente === "Vitamina B12")!;
  assert.deepEqual(b12.medicamentos, ["Omeprazol", "Metformina"]);
  assert.deepEqual(b12.fontes, ["Lam 2013", "Aroda 2016"]);
});

test("acha os exames que trazem o nome do nutriente", () => {
  const exames = ["Ferritina", "Ferro sérico", "Vitamina B12", "Magnésio", "Vitamina D (25-OH)"];
  assert.deepEqual(examesComONome(["Vitamina B12", "Ferro"], exames), ["Ferro sérico", "Vitamina B12"]);
});

test("o PDF numera as fontes e deixa de fora a base não conferida", () => {
  const { linhas, fontes } = montarPdfDeMedicamentos(
    [{ ...med("Omeprazol 20 mg"), dose: "20 mg", horario: "em jejum" }, med("Metformina"), med("Parei", false)],
    [IBP, MET],
    () => "Fitoterápico",
  );
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0]!.uso, "em jejum");
  assert.deepEqual(linhas[0]!.acompanhar, [
    { nutriente: "Vitamina B12", fonte: 1 },
    { nutriente: "Ferro", fonte: 2 },
  ]);
  assert.deepEqual(linhas[1]!.acompanhar, []);
  assert.deepEqual(fontes, ["Lam 2013", "Lam 2017"]);
});
