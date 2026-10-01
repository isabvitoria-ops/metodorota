import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TERMO_PADRAO } from "./termo.ts";

test("o termo padrão do app é o mesmo texto da versão 1 gravada pela migração 0063", () => {
  const sql = readFileSync(new URL("../../../../supabase/migracoes/0063_termo_de_uso_e_lgpd.sql", import.meta.url), "utf8");
  const trecho = sql.split("$termo$")[1] ?? "";
  assert.equal(trecho.trim(), TERMO_PADRAO.trim());
});

test("o termo cobre o que a LGPD pede: dados, finalidade, base legal, direitos, segurança", () => {
  for (const item of ["Que dados são guardados", "Para que usamos", "Por que podemos usar", "Os seus direitos", "Segurança", "Baixar meus dados", "Pedir exclusão"]) {
    assert.ok(TERMO_PADRAO.includes(item), `faltou: ${item}`);
  }
});
