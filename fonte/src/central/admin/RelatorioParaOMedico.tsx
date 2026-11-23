import { useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { BotaoPdf } from "@/central/components/BotaoPdf";
import { DocumentoRelatorioMedico } from "@/central/components/DocumentosNovos";
import type { DadosDoRelatorio, RelatorioGuardado, SecaoDoRelatorio } from "@/central/types/relatorioMedico";
import { SECOES_DO_RELATORIO } from "@/central/types/relatorioMedico";
import { montarRelatorio } from "@/central/utils/relatorioMedico";
import { pontuacaoDoEnvio } from "@/central/utils/pontuacaoQuestionario";
import { hojeSaoPaulo, somarDias } from "@/central/utils/situacao";

/**
 * Relatório de evolução para o médico (lote 3, aprovado em 23/11/2026).
 *
 * Ela escolhe o período, para quem e o que entra, escreve o parecer e gera o
 * PDF na marca. Só entra o que foi registrado; nada é interpretado. Cada PDF
 * gerado fica guardado (cópia do que saiu), para baixar de novo igual.
 */
type Periodo = "30" | "90" | "datas";
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const diaSP = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

interface Fontes {
  fases: { fase: string; inicio: string }[];
  registros: { data: string; sintomas: string[]; bristol: number | null }[];
  itens: { nome: string; status: string }[];
  checkins: { titulo: string; envios: { data: string; nota: number | null }[] }[];
  avaliacoes: { data: string; peso: number | null; circunferencias: { nome: string; valor: string }[] }[];
  consultas: { data: string; status: string; resumo: string | null; observacoes: string | null }[];
}

export function RelatorioParaOMedico({ pacienteId, pacienteNome }: { pacienteId: string; pacienteNome: string }) {
  const { configuracoes } = useSessao();
  const hoje = hojeSaoPaulo();
  const [aberto, definirAberto] = useState(false);
  const [periodo, definirPeriodo] = useState<Periodo>("90");
  const [de, definirDe] = useState(somarDias(hoje, -90));
  const [ate, definirAte] = useState(hoje);
  const [medico, definirMedico] = useState("");
  const [secoes, definirSecoes] = useState<SecaoDoRelatorio[]>(SECOES_DO_RELATORIO.map((s) => s.chave));
  const [parecer, definirParecer] = useState("");
  const [fontes, definirFontes] = useState<Fontes | null>(null);
  const [falhou, definirFalhou] = useState(false);
  const [guardados, definirGuardados] = useState<RelatorioGuardado[]>([]);
  const [recado, definirRecado] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || fontes) return;
    let vivo = true;
    void (async () => {
      try {
        const [fases, reintro, quests, atrasos, avals, consultas, salvos] = await Promise.all([
          repositorio.fasesDoPaciente(pacienteId),
          repositorio.reintroducaoDoPaciente(pacienteId),
          repositorio.questionariosDoPaciente(pacienteId),
          repositorio.atrasosDoPaciente(pacienteId).catch(() => []),
          repositorio.avaliacoesDoPaciente(pacienteId),
          repositorio.consultasDe(pacienteId),
          repositorio.relatoriosMedicoDe(pacienteId).catch(() => []),
        ]);
        if (!vivo) return;
        const atrasada = new Set(atrasos.map((a) => `${a.questionarioId}|${a.periodo}`));
        definirFontes({
          fases: fases.map((f) => ({ fase: f.fase, inicio: f.inicio })),
          registros: reintro.registros.map((r) => ({ data: r.data, sintomas: r.sintomas, bristol: r.bristol })),
          itens: reintro.itens.map((i) => ({ nome: i.nome, status: i.status })),
          checkins: quests
            .filter((q) => q.periodicidade === "semanal")
            .map((q) => ({
              titulo: q.titulo,
              envios: q.envios.map((e) => ({
                data: diaSP(e.respondidoEm),
                nota: atrasada.has(`${q.id}|${e.periodo}`) ? null : pontuacaoDoEnvio(q.perguntas, e),
              })),
            })),
          avaliacoes: avals.map((a) => ({ data: a.data, peso: a.dados.peso, circunferencias: a.dados.circunferencias ?? [] })),
          consultas: consultas.map((c) => ({ data: c.data, status: c.status, resumo: c.resumo, observacoes: c.observacoes })),
        });
        definirGuardados(salvos);
      } catch {
        if (vivo) definirFalhou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, fontes, pacienteId]);

  function escolherPeriodo(p: Periodo) {
    definirPeriodo(p);
    if (p !== "datas") {
      definirDe(somarDias(hoje, -Number(p)));
      definirAte(hoje);
    }
  }

  const periodoValido = de <= ate;
  const dados: DadosDoRelatorio | null = useMemo(
    () =>
      fontes && periodoValido
        ? montarRelatorio({ paciente: pacienteNome, de, ate, medico, emitidoEm: hoje, secoes, parecer, ...fontes })
        : null,
    [fontes, periodoValido, pacienteNome, de, ate, medico, hoje, secoes, parecer],
  );
  const nutricionista = configuracoes.nomeNutricionista || "Isabela Marçal";
  // O documento só muda quando os dados mudam: se mudasse a cada desenho da
  // tela, o botão perderia o PDF pronto.
  const documento = useMemo(
    () => (dados ? <DocumentoRelatorioMedico dados={dados} nutricionista={nutricionista} /> : null),
    [dados, nutricionista],
  );

  async function guardarCopia() {
    if (!dados) return;
    try {
      const r = await repositorio.salvarRelatorioMedico(pacienteId, dados);
      definirGuardados((l) => [r, ...l]);
      definirRecado("PDF pronto. Uma cópia ficou guardada aqui embaixo.");
    } catch {
      definirRecado("O PDF saiu, mas não consegui guardar a cópia. Tente gerar de novo.");
    }
  }

  if (!aberto) {
    return (
      <section className="c-secao c-relmed">
        <h2 className="c-secao-titulo">Relatório para o médico</h2>
        <p className="c-dica">Junta o que foi registrado no período e o seu parecer num PDF com a sua marca.</p>
        <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={() => definirAberto(true)}>
          Montar relatório
        </button>
      </section>
    );
  }

  return (
    <section className="c-secao c-relmed">
      <h2 className="c-secao-titulo">Relatório para o médico</h2>
      {falhou && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui carregar os registros. Recarregue a página.
        </div>
      )}

      <p className="c-rotulo">Período</p>
      <div className="c-chips">
        {(
          [
            ["30", "30 dias"],
            ["90", "90 dias"],
            ["datas", "Escolher datas"],
          ] as [Periodo, string][]
        ).map(([v, r]) => (
          <button key={v} type="button" className="c-chip" aria-pressed={periodo === v} onClick={() => escolherPeriodo(v)}>
            {r}
          </button>
        ))}
      </div>
      {periodo === "datas" && (
        <div className="c-relmed-datas">
          <label className="c-campo">
            <span className="c-rotulo">De</span>
            <input className="c-input" type="date" value={de} max={ate} onChange={(e) => definirDe(e.target.value)} />
          </label>
          <label className="c-campo">
            <span className="c-rotulo">Até</span>
            <input className="c-input" type="date" value={ate} min={de} onChange={(e) => definirAte(e.target.value)} />
          </label>
        </div>
      )}
      {!periodoValido && <p className="c-aviso c-aviso-erro">A data final vem antes da inicial.</p>}

      <label className="c-campo">
        <span className="c-rotulo">Para quem (opcional)</span>
        <input className="c-input" value={medico} maxLength={120} placeholder="Nome do médico" onChange={(e) => definirMedico(e.target.value)} />
      </label>

      <p className="c-rotulo">O que entra</p>
      <div className="c-relmed-secoes">
        {SECOES_DO_RELATORIO.map((s) => (
          <label key={s.chave} className="c-px-exame">
            <input
              type="checkbox"
              checked={secoes.includes(s.chave)}
              onChange={() => definirSecoes((l) => (l.includes(s.chave) ? l.filter((x) => x !== s.chave) : [...l, s.chave]))}
            />
            <span>{s.rotulo}</span>
          </label>
        ))}
      </div>

      <label className="c-campo">
        <span className="c-rotulo">Seu parecer (sai no fim do PDF)</span>
        <textarea className="c-textarea" rows={4} value={parecer} onChange={(e) => definirParecer(e.target.value)} />
      </label>

      {recado && (
        <p className="c-dica" role="status">
          {recado}
        </p>
      )}
      <div className="c-acoes">
        <BotaoPdf
          titulo={`Relatório de evolução — ${pacienteNome}`}
          rotulo="Gerar PDF"
          desligado={!dados}
          documento={documento}
          aoGerar={() => void guardarCopia()}
        />
        <button type="button" className="c-link" onClick={() => definirAberto(false)}>
          Fechar
        </button>
      </div>

      {guardados.length > 0 && (
        <div className="c-relmed-guardados">
          <p className="c-rotulo">Relatórios já gerados</p>
          <ul>
            {guardados.map((g) => (
              <RelatorioGuardadoItem key={g.id} guardado={g} nutricionista={nutricionista} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Um relatório já gerado: baixa de novo a mesma cópia, igual ao que saiu. */
function RelatorioGuardadoItem({ guardado: g, nutricionista }: { guardado: RelatorioGuardado; nutricionista: string }) {
  const documento = useMemo(() => <DocumentoRelatorioMedico dados={g.dados} nutricionista={nutricionista} />, [g, nutricionista]);
  return (
    <li>
      <span>
        {dataBr(diaSP(g.criadoEm))} · período {dataBr(g.dados.de)} a {dataBr(g.dados.ate)}
        {g.dados.medico ? ` · ${g.dados.medico}` : ""}
      </span>
      <BotaoPdf
        titulo={`Relatório de evolução — ${g.dados.paciente}`}
        rotulo="Baixar de novo"
        classe="c-botao c-botao-secundario c-botao-pequeno"
        documento={documento}
      />
    </li>
  );
}
