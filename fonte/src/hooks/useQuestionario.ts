import { useCallback, useEffect, useState } from "react";
import type { QuestionarioTemplate, RespostaQuestionario } from "@/types";
import { questionarioService } from "@/services";
import { useUiPacienteStore } from "@/store/uiPacienteStore";

/**
 * Inicializa o badge de questionário pendente no topbar, chamado uma vez
 * no mount de AppPaciente. Separado do useQuestionarioMensal (que carrega
 * o template completo) porque o badge precisa aparecer antes do usuário
 * abrir o modal.
 */
export function useQuestionarioPendenteInicial(pacienteId: string) {
  const definirQuestionarioPendente = useUiPacienteStore((s) => s.definirQuestionarioPendente);
  useEffect(() => {
    let ativo = true;
    (async () => {
      const t = await questionarioService.buscarTemplateMensal();
      if (ativo && t) {
        const pendente = await questionarioService.pendenteEsteMs(pacienteId, t);
        if (ativo) definirQuestionarioPendente(pendente);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [pacienteId, definirQuestionarioPendente]);
}

export function useQuestionarioMensal(pacienteId: string) {
  const [template, setTemplate] = useState<QuestionarioTemplate | null>(null);
  const [carregando, setCarregando] = useState(true);
  const definirQuestionarioPendente = useUiPacienteStore((s) => s.definirQuestionarioPendente);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const t = await questionarioService.buscarTemplateMensal();
      if (!ativo) return;
      setTemplate(t);
      if (t) {
        const pendente = await questionarioService.pendenteEsteMs(pacienteId, t);
        if (ativo) definirQuestionarioPendente(pendente);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [pacienteId, definirQuestionarioPendente]);

  const enviar = useCallback(
    async (nutricionistaId: string, respostas: RespostaQuestionario["respostas"]) => {
      if (!template) throw new Error("Template não carregado.");
      const resposta = await questionarioService.enviarResposta(nutricionistaId, pacienteId, template, respostas);
      definirQuestionarioPendente(false);
      return resposta;
    },
    [template, pacienteId, definirQuestionarioPendente],
  );

  return { template, carregando, enviar };
}
