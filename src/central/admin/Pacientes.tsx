import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { NovoPaciente, Paciente, Plano } from "@/central/types";
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
 * Gestão de pacientes (§24 do briefing).
 *
 * A lista é a tela de trabalho: procurar, filtrar por situação e abrir a
 * ficha. A ficha abre como modal em cima da lista, e não em outra página,
 * porque a nutricionista quase sempre vai voltar para a lista em seguida —
 * e porque no celular perder o contexto da lista a cada toque cansa.
 */
const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativo", rotulo: "Com acesso" },
  { valor: "proximo_do_vencimento", rotulo: "Vencendo" },
  { valor: "expirado", rotulo: "Expirados" },
  { valor: "suspenso", rotulo: "Suspensos" },
  { valor: "convite_pendente", rotulo: "Convite pendente" },
];

export function Pacientes() {
  const { pacienteId } = useParams();
  const navegar = useNavigate();
  const { pacientes, planos, carregando, erro, carregar } = usePacientes();
  const [consulta, definirConsulta] = useState("");
  const [filtro, definirFiltro] = useState("todos");
  const [criando, definirCriando] = useState(false);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = normalizar(consulta);
    return pacientes.filter((p) => {
      const combinaFiltro =
        filtro === "todos" ||
        p.situacao === filtro ||
        (filtro === "ativo" && p.situacao === "proximo_do_vencimento");
      if (!combinaFiltro) return false;
      if (!termo) return true;
      return normalizar(p.nome).includes(termo) || normalizar(p.email).includes(termo);
    });
  }, [pacientes, consulta, filtro]);

  const aberto = pacienteId ? pacientes.find((p) => p.id === pacienteId) : undefined;

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Pacientes
      </h1>
      <p className="c-subtitulo">Quem tem acesso, até quando, e o que precisa ser renovado.</p>

      <div className="c-barra-acoes">
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
        <div className="c-tabela">
          {visiveis.map((paciente) => (
            <LinhaPaciente
              key={paciente.id}
              paciente={paciente}
              aoAbrir={() => navegar(rotas.adminPaciente(paciente.id))}
            />
          ))}
        </div>
      )}

      {pacientes.length > 0 && visiveis.length === 0 && (
        <p className="c-contagem">Nenhum paciente nesse filtro.</p>
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

function LinhaPaciente({ paciente, aoAbrir }: { paciente: Paciente; aoAbrir: () => void }) {
  return (
    <div className="c-tabela-linha">
      <button type="button" className="c-tabela-alvo" onClick={aoAbrir}>
        <span style={{ flex: 1, minWidth: 170 }}>
          <span className="c-tabela-nome">{paciente.nome}</span>
          <span className="c-tabela-apoio">{paciente.email}</span>
        </span>
        <span className="c-tabela-coluna">
          <span className="c-tabela-apoio" style={{ marginTop: 0 }}>
            {paciente.planoNome ?? "Sem plano"} · até {dataBonita(paciente.dataFim)}
          </span>
        </span>
        <span className="c-tabela-coluna" style={{ minWidth: 130 }}>
          <SeloSituacao situacao={paciente.situacao} />
        </span>
      </button>
    </div>
  );
}

function ModalNovoPaciente({ planos, aoFechar }: { planos: Plano[]; aoFechar: () => void }) {
  const { criar, convidar } = usePacientes();
  const [nome, definirNome] = useState("");
  const [email, definirEmail] = useState("");
  const [telefone, definirTelefone] = useState("");
  const [planoId, definirPlanoId] = useState(planos[0]?.id ?? "");
  const [dataInicio, definirDataInicio] = useState(hojeSaoPaulo());
  const [dataFim, definirDataFim] = useState(somarDias(hojeSaoPaulo(), planos[0]?.duracaoDias ?? 30));
  const [observacoes, definirObservacoes] = useState("");
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

    definirSalvando(true);
    const dados: NovoPaciente = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim() || null,
      planoId: planoId || null,
      dataInicio,
      dataFim,
      observacoes: observacoes.trim() || null,
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
