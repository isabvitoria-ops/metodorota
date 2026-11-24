/**
 * O Panorama da ficha: o caso inteiro em blocos, antes da consulta.
 * Só para a nutricionista; nada aparece para a paciente.
 *
 * Só FATO, nunca leitura: conta, data e de onde veio. "3 fora da faixa"
 * vem da faixa de referência que ela mesma lançou no marcador; a adesão é a
 * mesma conta da lista de pacientes (`adesao()`); a sequência é a mesma que
 * a paciente vê (`sequencia()`). Peso e adesão saem da MESMA fonte do
 * cabeçalho da ficha, para os dois nunca mostrarem números diferentes. Nenhuma conduta, nenhum "melhorou/piorou".
 *
 * Cada linha diz a tela de origem, a data (quando há) e para onde leva.
 */
import type { Meta } from "@/central/types/meta";
import type { Reintroducao } from "@/central/types/reintroducao";
import type { RestricaoAlimentar } from "@/central/types/restricao";
import type { Exame, GrupoDeMarcadores } from "@/central/types/exame";
import type { CardioSessao, SessaoDeTreino } from "@/central/types/treino";
import { adesao, DIAS_DE_ADESAO } from "./panoramaPacientes";
import { sequencia } from "./progressoMetas";
import { STATUS, temSintoma } from "./reintroducao";

export interface LinhaDoCaso {
  texto: string;
  origem: string;
  /** ISO (aaaa-mm-dd). Nula quando a linha não tem um dia só. */
  data: string | null;
  /** Para onde a linha leva (rota do app). */
  link: string;
}

export interface BlocoDoCaso {
  titulo: string;
  linhas: LinhaDoCaso[];
}

export interface DadosDoCaso {
  pacienteId: string;
  hoje: string;
  /** Nulo quando a leitura falhou: o bloco diz isso em vez de "nada". */
  reintroducao: Reintroducao | null;
  restricoes: RestricaoAlimentar[] | null;
  marcadores: GrupoDeMarcadores[] | null;
  exames: Exame[] | null;
  /** Os mesmos números do cabeçalho da ficha (lista de pacientes). */
  peso: { atual: number | null; inicial: number | null; data: string | null };
  treinos: SessaoDeTreino[] | null;
  cardio: CardioSessao[] | null;
  metas: Meta[];
}

const TIPO: Record<RestricaoAlimentar["tipo"], string> = {
  alergia: "Alergia",
  intolerancia: "Intolerância",
  sensibilidade: "Sensibilidade",
  preferencia: "Preferência",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const kg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

function diasAntes(hoje: string, dias: number): string {
  const t = Date.parse(`${hoje.slice(0, 10)}T12:00:00Z`) - dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const maisRecente = (datas: (string | null | undefined)[]) =>
  datas.filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort().at(-1) ?? null;

const falhou = (origem: string, link: string): LinhaDoCaso => ({
  texto: "Não consegui ler agora",
  origem,
  data: null,
  link,
});

function intestino(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/rastreabilidade/${d.pacienteId}`;
  const origem = "Rastreabilidade";
  const r = d.reintroducao;
  if (!r) return { titulo: "Intestino", linhas: [falhou(origem, link)] };
  const linhas: LinhaDoCaso[] = [];
  linhas.push(
    r.ativo
      ? { texto: `Rastreio ligado · semana ${r.semanaAtual}`, origem, data: r.inicio, link }
      : { texto: "Rastreio desligado", origem, data: null, link },
  );
  if (r.registros.length > 0) {
    const comSintoma = r.registros.filter(temSintoma).length;
    linhas.push({
      texto: `${plural(r.registros.length, "registro", "registros")}, ${comSintoma} com sintoma`,
      origem,
      data: maisRecente(r.registros.map((x) => x.data)),
      link,
    });
  } else if (r.ativo) {
    linhas.push({ texto: "Nenhum registro ainda", origem, data: null, link });
  }
  const contagem = STATUS.filter((s) => s.chave !== "nao_iniciado" && s.chave !== "nao_relevante")
    .map((s) => ({ s, n: r.itens.filter((i) => i.status === s.chave).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.s.rotulo}: ${x.n}`);
  if (contagem.length) linhas.push({ texto: contagem.join(" · "), origem, data: null, link });
  return { titulo: "Intestino", linhas };
}

function restricoes(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/paciente/${d.pacienteId}?aba=resumo#restricoes`;
  const origem = "Restrições";
  if (!d.restricoes) return { titulo: "Restrições", linhas: [falhou(origem, link)] };
  if (d.restricoes.length === 0) {
    return { titulo: "Restrições", linhas: [{ texto: "Nenhuma cadastrada", origem, data: null, link }] };
  }
  const ordem: RestricaoAlimentar["tipo"][] = ["alergia", "intolerancia", "sensibilidade", "preferencia"];
  const linhas = [...d.restricoes]
    .sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo) || a.alimento.localeCompare(b.alimento, "pt-BR"))
    .map((x) => ({
      texto:
        `${TIPO[x.tipo]}: ${x.alimento} (${x.gravidade})` +
        ((x.alimentoIds?.length ?? 0) === 0 ? " · sem alimento ligado, não muda as trocas" : ""),
      origem: x.origem === "rastreio" ? "Restrições, veio do rastreio" : origem,
      data: (x.atualizadoEm || x.criadoEm || "").slice(0, 10) || null,
      link,
    }));
  return { titulo: "Restrições", linhas };
}

function exames(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/paciente/${d.pacienteId}?aba=exames`;
  const origem = "Exames";
  const linhas: LinhaDoCaso[] = [];
  if (!d.marcadores || !d.exames) return { titulo: "Exames", linhas: [falhou(origem, link)] };
  const ultimo = [...d.marcadores].sort((a, b) => b.data.localeCompare(a.data))[0];
  if (ultimo) {
    const fora = ultimo.marcadores.filter(
      (m) => (m.refMin !== null && m.valor < m.refMin) || (m.refMax !== null && m.valor > m.refMax),
    );
    linhas.push({
      texto:
        `${plural(ultimo.marcadores.length, "marcador lançado", "marcadores lançados")}` +
        (fora.length ? ` · fora da faixa informada: ${fora.map((m) => m.nome).join(", ")}` : ""),
      origem,
      data: ultimo.data,
      link,
    });
  }
  if (d.exames.length) {
    const recente = [...d.exames].sort((a, b) => (b.data ?? b.criadoEm).localeCompare(a.data ?? a.criadoEm))[0]!;
    linhas.push({
      texto: `${plural(d.exames.length, "arquivo", "arquivos")} · o mais recente: ${recente.nome}`,
      origem,
      data: (recente.data ?? recente.criadoEm).slice(0, 10),
      link,
    });
  }
  if (!linhas.length) linhas.push({ texto: "Nenhum exame guardado", origem, data: null, link });
  return { titulo: "Exames", linhas };
}

function corpo(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/paciente/${d.pacienteId}?aba=historico`;
  const origem = "Avaliação";
  const { atual, inicial, data } = d.peso;
  if (atual === null) return { titulo: "Corpo", linhas: [{ texto: "Nenhuma avaliação com peso", origem, data: null, link }] };
  let texto = kg(atual);
  if (inicial !== null) {
    const dif = Math.round((atual - inicial) * 10) / 10;
    if (dif !== 0) texto += ` · ${dif < 0 ? "−" : "+"}${kg(Math.abs(dif))} desde a 1ª avaliação`;
  }
  return { titulo: "Corpo", linhas: [{ texto, origem, data, link }] };
}

function treino(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/treinos/${d.pacienteId}`;
  const origem = "Treino";
  if (!d.treinos || !d.cardio) return { titulo: "Treino", linhas: [falhou(origem, link)] };
  const desde = diasAntes(d.hoje, DIAS_DE_ADESAO);
  const linhas: LinhaDoCaso[] = [];
  // Dentro da janela e até hoje: data futura (lançada adiantada) não conta.
  const naJanela = (data: string) => data.slice(0, 10) > desde && data.slice(0, 10) <= d.hoje;
  const nT = d.treinos.filter((t) => naJanela(t.data)).length;
  const nC = d.cardio.filter((c) => naJanela(c.data)).length;
  if (d.treinos.length) {
    linhas.push({
      texto: `${plural(nT, "treino", "treinos")} nos últimos ${DIAS_DE_ADESAO} dias`,
      origem,
      data: maisRecente(d.treinos.map((t) => t.data).filter((x) => x.slice(0, 10) <= d.hoje)),
      link,
    });
  }
  if (d.cardio.length) {
    linhas.push({
      texto: `${plural(nC, "cardio", "cardios")} nos últimos ${DIAS_DE_ADESAO} dias`,
      origem: "Cardio",
      data: maisRecente(d.cardio.map((c) => c.data).filter((x) => x.slice(0, 10) <= d.hoje)),
      link,
    });
  }
  if (!linhas.length) linhas.push({ texto: "Nenhum treino registrado", origem, data: null, link });
  return { titulo: "Treino", linhas };
}

function adesaoBloco(d: DadosDoCaso): BlocoDoCaso {
  const link = `/admin/metas/${d.pacienteId}`;
  const origem = "Metas";
  const ativas = d.metas.filter((m) => m.status === "ativa");
  if (!ativas.length) return { titulo: "Adesão", linhas: [{ texto: "Nenhuma meta ativa", origem, data: null, link }] };
  const linhas: LinhaDoCaso[] = [];
  const pct = adesao(d.metas, d.hoje);
  linhas.push({
    texto: pct === null ? "Metas começaram agora: ainda sem período para contar" : `${pct}% nas metas, últimos ${DIAS_DE_ADESAO} dias`,
    origem,
    data: null,
    link,
  });
  for (const m of ativas) {
    const n = sequencia(m, d.hoje);
    linhas.push({
      texto: `${m.titulo}: ${n} ${m.frequencia === "semanal" ? (n === 1 ? "semana seguida" : "semanas seguidas") : n === 1 ? "dia seguido" : "dias seguidos"}`,
      origem,
      data: maisRecente(m.registros.map((r) => r.data)),
      link,
    });
  }
  return { titulo: "Adesão", linhas };
}

/** Os seis blocos, na ordem combinada: Intestino, Restrições, Exames, Corpo, Treino, Adesão. */
export function panoramaDoCaso(d: DadosDoCaso): BlocoDoCaso[] {
  return [intestino(d), restricoes(d), exames(d), corpo(d), treino(d), adesaoBloco(d)];
}
