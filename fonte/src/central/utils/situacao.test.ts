import assert from "node:assert/strict";
import test from "node:test";
import type { SituacaoPaciente } from "@/central/types";
import { calcularSituacao, rotuloSituacao, temAcesso, tomSituacao } from "./situacao";

/**
 * Os rótulos da área administrativa.
 *
 * O bug que motivou este arquivo: a tela reaproveitava o selo dos alimentos
 * passando só a cor, então um paciente ativo aparecia como "Melhor escolha"
 * e um vencido como "Mais ocasional" — vocabulário de comida numa ficha de
 * pessoa. O compilador agora separa os dois componentes; estes testes
 * guardam o resto: que toda situação tem rótulo próprio e que nenhum deles
 * volta a ser texto de alimento.
 */

const SITUACOES: SituacaoPaciente[] = [
  "convite_pendente",
  "ativo",
  "suspenso",
  "nao_iniciado",
  "expirado",
  "proximo_do_vencimento",
];

const VOCABULARIO_DE_ALIMENTO = ["Melhor escolha", "Boa opção", "Mais ocasional"];

test("toda situação tem um rótulo legível, diferente do nome técnico", () => {
  for (const situacao of SITUACOES) {
    const rotulo = rotuloSituacao(situacao);
    assert.ok(rotulo.length > 0, `${situacao} ficou sem rótulo`);
    assert.notEqual(rotulo, situacao, `${situacao} está mostrando o nome técnico na tela`);
    assert.ok(!rotulo.includes("_"), `${situacao} está mostrando underline na tela`);
  }
});

test("nenhum rótulo de paciente usa o vocabulário dos alimentos", () => {
  for (const situacao of SITUACOES) {
    assert.ok(
      !VOCABULARIO_DE_ALIMENTO.includes(rotuloSituacao(situacao)),
      `${situacao} voltou a mostrar rótulo de alimento`,
    );
  }
});

test("os rótulos que a nutricionista espera ver", () => {
  assert.equal(rotuloSituacao("ativo"), "Ativo");
  assert.equal(rotuloSituacao("expirado"), "Expirado");
  assert.equal(rotuloSituacao("suspenso"), "Suspenso");
  assert.equal(rotuloSituacao("convite_pendente"), "Convite pendente");
  assert.equal(rotuloSituacao("proximo_do_vencimento"), "Próximo do vencimento");
  assert.equal(rotuloSituacao("nao_iniciado"), "Ainda não começou");
});

test("a cor acompanha a gravidade da situação", () => {
  assert.equal(tomSituacao("ativo"), "melhor");
  assert.equal(tomSituacao("proximo_do_vencimento"), "boa");
  assert.equal(tomSituacao("expirado"), "ocasional");
  assert.equal(tomSituacao("suspenso"), "ocasional");
  assert.equal(tomSituacao("convite_pendente"), "neutro");
  assert.equal(tomSituacao("nao_iniciado"), "neutro");
});

/**
 * A regra do briefing, em caso: convite não é acesso, e vencer não é a
 * mesma coisa que ser suspenso.
 */
const DENTRO = { status: "ativo" as const, perfilId: "p1", dataInicio: "2026-09-01", dataFim: "2026-10-01" };

test("convite pendente não é acesso, mesmo dentro do período", () => {
  const semConta = { ...DENTRO, perfilId: null };
  assert.equal(calcularSituacao(semConta, 15, "2026-09-12"), "convite_pendente");
  assert.equal(temAcesso(semConta, "2026-09-12"), false);
});

test("dentro do período, com conta e sem suspensão, tem acesso", () => {
  assert.equal(calcularSituacao(DENTRO, 15, "2026-09-12"), "ativo");
  assert.equal(temAcesso(DENTRO, "2026-09-12"), true);
});

test("no último dia ainda tem acesso; no dia seguinte, não", () => {
  assert.equal(temAcesso(DENTRO, "2026-10-01"), true);
  assert.equal(temAcesso(DENTRO, "2026-10-02"), false);
  assert.equal(calcularSituacao(DENTRO, 15, "2026-10-02"), "expirado");
});

test("próximo do vencimento continua tendo acesso — é só aviso", () => {
  assert.equal(calcularSituacao(DENTRO, 15, "2026-09-25"), "proximo_do_vencimento");
  assert.equal(temAcesso(DENTRO, "2026-09-25"), true);
});

test("suspenso não tem acesso nem no meio do período", () => {
  const suspenso = { ...DENTRO, status: "suspenso" as const };
  assert.equal(calcularSituacao(suspenso, 15, "2026-09-12"), "suspenso");
  assert.equal(temAcesso(suspenso, "2026-09-12"), false);
});

test("antes da data de início, o acesso ainda não vale", () => {
  assert.equal(calcularSituacao(DENTRO, 15, "2026-08-30"), "nao_iniciado");
  assert.equal(temAcesso(DENTRO, "2026-08-30"), false);
});
