import type { Consentimento, PreferenciasNotificacao } from "@/types";
import { PACIENTE_MARINA_ID } from "./ids";

/** Portado do protótipo (constante `LEMBRETES_PADRAO`). */
export const PREFERENCIAS_MARINA: PreferenciasNotificacao = {
  pacienteId: PACIENTE_MARINA_ID,
  textoDiscretoNaTelaBloqueada: true,
  naoPerturbeInicio: "22:00",
  naoPerturbeFim: "07:00",
  lembretes: [
    { id: "checkin", label: "Check-in do dia", descricao: "Uma vez por dia, no horário que você escolher", ativo: true, horario: "20:30" },
    { id: "refeicoes", label: "Refeições do plano", descricao: "Nos horários prescritos", ativo: true },
    { id: "agua", label: "Água", descricao: "A cada 3 horas, dentro do horário ativo", ativo: false },
    { id: "nutri", label: "Mensagem da nutri", descricao: "Quando ela responder você", ativo: true },
    { id: "questionario", label: "Questionário mensal", descricao: "Uma vez por mês", ativo: true },
    { id: "feed", label: "Novidades no feed", descricao: "No máximo duas por semana", ativo: false },
  ],
};

/** Portado do protótipo (constante `CONSENTIMENTOS`). */
export const CONSENTIMENTOS: Consentimento[] = [
  {
    id: "tratamento", obrigatorio: true, titulo: "Acompanhamento nutricional",
    texto: "Sua nutricionista vai registrar e consultar seus dados de saúde para conduzir seu tratamento. Sem isso o app não funciona.",
  },
  {
    id: "notificacoes", obrigatorio: false, titulo: "Lembretes no celular",
    texto: "Avisos de check-in, refeições e respostas da nutri. Você escolhe depois quais quer e pode desligar todos.",
  },
  {
    id: "fotos", obrigatorio: false, titulo: "Fotos de evolução corporal",
    texto: "Guardadas em área privada, sem localização, visíveis só para você e sua nutricionista. Pode apagar quando quiser.",
  },
  {
    id: "feed", obrigatorio: false, titulo: "Participar da comunidade",
    texto: "Você aparece só como um número, nunca com nome ou foto de rosto. Tudo que você publicar passa antes pela sua nutri.",
  },
];
