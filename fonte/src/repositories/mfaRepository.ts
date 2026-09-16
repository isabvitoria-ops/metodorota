import { atraso, db } from "./mockDb";

/**
 * Regra §5 (exceção deliberada): sessão persistente não isenta a
 * nutricionista de MFA no primeiro login em cada dispositivo novo. Uma vez
 * confiado, o dispositivo fica confiável por 90 dias — depois disso pede
 * o código de novo, mesmo com a sessão ainda válida.
 */
const DIAS_CONFIANCA = 90;

/**
 * "Confiar por 90 dias" precisa sobreviver a um F5 — senão a promessa da
 * caixa de seleção é falsa e a nutricionista digita o código toda vez.
 * O mock em memória zera a cada recarga, então a lista é espelhada no
 * localStorage. Com Supabase isto vira uma tabela; a assinatura não muda.
 */
const CHAVE_ARMAZENAMENTO = "consultorio:dispositivos-confiaveis";

type Confiavel = { deviceId: string; confiadoAte: string };

function lerArmazenados(): Confiavel[] {
  try {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    const lista: unknown = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(lista) ? (lista as Confiavel[]) : [];
  } catch {
    return [];
  }
}

function gravarArmazenados(lista: Confiavel[]): void {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(lista));
  } catch {
    // Modo privado / cota cheia: cai para só-em-memória, pedindo MFA de novo.
  }
}

/** União do mock em memória com o que foi persistido nesta origem. */
function todosOsConfiaveis(): Confiavel[] {
  const porId = new Map<string, Confiavel>();
  for (const d of [...db.nutricionista.dispositivosConfiaveis, ...lerArmazenados()]) {
    const anterior = porId.get(d.deviceId);
    // Mantém sempre a data de expiração mais distante.
    if (!anterior || anterior.confiadoAte < d.confiadoAte) porId.set(d.deviceId, d);
  }
  return [...porId.values()];
}

export async function dispositivoEhConfiavel(deviceId: string): Promise<boolean> {
  await atraso(80);
  const entrada = todosOsConfiaveis().find((d) => d.deviceId === deviceId);
  if (!entrada) return false;
  return new Date(entrada.confiadoAte).getTime() > Date.now();
}

export async function confiarDispositivo(deviceId: string): Promise<void> {
  await atraso(150);
  const confiadoAte = new Date(Date.now() + DIAS_CONFIANCA * 24 * 60 * 60 * 1000).toISOString();

  const existente = db.nutricionista.dispositivosConfiaveis.find((d) => d.deviceId === deviceId);
  if (existente) existente.confiadoAte = confiadoAte;
  else db.nutricionista.dispositivosConfiaveis.push({ deviceId, confiadoAte });

  const armazenados = lerArmazenados().filter((d) => d.deviceId !== deviceId);
  armazenados.push({ deviceId, confiadoAte });
  gravarArmazenados(armazenados);
}
