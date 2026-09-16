const CHAVE = "diet-app:device-id";

/** ID estável do navegador/dispositivo — base para "confiar neste dispositivo" (briefing §5). */
export function idDoDispositivo(): string {
  let id = localStorage.getItem(CHAVE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CHAVE, id);
  }
  return id;
}
