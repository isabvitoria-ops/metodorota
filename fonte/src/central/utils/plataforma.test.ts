import test from "node:test";
import assert from "node:assert/strict";
import { detectarPlataforma, estaEmNavegadorInterno, jaEstaInstalado } from "./plataforma.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_WHATSAPP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36";

test("plataforma: iPhone, Android e computador", () => {
  assert.equal(detectarPlataforma(IPHONE_SAFARI), "ios");
  assert.equal(detectarPlataforma(ANDROID_CHROME), "android");
  assert.equal(detectarPlataforma(WINDOWS_CHROME), "computador");
});

test("plataforma: iPad novo se apresenta como Mac, mas tem toque", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  assert.equal(detectarPlataforma(mac, "MacIntel", 5), "ios");
  assert.equal(detectarPlataforma(mac, "MacIntel", 0), "computador");
});

test("navegador interno do iPhone (WhatsApp, Instagram) é reconhecido; Safari e Chrome não", () => {
  assert.equal(estaEmNavegadorInterno(IPHONE_WHATSAPP), true);
  assert.equal(estaEmNavegadorInterno(IPHONE_SAFARI), false);
  assert.equal(estaEmNavegadorInterno(IPHONE_CHROME), false);
  assert.equal(estaEmNavegadorInterno(ANDROID_CHROME), false);
  assert.equal(estaEmNavegadorInterno(IPHONE_SAFARI + " Instagram 300.0"), true);
});

test("já instalado: iPhone (standalone) e modo standalone do resto", () => {
  assert.equal(jaEstaInstalado({ navigator: { standalone: true } }), true);
  assert.equal(jaEstaInstalado({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(jaEstaInstalado({ matchMedia: () => ({ matches: false }), navigator: { standalone: false } }), false);
  assert.equal(jaEstaInstalado({}), false);
});
