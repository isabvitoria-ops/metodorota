/**
 * O bloco "Hoje" no topo do Início (N30, aprovado em 23/11/2026).
 *
 * Junta, numa lista curta, o que a paciente tem para hoje: o check-in
 * pendente (com o prazo), a meta de hoje, a água, a próxima refeição do
 * plano e a próxima consulta. Só entra o que está ligado para ela e o que
 * tem dado; sem nada, o bloco não aparece. Cada linha leva para a tela.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { areaLigada } from "@/central/utils/areas";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { textoDoPrazo } from "@/central/utils/prazoCheckin";
import { metaEmDestaque, progressoNoPeriodo, resumoDoProgresso } from "@/central/utils/progressoMetas";
import { proximaRefeicao } from "@/central/utils/protocoloDaPaciente";
import { Icone, type NomeIcone } from "@/central/components/Icone";

interface Linha {
  chave: string;
  icone: NomeIcone;
  titulo: string;
  apoio: string;
  rota: string;
}

const minutosAgora = () => {
  const [h, m] = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).split(":");
  return Number(h) * 60 + Number(m);
};
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const somarDia = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** "hoje", "amanhã, 24/11" ou "05/12". */
const quandoFica = (iso: string, hoje: string) =>
  iso === hoje ? "hoje" : iso === somarDia(hoje) ? `amanhã, ${dataCurta(iso)}` : dataCurta(iso);

export function BlocoHoje() {
  const { acesso } = useSessao();
  const navegar = useNavigate();
  const [linhas, definirLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    let vivo = true;
    const hoje = hojeSaoPaulo();
    // Cada pedaço é independente: um que falha some sozinho, sem levar os outros.
    const pedacos: Promise<Linha | null>[] = [];

    if (areaLigada(acesso, "checkin"))
      pedacos.push(
        (async () => {
          const lista = await repositorio.meusQuestionarios();
          const abertos = lista.filter((q) => q.pendente);
          if (!abertos.length) return null;
          const prazos = await repositorio.meusPrazos().catch(() => []);
          const vence = prazos
            .filter((p) => p.venceEm && abertos.some((q) => q.id === p.questionarioId))
            .map((p) => p.venceEm as string)
            .sort()[0];
          const prazo = textoDoPrazo(vence ?? null, hoje);
          return {
            chave: "checkin",
            icone: "documentos",
            titulo: abertos.length === 1 ? "Check-in da semana" : `${abertos.length} questionários para responder`,
            apoio: prazo && !prazo.passou ? prazo.texto : "Leva poucos minutos.",
            rota: rotas.questionarios,
          };
        })(),
      );

    if (areaLigada(acesso, "metas"))
      pedacos.push(
        (async () => {
          const meta = metaEmDestaque(await repositorio.metasDe(), hoje);
          if (!meta) return null;
          const p = progressoNoPeriodo(meta, hoje);
          return {
            chave: "meta",
            icone: "feito",
            titulo: meta.frequencia === "semanal" ? "Meta da semana" : "Meta de hoje",
            apoio: `${meta.titulo} · ${resumoDoProgresso(p, meta.unidade)}`,
            rota: rotas.metas,
          };
        })(),
      );

    if (areaLigada(acesso, "hidratacao"))
      pedacos.push(
        (async () => {
          const h = await repositorio.minhaHidratacao();
          const total = h.hoje.reduce((s, r) => s + r.ml, 0);
          const litros = (ml: number) => `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
          return {
            chave: "agua",
            icone: "agua",
            titulo: "Água",
            apoio: h.metaMl ? `${litros(total)} de ${litros(h.metaMl)} hoje` : `${litros(total)} registrados hoje`,
            rota: rotas.hidratacao,
          };
        })(),
      );

    pedacos.push(
      (async () => {
        const protocolo = await repositorio.meuProtocolo();
        const refeicoes = protocolo?.conteudo.refeicoes ?? [];
        const i = proximaRefeicao(refeicoes, minutosAgora());
        if (i === null) return null;
        const r = refeicoes[i]!;
        return {
          chave: "refeicao",
          icone: "almoco",
          titulo: `Próxima refeição: ${r.nome.toLowerCase()}${r.horario ? `, ${r.horario}` : ""}`,
          apoio: "Ver no seu plano",
          rota: rotas.protocolo,
        };
      })(),
    );

    pedacos.push(
      (async () => {
        const r = await repositorio.oQueMudou();
        if (!r?.proximaConsulta) return null;
        return { chave: "consulta", icone: "relogio", titulo: "Próxima consulta", apoio: quandoFica(r.proximaConsulta, hoje), rota: rotas.home };
      })(),
    );

    void Promise.allSettled(pedacos).then((res) => {
      if (!vivo) return;
      definirLinhas(res.flatMap((x) => (x.status === "fulfilled" && x.value ? [x.value] : [])));
    });
    return () => {
      vivo = false;
    };
  }, [acesso]);

  if (!linhas.length) return null;

  return (
    <section className="c-hoje" aria-label="Hoje">
      <p className="c-hoje-rotulo">Hoje</p>
      {linhas.map((l) => (
        <button
          key={l.chave}
          type="button"
          className="c-hoje-linha"
          onClick={() => l.rota !== rotas.home && navegar(l.rota)}
          disabled={l.rota === rotas.home}
        >
          <span className="c-hoje-icone" aria-hidden="true">
            <Icone nome={l.icone} tamanho={18} />
          </span>
          <span className="c-hoje-texto">
            <strong>{l.titulo}</strong>
            <small>{l.apoio}</small>
          </span>
          {l.rota !== rotas.home && <Icone nome="seta" tamanho={16} />}
        </button>
      ))}
    </section>
  );
}
