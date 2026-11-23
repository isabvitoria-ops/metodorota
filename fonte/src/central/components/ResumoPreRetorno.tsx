import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import type { ResumoPreRetorno as Resumo } from "@/central/types/resumoPreRetorno";
import type { QuestionarioDoPaciente } from "@/central/types/questionario";
import { pontuacaoDoEnvio } from "@/central/utils/pontuacaoQuestionario";
import { rotuloSintoma, STATUS } from "@/central/utils/reintroducao";
import { bristolMaisFrequente, ddmm, lacunas, notaAntesEAgora } from "@/central/utils/resumoPreRetorno";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * Resumo pré-retorno (N28, aprovado em 23/11/2026, versão A em cartões).
 *
 * Abre na Agenda ao clicar numa consulta. Conta a partir da ÚLTIMA CONSULTA
 * CONCLUÍDA; sem ela não há marco, e o resumo diz isso em vez de inventar
 * um período. Só dados e contagens, cada um com o "abrir" de onde veio.
 * Nada aqui é escrito por IA nem diz se está bom ou ruim, e a paciente não vê.
 *
 * No computador é um painel à direita; no celular sobe de baixo (só CSS).
 */
export function ResumoPreRetorno({
  pacienteId,
  pacienteNome,
  consulta,
  aoFechar,
}: {
  pacienteId: string;
  pacienteNome: string;
  consulta: { data: string; hora: string | null; tipo: "primeira" | "retorno" };
  aoFechar: () => void;
}) {
  const [resumo, definirResumo] = useState<Resumo | null>(null);
  const [checkins, definirCheckins] = useState<QuestionarioDoPaciente[]>([]);
  const [atrasos, definirAtrasos] = useState<Set<string>>(new Set());
  const [falhou, definirFalhou] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    definirResumo(null);
    definirFalhou(false);
    repositorio
      .resumoPreRetorno(pacienteId)
      .then((r) => vivo && definirResumo(r))
      .catch(() => vivo && definirFalhou(true));
    // O check-in é um extra: se falhar, o cartão dele só não aparece.
    repositorio
      .questionariosDoPaciente(pacienteId)
      .then((qs) => vivo && definirCheckins(qs))
      .catch(() => vivo && definirCheckins([]));
    repositorio
      .atrasosDoPaciente(pacienteId)
      .then((a) => vivo && definirAtrasos(new Set(a.map((x) => `${x.questionarioId}|${x.periodo}`))))
      .catch(() => vivo && definirAtrasos(new Set()));
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      anterior?.focus?.();
    };
  }, [aoFechar]);

  const hoje = hojeSaoPaulo();
  const amanha = (() => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const quando = consulta.data === hoje ? "hoje" : consulta.data === amanha ? "amanhã" : `em ${ddmm(consulta.data)}`;
  const tipo = consulta.tipo === "primeira" ? "Primeira consulta" : "Retorno";
  const prontuario = (aba: string) => `${rotas.adminProntuario(pacienteId)}?aba=${aba}`;
  const rastreio = rotas.adminRastreabilidadeDe(pacienteId);

  return (
    <div className="c-rpr-veu" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="c-rpr" role="dialog" aria-modal="true" aria-label={`Resumo pré-retorno de ${pacienteNome}`} tabIndex={-1} ref={caixa}>
        <div className="c-rpr-pega" aria-hidden="true" />
        <div className="c-rpr-topo">
          <div>
            <p className="c-rpr-rotulo">Resumo pré-retorno</p>
            <h2 className="c-rpr-nome">{pacienteNome}</h2>
            <p className="c-rpr-sub">
              {tipo} {quando}
              {consulta.hora ? `, ${consulta.hora}` : ""}
              {resumo?.temMarco && resumo.desde
                ? ` · desde a última consulta concluída (${ddmm(resumo.desde)}), ${resumo.dias} ${resumo.dias === 1 ? "dia" : "dias"}`
                : ""}
            </p>
          </div>
          <button type="button" className="c-rpr-fechar" onClick={aoFechar}>
            Fechar
          </button>
        </div>

        {falhou ? (
          <p className="c-dica">Não consegui carregar o resumo agora. Tente de novo em instantes.</p>
        ) : !resumo ? (
          <p className="c-contagem">Carregando o resumo…</p>
        ) : !resumo.temMarco || !resumo.desde ? (
          <>
            <div className="c-rpr-cartao c-rpr-vazio">
              <strong>Ainda não há marco</strong>
              <p>
                O resumo conta a partir da última consulta concluída. Quando a primeira for concluída no
                prontuário, ele começa a aparecer aqui.
              </p>
            </div>
            <p className="c-rpr-nota">
              Registros que ela já fez estão na ficha: <Link to={prontuario("consulta")}>abrir a ficha</Link>.
            </p>
          </>
        ) : (
          <Cartoes resumo={resumo} desde={resumo.desde} hoje={hoje} checkins={checkins} atrasos={atrasos} prontuario={prontuario} rastreio={rastreio} />
        )}

        <p className="c-rpr-nota">Só dados e contagens. Nenhuma frase diz se está bom ou ruim.</p>
      </div>
    </div>
  );
}

function Cartoes({
  resumo,
  desde,
  hoje,
  checkins,
  atrasos,
  prontuario,
  rastreio,
}: {
  resumo: Resumo;
  desde: string;
  hoje: string;
  checkins: QuestionarioDoPaciente[];
  atrasos: Set<string>;
  prontuario: (aba: string) => string;
  rastreio: string;
}) {
  const bristol = bristolMaisFrequente(resumo.bristol);
  const sintomas = Object.entries(resumo.sintomas).sort((a, b) => b[1] - a[1]);
  const buracos = lacunas(resumo.diasComRegistro, desde, hoje);
  const notas = checkins
    .filter((q) => q.periodicidade === "semanal" && q.envios.length > 0)
    .map((q) => ({
      titulo: q.titulo,
      ...notaAntesEAgora(
        q.envios.map((e) => ({
          data: new Date(e.respondidoEm).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
          nota: atrasos.has(`${q.id}|${e.periodo}`) ? null : pontuacaoDoEnvio(q.perguntas, e),
        })),
        desde,
      ),
    }))
    .filter((n) => n.antes || n.agora);
  const vezes = (n: number) => `${n} ${n === 1 ? "registro" : "registros"}`;
  const rotuloStatus = (s: string) => STATUS.find((x) => x.chave === s)?.rotulo ?? s;

  return (
    <div className="c-rpr-cartoes">
      <div className="c-rpr-cartao c-rpr-gelo">
        <Rotulo texto="Combinado da última consulta" para={prontuario("consulta")} />
        <p>{resumo.combinado ?? "Sem anotação na consulta concluída."}</p>
      </div>

      <div className="c-rpr-grade">
        <div className="c-rpr-cartao">
          <Rotulo texto="Check-in" para={prontuario("checkin")} />
          {notas.length === 0 ? (
            <p className="c-rpr-pouco">Sem check-in com nota.</p>
          ) : (
            notas.map((n) => (
              <div key={n.titulo}>
                <strong className="c-rpr-num">
                  {n.antes?.nota ?? "—"} → {n.agora?.nota ?? "—"}
                </strong>
                <p className="c-rpr-pouco">
                  {n.antes ? `nota de ${ddmm(n.antes.data)}` : "sem nota antes"} e{" "}
                  {n.agora ? `de ${ddmm(n.agora.data)}` : "nenhuma depois"}
                  {notas.length > 1 ? ` · ${n.titulo}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="c-rpr-cartao">
          <Rotulo texto="Bristol" para={rastreio} />
          {bristol ? (
            <>
              <strong className="c-rpr-num">tipo {bristol.tipo}</strong>
              <p className="c-rpr-pouco">
                em {bristol.vezes} de {vezes(resumo.registrosComBristol)}
              </p>
            </>
          ) : (
            <p className="c-rpr-pouco">Nenhum registro com Bristol.</p>
          )}
        </div>
      </div>

      <div className="c-rpr-cartao">
        <Rotulo texto="Sintomas" para={rastreio} />
        <p>
          {sintomas.length
            ? sintomas.map(([s, n]) => `${rotuloSintoma(s)}: ${vezes(n)}`).join(" · ")
            : `Nenhum sintoma registrado desde ${ddmm(desde)}.`}
        </p>
      </div>

      <div className="c-rpr-cartao">
        <Rotulo texto="Reintrodução" para={rastreio} />
        {resumo.reintroducao.length ? (
          <ul className="c-rpr-lista">
            {resumo.reintroducao.map((r, i) => (
              <li key={`${r.nome}-${i}`}>
                {r.nome}: {rotuloStatus(r.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum alimento mudou de situação desde {ddmm(desde)}.</p>
        )}
      </div>

      <div className="c-rpr-cartao">
        <Rotulo texto="Restrições novas" para={prontuario("resumo")} />
        {resumo.restricoesNovas.length ? (
          <ul className="c-rpr-lista">
            {resumo.restricoesNovas.map((r, i) => (
              <li key={`${r.alimento}-${i}`}>{r.alimento}</li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma desde {ddmm(desde)}.</p>
        )}
      </div>

      <div className="c-rpr-cartao">
        <Rotulo texto="Metas" para={prontuario("resumo")} />
        {resumo.metas.length ? (
          <ul className="c-rpr-lista">
            {resumo.metas.map((m, i) => (
              <li key={`${m.titulo}-${i}`}>
                {m.titulo}:{" "}
                {m.frequencia === "diaria" && resumo.dias
                  ? `${m.diasMarcados} de ${resumo.dias} dias`
                  : `marcou em ${m.diasMarcados} ${m.diasMarcados === 1 ? "dia" : "dias"}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma meta ativa.</p>
        )}
      </div>

      <div className="c-rpr-cartao">
        <Rotulo texto="Dias sem registro" para={prontuario("historico")} />
        {buracos.length ? (
          <ul className="c-rpr-lista">
            {buracos.map((b) => (
              <li key={b.de}>
                {ddmm(b.de)} a {ddmm(b.ate)} ({b.dias} dias)
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum trecho de 3 dias ou mais sem registro.</p>
        )}
      </div>
    </div>
  );
}

function Rotulo({ texto, para }: { texto: string; para: string }) {
  return (
    <div className="c-rpr-cab">
      <span>{texto}</span>
      <Link to={para}>abrir</Link>
    </div>
  );
}
