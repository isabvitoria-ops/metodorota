import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Meta } from "@/central/types/meta";
import type { PanoramaDoPaciente } from "@/central/types/panorama";
import {
  adesao,
  emOrdemDeAtencao,
  iniciais,
  statusDoPaciente,
  textoDoStatus,
  variacaoDePeso,
} from "@/central/utils/panoramaPacientes";

const HOJE = "2026-09-16";

function dias(n: number): string {
  const d = new Date(`${HOJE}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function meta(parcial: Partial<Meta> = {}): Meta {
  return {
    id: "m1",
    titulo: "Beber água",
    descricao: null,
    categoria: null,
    frequencia: "diaria",
    alvo: 1,
    unidade: "vez",
    inicio: dias(-30),
    prazo: null,
    status: "ativa",
    registros: [],
    ...parcial,
  };
}

function paciente(parcial: Partial<PanoramaDoPaciente> = {}): PanoramaDoPaciente {
  return {
    id: "p1",
    nome: "Mariana Silva",
    email: "m@teste.test",
    condicao: "SII",
    situacao: "ativo",
    dataInicio: dias(-60),
    // `dataFim` e `diasRestantes` coerentes entre si: é deles que o texto
    // do status descobre que dia é hoje, sem relógio global.
    dataFim: dias(30),
    diasRestantes: 30,
    proximaConsulta: null,
    ultimaConsulta: null,
    ultimoRegistro: null,
    pesoInicial: null,
    pesoAtual: null,
    metas: [],
    ...parcial,
  };
}

// ------------------------------------------------------------------ status

test("consulta marcada para hoje é retorno hoje", () => {
  const p = paciente({ proximaConsulta: { data: HOJE, hora: null, tipo: "retorno" } });
  assert.equal(statusDoPaciente(p, HOJE), "retorno_hoje");
});

test("consulta em três dias é retorno próximo", () => {
  const p = paciente({ proximaConsulta: { data: dias(3), hora: null, tipo: "retorno" } });
  assert.equal(statusDoPaciente(p, HOJE), "retorno_proximo");
  assert.equal(textoDoStatus("retorno_proximo", p), "retorno em 3 dias");
});

test("consulta amanhã se escreve 'amanhã', não 'em 1 dias'", () => {
  const p = paciente({ proximaConsulta: { data: dias(1), hora: null, tipo: "retorno" } });
  assert.equal(textoDoStatus("retorno_proximo", p), "retorno amanhã");
});

test("consulta daqui a um mês não vira retorno próximo", () => {
  const p = paciente({ proximaConsulta: { data: dias(25), hora: null, tipo: "retorno" } });
  assert.equal(statusDoPaciente(p, HOJE), "em_dia");
});

test("nove dias sem registro nenhum é sem registro recente", () => {
  const p = paciente({ metas: [meta()], ultimoRegistro: dias(-9) });
  assert.equal(statusDoPaciente(p, HOJE), "sem_registro");
  assert.equal(textoDoStatus("sem_registro", p), "sem registro há 9 dias");
});

test("registro de três dias atrás continua em dia", () => {
  const p = paciente({ metas: [meta()], ultimoRegistro: dias(-3) });
  assert.equal(statusDoPaciente(p, HOJE), "em_dia");
});

test("paciente SEM meta nenhuma não é cobrada por não registrar", () => {
  // Nunca registrou porque nunca teve onde. Chamá-la de "sem registro
  // recente" seria cobrar o silêncio de uma porta que ela não tem.
  const p = paciente({ metas: [], ultimoRegistro: null });
  assert.equal(statusDoPaciente(p, HOJE), "em_dia");
});

test("com meta e nenhum registro, a lista chama atenção", () => {
  const p = paciente({ metas: [meta()], ultimoRegistro: null });
  assert.equal(statusDoPaciente(p, HOJE), "sem_registro");
  assert.equal(textoDoStatus("sem_registro", p), "nenhum registro ainda");
});

test("acesso vencido aparece, mas perde para o retorno marcado", () => {
  const vencida = paciente({ situacao: "expirado" });
  assert.equal(statusDoPaciente(vencida, HOJE), "sem_acesso");

  // Com consulta marcada, o acesso vencido é assunto da consulta.
  const comRetorno = paciente({
    situacao: "expirado",
    proximaConsulta: { data: HOJE, hora: null, tipo: "retorno" },
  });
  assert.equal(statusDoPaciente(comRetorno, HOJE), "retorno_hoje");
});

// ------------------------------------------------------------------ adesão

test("sem meta ativa, a adesão é NULA e não zero", () => {
  // Zero por cento diria que ela não fez nada. Nulo diz que não há como
  // saber, que é a verdade.
  assert.equal(adesao([], HOJE), null);
});

test("meta que começou hoje ainda não tem adesão", () => {
  assert.equal(adesao([meta({ inicio: HOJE })], HOJE), null);
});

test("cumprir todos os dias passados dá 100%", () => {
  const registros = Array.from({ length: 28 }, (_, i) => ({
    id: `r${i}`,
    data: dias(-(i + 1)),
    quantidade: 1,
    observacao: null,
  }));
  assert.equal(adesao([meta({ registros })], HOJE), 100);
});

test("cumprir metade dos dias dá perto de 50%", () => {
  const registros = Array.from({ length: 14 }, (_, i) => ({
    id: `r${i}`,
    data: dias(-(i * 2 + 1)),
    quantidade: 1,
    observacao: null,
  }));
  const valor = adesao([meta({ registros })], HOJE);
  assert.ok(valor !== null && valor >= 45 && valor <= 55, `esperava perto de 50, veio ${valor}`);
});

test("o dia de hoje, ainda aberto, não derruba a adesão", () => {
  // Contá-lo como não cumprido derrubaria a adesão de toda paciente toda
  // manhã, por um motivo que não é dela.
  const registros = Array.from({ length: 28 }, (_, i) => ({
    id: `r${i}`,
    data: dias(-(i + 1)),
    quantidade: 1,
    observacao: null,
  }));
  assert.equal(adesao([meta({ registros })], HOJE), 100, "hoje sem marcação não pode tirar pontos");
});

test("meta pausada não entra na adesão", () => {
  assert.equal(adesao([meta({ status: "pausada" })], HOJE), null);
});

test("meta semanal é contada em semanas, não em dias", () => {
  // 28 dias são 4 semanas. Contando em dias, uma meta semanal cumprida
  // sairia com 4 de 28 = 14%, e a lista diria que ela quase não fez nada.
  const semanal = meta({
    frequencia: "semanal",
    alvo: 1,
    inicio: dias(-60),
    registros: [
      { id: "a", data: dias(-2), quantidade: 1, observacao: null },
      { id: "b", data: dias(-9), quantidade: 1, observacao: null },
      { id: "c", data: dias(-16), quantidade: 1, observacao: null },
      { id: "d", data: dias(-23), quantidade: 1, observacao: null },
    ],
  });
  const valor = adesao([semanal], HOJE);
  assert.ok(valor !== null && valor >= 75, `esperava alto, veio ${valor}`);
});

// ------------------------------------------------------------------ o resto

test("a variação de peso só existe com as duas pontas", () => {
  assert.equal(variacaoDePeso(paciente({ pesoInicial: 77, pesoAtual: null })), null);
  assert.equal(variacaoDePeso(paciente({ pesoInicial: 77, pesoAtual: 72.8 })), -4.2);
});

test("as iniciais pegam o primeiro e o último nome", () => {
  assert.equal(iniciais("Mariana Silva"), "MS");
  assert.equal(iniciais("Ana Maria Souza Lima"), "AL");
  assert.equal(iniciais("Madonna"), "M");
  assert.equal(iniciais("   "), "?");
});

test("a lista põe quem precisa de algo primeiro", () => {
  const hoje = paciente({ id: "hoje", nome: "Zuleica",
    proximaConsulta: { data: HOJE, hora: null, tipo: "retorno" } });
  const parada = paciente({ id: "parada", nome: "Beatriz",
    metas: [meta()], ultimoRegistro: dias(-20) });
  const bem = paciente({ id: "bem", nome: "Ana", metas: [meta()], ultimoRegistro: dias(-1) });

  assert.deepEqual(
    emOrdemDeAtencao([bem, parada, hoje], HOJE).map((p) => p.id),
    ["hoje", "parada", "bem"],
    "alfabética poria a Zuleica no fim, no dia do retorno dela",
  );
});

test("empatadas no status, a ordem é alfabética", () => {
  const a = paciente({ id: "a", nome: "Ana" });
  const z = paciente({ id: "z", nome: "Zuleica" });
  assert.deepEqual(emOrdemDeAtencao([z, a], HOJE).map((p) => p.id), ["a", "z"]);
});
