/** "há 2 h", "ontem", "seg, 09:14" — mesmo estilo de rótulo usado nos dois protótipos para post/mensagem. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24 && data.toDateString() === agora.toDateString()) return `há ${diffH} h`;

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "ontem";
  if (diffDias < 6) {
    const dia = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${dia}, ${hora}`;
  }
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
