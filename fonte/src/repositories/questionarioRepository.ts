import type { QuestionarioTemplate, RespostaQuestionario } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function buscarTemplateAtivo(periodicidade: QuestionarioTemplate["periodicidade"]): Promise<QuestionarioTemplate | null> {
  await atraso();
  return db.templatesQuestionario.find((t) => t.periodicidade === periodicidade) ?? null;
}

export async function listarRespostas(pacienteId: string): Promise<RespostaQuestionario[]> {
  await atraso();
  return db.respostasQuestionario.filter((r) => r.pacienteId === pacienteId);
}

export async function jaRespondeuNoMesAtual(pacienteId: string, templateId: string): Promise<boolean> {
  await atraso();
  const agora = new Date();
  return db.respostasQuestionario.some((r) => {
    if (r.pacienteId !== pacienteId || r.templateId !== templateId) return false;
    const d = new Date(r.respondidoEm);
    return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
  });
}

export async function salvarResposta(
  nutricionistaId: string,
  pacienteId: string,
  templateId: string,
  templateVersao: number,
  respostas: RespostaQuestionario["respostas"],
): Promise<RespostaQuestionario> {
  await atraso(350);
  const resposta: RespostaQuestionario = {
    id: gerarId("resposta-quest"),
    nutricionistaId,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId,
    templateId,
    templateVersao,
    respondidoEm: agoraISO(),
    respostas,
    lidaPelaNutricionistaEm: null,
  };
  db.respostasQuestionario.push(resposta);
  return resposta;
}

export async function listarRespostasAguardandoLeitura(nutricionistaId: string): Promise<RespostaQuestionario[]> {
  await atraso();
  return db.respostasQuestionario.filter((r) => r.nutricionistaId === nutricionistaId && !r.lidaPelaNutricionistaEm);
}

export async function marcarRespostaLida(respostaId: string): Promise<void> {
  await atraso();
  const resposta = db.respostasQuestionario.find((r) => r.id === respostaId);
  if (resposta) resposta.lidaPelaNutricionistaEm = agoraISO();
}
