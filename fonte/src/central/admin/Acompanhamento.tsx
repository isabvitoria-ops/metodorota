import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PanoramaDoPaciente, StatusDoPaciente } from "@/central/types/panorama";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import {
  adesao,
  emOrdemDeAtencao,
  iniciais,
  statusDoPaciente,
  textoDoStatus,
  variacaoDePeso,
} from "@/central/utils/panoramaPacientes";

/**
 * "Minhas pacientes" — a lista de acompanhamento.
 *
 * A ORDEM É A DA URGÊNCIA, não a alfabética: quem tem retorno hoje vem
 * primeiro. Em ordem de nome, a paciente que ela atende daqui a duas horas
 * ficaria na letra dela, no meio de doze.
 *
 * NENHUMA ETIQUETA É INVENTADA. Só existe status que sai de dado real —
 * consulta marcada, registro feito, acesso vencido. "Check-in pendente" e
 * "pagamento atrasado" estão na lista dela e ainda não têm de onde sair;
 * colocá-los agora faria a tela mentir com confiança.
 *
 * E O QUE NÃO SE SABE APARECE COMO TRAVESSÃO, nunca como zero. Uma adesão
 * de "0%" numa paciente sem meta diria que ela não fez nada; o travessão diz
 * que não há como saber, que é a verdade.
 */
const ROTULO: Record<StatusDoPaciente, string> = {
  retorno_hoje: "c-selo-hoje",
  retorno_proximo: "c-selo-proximo",
  sem_registro: "c-selo-parada",
  sem_acesso: "c-selo-sem-acesso",
  em_dia: "c-selo-em-dia",
};

export function Acompanhamento() {
  const navegar = useNavigate();
  const [pacientes, definirPacientes] = useState<PanoramaDoPaciente[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [busca, definirBusca] = useState("");
  const [filtro, definirFiltro] = useState<StatusDoPaciente | "todas">("todas");

  const hoje = hojeSaoPaulo();

  const carregar = useCallback(async () => {
    try {
      definirPacientes(await repositorio.panoramaDosPacientes());
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar as pacientes.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ordenadas = useMemo(() => emOrdemDeAtencao(pacientes, hoje), [pacientes, hoje]);

  const visiveis = ordenadas.filter((p) => {
    const casaBusca = busca.trim()
      ? p.nome.toLowerCase().includes(busca.trim().toLowerCase())
      : true;
    const casaFiltro = filtro === "todas" || statusDoPaciente(p, hoje) === filtro;
    return casaBusca && casaFiltro;
  });

  const retornosHoje = ordenadas.filter((p) => statusDoPaciente(p, hoje) === "retorno_hoje").length;
  const ativas = ordenadas.filter((p) => p.situacao === "ativo").length;

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          Minhas pacientes
        </h1>
        <p className="c-subtitulo">
          {ativas} {ativas === 1 ? "ativa" : "ativas"}
          {retornosHoje > 0 &&
            ` · ${retornosHoje} ${retornosHoje === 1 ? "retorno hoje" : "retornos hoje"}`}
        </p>
      </div>

      <div className="c-barra-acoes">
        <input
          className="c-input"
          type="search"
          placeholder="Buscar por nome"
          value={busca}
          onChange={(e) => definirBusca(e.target.value)}
        />
      </div>

      <div className="c-chips" style={{ marginTop: 12 }}>
        {(
          [
            ["todas", "Todas"],
            ["retorno_hoje", "Retorno hoje"],
            ["retorno_proximo", "Retorno próximo"],
            ["sem_registro", "Sem registro"],
            ["sem_acesso", "Sem acesso"],
            ["em_dia", "Em dia"],
          ] as [StatusDoPaciente | "todas", string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            className="c-chip"
            aria-pressed={filtro === valor}
            onClick={() => definirFiltro(valor)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="c-dica" style={{ marginTop: 14 }}>
          Carregando…
        </p>
      ) : visiveis.length === 0 ? (
        <div className="c-bloco" style={{ marginTop: 14 }}>
          <p className="c-item-protocolo-nome">
            {pacientes.length === 0 ? "Nenhuma paciente cadastrada" : "Nada com esse filtro"}
          </p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            {pacientes.length === 0
              ? "Cadastre a primeira em Pacientes."
              : "Tente outro filtro, ou limpe a busca."}
          </p>
        </div>
      ) : (
        <div className="c-lista-pacientes">
          {visiveis.map((p) => (
            <Linha
              key={p.id}
              paciente={p}
              hoje={hoje}
              aoAbrir={() => navegar(rotas.adminProntuario(p.id))}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Linha({
  paciente,
  hoje,
  aoAbrir,
}: {
  paciente: PanoramaDoPaciente;
  hoje: string;
  aoAbrir: () => void;
}) {
  const status = statusDoPaciente(paciente, hoje);
  const ade = adesao(paciente.metas, hoje);
  const peso = variacaoDePeso(paciente);

  return (
    <button type="button" className="c-paciente-linha" onClick={aoAbrir}>
      <span className="c-paciente-avatar" aria-hidden="true">
        {iniciais(paciente.nome)}
      </span>

      <span className="c-paciente-meio">
        <span className="c-paciente-topo">
          <span className="c-paciente-nome">{paciente.nome}</span>
          {/* "em dia" não ganha etiqueta: a lista ficaria com uma marca em
              cada linha e a marca deixaria de chamar atenção. */}
          {status !== "em_dia" && (
            <span className={`c-selo-status ${ROTULO[status]}`}>
              {textoDoStatus(status, paciente)}
            </span>
          )}
        </span>

        <span className="c-paciente-apoio">{resumo(paciente, peso)}</span>
      </span>

      <span className="c-paciente-adesao">
        {/* Travessão, não "0%": sem meta ativa não há como medir adesão, e
            zero por cento seria uma acusação inventada. */}
        <strong>{ade === null ? "—" : `${ade}%`}</strong>
        <span>adesão</span>
      </span>
    </button>
  );
}

/** A linha de apoio: o que mudou desde a última vez, em poucas palavras. */
function resumo(p: PanoramaDoPaciente, peso: number | null): string {
  const partes: string[] = [];

  if (p.ultimaConsulta?.resumo) {
    partes.push(p.ultimaConsulta.resumo);
  } else if (p.ultimaConsulta) {
    partes.push(`última consulta em ${dia(p.ultimaConsulta.data)}`);
  }

  if (peso !== null && peso !== 0) {
    // O sinal é explícito: "−4,2 kg" e "+1,1 kg" se leem sem pensar, e a
    // tela não diz se um é bom e o outro é ruim.
    const sinal = peso < 0 ? "−" : "+";
    partes.push(`${sinal}${Math.abs(peso).toLocaleString("pt-BR")} kg desde o início`);
  }

  if (p.metas.length > 0) {
    partes.push(`${p.metas.length} ${p.metas.length === 1 ? "meta ativa" : "metas ativas"}`);
  }

  return partes.length > 0 ? partes.join(" · ") : "Sem histórico ainda";
}

function dia(iso: string): string {
  return iso.split("-").reverse().slice(0, 2).join("/");
}
