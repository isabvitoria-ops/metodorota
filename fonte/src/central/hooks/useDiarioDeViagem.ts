import { useCallback, useEffect, useRef, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { CamposDoDiario } from "@/central/types/viagem";
import {
  CAMPOS_VAZIOS,
  camposDe,
  diasPendentes,
  eCampoNumerico,
  lerDiarioLocal,
  mesclarDiario,
  migrarDiarioPorNumero,
  numeroNaFaixa,
  type DiarioLocal,
} from "@/central/utils/diarioDeViagem";

export type EstadoDeEnvio = "salvando" | "salvo" | "falhou";

/** Espera ela parar de digitar antes de mandar: uma ida ao banco por pausa, não por letra. */
const ESPERA_MS = 1200;

function chave(versao: "v1" | "v2", perfilId: string | null): string {
  return `central:viagem-diario:${versao}:${perfilId ?? "anonimo"}`;
}

function lerDoAparelho(perfilId: string | null, datas: string[]): DiarioLocal {
  try {
    const atual = window.localStorage.getItem(chave("v2", perfilId));
    if (atual) return lerDiarioLocal(atual);
    // Primeira versão do guia: o diário era guardado pelo número do dia.
    const antigo = window.localStorage.getItem(chave("v1", perfilId));
    return antigo ? migrarDiarioPorNumero(JSON.parse(antigo), datas) : {};
  } catch {
    return {};
  }
}

/**
 * O diário da viagem: primeiro no aparelho, depois no banco.
 *
 * Ela preenche no exterior, com internet ruim. Então cada tecla fica guardada
 * no aparelho na hora, e o envio para a nutricionista acontece por baixo:
 * quando ela para de digitar, quando a tela abre e quando a conexão volta. O
 * que não subiu fica marcado e sobe na próxima chance — nada se perde por
 * falta de sinal.
 *
 * `enviar` desligado (a nutricionista olhando a própria conta) mantém o
 * diário só no aparelho.
 */
export function useDiarioDeViagem(perfilId: string | null, enviar: boolean, datas: string[]) {
  const [valores, definirValores] = useState<DiarioLocal>(() => lerDoAparelho(perfilId, datas));
  const [estados, definirEstados] = useState<Record<string, EstadoDeEnvio>>({});
  // O envio lê daqui, e não do estado: ele roda depois de uma espera, e
  // precisa do que está na tela AGORA, não do que estava quando foi agendado.
  const atual = useRef(valores);
  const esperas = useRef(new Map<string, number>());

  const guardar = useCallback(
    (novo: DiarioLocal) => {
      atual.current = novo;
      definirValores(novo);
      try {
        window.localStorage.setItem(chave("v2", perfilId), JSON.stringify(novo));
      } catch {
        /* sem armazenamento, o diário vale enquanto a tela estiver aberta */
      }
    },
    [perfilId],
  );

  const enviarDia = useCallback(
    async (dia: string) => {
      const campos = camposDe(atual.current[dia]);
      const enviado = JSON.stringify(campos);
      definirEstados((e) => ({ ...e, [dia]: "salvando" }));
      try {
        await repositorio.anotarDiarioDeViagem(dia, campos);
        // Se ela continuou digitando enquanto subia, este envio já é velho:
        // o dia segue pendente e o próximo envio (já agendado) leva o resto.
        if (JSON.stringify(camposDe(atual.current[dia])) !== enviado) return;
        guardar({ ...atual.current, [dia]: { ...campos, pendente: false } });
        definirEstados((e) => ({ ...e, [dia]: "salvo" }));
      } catch {
        definirEstados((e) => ({ ...e, [dia]: "falhou" }));
      }
    },
    [guardar],
  );

  const enviarPendentes = useCallback(() => {
    for (const dia of diasPendentes(atual.current)) {
      if (!esperas.current.has(dia)) void enviarDia(dia);
    }
  }, [enviarDia]);

  // Ao abrir: traz o que já está no banco (outro aparelho, ou depois de limpar
  // o navegador) e sobe o que ficou para trás.
  useEffect(() => {
    if (!enviar) return;
    let ativo = true;
    repositorio
      .meuDiarioDeViagem()
      .then((servidor) => {
        if (!ativo) return;
        guardar(mesclarDiario(atual.current, servidor));
        enviarPendentes();
      })
      .catch(() => {
        /* sem conexão agora: o aparelho segue valendo, e o `online` tenta de novo */
      });
    window.addEventListener("online", enviarPendentes);
    const pendentesAoSair = esperas.current;
    return () => {
      ativo = false;
      window.removeEventListener("online", enviarPendentes);
      // Saiu da tela com envio agendado: manda já, em vez de perder a espera.
      for (const [dia, espera] of pendentesAoSair) {
        window.clearTimeout(espera);
        void repositorio.anotarDiarioDeViagem(dia, camposDe(atual.current[dia])).catch(() => {});
      }
      pendentesAoSair.clear();
    };
  }, [enviar, guardar, enviarPendentes]);

  const anotar = useCallback(
    (dia: string, campo: keyof CamposDoDiario, digitado: string) => {
      const valor = eCampoNumerico(campo) ? numeroNaFaixa(campo, digitado) : digitado;
      guardar({
        ...atual.current,
        [dia]: { ...CAMPOS_VAZIOS, ...camposDe(atual.current[dia]), [campo]: valor, pendente: true },
      });
      if (!enviar) return;
      const anterior = esperas.current.get(dia);
      if (anterior !== undefined) window.clearTimeout(anterior);
      esperas.current.set(
        dia,
        window.setTimeout(() => {
          esperas.current.delete(dia);
          void enviarDia(dia);
        }, ESPERA_MS),
      );
    },
    [enviar, guardar, enviarDia],
  );

  return { valores, estados, anotar };
}
