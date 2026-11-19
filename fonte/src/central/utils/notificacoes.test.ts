import test from "node:test";
import assert from "node:assert/strict";
import { destino, frase, nomeCurto, quandoCurto } from "./notificacoes.ts";
import type { Notificacao } from "../types/notificacao.ts";

const n = (tipo: Notificacao["tipo"], detalhe: string | null): Notificacao => ({
  tipo, detalhe, pacienteId: "p1", pacienteNome: "Ana Rita Souza Lima", quando: "2026-11-18T15:00:00Z", nova: true,
});

test("nome curto: primeiro e último", () => {
  assert.equal(nomeCurto("Ana Rita Souza Lima"), "Ana Lima");
  assert.equal(nomeCurto("Ana Rita"), "Ana Rita");
  assert.equal(nomeCurto("  Bia  "), "Bia");
});

test("a frase diz quem fez o quê", () => {
  assert.equal(frase(n("rastreio", "Banana · com sintoma")), "Ana Lima registrou Banana · com sintoma na rastreabilidade");
  assert.equal(frase(n("foto", "almoco")), "Ana Lima mandou foto do almoço");
  assert.equal(frase(n("checkin", "Feedback semanal")), "Ana Lima respondeu o Feedback semanal");
  assert.equal(frase(n("treino", "Treino A")), "Ana Lima registrou um treino: Treino A");
  assert.equal(frase(n("mensagem", "Almoço")), "Ana Lima mandou mensagem no almoço");
});

test("tocar leva para o lugar certo", () => {
  assert.equal(destino(n("rastreio", null)), "/admin/rastreabilidade/p1");
  assert.equal(destino(n("foto", null)), "/admin/paciente/p1?aba=diario");
  assert.equal(destino(n("treino", null)), "/admin/treinos/p1");
});

test("quando, em poucas palavras", () => {
  const agora = new Date("2026-11-18T15:30:00Z");
  assert.equal(quandoCurto("2026-11-18T15:29:40Z", agora), "agora");
  assert.equal(quandoCurto("2026-11-18T15:10:00Z", agora), "há 20 min");
  assert.equal(quandoCurto("2026-11-18T12:30:00Z", agora), "há 3 h");
  assert.equal(quandoCurto("2026-11-17T12:30:00Z", agora), "ontem 09:30");
  assert.equal(quandoCurto("2026-11-12T12:05:00Z", agora), "12/11 09:05");
});
