/** A data de hoje como sai nos documentos: 18/11/2026. */
export function hojeEmTexto(agora: Date = new Date()): string {
  return agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
