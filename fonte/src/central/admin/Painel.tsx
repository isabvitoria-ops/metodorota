import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePacientes } from "@/central/hooks/usePacientes";
import { dataBonita, ordenarPorVencimento, rotuloSituacao } from "@/central/utils/situacao";
import { SeloNeutro, SeloSituacao } from "@/central/components/Selo";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { rotas } from "@/central/rotas";

/**
 * Painel (§23 do briefing).
 *
 * Responde a uma pergunta só, logo na abertura: tem alguém precisando de
 * mim hoje? Por isso a lista de quem está perto de vencer vem antes de
 * qualquer outra coisa — é a única informação que exige ação.
 */
export function Painel() {
  const { pacientes, carregando, carregar } = usePacientes();
  const navegar = useNavigate();

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const contagens = useMemo(() => {
    const por = (situacao: string) => pacientes.filter((p) => p.situacao === situacao).length;
    return {
      ativos: por("ativo") + por("proximo_do_vencimento"),
      vencendo: por("proximo_do_vencimento"),
      expirados: por("expirado"),
      suspensos: por("suspenso"),
      convites: por("convite_pendente"),
      total: pacientes.length,
    };
  }, [pacientes]);

  const atencao = useMemo(
    () =>
      pacientes
        .filter((p) => p.situacao === "proximo_do_vencimento" || p.situacao === "expirado")
        .sort(ordenarPorVencimento),
    [pacientes],
  );

  if (carregando && pacientes.length === 0) {
    return <p className="c-contagem">Carregando…</p>;
  }

  return (
    <>
      <h1 className="c-titulo" style={{ fontSize: 28 }}>
        Painel
      </h1>
      <p className="c-subtitulo">
        {contagens.total === 0
          ? "Nenhum paciente cadastrado ainda."
          : `${contagens.total} ${contagens.total === 1 ? "paciente" : "pacientes"} no total.`}
      </p>

      <div className="c-cartoes" style={{ marginTop: 22 }}>
        <Metrica rotulo="Com acesso" valor={contagens.ativos} />
        <Metrica rotulo="Vencendo" valor={contagens.vencendo} />
        <Metrica rotulo="Expirados" valor={contagens.expirados} />
        <Metrica rotulo="Suspensos" valor={contagens.suspensos} />
        <Metrica rotulo="Convites pendentes" valor={contagens.convites} />
      </div>

      <section className="c-secao">
        <h2 className="c-secao-titulo">Precisam de atenção</h2>
        {atencao.length === 0 ? (
          <EstadoVazio
            icone="relogio"
            titulo="Nada vencendo agora"
            descricao="Quando um acesso estiver perto do fim, ele aparece aqui antes de expirar."
          />
        ) : (
          <div className="c-tabela">
            {atencao.map((paciente) => (
              <div className="c-tabela-linha" key={paciente.id}>
                <button
                  type="button"
                  className="c-tabela-alvo"
                  onClick={() => navegar(rotas.adminPaciente(paciente.id))}
                >
                  <span style={{ flex: 1, minWidth: 160 }}>
                    <span className="c-tabela-nome">{paciente.nome}</span>
                    <span className="c-tabela-apoio">
                      {paciente.situacao === "expirado"
                        ? `Expirou em ${dataBonita(paciente.dataFim)}`
                        : `Vence em ${paciente.diasRestantes} ${paciente.diasRestantes === 1 ? "dia" : "dias"} · ${dataBonita(paciente.dataFim)}`}
                    </span>
                  </span>
                  <span className="c-tabela-coluna">
                    <SeloSituacao situacao={paciente.situacao} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="c-secao">
        <h2 className="c-secao-titulo">Últimos acessos</h2>
        {pacientes.length === 0 ? (
          <p className="c-contagem">Cadastre um paciente para começar.</p>
        ) : (
          <div className="c-tabela">
            {[...pacientes]
              .sort((a, b) => (b.ultimoAcesso ?? "").localeCompare(a.ultimoAcesso ?? ""))
              .slice(0, 6)
              .map((paciente) => (
                <div className="c-tabela-linha" key={paciente.id}>
                  <button
                    type="button"
                    className="c-tabela-alvo"
                    onClick={() => navegar(rotas.adminPaciente(paciente.id))}
                  >
                    <span style={{ flex: 1, minWidth: 160 }}>
                      <span className="c-tabela-nome">{paciente.nome}</span>
                      <span className="c-tabela-apoio">
                        {paciente.ultimoAcesso
                          ? `Entrou em ${dataBonita(paciente.ultimoAcesso.slice(0, 10))}`
                          : "Ainda não entrou"}
                      </span>
                    </span>
                    <span className="c-tabela-coluna">
                      <SeloNeutro>{rotuloSituacao(paciente.situacao)}</SeloNeutro>
                    </span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="c-metrica">
      <p className="c-metrica-rotulo">{rotulo}</p>
      <p className="c-metrica-valor">{valor}</p>
    </div>
  );
}
