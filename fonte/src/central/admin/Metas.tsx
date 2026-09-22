import { useCallback, useEffect, useState } from "react";
import type { Paciente } from "@/central/types";
import type { Meta, MetaParaSalvar, StatusDaMeta } from "@/central/types/meta";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto } from "@/central/admin/componentes/Campos";
import { CartaoDeMeta } from "@/central/components/CartaoDeMeta";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * Metas — área da nutricionista.
 *
 * "As metas são individuais e devem ser criadas pelo nutricionista de acordo
 * com cada paciente. Não utilizar uma lista fixa. As metas precisam ser
 * totalmente personalizáveis."
 *
 * Por isso não há catálogo, não há sugestão e não há meta pronta: título,
 * categoria e unidade são campos de texto vazios esperando o que ela quiser
 * escrever. Qualquer lista que eu colocasse aqui seria a lista que faltou no
 * dia em que ela precisou de outra coisa.
 *
 * O PROGRESSO QUE ELA VÊ É O MESMO CARTÃO DA PACIENTE (`CartaoDeMeta`), em
 * modo leitura. Dois desenhos diferentes para o mesmo número acabariam
 * discordando, e a paciente e ela estariam olhando contas diferentes na
 * mesma consulta.
 */
const VAZIA: MetaParaSalvar = {
  titulo: "",
  descricao: "",
  categoria: "",
  frequencia: "diaria",
  alvo: "",
  unidade: "",
  inicio: "",
  prazo: "",
  status: "ativa",
};

export function Metas() {
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [escolhida, definirEscolhida] = useState("");
  const [busca, definirBusca] = useState("");

  useEffect(() => {
    void repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch(() => definirPacientes([]));
  }, []);

  const visiveis = pacientes.filter((p) =>
    busca.trim() ? p.nome.toLowerCase().includes(busca.trim().toLowerCase()) : true,
  );
  const paciente = pacientes.find((p) => p.id === escolhida) ?? null;

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          Metas
        </h1>
        <p className="c-subtitulo">
          O que você combinou com cada paciente, e quanto ela já fez. Cada meta é sua — não há
          lista pronta, você escreve o que quiser acompanhar.
        </p>
      </div>

      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>

      <Campo rotulo="Paciente">
        <Selecao
          valor={escolhida}
          aoMudar={definirEscolhida}
          opcoes={[
            { valor: "", rotulo: "Escolha a paciente" },
            ...visiveis.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
      </Campo>

      {paciente && (
        /* `key` pelo id, pelo mesmo motivo do treino e do protocolo: sem ela,
           trocar de paciente com o formulário aberto deixaria o rascunho de
           uma aparecendo no lugar do da outra — e salvar gravaria a meta
           errada na ficha errada. */
        <PainelDasMetas key={paciente.id} paciente={paciente} />
      )}
    </>
  );
}

function PainelDasMetas({ paciente }: { paciente: Paciente }) {
  const [metas, definirMetas] = useState<Meta[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [editando, definirEditando] = useState<Meta | "nova" | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirMetas(await repositorio.metasDe(paciente.id));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar as metas.");
    } finally {
      definirCarregando(false);
    }
  }, [paciente.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (editando) {
    return (
      <Editor
        paciente={paciente}
        meta={editando === "nova" ? null : editando}
        aoFechar={() => definirEditando(null)}
        aoSalvar={async () => {
          definirEditando(null);
          await carregar();
        }}
      />
    );
  }

  const ativas = metas.filter((m) => m.status === "ativa");
  const resto = metas.filter((m) => m.status !== "ativa");

  return (
    <>
      <div className="c-barra-acoes">
        <button
          type="button"
          className="c-botao c-botao-pequeno"
          onClick={() => definirEditando("nova")}
        >
          Nova meta
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="c-dica">Carregando…</p>
      ) : metas.length === 0 ? (
        <div className="c-bloco">
          <p className="c-item-protocolo-nome">Nenhuma meta para {paciente.nome}</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            Escreva a primeira. Pode ser qualquer coisa que você queira acompanhar entre uma
            consulta e outra — beber água, levar marmita, dormir mais cedo.
          </p>
        </div>
      ) : (
        <>
          {ativas.map((m) => (
            <MetaDaLista key={m.id} meta={m} aoEditar={() => definirEditando(m)} aoMudar={carregar} />
          ))}

          {resto.length > 0 && (
            <section className="c-secao">
              <h2 className="c-secao-titulo">Pausadas e encerradas</h2>
              {resto.map((m) => (
                <MetaDaLista
                  key={m.id}
                  meta={m}
                  aoEditar={() => definirEditando(m)}
                  aoMudar={carregar}
                />
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

function MetaDaLista({
  meta,
  aoEditar,
  aoMudar,
}: {
  meta: Meta;
  aoEditar: () => void;
  aoMudar: () => Promise<void>;
}) {
  const [ocupado, definirOcupado] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [confirmando, definirConfirmando] = useState(false);

  async function mudarStatus(status: StatusDaMeta) {
    definirOcupado(true);
    definirAviso(null);
    try {
      await repositorio.definirStatusMeta(meta.id, status);
      await aoMudar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui mudar.");
    } finally {
      definirOcupado(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Em modo leitura: ela lê o progresso da paciente, não marca por ela.
          Quem marca é quem fez. */}
      <CartaoDeMeta meta={meta} aoMudar={aoMudar} somenteLeitura />

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao c-botao-secundario c-botao-pequeno" onClick={aoEditar}>
          Editar
        </button>

        {meta.status === "ativa" && (
          <>
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              disabled={ocupado}
              onClick={() => void mudarStatus("pausada")}
            >
              Pausar
            </button>
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              disabled={ocupado}
              onClick={() => void mudarStatus("concluida")}
            >
              Concluir
            </button>
          </>
        )}

        {(meta.status === "pausada" || meta.status === "concluida") && (
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            disabled={ocupado}
            onClick={() => void mudarStatus("ativa")}
          >
            Reativar
          </button>
        )}

        {!confirmando ? (
          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            onClick={() => definirConfirmando(true)}
          >
            Apagar
          </button>
        ) : (
          <>
            {/* O que se perde é dito ANTES: apagar leva as marcações junto,
                e pausar existe justamente para não precisar apagar. */}
            <span className="c-dica">
              Apagar leva junto tudo que ela marcou. Pausar guarda. Apagar mesmo?
            </span>
            <button
              type="button"
              className="c-botao c-botao-perigo c-botao-pequeno"
              disabled={ocupado}
              onClick={async () => {
                definirOcupado(true);
                try {
                  await repositorio.excluirMeta(meta.id);
                  await aoMudar();
                } catch (e) {
                  definirAviso(e instanceof Error ? e.message : "Não consegui apagar.");
                  definirOcupado(false);
                }
              }}
            >
              Sim, apagar
            </button>
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              onClick={() => definirConfirmando(false)}
            >
              Não
            </button>
          </>
        )}
      </div>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}
    </div>
  );
}

function Editor({
  paciente,
  meta,
  aoFechar,
  aoSalvar,
}: {
  paciente: Paciente;
  meta: Meta | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [dados, definirDados] = useState<MetaParaSalvar>(() =>
    meta
      ? {
          titulo: meta.titulo,
          descricao: meta.descricao ?? "",
          categoria: meta.categoria ?? "",
          frequencia: meta.frequencia,
          alvo: meta.alvo === null ? "" : String(meta.alvo).replace(".", ","),
          unidade: meta.unidade ?? "",
          inicio: meta.inicio,
          prazo: meta.prazo ?? "",
          status: meta.status,
        }
      : { ...VAZIA, inicio: hojeSaoPaulo() },
  );
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  const mudar = (campo: keyof MetaParaSalvar, valor: string) =>
    definirDados((antes) => ({ ...antes, [campo]: valor }));

  async function salvar() {
    if (dados.titulo.trim() === "") {
      definirAviso("Escreva o título da meta.");
      return;
    }
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.salvarMeta(meta?.id ?? null, paciente.id, dados);
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
      definirSalvando(false);
    }
  }

  return (
    <>
      <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
        {meta ? "Editar meta" : `Nova meta para ${paciente.nome}`}
      </h2>

      <Campo rotulo="O que ela vai fazer" dica="É o que aparece na tela dela.">
        <Texto
          valor={dados.titulo}
          aoMudar={(v) => mudar("titulo", v)}
          placeholder="Beber 2 litros de água"
        />
      </Campo>

      <Campo rotulo="Explicação (opcional)">
        <Texto
          valor={dados.descricao}
          aoMudar={(v) => mudar("descricao", v)}
          placeholder="Espalhar ao longo do dia, sem deixar tudo para a noite."
        />
      </Campo>

      <Campo rotulo="Categoria (opcional)" dica="Serve só para você se organizar.">
        <Texto valor={dados.categoria} aoMudar={(v) => mudar("categoria", v)} placeholder="Hidratação" />
      </Campo>

      <Campo
        rotulo="Conta por"
        dica="Diária conta o dia; semanal conta de segunda a domingo."
      >
        <Selecao
          valor={dados.frequencia}
          aoMudar={(v) => mudar("frequencia", v)}
          opcoes={[
            { valor: "diaria", rotulo: "Dia" },
            { valor: "semanal", rotulo: "Semana" },
          ]}
        />
      </Campo>

      <div className="c-linha-medidas">
        <Campo
          rotulo="Quanto"
          dica="Em branco: a meta vira só 'fez ou não fez'."
        >
          <Texto valor={dados.alvo} aoMudar={(v) => mudar("alvo", v)} placeholder="2" />
        </Campo>
        <Campo rotulo="De quê">
          <Texto valor={dados.unidade} aoMudar={(v) => mudar("unidade", v)} placeholder="litros" />
        </Campo>
      </div>

      <div className="c-linha-medidas">
        <Campo rotulo="Começa em">
          <Texto tipo="date" valor={dados.inicio} aoMudar={(v) => mudar("inicio", v)} />
        </Campo>
        <Campo rotulo="Até (opcional)">
          <Texto tipo="date" valor={dados.prazo} aoMudar={(v) => mudar("prazo", v)} />
        </Campo>
      </div>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : meta ? "Salvar" : "Criar meta"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </>
  );
}
