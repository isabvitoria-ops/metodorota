import { textoDoPrazo } from "@/central/utils/prazoCheckin";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";

/**
 * O aviso de check-in em aberto, na primeira tela.
 *
 * O CARTÃO SOME QUANDO NÃO HÁ NADA EM ABERTO, e isso é a regra toda. Um
 * cartão permanente dizendo "check-in: respondido" seria mais uma coisa
 * ocupando a tela para não dizer nada; e um cartão que ficasse ali cobrando
 * a semana anterior seria uma cobrança na primeira coisa que ela vê ao abrir
 * o aplicativo.
 *
 * Ele também não mostra pontuação nem sequência ("você respondeu 5 semanas
 * seguidas!"). Contagem na tela de quem responde vira placar, e placar muda
 * a resposta da semana seguinte.
 */
export function CheckinPendente() {
  const navegar = useNavigate();
  const [pendentes, definirPendentes] = useState(0);
  const [vence, definirVence] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await repositorio.meusQuestionarios();
        const abertos = lista.filter((q) => q.pendente);
        if (vivo) definirPendentes(abertos.length);
        // O prazo mais próximo entre os pendentes (0099). Sem prazo, nada muda.
        const prazos = await repositorio.meusPrazos().catch(() => []);
        const datas = prazos
          .filter((p) => p.venceEm && abertos.some((q) => q.id === p.questionarioId))
          .map((p) => p.venceEm as string)
          .sort();
        if (vivo) definirVence(datas[0] ?? null);
      } catch {
        // Sem conexão, o cartão simplesmente não aparece. Um erro aqui não
        // pode estragar a primeira tela do aplicativo.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (pendentes === 0) return null;

  return (
    <button
      type="button"
      className="c-secao c-meta-clicavel"
      style={{ width: "100%", textAlign: "left" }}
      onClick={() => navegar(rotas.questionarios)}
    >
      <span className="c-lista-item-nome">
        {pendentes === 1 ? "Você tem um questionário para responder" : `Você tem ${pendentes} questionários para responder`}
      </span>
      <span className="c-lista-item-apoio">
        {textoDoPrazo(vence, hojeSaoPaulo())?.passou === false
          ? `${textoDoPrazo(vence, hojeSaoPaulo())!.texto} Leva poucos minutos.`
          : "Leva poucos minutos — toque para abrir."}
      </span>
    </button>
  );
}
