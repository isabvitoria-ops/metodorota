import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { NovoPaciente, Paciente, Plano } from "@/central/types";
import type { PanoramaDoPaciente, StatusDoPaciente } from "@/central/types/panorama";
import { repositorio } from "@/central/dados/repositorio";
import {
  adesao,
  emOrdemDeAtencao,
  iniciais,
  statusDoPaciente,
  textoDoStatus,
  variacaoDePeso,
} from "@/central/utils/panoramaPacientes";
import { usePacientes } from "@/central/hooks/usePacientes";
import { BarraBusca } from "@/central/components/BarraBusca";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { SeloSituacao } from "@/central/components/Selo";
import { normalizar } from "@/central/utils/texto";
import { dataBonita, hojeSaoPaulo, somarDias } from "@/central/utils/situacao";
import { rotas } from "@/central/rotas";
import { Modal } from "./componentes/Modal";
import { AreaTexto, Campo, Selecao, Texto } from "./componentes/Campos";
import { FichaPaciente } from "./FichaPaciente";

/**
 * Pacientes — a tela única.
 *
 * ERAM TRÊS ABAS, e ela perguntou por que. Não havia boa resposta:
 *
 *   * "Painel" contava quantas ativas e listava quem ia vencer;
 *   * "Acompanhamento" listava as mesmas pessoas com dado clínico;
 *   * "Pacientes" listava as mesmas pessoas de novo, com plano e validade.
 *
 * Três listas das MESMAS pessoas, e ela tinha que lembrar em qual delas
 * estava a coluna que queria. Pior: havia duas telas de detalhe com
 * endereços quase iguais (`/pacientes/:id` e `/paciente/:id`), uma
 * administrativa e uma clínica.
 *
 * Agora é uma lista só. Cada linha traz o que importa dos três lados —
 * urgência clínica, adesão e situação do acesso — e abre o prontuário, que
 * é onde tudo sobre a pessoa já mora. O cadastro (plano, datas, convite)
 * continua existindo como ficha, alcançada de dentro do prontuário.
 *
 * A ORDEM É A DA URGÊNCIA, não a alfabética: quem tem retorno hoje vem
 * primeiro. Em ordem de nome, a paciente que ela atende daqui a duas horas
 * ficaria na letra dela, no meio de doze.
 */
const ROTULO_STATUS: Record<StatusDoPaciente, string> = {
  retorno_hoje: "c-selo-hoje",
  retorno_proximo: "c-selo-proximo",
  sem_registro: "c-selo-parada",
  sem_acesso: "c-selo-sem-acesso",
  em_dia: "c-selo-em-dia",
};

/**
 * Os filtros: os clínicos e os administrativos na MESMA fileira.
 *
 * Separá-los em dois grupos devolveria o problema que esta tela resolveu —
 * ela teria que lembrar em qual grupo estava o que procura. O que ela
 * filtra é uma pergunta só: "quem eu preciso olhar agora".
 */
const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  // Clínicos primeiro: é o que ela olha todo dia.
  { valor: "retorno_hoje", rotulo: "Retorno hoje" },
  { valor: "retorno_proximo", rotulo: "Retorno próximo" },
  { valor: "sem_registro", rotulo: "Sem registro" },
  // Os administrativos (vencendo, expirados, convite pendente) são os
  // próprios números lá em cima, que filtram ao toque. Repeti-los aqui
  // dava duas fileiras de botões fazendo a mesma coisa.
  { valor: "suspenso", rotulo: "Suspensos" },
];

const CLINICOS = new Set(["retorno_hoje", "retorno_proximo", "sem_registro"]);

export function Pacientes() {
  const { pacienteId } = useParams();
  const navegar = useNavigate();
  const { pacientes, planos, carregando, erro, carregar } = usePacientes();
  const [consulta, definirConsulta] = useState("");
  const [filtro, definirFiltro] = useState("todos");
  const [criando, definirCriando] = useState(false);
  // O lado clínico da mesma lista. As duas vêm de funções diferentes do
  // banco -- uma sabe de plano e convite, a outra de consulta e adesão --
  // e são casadas pelo id aqui, para a linha mostrar os dois lados.
  const [panorama, definirPanorama] = useState<PanoramaDoPaciente[]>([]);

  const hoje = hojeSaoPaulo();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const p = await repositorio.panoramaDosPacientes();
        if (vivo) definirPanorama(p);
      } catch {
        // Sem o panorama a lista ainda funciona, só sem o dado clínico. Um
        // erro aqui não pode esconder as pacientes.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const contagens = useMemo(() => {
    const por = (situacao: string) => pacientes.filter((p) => p.situacao === situacao).length;
    return {
      ativos: por("ativo") + por("proximo_do_vencimento"),
      vencendo: por("proximo_do_vencimento"),
      expirados: por("expirado"),
      convites: por("convite_pendente"),
      total: pacientes.length,
    };
  }, [pacientes]);

  const porId = useMemo(() => new Map(panorama.map((p) => [p.id, p])), [panorama]);

  const retornosHoje = useMemo(
    () => panorama.filter((p) => statusDoPaciente(p, hoje) === "retorno_hoje").length,
    [panorama, hoje],
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(consulta);
    // A ordem de urgência vem do panorama; quem não está nele (cadastro
    // novo, ainda sem dado clínico) entra depois, em ordem de nome.
    const urgencia = emOrdemDeAtencao(panorama, hoje).map((p) => p.id);
    const posicao = (id: string) => {
      const i = urgencia.indexOf(id);
      return i === -1 ? urgencia.length : i;
    };

    return pacientes
      .filter((p) => {
        const clinico = porId.get(p.id);
        const combinaFiltro =
          filtro === "todos" ||
          (CLINICOS.has(filtro)
            ? clinico !== undefined && statusDoPaciente(clinico, hoje) === filtro
            : p.situacao === filtro);
        if (!combinaFiltro) return false;
        if (!termo) return true;
        return normalizar(p.nome).includes(termo) || normalizar(p.email).includes(termo);
      })
      .sort((a, b) => posicao(a.id) - posicao(b.id) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [pacientes, consulta, filtro, panorama, porId, hoje]);

  const aberto = pacienteId ? pacientes.find((p) => p.id === pacienteId) : undefined;

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Pacientes
      </h1>
      <p className="c-subtitulo">
        {contagens.total === 0
          ? "Nenhuma paciente cadastrada ainda."
          : `${contagens.total} ${contagens.total === 1 ? "paciente" : "pacientes"} no total` +
            (retornosHoje > 0
              ? ` · ${retornosHoje} ${retornosHoje === 1 ? "retorno" : "retornos"} hoje`
              : "") +
            "."}
      </p>

      {/* Os números do antigo Painel. São botões: tocar em "Vencendo" filtra
          a lista abaixo por quem está vencendo -- o número deixa de ser só
          informação e vira o atalho para agir sobre ela. */}
      {contagens.total > 0 && (
        <div className="c-cartoes c-cartoes-compactos" style={{ marginTop: 18 }}>
          <Metrica
            rotulo="Com acesso"
            valor={contagens.ativos}
            ativo={filtro === "todos"}
            aoTocar={() => definirFiltro("todos")}
          />
          <Metrica
            rotulo="Vencendo"
            valor={contagens.vencendo}
            ativo={filtro === "proximo_do_vencimento"}
            aoTocar={() => definirFiltro("proximo_do_vencimento")}
          />
          <Metrica
            rotulo="Expirados"
            valor={contagens.expirados}
            ativo={filtro === "expirado"}
            aoTocar={() => definirFiltro("expirado")}
          />
          <Metrica
            rotulo="Convites pendentes"
            valor={contagens.convites}
            ativo={filtro === "convite_pendente"}
            aoTocar={() => definirFiltro("convite_pendente")}
          />
        </div>
      )}

      <div className="c-barra-acoes" style={{ marginTop: 18 }}>
        <BarraBusca
          valor={consulta}
          aoMudar={definirConsulta}
          placeholder="Buscar por nome ou e-mail"
          rotulo="Buscar paciente"
        />
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirCriando(true)}>
          Adicionar paciente
        </button>
      </div>

      <div className="c-chips" style={{ marginTop: 12 }}>
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className="c-chip"
            aria-pressed={filtro === f.valor}
            onClick={() => definirFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando && pacientes.length === 0 && <p className="c-contagem">Carregando…</p>}

      {!carregando && pacientes.length === 0 && (
        <EstadoVazio
          icone="salvos"
          titulo="Nenhum paciente ainda"
          descricao="Cadastre a primeira pessoa, escolha o plano e o período, e envie o convite por e-mail."
        />
      )}

      {visiveis.length > 0 && (
        <div className="c-lista-pacientes">
          {visiveis.map((paciente) => (
            <LinhaPaciente
              key={paciente.id}
              paciente={paciente}
              clinico={porId.get(paciente.id)}
              hoje={hoje}
              aoAbrir={() => navegar(rotas.adminProntuario(paciente.id))}
              aoEditar={() => navegar(rotas.adminPaciente(paciente.id))}
            />
          ))}
        </div>
      )}

      {pacientes.length > 0 && visiveis.length === 0 && (
        <p className="c-contagem">Nenhuma paciente nesse filtro.</p>
      )}

      {criando && (
        <ModalNovoPaciente planos={planos} aoFechar={() => definirCriando(false)} />
      )}

      {aberto && (
        // Mesma armadilha da Rastreabilidade: trocar de paciente com a ficha
        // aberta (pelo endereço ou pelo voltar do navegador) não remontava,
        // e os campos de "Editar" continuariam com o nome e o e-mail da
        // paciente anterior. Salvar ali gravaria os dados de uma na outra.
        <FichaPaciente
          key={aberto.id}
          paciente={aberto}
          planos={planos}
          aoFechar={() => navegar(rotas.adminPacientes)}
        />
      )}
    </>
  );
}

function Metrica({
  rotulo,
  valor,
  ativo,
  aoTocar,
}: {
  rotulo: string;
  valor: number;
  ativo: boolean;
  aoTocar: () => void;
}) {
  return (
    <button type="button" className="c-metrica c-metrica-botao" aria-pressed={ativo} onClick={aoTocar}>
      <span className="c-metrica-rotulo">{rotulo}</span>
      <span className="c-metrica-valor">{valor}</span>
    </button>
  );
}

/**
 * Uma linha com os dois lados da mesma pessoa.
 *
 * O toque na linha abre o PRONTUÁRIO -- é onde ela passa o dia. O cadastro
 * (plano, validade, convite) tem o seu botão pequeno à direita, porque é
 * o que ela mexe uma vez por mês.
 */
function LinhaPaciente({
  paciente,
  clinico,
  hoje,
  aoAbrir,
  aoEditar,
}: {
  paciente: Paciente;
  clinico: PanoramaDoPaciente | undefined;
  hoje: string;
  aoAbrir: () => void;
  aoEditar: () => void;
}) {
  const status = clinico ? statusDoPaciente(clinico, hoje) : null;
  const ade = clinico ? adesao(clinico.metas, hoje) : null;
  // "Ativo" não ganha selo administrativo: é o normal, e uma marca em cada
  // linha deixaria de chamar atenção. Só aparece o que pede ação.
  const mostrarSituacao = paciente.situacao !== "ativo";

  return (
    <div className="c-paciente-item">
      <button type="button" className="c-paciente-linha" onClick={aoAbrir}>
        <span className="c-paciente-avatar" aria-hidden="true">
          {iniciais(paciente.nome)}
        </span>

        <span className="c-paciente-meio">
          <span className="c-paciente-topo">
            <span className="c-paciente-nome">{paciente.nome}</span>
            {clinico && status && status !== "em_dia" && status !== "sem_acesso" && (
              <span className={`c-selo-status ${ROTULO_STATUS[status]}`}>
                {textoDoStatus(status, clinico)}
              </span>
            )}
            {mostrarSituacao && <SeloSituacao situacao={paciente.situacao} />}
          </span>

          <span className="c-paciente-apoio">
            {clinico ? resumo(clinico) : (paciente.condicao ?? "condição não informada")}
          </span>
          <span className="c-paciente-apoio c-paciente-apoio-fraco">
            {paciente.planoNome ?? "Sem plano"} · até {dataBonita(paciente.dataFim)}
          </span>
        </span>

        <span className="c-paciente-adesao">
          {/* Travessão, não "0%": sem meta ativa não há como medir adesão, e
              zero por cento seria uma acusação inventada. */}
          <strong>{ade === null ? "—" : `${ade}%`}</strong>
          <span>adesão</span>
        </span>
      </button>
      <button type="button" className="c-link c-paciente-cadastro" onClick={aoEditar}>
        Cadastro
      </button>
    </div>
  );
}

/** A linha de apoio: o que mudou desde a última vez, em poucas palavras. */
function resumo(p: PanoramaDoPaciente): string {
  const partes: string[] = [];

  // A condição vem primeiro: é o que ela usa para se situar antes de ler o
  // resto. Vazio APARECE, em vez de sumir.
  partes.push(p.condicao ?? "condição não informada");

  if (p.ultimaConsulta?.resumo) {
    partes.push(p.ultimaConsulta.resumo);
  } else if (p.ultimaConsulta) {
    partes.push(`última consulta em ${p.ultimaConsulta.data.split("-").reverse().slice(0, 2).join("/")}`);
  }

  const peso = variacaoDePeso(p);
  if (peso !== null && peso !== 0) {
    const sinal = peso < 0 ? "−" : "+";
    partes.push(`${sinal}${Math.abs(peso).toLocaleString("pt-BR")} kg desde o início`);
  }

  if (p.metas.length > 0) {
    partes.push(`${p.metas.length} ${p.metas.length === 1 ? "meta ativa" : "metas ativas"}`);
  }

  return partes.join(" · ");
}

/**
 * As condições que ela atende, com "Outra" no fim.
 *
 * Lista curta e editável aqui no código de propósito: para AGRUPAR depois,
 * os valores precisam ser os mesmos — "SII", "sii" e "Síndrome do Intestino
 * Irritável" digitados à mão viram três grupos de uma coisa só. E "Outra"
 * existe para nunca travar um cadastro por falta de opção.
 */
const CONDICOES = [
  "SII",
  "SIBO",
  "Doença de Crohn",
  "Retocolite ulcerativa",
  "Sintomas gastrointestinais",
  "Emagrecimento",
  "Ganho de massa",
  "Acompanhamento geral",
];

function ModalNovoPaciente({ planos, aoFechar }: { planos: Plano[]; aoFechar: () => void }) {
  const { criar, convidar } = usePacientes();
  const [nome, definirNome] = useState("");
  const [email, definirEmail] = useState("");
  const [telefone, definirTelefone] = useState("");
  const [planoId, definirPlanoId] = useState(planos[0]?.id ?? "");
  const [dataInicio, definirDataInicio] = useState(hojeSaoPaulo());
  const [dataFim, definirDataFim] = useState(somarDias(hojeSaoPaulo(), planos[0]?.duracaoDias ?? 30));
  const [observacoes, definirObservacoes] = useState("");
  const [condicao, definirCondicao] = useState("");
  const [outraCondicao, definirOutraCondicao] = useState("");
  const [enviarConvite, definirEnviarConvite] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  /** Trocar o plano reposiciona a data de fim; ela continua editável na mão. */
  function escolherPlano(id: string) {
    definirPlanoId(id);
    const plano = planos.find((p) => p.id === id);
    if (plano) definirDataFim(somarDias(dataInicio, plano.duracaoDias));
  }

  function escolherInicio(data: string) {
    definirDataInicio(data);
    const plano = planos.find((p) => p.id === planoId);
    if (plano) definirDataFim(somarDias(data, plano.duracaoDias));
  }

  async function salvar() {
    definirErro(null);
    if (!nome.trim()) return definirErro("Escreva o nome do paciente.");
    if (!email.includes("@")) return definirErro("Escreva um e-mail válido.");
    if (dataFim < dataInicio) return definirErro("A data de fim não pode ser antes da de início.");
    // OBRIGATÓRIO, e é o ponto do campo: opcional, ninguém preenche, e o dia
    // em que ela quiser agrupar as pacientes vai encontrar tudo em branco.
    const condicaoFinal = condicao === "Outra" ? outraCondicao.trim() : condicao;
    if (!condicaoFinal) return definirErro("Escolha a condição principal.");

    definirSalvando(true);
    const dados: NovoPaciente = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim() || null,
      planoId: planoId || null,
      dataInicio,
      dataFim,
      observacoes: observacoes.trim() || null,
      condicao: condicaoFinal,
    };
    const paciente = await criar(dados);
    if (!paciente) {
      definirErro(usePacientes.getState().erro ?? "Não foi possível cadastrar.");
      definirSalvando(false);
      return;
    }
    if (enviarConvite) await convidar(paciente.id, dados.email);
    definirSalvando(false);
    aoFechar();
  }

  return (
    <Modal titulo="Adicionar paciente" aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Nome completo" />
      </Campo>
      <Campo rotulo="E-mail" dica="É por ele que o convite chega e que o acesso é reconhecido.">
        <Texto valor={email} aoMudar={definirEmail} tipo="email" placeholder="paciente@email.com" />
      </Campo>
      <Campo
        rotulo="Condição principal"
        dica="É por aqui que você vai conseguir agrupar as pacientes depois. Preencher agora custa cinco segundos; recuperar depois é impossível."
      >
        <Selecao
          valor={condicao}
          aoMudar={definirCondicao}
          opcoes={[
            { valor: "", rotulo: "Escolha" },
            ...CONDICOES.map((c) => ({ valor: c, rotulo: c })),
            { valor: "Outra", rotulo: "Outra…" },
          ]}
        />
      </Campo>
      {condicao === "Outra" && (
        <Campo rotulo="Qual?">
          <Texto valor={outraCondicao} aoMudar={definirOutraCondicao} placeholder="Escreva" />
        </Campo>
      )}

      <Campo rotulo="Telefone (opcional)">
        <Texto valor={telefone} aoMudar={definirTelefone} placeholder="(11) 90000-0000" />
      </Campo>
      <Campo rotulo="Plano">
        <Selecao
          valor={planoId}
          aoMudar={escolherPlano}
          opcoes={planos.map((p) => ({ valor: p.id, rotulo: `${p.nome} (${p.duracaoDias} dias)` }))}
        />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Início">
          <Texto valor={dataInicio} aoMudar={escolherInicio} tipo="date" />
        </Campo>
        <Campo rotulo="Fim">
          <Texto valor={dataFim} aoMudar={definirDataFim} tipo="date" />
        </Campo>
      </div>
      <Campo rotulo="Observações (opcional)">
        <AreaTexto valor={observacoes} aoMudar={definirObservacoes} linhas={3} />
      </Campo>

      <label className="c-chip" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={enviarConvite}
          onChange={(e) => definirEnviarConvite(e.target.checked)}
        />
        Enviar convite por e-mail agora
      </label>
      <p className="c-dica">
        O convite cria a conta e deixa a pessoa escolher a senha. Ele não libera conteúdo por si:
        o acesso só vale dentro do período acima.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Cadastrar"}
        </button>
      </div>
    </Modal>
  );
}
