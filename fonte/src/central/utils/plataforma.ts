/**
 * Em que aparelho a paciente está, para mostrar o passo a passo certo de
 * "colocar na tela inicial". Função pura (recebe o que o navegador informa),
 * para poder ser testada sem navegador.
 */
export type Plataforma = "ios" | "android" | "computador";

export function detectarPlataforma(
  userAgent: string,
  plataforma = "",
  pontosDeToque = 0,
): Plataforma {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS 13+ se apresenta como Mac; só o toque o entrega.
  if (plataforma === "MacIntel" && pontosDeToque > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "computador";
}

/**
 * No iPhone, só o Safari (e, nas versões recentes, o Chrome) sabe colocar o
 * site na tela inicial. O navegador que abre dentro do WhatsApp ou do
 * Instagram não sabe — e é por ele que a paciente costuma chegar, pelo link
 * que recebeu. Esse navegador interno não tem a palavra "Safari" no
 * identificador, ao contrário do Safari de verdade.
 */
export function estaEmNavegadorInterno(userAgent: string): boolean {
  const ua = userAgent;
  if (/FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp/i.test(ua)) return true;
  const ios = /iphone|ipad|ipod/i.test(ua);
  // Safari e Chrome/Firefox/Edge do iPhone trazem "Safari/", "CriOS", "FxiOS" ou "EdgiOS".
  return ios && !/Safari\/|CriOS|FxiOS|EdgiOS/i.test(ua);
}

/** Já está aberto como aplicativo (ícone da tela inicial): não precisa ensinar. */
export function jaEstaInstalado(
  janela: { matchMedia?: (q: string) => { matches: boolean }; navigator?: { standalone?: boolean } },
): boolean {
  try {
    if (janela.navigator?.standalone === true) return true;
    return Boolean(janela.matchMedia?.("(display-mode: standalone)").matches);
  } catch {
    return false;
  }
}
