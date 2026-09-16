import type { Plano, VersaoPlanoResumo } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function buscarPlanoAtivo(pacienteId: string): Promise<Plano | null> {
  await atraso();
  return db.planos.find((p) => p.pacienteId === pacienteId && p.ativa) ?? null;
}

export async function listarHistoricoVersoes(pacienteId: string): Promise<VersaoPlanoResumo[]> {
  await atraso();
  const planoIds = new Set(db.planos.filter((p) => p.pacienteId === pacienteId).map((p) => p.id));
  return db.historicoVersoes.filter((v) => planoIds.has(v.planoId));
}

/**
 * Publica uma nova versão: desativa a versão atual, cria a nova como ativa
 * e registra no histórico. Nunca sobrescreve a versão anterior (auditoria).
 */
export async function publicarNovaVersao(
  pacienteId: string,
  nutricionistaId: string,
  refeicoes: Plano["refeicoes"],
  notaVersao: string | undefined,
  faseRotulo: string | undefined,
): Promise<Plano> {
  await atraso(400);
  const atual = db.planos.find((p) => p.pacienteId === pacienteId && p.ativa);
  if (atual) {
    atual.ativa = false;
    // O histórico é uma projeção separada: desativar só o `Plano` deixava a
    // entrada antiga do histórico ainda marcada ATIVA, e a tela mostrava
    // duas versões ativas ao mesmo tempo.
    const entradaAntiga = db.historicoVersoes.find((v) => v.planoId === atual.id);
    if (entradaAntiga) entradaAntiga.ativa = false;
  }

  const versao = (atual?.versao ?? 0) + 1;
  const id = gerarId("plano");
  const publicado: Plano = {
    id,
    nutricionistaId,
    pacienteId,
    versao,
    ativa: true,
    notaVersao,
    faseRotulo: faseRotulo ?? atual?.faseRotulo,
    refeicoes,
    publicadoEm: agoraISO(),
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
  };
  db.planos.push(publicado);
  db.historicoVersoes.unshift({ planoId: id, versao, publicadoEm: publicado.publicadoEm!, nota: notaVersao, ativa: true });
  return publicado;
}
