import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Guarda de contraste da paleta (§20, §21).
 *
 * O briefing pede que trocar a identidade visual seja mexer só nas variáveis
 * de `central.css`. Este teste existe para que essa troca não derrube a
 * legibilidade sem ninguém perceber: ele lê as variáveis direto do CSS e
 * confere cada par que aparece na tela contra a régua da WCAG — 4,5:1 para
 * texto e 3:1 para ícone e moldura de controle.
 *
 * Se uma cor nova reprovar aqui, a saída diz qual par e quanto faltou.
 */
const CSS = readFileSync(fileURLToPath(new URL("./central.css", import.meta.url)), "utf8");

function variavel(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{3,8});`).exec(CSS);
  assert.ok(achado, `variável --${nome} não encontrada em central.css`);
  return achado[1]!;
}

function luminancia(hex: string): number {
  const limpo = hex.replace("#", "");
  const completo = limpo.length === 3 ? limpo.split("").map((c) => c + c).join("") : limpo;
  const canais = [0, 2, 4].map((i) => parseInt(completo.slice(i, i + 2), 16) / 255);
  const linear = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (escuro! + 0.05);
}

/** [descrição, frente, fundo, mínimo] */
const PARES: [string, string, string, number][] = [
  ["texto sobre o fundo", "text", "background", 4.5],
  ["texto sobre o cartão", "text", "surface", 4.5],
  ["texto de apoio sobre o fundo", "text-muted", "background", 4.5],
  ["texto de apoio sobre o cartão", "text-muted", "surface", 4.5],
  ["rótulo e placeholder sobre o fundo", "text-subtle", "background", 4.5],
  ["rótulo e placeholder sobre o cartão", "text-subtle", "surface", 4.5],
  ["cor principal sobre o fundo", "primary", "background", 4.5],
  ["cor principal sobre o cartão", "primary", "surface", 4.5],
  ["texto do cartão de resultado", "surface", "primary", 4.5],
  ["item ativo da navegação", "primary", "primary-soft", 4.5],
  ["faixa da nutricionista", "primary-dark", "primary-soft", 4.5],
  ["selo de melhor escolha", "success", "success-soft", 4.5],
  ["selo de boa opção", "warning", "warning-soft", 4.5],
  ["selo de mais ocasional", "danger", "danger-soft", 4.5],
  ["ícone decorativo", "icone", "background", 3],
  ["moldura de campo sobre o cartão", "border-campo", "surface", 3],
  ["moldura de campo sobre o fundo", "border-campo", "background", 3],
];

for (const [descricao, frente, fundo, minimo] of PARES) {
  test(`contraste: ${descricao} (mínimo ${minimo}:1)`, () => {
    const valor = contraste(variavel(frente), variavel(fundo));
    assert.ok(
      valor >= minimo,
      `--${frente} sobre --${fundo} está em ${valor.toFixed(2)}:1 e precisa de ${minimo}:1`,
    );
  });
}
